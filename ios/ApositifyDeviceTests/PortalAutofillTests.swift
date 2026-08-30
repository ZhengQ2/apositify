import UIKit
import WebKit
import XCTest
@testable import Apositify

/// Loads each authority's verification portal in a real WKWebView on the
/// attached iPhone and injects the script the app actually ships, to report how
/// many of that authority's fields the page would accept.
///
/// This is a survey, not a pass/fail gate. The portals are live third-party
/// sites: they change, they rate-limit, and several are unreachable from any
/// given network, so failing the build on their behaviour would make the suite
/// lie about the app. Nothing is ever submitted — the script fills controls in
/// the page and the test reads them back.
@MainActor
final class PortalAutofillTests: XCTestCase {
    private lazy var entries = RegisterStore(bundle: .main).entries

    func testReportsWhichPortalsAcceptTheReviewedValues() async throws {
        let targets = entries.filter { entry in
            entry.verification?.kind == .fields && entry.registerUrl?.scheme?.lowercased() == "https"
        }
        var totals: [String: Int] = [:]

        for entry in targets {
            let fields = probeFields(for: entry)
            guard !fields.isEmpty, let url = entry.registerUrl,
                  let host = url.host?.lowercased(),
                  let script = PortalAutofill.script(fields: fields, allowedHost: host) else {
                record(&totals, "no-document-fields", entry, 0, 0, 0)
                continue
            }

            let outcome = await fill(url: url, script: script, fields: fields)
            let status: String
            switch (outcome.controls, outcome.filled) {
            case (0, _): status = "no-controls"
            case (_, fields.count): status = "all-filled"
            case (_, 0): status = "none-matched"
            default: status = "partial"
            }
            record(&totals, status, entry, outcome.filled, fields.count, outcome.controls)
        }

        print("--- " + totals.sorted { $0.value > $1.value }.map { "\($0.key): \($0.value)" }.joined(separator: ", "))
    }

    private struct Outcome {
        let filled: Int
        let controls: Int
    }

    /// Values shaped like the real thing, so nothing real is typed into a live form.
    private func probeFields(for entry: RegisterEntry) -> [ExtractedField] {
        (entry.verification?.fields ?? [])
            .filter { $0.captureSource == .document }
            .map { config in
                ExtractedField(
                    id: config.id,
                    label: config.label,
                    value: config.standardItem == 6 ? "19/06/2026" : "PROBE-0000-0000",
                    confidence: 1,
                    sourceText: nil,
                    isoDate: config.standardItem == 6 ? "2026-06-19" : nil,
                    suggestedValues: [],
                    aliases: config.aliases,
                    browserSelectors: config.browserSelectors,
                    captureSource: config.captureSource
                )
            }
    }

    private func fill(url: URL, script: String, fields: [ExtractedField]) async -> Outcome {
        let configuration = WKWebViewConfiguration()
        let webView = WKWebView(frame: CGRect(x: 0, y: 0, width: 390, height: 844), configuration: configuration)
        // A WKWebView outside the view hierarchy is throttled and may never lay
        // out, which reports a page as having no controls when it simply had not
        // rendered. Borrow the host app's own window rather than making a second
        // one, which the app's scene will not tolerate.
        let window = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first { $0.isKeyWindow } ?? UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows).first
        window?.addSubview(webView)
        defer { webView.removeFromSuperview() }
        let loader = Loader()
        webView.navigationDelegate = loader
        webView.load(URLRequest(url: url, timeoutInterval: 20))
        await loader.finished()
        // Single-page verifiers mount their form after load; the app's own
        // script re-runs on mutation, so give the page the same chance here.
        try? await Task.sleep(nanoseconds: 2_500_000_000)

        let controls = (try? await webView.evaluateJavaScript(
            "document.querySelectorAll('input:not([type=hidden]), select, textarea').length"
        )) as? Int ?? 0
        _ = try? await webView.evaluateJavaScript(script)
        let wanted = fields.map(\.value)
        let counter = """
        (() => {
          const wanted = \(wanted.map { "\"\($0)\"" }.joined(separator: ",").isEmpty ? "" : "[" + wanted.map { "\"\($0)\"" }.joined(separator: ",") + "]");
          const seen = [...document.querySelectorAll('input, select, textarea')].map(el => el.value);
          return wanted.filter(value => seen.includes(value)).length;
        })();
        """
        let filled = (try? await webView.evaluateJavaScript(counter)) as? Int ?? 0
        return Outcome(filled: filled, controls: controls)
    }

    private func record(
        _ totals: inout [String: Int],
        _ status: String,
        _ entry: RegisterEntry,
        _ filled: Int,
        _ total: Int,
        _ controls: Int
    ) {
        totals[status, default: 0] += 1
        let country = String(entry.country.prefix(20)).padding(toLength: 20, withPad: " ", startingAt: 0)
        print("\(status.padding(toLength: 26, withPad: " ", startingAt: 0))\(country)\(filled)/\(total) fields, \(controls) controls  \(entry.id.prefix(46))")
    }

    /// Resumes once the main frame settles, however it settles.
    private final class Loader: NSObject, WKNavigationDelegate {
        private var continuation: CheckedContinuation<Void, Never>?
        private var settled = false

        func finished() async {
            if settled { return }
            await withCheckedContinuation { continuation in
                self.continuation = continuation
                Task { @MainActor in
                    try? await Task.sleep(nanoseconds: 20_000_000_000)
                    self.settle()
                }
            }
        }

        private func settle() {
            guard !settled else { return }
            settled = true
            continuation?.resume()
            continuation = nil
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { settle() }
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { settle() }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { settle() }
    }
}
