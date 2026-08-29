import Foundation
import ImageIO
import UIKit
import Vision

struct ScanAnalysis {
    let outcome: ScanOutcome
    let previewImage: UIImage
}

struct ApostilleRecognizer {
    static let maximumPixelDimension = 2_400

    enum RecognitionError: LocalizedError {
        case missingImage
        case noText

        var errorDescription: String? {
            switch self {
            case .missingImage: "A scanned page could not be read."
            case .noText: "No readable text was found. Try again in bright, even light."
            }
        }
    }

    func analyze(image: UIImage, entries: [RegisterEntry]) async throws -> ScanAnalysis {
        let preparedImage = try Self.preparedImage(from: image)
        guard let cgImage = preparedImage.cgImage else { throw RecognitionError.missingImage }

        let barcodes = (try? await detectBarcodes(in: cgImage)) ?? []
        let payloads = Array(Set(barcodes.filter { $0.symbology == .qr }.map(\.payload)))
        // Never guess which symbol is the Apostille when a photo contains more
        // than one QR. The text review explains that QR routing was withheld.
        if payloads.count == 1,
           let payload = payloads.first,
           let match = QrRouter.match(payload, entries: entries) {
            return ScanAnalysis(outcome: .qr(match), previewImage: preparedImage)
        }

        let fullPageStickerLines = barcodes.compactMap { barcode -> RecognizedLine? in
            guard barcode.symbology == .code128 || barcode.symbology == .code39 else { return nil }
            return ChinaStickerBarcode.recognizedLine(payload: barcode.payload, visionBounds: barcode.bounds)
        }
        let stickerLines: [RecognizedLine]
        if fullPageStickerLines.isEmpty {
            stickerLines = (try? await detectFocusedStickerBarcodes(in: cgImage))?.compactMap { barcode in
                ChinaStickerBarcode.recognizedLine(payload: barcode.payload, visionBounds: barcode.bounds)
            } ?? []
        } else {
            stickerLines = fullPageStickerLines
        }
        let recognition = try await recognize(cgImage: cgImage, supplementalLines: stickerLines)
        return ScanAnalysis(
            outcome: .text(recognition, detectedQrPayloads: payloads),
            previewImage: preparedImage
        )
    }

    static func preparedImage(from image: UIImage) throws -> UIImage {
        guard let source = image.cgImage else { throw RecognitionError.missingImage }
        let swapsAxes = [UIImage.Orientation.left, .leftMirrored, .right, .rightMirrored].contains(image.imageOrientation)
        let orientedWidth = CGFloat(swapsAxes ? source.height : source.width)
        let orientedHeight = CGFloat(swapsAxes ? source.width : source.height)
        let longestEdge = max(orientedWidth, orientedHeight)

        if image.imageOrientation == .up, longestEdge <= CGFloat(maximumPixelDimension) {
            return UIImage(cgImage: source, scale: 1, orientation: .up)
        }

        let downsampleScale = min(1, CGFloat(maximumPixelDimension) / longestEdge)
        let targetSize = CGSize(
            width: max(1, (orientedWidth * downsampleScale).rounded()),
            height: max(1, (orientedHeight * downsampleScale).rounded())
        )
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        format.preferredRange = .standard
        return UIGraphicsImageRenderer(size: targetSize, format: format).image { context in
            UIColor.white.setFill()
            context.cgContext.fill(CGRect(origin: .zero, size: targetSize))
            image.draw(in: CGRect(origin: .zero, size: targetSize))
        }
    }

    /// Creates a bounded, orientation-correct thumbnail directly from the
    /// encoded photo. ImageIO subsamples while decoding, so Photos-library
    /// imports never materialize the full-resolution bitmap first.
    static func preparedImage(fromEncodedFileAt url: URL) throws -> UIImage {
        let sourceOptions = [kCGImageSourceShouldCache: false] as CFDictionary
        guard let source = CGImageSourceCreateWithURL(url as CFURL, sourceOptions) else {
            throw RecognitionError.missingImage
        }
        let thumbnailOptions = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maximumPixelDimension,
            kCGImageSourceShouldCacheImmediately: true
        ] as CFDictionary
        guard let thumbnail = CGImageSourceCreateThumbnailAtIndex(source, 0, thumbnailOptions) else {
            throw RecognitionError.missingImage
        }
        return UIImage(cgImage: thumbnail, scale: 1, orientation: .up)
    }

    private func recognize(cgImage: CGImage, supplementalLines: [RecognizedLine]) async throws -> RecognitionResult {
        let lines = (try await recognizeLines(in: cgImage) + supplementalLines).sorted {
            let rowDifference = abs($0.bounds.y - $1.bounds.y)
            if rowDifference < 0.012 { return $0.bounds.x < $1.bounds.x }
            return $0.bounds.y > $1.bounds.y
        }
        guard !lines.isEmpty else { throw RecognitionError.noText }
        return RecognitionResult(lines: lines)
    }

    private func recognizeLines(in cgImage: CGImage) async throws -> [RecognizedLine] {
        return try await withCheckedThrowingContinuation { continuation in
            let request = VNRecognizeTextRequest { request, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                let observations = (request.results as? [VNRecognizedTextObservation]) ?? []
                let lines = observations
                    .compactMap { observation -> RecognizedLine? in
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
                continuation.resume(returning: lines)
            }
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = true
            request.automaticallyDetectsLanguage = true
            request.minimumTextHeight = 0.008
            request.customWords = ["Apostille", "Apostilla", "Apostila", "Apostillenummer"]

            // Vision otherwise tends to settle on one dominant language for the
            // whole page. Supplying every locally-supported language from the
            // Apostille corpus lets automatic detection choose per observation.
            let preferredLanguages = [
                "en-US", "fr-FR", "es-ES", "de-DE", "it-IT", "pt-BR", "nl-NL",
                "ru-RU", "uk-UA", "ar-SA", "zh-Hans", "zh-Hant", "ja-JP", "ko-KR"
            ]
            if let supported = try? request.supportedRecognitionLanguages() {
                request.recognitionLanguages = preferredLanguages.filter(supported.contains)
            }

            do {
                try VNImageRequestHandler(cgImage: cgImage, orientation: .up).perform([request])
            } catch {
                continuation.resume(throwing: error)
            }
        }
    }

    private struct DetectedBarcode {
        let payload: String
        let symbology: VNBarcodeSymbology
        let bounds: NormalizedRect
    }

    private func detectBarcodes(in cgImage: CGImage) async throws -> [DetectedBarcode] {
        return try await withCheckedThrowingContinuation { continuation in
            let request = VNDetectBarcodesRequest { request, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                let barcodes = ((request.results as? [VNBarcodeObservation]) ?? []).compactMap { observation -> DetectedBarcode? in
                    guard let payload = observation.payloadStringValue?.trimmingCharacters(in: .whitespacesAndNewlines),
                          !payload.isEmpty else { return nil }
                    let box = observation.boundingBox
                    return DetectedBarcode(
                        payload: payload,
                        symbology: observation.symbology,
                        bounds: NormalizedRect(x: box.origin.x, y: box.origin.y, width: box.width, height: box.height)
                    )
                }
                continuation.resume(returning: barcodes)
            }
            request.symbologies = [.qr, .code128, .code39]
            do {
                try VNImageRequestHandler(cgImage: cgImage, orientation: .up).perform([request])
            } catch {
                continuation.resume(throwing: error)
            }
        }
    }

    private func detectFocusedStickerBarcodes(in cgImage: CGImage) async throws -> [DetectedBarcode] {
        let region = CGRect(
            x: CGFloat(cgImage.width) * 0.52,
            y: CGFloat(cgImage.height) * 0.06,
            width: CGFloat(cgImage.width) * 0.42,
            height: CGFloat(cgImage.height) * 0.26
        ).integral
        guard let cropped = cgImage.cropping(to: region) else { return [] }
        let local = try await detectBarcodes(in: cropped)
        return local.compactMap { barcode in
            guard barcode.symbology == .code128 || barcode.symbology == .code39 else { return nil }
            let globalBounds = NormalizedRect(
                x: 0.52 + barcode.bounds.x * 0.42,
                y: 0.68 + barcode.bounds.y * 0.26,
                width: barcode.bounds.width * 0.42,
                height: barcode.bounds.height * 0.26
            )
            return DetectedBarcode(payload: barcode.payload, symbology: barcode.symbology, bounds: globalBounds)
        }
    }
}
