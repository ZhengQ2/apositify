import UIKit
import XCTest
@testable import Apositify

/// Runs the specimen corpus through the app's own recognition path on an
/// attached iPhone. Apple Vision on the device is not the Vision that runs on a
/// Mac — different OS, different models — so the host-side suite in
/// `ApositifySampleTests` cannot stand in for this.
///
/// Specimen photographs are private and are never committed. Populate them with
/// `npm run prepare:ios-device-specimens`; every test skips when they are absent.
@MainActor
final class DeviceSpecimenTests: XCTestCase {
    private lazy var entries = RegisterStore(bundle: .main).entries

    private func specimen(_ name: String) throws -> UIImage {
        let base = (name as NSString).deletingPathExtension
        let ext = (name as NSString).pathExtension
        guard let url = Bundle(for: Self.self).url(forResource: "Specimens/\(base)", withExtension: ext) else {
            throw XCTSkip("Specimen \(name) is not bundled on this machine")
        }
        return try ApostilleRecognizer.preparedImage(fromEncodedFileAt: url)
    }

    private func analyze(_ name: String) async throws -> ScanAnalysis {
        try await ApostilleRecognizer().analyze(image: try specimen(name), entries: entries)
    }

    /// The text reading of a specimen, taken through the app's own recognizer.
    ///
    /// QR routing short-circuits `analyze` before any text is read, which would
    /// leave the text path on a third of the corpus untested on the device. The
    /// router matches payloads against the entries it is given, so recognizing
    /// against none of them takes the same code down the text branch — which is
    /// exactly what the app itself does when a QR is damaged or unreadable.
    private func recognition(_ name: String) async throws -> RecognitionResult {
        let outcome = try await ApostilleRecognizer()
            .analyze(image: try specimen(name), entries: [])
            .outcome
        switch outcome {
        case .text(let recognition, _): return recognition
        case .qr(let match): throw XCTSkip("\(name) unexpectedly routed to \(match.entry.id)")
        }
    }

    private func fields(_ name: String, _ authorityId: String) async throws -> [String: ExtractedField] {
        let recognition = try await recognition(name)
        let entry = try XCTUnwrap(entries.first { $0.id == authorityId })
        return Dictionary(
            uniqueKeysWithValues: ApostilleParser.extractFields(for: entry, from: recognition).map { ($0.id, $0) }
        )
    }

    private func topAuthority(_ name: String) async throws -> RegisterEntry? {
        AuthorityMatcher(entries: entries).matches(for: try await recognition(name)).first?.entry
    }

    // MARK: - Values printed on the certificates

    func testCostaRicaReadsItsSpanishLabelledCode() async throws {
        let costaRica = try await topAuthority("costa-rica.png")
        XCTAssertEqual(costaRica?.country, "Costa Rica")
        let extracted = try await fields("costa-rica.png", "costa-rica-ministry-of-foreign-affairs-and-worship")
        XCTAssertEqual(extracted["apostilleCode"]?.value, "NCDXATKNWGC")
        // Costa Rica's is the one field in the catalogue that must submit ISO,
        // so 12/07/2019 genuinely has to be interpreted. Costa Rica writes
        // dates day-first and nothing on the page contradicts that.
        XCTAssertEqual(extracted["apostilleDate"]?.value, "2019-07-12")
    }

    func testChileSubmitsValuesWithoutTheirPrintedWrappers() async throws {
        let chile = "chile-relevant-authorities-of-the-ministries-of-justice-education-health-foreign-affairs-and-the-civil-and-identification-registration-service"
        let extracted = try await fields("chile.png", chile)
        XCTAssertEqual(extracted["field-1"]?.value, "28-10-2016")
        XCTAssertEqual(extracted["field-2"]?.value, "2E0387744D")
        let number = try XCTUnwrap(extracted["field-0"])
        XCTAssertTrue(
            number.value == "EAC42604" || number.suggestedValues.first == "EAC42604",
            "expected EAC42604, got '\(number.value)' \(number.suggestedValues)"
        )
    }

    func testJapanReadsThroughAWatermarkedPhoto() async throws {
        let japan = try await topAuthority("japan.jpg")
        XCTAssertEqual(japan?.id, "japan-ministry-of-foreign-affairs")
        let extracted = try await fields("japan.jpg", "japan-ministry-of-foreign-affairs")
        XCTAssertEqual(extracted["field-2"]?.value, "758GBU")
        XCTAssertEqual(extracted["field-1"]?.isoDate, "2026-07-10")
        let number = try XCTUnwrap(extracted["field-0"])
        XCTAssertTrue(
            number.value == "26028925" || number.suggestedValues.first == "26028925",
            "expected 26028925, got '\(number.value)' \(number.suggestedValues)"
        )
    }

    func testHongKongIsNotReadAsIndia() async throws {
        let hongKong = "china-hong-kong-sar-the-registrar-the-senior-deputy-registrar-and-the-deputy-registrar-of-the-high-court"
        let top = try await topAuthority("hong-kong.JPG")
        XCTAssertEqual(top?.id, hongKong)
        let extracted = try await fields("hong-kong.JPG", hongKong)
        XCTAssertEqual(extracted["field-1"]?.value, "", "the Year field must not take the word after its label")
        XCTAssertEqual(extracted["field-2"]?.value, "", "the Reference Code is redacted on this specimen")
    }

    func testUnitedKingdomIsNotIrelandAndAFeeIsNotANumber() async throws {
        let unitedKingdom = try await topAuthority("bahrain.png")
        XCTAssertEqual(unitedKingdom?.country, "United Kingdom")
        let extracted = try await fields("bahrain.png", "united-kingdom-foreign-and-commonwealth-office")
        for field in extracted.values {
            XCTAssertNotEqual(field.value, "GBP40.00", "a fee must never be submitted as a certificate value")
        }
    }

    func testChinaReadsItsTwelveDigitNumber() async throws {
        for name in ["china.jpg", "china.jpeg"] {
            let extracted = try await fields(name, "china-china-mainland-ministry-of-foreign-affairs")
            XCTAssertEqual(extracted["apostilleNumber"]?.value, "263600004721", "\(name)")
        }
    }

    func testOntarioReadsItsNumberAndDateInEveryOrientation() async throws {
        let ontario = "canada-ministry-of-public-and-business-service-delivery-and-procurement-of-the-province-of-ontario"
        for name in [
            "ontario-user-sample.jpg",
            "ontario-user-sample-landscape.jpg",
            "ontario-user-sample-landscape-opposite.jpg"
        ] {
            let extracted = try await fields(name, ontario)
            XCTAssertEqual(extracted["field-0"]?.value, "ON-26-506237-8785", "\(name)")
            XCTAssertEqual(extracted["field-1"]?.isoDate, "2026-06-19", "\(name)")
        }
    }

    /// Several specimens have item 8 blacked out, so a blank field there proves
    /// nothing. `npm run prepare:redaction-fixtures` renders a known value onto
    /// the item's own row and these assert that exact value comes back.
    func testRedactionFilledSpecimensReturnTheValueWrittenIntoThem() async throws {
        let uk = try await fields("bahrain-filled.png", "united-kingdom-foreign-and-commonwealth-office")
        XCTAssertEqual(uk["field-1"]?.value, "APO-2209051234")

        let hongKong = "china-hong-kong-sar-the-registrar-the-senior-deputy-registrar-and-the-deputy-registrar-of-the-high-court"
        let hongKongFields = try await fields("hong-kong-filled.png", hongKong)
        let number = try XCTUnwrap(hongKongFields["field-0"])
        XCTAssertTrue(
            number.value == "2781234" || number.suggestedValues.first == "2781234",
            "expected 2781234, got '\(number.value)' \(number.suggestedValues)"
        )
    }

    /// Reports what every bundled specimen produces, so a regression in one that
    /// nobody has written expectations for is still visible in the test output.
    func testSweepEveryBundledSpecimen() async throws {
        let directory = try XCTUnwrap(Bundle(for: Self.self).resourcePath).appending("/Specimens")
        let names = ((try? FileManager.default.contentsOfDirectory(atPath: directory)) ?? [])
            .filter { ["png", "jpg", "jpeg", "JPG", "heic", "webp"].contains(($0 as NSString).pathExtension) }
            .sorted()
        try XCTSkipIf(names.isEmpty, "No specimens are bundled on this machine")

        for name in names {
            guard let analysis = try? await analyze(name) else {
                print("SPECIMEN \(name): unreadable")
                continue
            }
            switch analysis.outcome {
            case .qr(let match):
                print("SPECIMEN \(name): qr -> \(match.entry.id)")
            case .text(let recognition, let payloads):
                let matches = AuthorityMatcher(entries: entries).matches(for: recognition)
                var summary = "SPECIMEN \(name): lines=\(recognition.lines.count) unroutedQr=\(payloads.count)"
                summary += " authority=\(matches.first?.entry.id ?? "none")"
                if let entry = matches.first?.entry {
                    summary += ApostilleParser.extractFields(for: entry, from: recognition)
                        .map { " [\($0.id)='\($0.value)' \($0.suggestedValues)]" }
                        .joined()
                }
                print(summary)
            }
        }
    }
}
