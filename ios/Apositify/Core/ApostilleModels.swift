import Foundation

struct RegisterCatalog: Decodable {
    let schemaVersion: Int
    let sourceUrl: URL
    let entries: [RegisterEntry]
}

struct RegisterEntry: Decodable, Identifiable, Hashable {
    let id: String
    let country: String
    let authority: String
    let registerUrl: URL?
    let verificationMode: VerificationMode
    let notes: String
    let registerLinks: [RegisterLink]
    let registerGuide: RegisterGuide?
    let qrRoutes: [QrRoute]
    let verification: VerificationConfig?
}

struct RegisterLink: Decodable, Hashable {
    let label: String
    let url: URL
}

struct RegisterGuide: Decodable, Hashable {
    let title: String
    let steps: [String]
}

enum VerificationMode: String, Decodable {
    case online
    case hybrid
    case qrOnly = "qr_only"
    case manualContact = "manual_contact"
    case sourceLinkMissing = "source_link_missing"
    case hybridLinkMissing = "hybrid_link_missing"
}

struct VerificationConfig: Decodable, Hashable {
    enum Kind: String, Decodable {
        case fields
        case upload
    }

    let kind: Kind
    let fields: [VerificationField]
    let note: String?
    let deepLink: DeepLink?
}

struct VerificationField: Decodable, Identifiable, Hashable {
    enum CaptureSource: String, Decodable {
        case document
        case portal
    }

    let id: String
    let label: String
    let placeholder: String
    let format: String?
    let aliases: [String]
    let browserSelectors: [String]
    let captureSource: CaptureSource
    let standardItem: Int?
    let pattern: String?
}

struct DeepLink: Decodable, Hashable {
    enum Method: String, Decodable {
        case get
        case post
    }

    let method: Method
    let url: URL
    let extraParams: [String: String]
    let paramOrder: [String]
}

struct RecognizedLine: Identifiable, Hashable {
    let id = UUID()
    let text: String
    let confidence: Float
    /// Vision's normalized coordinates, with an origin at the lower-left.
    let bounds: NormalizedRect
}

struct NormalizedRect: Hashable {
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

struct RecognitionResult: Hashable {
    let lines: [RecognizedLine]

    var fullText: String { lines.map(\.text).joined(separator: "\n") }
    var meanConfidence: Float {
        guard !lines.isEmpty else { return 0 }
        return lines.reduce(0) { $0 + $1.confidence } / Float(lines.count)
    }
}

enum ChinaStickerBarcode {
    static func normalizedValue(from payload: String) -> String? {
        let value = payload.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard value.range(of: "^E[0-9]{8}$", options: .regularExpression) != nil else { return nil }
        return value
    }

    /// Vision rectangles use a lower-left origin. The security sticker on the
    /// official Chinese specimen is the linear barcode in the upper-right,
    /// beside (and distinct from) the verification QR code.
    static func recognizedLine(payload: String, visionBounds bounds: NormalizedRect) -> RecognizedLine? {
        guard bounds.x + bounds.width / 2 >= 0.55,
              bounds.y + bounds.height / 2 >= 0.68,
              let value = normalizedValue(from: payload) else { return nil }
        return RecognizedLine(
            text: "Sticker Number: \(value)",
            confidence: 1,
            bounds: bounds
        )
    }
}

struct QrRoute: Decodable, Hashable {
    let function: String
    let specimenCount: Int
    let normalizeSchemelessTo: String?
    let allowedUrls: [QrUrlRule]
}

struct QrUrlRule: Decodable, Hashable {
    let `protocol`: String
    let hostname: String
    let port: String
    let pathnamePattern: String?
    let allowedSearchParams: [String]
    let requiredSearchParams: [String]
    let staticSearchParams: [String: String]
    let allowSubdomains: Bool
    let allowFragment: Bool
    let requireFragment: Bool
    let fragmentPattern: String?
    let insecureAccepted: Bool
    let tokenPattern: String?
    let tokenGroup: Int?
    let tokenSource: String?
    let canonicalUrlTemplate: String?
}

struct QrMatch: Hashable {
    let entry: RegisterEntry
    let destination: URL
    let function: String
    let rawPayload: String
    let specimenCount: Int
}

enum ScanOutcome: Hashable {
    case qr(QrMatch)
    case text(RecognitionResult, detectedQrPayloads: [String])
}

struct ExtractedField: Identifiable, Hashable {
    let id: String
    let label: String
    var value: String
    let confidence: Float
    let sourceText: String?
    var isoDate: String?
    /// Plausible OCR values that could not be associated with this field
    /// safely. The user must choose one (or type another value) before the
    /// field can be submitted.
    let suggestedValues: [String]
    let aliases: [String]
    let browserSelectors: [String]
    let captureSource: VerificationField.CaptureSource

    var needsCandidateSelection: Bool {
        value.isEmpty && !suggestedValues.isEmpty
    }
}

struct AuthorityMatch: Identifiable, Hashable {
    var id: String { entry.id }
    let entry: RegisterEntry
    let score: Double
    let evidence: String
}
