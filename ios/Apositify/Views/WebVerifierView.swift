import SwiftUI
import UIKit
import WebKit

struct WebSession: Identifiable {
    let id = UUID()
    let route: VerificationRoute
    let title: String
    let fields: [ExtractedField]
    let isPrefilled: Bool
    let hostPolicy: OfficialHostPolicy

    init(route: VerificationRoute, title: String, fields: [ExtractedField], isPrefilled: Bool, entry: RegisterEntry) {
        self.route = route
        self.title = title
        self.fields = fields
        self.isPrefilled = isPrefilled
        hostPolicy = OfficialHostPolicy(entry: entry, initialURL: route.initialURL)
    }
}

private struct AutofillReport: Equatable {
    let filled: Int
    let total: Int
}

struct WebVerifierView: View {
    @Environment(\.dismiss) private var dismiss
    let session: WebSession
    @State private var currentURL: URL?
    @State private var autofillReport: AutofillReport?
    @State private var blockedExternalURL: URL?

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                destinationBar
                if !session.isPrefilled && !session.fields.isEmpty { autofillAssist }
                Divider()
                OfficialWebView(
                    route: session.route,
                    fields: session.isPrefilled ? [] : session.fields,
                    hostPolicy: session.hostPolicy,
                    currentURL: $currentURL,
                    autofillReport: $autofillReport,
                    blockedExternalURL: $blockedExternalURL
                )
            }
            .navigationTitle("Official verifier")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Done") { dismiss() } }
                if let currentURL {
                    ToolbarItem(placement: .primaryAction) {
                        ShareLink(item: currentURL) { Image(systemName: "square.and.arrow.up") }
                    }
                }
            }
        }
        .alert("Leave the official verifier?", isPresented: blockedExternalURLIsPresented, presenting: blockedExternalURL) { url in
            Button("Open in Safari") { UIApplication.shared.open(url) }
            Button("Stay here", role: .cancel) {}
        } message: { url in
            Text("\(url.host ?? url.absoluteString) is not an approved website for this issuing authority. Apositify will not show it with official branding.")
        }
    }

    private var blockedExternalURLIsPresented: Binding<Bool> {
        Binding(
            get: { blockedExternalURL != nil },
            set: { if !$0 { blockedExternalURL = nil } }
        )
    }

    private var destinationBar: some View {
        HStack(spacing: 8) {
            Image(systemName: isCurrentDestinationOfficialAndSecure ? "lock.fill" : "exclamationmark.triangle.fill")
            VStack(alignment: .leading, spacing: 1) {
                Text(session.title).font(.caption.weight(.semibold)).lineLimit(1)
                Text(currentURL?.host ?? "Opening official site…")
                    .font(.caption2.monospaced())
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 9)
        .background(Color(.secondarySystemBackground))
    }

    private var isCurrentDestinationOfficialAndSecure: Bool {
        guard let currentURL else { return false }
        return currentURL.scheme?.lowercased() == "https" && session.hostPolicy.permitsMainFrameNavigation(to: currentURL)
    }

    private var autofillAssist: some View {
        VStack(alignment: .leading, spacing: 5) {
            if let report = autofillReport {
                Label(
                    report.filled == report.total
                        ? "Filled all \(report.total) compatible fields"
                        : "Filled \(report.filled) of \(report.total) fields; tap a value below to copy it",
                    systemImage: report.filled > 0 ? "checkmark.circle.fill" : "hand.tap"
                )
                .font(.caption.weight(.semibold))
                .foregroundStyle(report.filled > 0 ? .green : .secondary)
                .padding(.horizontal, 12)
            } else {
                Text("Waiting for the official form…")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 12)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(session.fields) { field in
                        Button {
                            UIPasteboard.general.string = field.value
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(field.label).font(.caption2).foregroundStyle(.secondary)
                                Label(field.value, systemImage: "doc.on.doc")
                                    .font(.caption.weight(.semibold))
                            }
                            .padding(.horizontal, 11)
                            .padding(.vertical, 7)
                            .background(Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 10))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 12)
            }
        }
        .padding(.vertical, 7)
        .background(Color(.secondarySystemBackground))
    }
}

private struct OfficialWebView: UIViewRepresentable {
    let route: VerificationRoute
    let fields: [ExtractedField]
    let hostPolicy: OfficialHostPolicy
    @Binding var currentURL: URL?
    @Binding var autofillReport: AutofillReport?
    @Binding var blockedExternalURL: URL?

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        if let script = autofillScript {
            configuration.userContentController.addUserScript(WKUserScript(
                source: script,
                injectionTime: .atDocumentEnd,
                forMainFrameOnly: true
            ))
            configuration.userContentController.add(context.coordinator, name: "apostilleAutofill")
        }
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true

        switch route {
        case .get(let url), .official(let url):
            webView.load(URLRequest(url: url))
        case .post(let request):
            webView.load(request)
        case .externalInsecure:
            webView.loadHTMLString("<main style='font: -apple-system-body; padding: 2rem'><h2>This site requires an external browser</h2><p>Apositify never loads unencrypted HTTP verifiers inside its branded verification view.</p></main>", baseURL: nil)
        case .unavailable:
            webView.loadHTMLString("<main style='font: -apple-system-body; padding: 2rem'><h2>No online route is available</h2><p>Contact the issuing authority using the instructions in Apositify.</p></main>", baseURL: nil)
        }
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        let parent: OfficialWebView

        init(parent: OfficialWebView) { self.parent = parent }

        func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
            parent.currentURL = webView.url
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            parent.currentURL = webView.url
            if let script = parent.autofillScript {
                webView.evaluateJavaScript(script)
            }
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "apostilleAutofill",
                  let payload = message.body as? [String: Any],
                  let filled = payload["filled"] as? Int,
                  let total = payload["total"] as? Int else { return }
            parent.autofillReport = AutofillReport(filled: filled, total: total)
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }
            if let scheme = url.scheme?.lowercased(), !["https", "http", "about"].contains(scheme) {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            // Subframes are deliberately not held to the allowlist. Real
            // verifiers embed third-party CAPTCHA widgets and lazy-load their
            // search form in an iframe, so gating subframes would silently break
            // verification on those authorities. The isolation that matters is
            // kept elsewhere: reviewed values only ever reach the main frame
            // (the autofill script is main-frame-only in both injection paths),
            // the same-origin policy stops a subframe reading the page around
            // it, and the destination bar reports the main frame — as a
            // browser's address bar does. A hostile subframe therefore requires
            // the official page itself to embed it, at which point the main
            // frame is already compromised.
            let isMainFrame = navigationAction.targetFrame?.isMainFrame ?? true
            if isMainFrame && !parent.hostPolicy.permitsMainFrameNavigation(to: url) {
                parent.blockedExternalURL = url
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }

        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            // Government verifiers often use target="_blank" for their result
            // page. Keep that navigation in the same trusted-site view.
            if navigationAction.targetFrame == nil,
               let url = navigationAction.request.url,
               parent.hostPolicy.permitsMainFrameNavigation(to: url) {
                webView.load(navigationAction.request)
            } else if let url = navigationAction.request.url {
                parent.blockedExternalURL = url
            }
            return nil
        }
    }

    private var autofillScript: String? {
        guard !fields.isEmpty,
              route.initialURL?.scheme?.lowercased() == "https",
              let host = route.initialURL?.host?.lowercased() else { return nil }
        let payload: [[String: Any]] = fields.map {
            [
                "id": $0.id,
                "label": $0.label,
                "value": $0.value,
                "isoDate": $0.isoDate ?? NSNull(),
                "aliases": $0.aliases,
                "selectors": $0.browserSelectors
            ]
        }
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else { return nil }
        return Self.javascript(fieldsJSON: json, allowedHost: host)
    }

    private static func javascript(fieldsJSON: String, allowedHost: String) -> String {
        """
        (() => {
          const fields = \(fieldsJSON);
          const allowedHost = \(String(reflecting: allowedHost));
          const notify = (filled) => window.webkit?.messageHandlers?.apostilleAutofill?.postMessage({filled, total: fields.length});
          if (location.hostname.toLowerCase() !== allowedHost) { notify(0); return; }
          const state = window.__apositifyAutofillState || {filledIds: new Set(), observer: null, timer: null};
          window.__apositifyAutofillState = state;
          state.observer?.disconnect();
          if (state.timer) clearTimeout(state.timer);
          const normalize = value => (value || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/[^\\p{L}\\p{N}]+/gu, ' ').trim();
          const labelText = el => {
            const explicit = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null;
            return [explicit?.innerText, el.closest('label')?.innerText, el.getAttribute('aria-label'), el.placeholder, el.name, el.id].filter(Boolean).join(' ');
          };
          const dateValue = (field, el) => {
            if (!field.isoDate) return field.value;
            if ((el.type || '').toLowerCase() === 'date') return field.isoDate;
            const [year, month, day] = field.isoDate.split('-');
            const hint = `${el.placeholder || ''} ${el.getAttribute('aria-label') || ''}`.toUpperCase();
            if (hint.includes('DD.MM')) return `${day}.${month}.${year}`;
            if (hint.includes('DD/MM')) return `${day}/${month}/${year}`;
            if (hint.includes('MM/DD')) return `${month}/${day}/${year}`;
            if (hint.includes('DD-MM')) return `${day}-${month}-${year}`;
            return field.value;
          };
          const setValue = (el, value) => {
            if (el.tagName === 'SELECT') {
              const target = normalize(value);
              const option = [...el.options].find(item => normalize(item.value) === target || normalize(item.text) === target);
              if (!option) return false;
              el.value = option.value;
            } else {
              const prototype = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
              const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
              setter ? setter.call(el, value) : (el.value = value);
            }
            el.dispatchEvent(new Event('input', {bubbles: true}));
            el.dispatchEvent(new Event('change', {bubbles: true}));
            el.dispatchEvent(new Event('blur', {bubbles: true}));
            return true;
          };
          const attempt = () => {
            const controls = [...document.querySelectorAll('input:not([type=hidden]):not([type=file]):not([type=password]), select, textarea')]
              .filter(el => !el.disabled && !el.readOnly && !el.value && !/captcha|recaptcha|turnstile/i.test(`${el.id} ${el.name} ${el.className} ${el.getAttribute('aria-label') || ''}`));
            const claimed = new Set();
            for (const field of fields) {
              if (state.filledIds.has(field.id)) continue;
              let control = null;
              for (const selector of field.selectors || []) {
                try { const match = document.querySelector(selector); if (match && controls.includes(match)) { control = match; break; } } catch (_) {}
              }
              if (!control) {
                const aliases = (field.aliases || [field.label]).map(normalize).filter(Boolean);
                control = controls
                  .filter(el => !claimed.has(el))
                  .map(el => {
                    const signal = normalize(labelText(el));
                    const id = normalize(field.id);
                    let score = aliases.reduce((best, alias) => Math.max(best, signal.includes(alias) ? 100 + alias.length : 0), 0);
                    if (id && signal.replace(/ /g, '').includes(id.replace(/ /g, ''))) score += 60;
                    return {el, score};
                  })
                  .filter(item => item.score >= 100)
                  .sort((a, b) => b.score - a.score)[0]?.el || null;
              }
              if (control && setValue(control, dateValue(field, control))) {
                claimed.add(control);
                state.filledIds.add(field.id);
              }
            }
            notify(state.filledIds.size);
          };
          attempt();
          let pending = null;
          state.observer = new MutationObserver(() => {
            clearTimeout(pending);
            pending = setTimeout(attempt, 120);
          });
          state.observer.observe(document.documentElement, {childList: true, subtree: true});
          state.timer = setTimeout(() => state.observer?.disconnect(), 10000);
        })();
        """
    }
}
