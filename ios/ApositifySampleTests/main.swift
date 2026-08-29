import AppKit
import Foundation
import ImageIO
import Vision

private struct FixtureCatalog: Decodable {
    let samples: [SampleFixture]
}

private struct SampleFixture: Decodable {
    let id: String
    let description: String
    let authorityId: String?
    let languages: [String]
    let anchors: [String]
    let minimumAnchorMatches: Int?
    let qrAuthorityId: String?
    /// Every QR the sample carries must be refused. Used for specimens whose
    /// published code points somewhere the authority's route does not cover.
    let qrMustNotRoute: Bool?
    let lines: [String]?
    let expectedItems: [ExpectedItem]?
    let expectedFields: [ExpectedField]?
    /// Artificial fixtures in scripts Apple Vision may not recognize on this
    /// OS. They skip rather than fail when the text cannot be read; the same
    /// parsing is asserted deterministically in the core suite.
    let optional: Bool?
}

private struct ExpectedItem: Decodable {
    let item: Int
    let exact: String?
    let contains: String?
    let pattern: String?
    let isoDate: String?
}

private struct ExpectedField: Decodable {
    let id: String
    let exact: String?
    let contains: String?
    let pattern: String?
    let isoDate: String?
    /// The field must come back empty and carry no browser-fill date. Used
    /// where guessing is worse than asking the user.
    let absent: Bool?
}

private var failures = 0
private var passes = 0
private var skips = 0
private var requiredPasses = 0

private func fail(_ fixture: SampleFixture, _ message: String) {
    failures += 1
    fputs("FAIL \(fixture.id): \(message)\n", stderr)
}

private func render(_ lines: [String]) -> CGImage? {
    let width = 1800
    let height = 2400
    guard let representation = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: width,
        pixelsHigh: height,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    ), let context = NSGraphicsContext(bitmapImageRep: representation) else { return nil }

    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    NSColor.white.setFill()
    NSRect(x: 0, y: 0, width: width, height: height).fill()

    let paragraph = NSMutableParagraphStyle()
    paragraph.lineBreakMode = .byWordWrapping
    let attributes: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: 43, weight: .regular),
        .foregroundColor: NSColor.black,
        .paragraphStyle: paragraph
    ]
    var y = CGFloat(height - 150)
    for line in lines {
        let rect = NSRect(x: 115, y: y - 88, width: CGFloat(width - 230), height: 112)
        (line as NSString).draw(with: rect, options: [.usesLineFragmentOrigin, .usesFontLeading], attributes: attributes)
        y -= 128
    }
    context.flushGraphics()
    NSGraphicsContext.restoreGraphicsState()
    return representation.cgImage
}

private func loadImage(at url: URL) -> CGImage? {
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
    return CGImageSourceCreateImageAtIndex(source, 0, nil)
}

private func recognize(_ image: CGImage, languages: [String]) throws -> RecognitionResult {
    if ProcessInfo.processInfo.environment["APOSITIFY_FORCE_VISION_FAILURE"] == "1" {
        throw NSError(domain: "ApositifySampleTests", code: 1, userInfo: [
            NSLocalizedDescriptionKey: "Forced Vision unavailability regression"
        ])
    }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.automaticallyDetectsLanguage = true
    request.minimumTextHeight = 0.006
    request.customWords = ["Apostille", "Apostilla", "Apostila", "Apostillenummer"]
    let supported = try request.supportedRecognitionLanguages()
    request.recognitionLanguages = languages.filter(supported.contains)
    try VNImageRequestHandler(cgImage: image).perform([request])

    let lines = (request.results ?? []).compactMap { observation -> RecognizedLine? in
        guard let candidate = observation.topCandidates(1).first else { return nil }
        let box = observation.boundingBox
        return RecognizedLine(
            text: candidate.string,
            confidence: candidate.confidence,
            bounds: NormalizedRect(
                x: box.origin.x,
                y: box.origin.y,
                width: box.width,
                height: box.height
            )
        )
    }
    .sorted {
        let rowDifference = abs($0.bounds.y - $1.bounds.y)
        if rowDifference < 0.012 { return $0.bounds.x < $1.bounds.x }
        return $0.bounds.y > $1.bounds.y
    }
    return RecognitionResult(lines: lines)
}

private func qrPayloads(in image: CGImage) throws -> [String] {
    let request = VNDetectBarcodesRequest()
    request.symbologies = [.qr]
    try VNImageRequestHandler(cgImage: image).perform([request])
    return Array(Set((request.results ?? []).compactMap(\.payloadStringValue)))
}

private func matches(_ pattern: String, in value: String) -> Bool {
    value.range(of: pattern, options: [.regularExpression, .caseInsensitive]) != nil
}

private func test(
    _ fixture: SampleFixture,
    image: CGImage,
    entries: [RegisterEntry],
    optionalUnreadable: Bool
) {
    let recognition: RecognitionResult
    do {
        recognition = try recognize(image, languages: fixture.languages)
    } catch {
        if optionalUnreadable {
            skips += 1
            print("SKIP \(fixture.id): Vision could not read the sample")
        } else {
            fail(fixture, "Vision failed: \(error.localizedDescription)")
        }
        return
    }

    let fullText = recognition.fullText
    if ProcessInfo.processInfo.environment["APOSITIFY_OCR_DEBUG"] == "1" {
        print("OCR \(fixture.id):\n\(fullText)\n---")
    }
    let anchorMatches = fixture.anchors.filter { matches($0, in: fullText) }.count
    let minimum = fixture.minimumAnchorMatches ?? fixture.anchors.count
    guard !recognition.lines.isEmpty, anchorMatches >= minimum else {
        if optionalUnreadable {
            skips += 1
            print("SKIP \(fixture.id): OCR readable anchors \(anchorMatches)/\(fixture.anchors.count), need \(minimum)")
        } else {
            fail(fixture, "OCR readable anchors \(anchorMatches)/\(fixture.anchors.count), need \(minimum)")
        }
        return
    }

    let numberedItems = ApostilleParser.numberedItems(in: recognition.lines)
    for expected in fixture.expectedItems ?? [] {
        guard let actual = numberedItems[expected.item] else {
            fail(fixture, "missing standard item \(expected.item)")
            return
        }
        if let exact = expected.exact, actual != exact {
            fail(fixture, "item \(expected.item) expected '\(exact)', got '\(actual)'")
            return
        }
        if let contains = expected.contains, !actual.contains(contains) {
            fail(fixture, "item \(expected.item) expected to contain '\(contains)', got '\(actual)'")
            return
        }
        if let pattern = expected.pattern, !matches(pattern, in: actual) {
            fail(fixture, "item \(expected.item) did not match its expected format; got '\(actual)'")
            return
        }
        if let isoDate = expected.isoDate, ApostilleParser.isoDate(from: actual) != isoDate {
            fail(fixture, "item \(expected.item) expected ISO date \(isoDate), got '\(actual)'")
            return
        }
    }

    if fixture.qrAuthorityId != nil || fixture.qrMustNotRoute == true {
        let payloads: [String]
        do {
            payloads = try qrPayloads(in: image)
        } catch {
            fail(fixture, "QR detection failed: \(error.localizedDescription)")
            return
        }
        if let qrAuthorityId = fixture.qrAuthorityId {
            guard payloads.count == 1,
                  QrRouter.match(payloads[0], entries: entries)?.entry.id == qrAuthorityId else {
                fail(fixture, "QR did not match its specimen-verified authority")
                return
            }
        }
        if fixture.qrMustNotRoute == true {
            guard !payloads.isEmpty else {
                fail(fixture, "expected to decode a QR that must not route, found none")
                return
            }
            if let routed = payloads.first(where: { QrRouter.match($0, entries: entries) != nil }) {
                fail(fixture, "a QR outside the authority's documented route was accepted: \(routed.prefix(60))")
                return
            }
        }
    }

    if let authorityId = fixture.authorityId {
        let authorityMatches = AuthorityMatcher(entries: entries).matches(for: recognition)
        guard authorityMatches.first?.entry.id == authorityId else {
            fail(fixture, "expected authority \(authorityId), got \(authorityMatches.first?.entry.id ?? "none")")
            return
        }

        guard let entry = entries.first(where: { $0.id == authorityId }) else {
            fail(fixture, "authority is missing from the catalog")
            return
        }
        let fields = ApostilleParser.extractFields(for: entry, from: recognition)
        for expected in fixture.expectedFields ?? [] {
            guard let actual = fields.first(where: { $0.id == expected.id }) else {
                fail(fixture, "missing field \(expected.id)")
                return
            }
            if expected.absent == true, !actual.value.isEmpty || actual.isoDate != nil {
                fail(fixture, "\(expected.id) must stay empty, got '\(actual.value)' iso=\(actual.isoDate ?? "none")")
                return
            }
            if let exact = expected.exact, actual.value != exact {
                fail(fixture, "\(expected.id) expected '\(exact)', got '\(actual.value)'")
                return
            }
            if let contains = expected.contains, !actual.value.contains(contains) {
                fail(fixture, "\(expected.id) expected to contain '\(contains)', got '\(actual.value)'")
                return
            }
            if let pattern = expected.pattern, !matches(pattern, in: actual.value) {
                fail(fixture, "\(expected.id) did not match its expected format")
                return
            }
            if let isoDate = expected.isoDate, actual.isoDate != isoDate {
                fail(fixture, "\(expected.id) expected ISO date \(isoDate), got \(actual.isoDate ?? "none")")
                return
            }
        }
    }

    // Line order is the one input that moves between scans of the same page: a
    // slightly different angle re-orders a two-column certificate and used to
    // change what was extracted. Every reading below must therefore be
    // invariant under reordering, or the app is intermittent in the field.
    if !reorderingIsStable(fixture, recognition: recognition, entries: entries) { return }

    passes += 1
    if !optionalUnreadable { requiredPasses += 1 }
    print("PASS \(fixture.id): \(recognition.lines.count) OCR lines")
}

private func reorderingIsStable(
    _ fixture: SampleFixture,
    recognition: RecognitionResult,
    entries: [RegisterEntry]
) -> Bool {
    let baselineItems = ApostilleParser.numberedItems(in: recognition.lines)
    let entry = fixture.authorityId.flatMap { id in entries.first { $0.id == id } }
    let baselineFields = entry.map { ApostilleParser.extractFields(for: $0, from: recognition) } ?? []

    let orderings: [(String, [RecognizedLine])] = [
        ("reversed", recognition.lines.reversed()),
        ("interleaved", stride(from: 0, to: 2, by: 1).flatMap { offset in
            stride(from: offset, to: recognition.lines.count, by: 2).map { recognition.lines[$0] }
        }),
        ("rotated", Array(recognition.lines.dropFirst(3) + recognition.lines.prefix(3)))
    ]

    for (label, lines) in orderings {
        let reordered = RecognitionResult(lines: lines)
        for expected in fixture.expectedItems ?? [] {
            let value = ApostilleParser.numberedItems(in: reordered.lines)[expected.item]
            if value != baselineItems[expected.item] {
                fail(fixture, "item \(expected.item) changed under \(label) line order: '\(baselineItems[expected.item] ?? "none")' then '\(value ?? "none")'")
                return false
            }
        }
        guard let entry else { continue }
        let fields = ApostilleParser.extractFields(for: entry, from: reordered)
        for expected in fixture.expectedFields ?? [] {
            let before = baselineFields.first { $0.id == expected.id }?.value
            let after = fields.first { $0.id == expected.id }?.value
            if before != after {
                fail(fixture, "\(expected.id) changed under \(label) line order: '\(before ?? "none")' then '\(after ?? "none")'")
                return false
            }
        }
    }
    return true
}

guard CommandLine.arguments.count >= 3 else {
    fputs("Usage: ApositifySampleTests <e-registers.json> <sample-fixtures.json> [official-samples.json cache-directory]\n", stderr)
    exit(2)
}

let decoder = JSONDecoder()
let catalog = try decoder.decode(
    RegisterCatalog.self,
    from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
)
private let synthetic = try decoder.decode(
    FixtureCatalog.self,
    from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[2]))
)

for fixture in synthetic.samples {
    guard let sourceLines = fixture.lines, let image = render(sourceLines) else {
        fail(fixture, "could not render the artificial sample")
        continue
    }
    test(fixture, image: image, entries: catalog.entries, optionalUnreadable: fixture.optional ?? false)
}

if CommandLine.arguments.count >= 5 {
    let official = try decoder.decode(
        FixtureCatalog.self,
        from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[3]))
    )
    let cache = URL(fileURLWithPath: CommandLine.arguments[4], isDirectory: true)
    for fixture in official.samples {
        let imageURL = cache.appendingPathComponent(fixture.id).appendingPathExtension("png")
        guard FileManager.default.fileExists(atPath: imageURL.path) else {
            skips += 1
            print("SKIP \(fixture.id): official sample is not cached")
            continue
        }
        guard let image = loadImage(at: imageURL) else {
            skips += 1
            print("SKIP \(fixture.id): cached sample is not a readable image")
            continue
        }
        test(fixture, image: image, entries: catalog.entries, optionalUnreadable: true)
    }
}

if !synthetic.samples.isEmpty, requiredPasses == 0 {
    failures += 1
    fputs("FAIL: no required synthetic OCR fixture executed successfully\n", stderr)
}

print("Apositify sample OCR tests: \(passes) passed, \(skips) skipped, \(failures) failed")
exit(failures == 0 ? 0 : 1)
