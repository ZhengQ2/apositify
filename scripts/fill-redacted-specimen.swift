import AppKit
import Foundation
import ImageIO
import Vision

// Writes a known value into a redacted numbered item, so a specimen whose real
// reference is blacked out still has ground truth to assert against.
// Usage: fill <in> <out> <item> <value>

let arguments = CommandLine.arguments
guard arguments.count == 5, let item = Int(arguments[3]) else {
    fputs("Usage: fill <input> <output> <item> <value>\n", stderr)
    exit(2)
}
let inputURL = URL(fileURLWithPath: arguments[1])
let outputURL = URL(fileURLWithPath: arguments[2])
let value = arguments[4]

guard let source = CGImageSourceCreateWithURL(inputURL as CFURL, nil),
      let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
          kCGImageSourceCreateThumbnailFromImageAlways: true,
          kCGImageSourceCreateThumbnailWithTransform: true,
          kCGImageSourceThumbnailMaxPixelSize: 2_400,
          kCGImageSourceShouldCacheImmediately: true
      ] as CFDictionary) else {
    fputs("could not read \(inputURL.path)\n", stderr)
    exit(1)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.automaticallyDetectsLanguage = true
request.minimumTextHeight = 0.008
try VNImageRequestHandler(cgImage: image, orientation: .up).perform([request])
let observations = (request.results ?? [])

// The item's own numbered line, in Vision's lower-left coordinate space.
let anchorPattern = "^\\s*\(item)\\s*[.):]"
guard let anchor = observations.first(where: { observation in
    guard let text = observation.topCandidates(1).first?.string else { return false }
    return text.range(of: anchorPattern, options: .regularExpression) != nil
}) else {
    fputs("no item \(item) anchor found in \(inputURL.lastPathComponent)\n", stderr)
    exit(3)
}

let box = anchor.boundingBox
let width = CGFloat(image.width)
let height = CGFloat(image.height)
// Immediately to the right of the label, on the label's own row.
let target = CGRect(
    x: (box.maxX + 0.012) * width,
    y: box.minY * height,
    width: min(0.34, 0.96 - box.maxX) * width,
    height: box.height * height
)

guard let representation = NSBitmapImageRep(
    bitmapDataPlanes: nil, pixelsWide: image.width, pixelsHigh: image.height,
    bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
    colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0
), let context = NSGraphicsContext(bitmapImageRep: representation) else {
    fputs("could not allocate a canvas\n", stderr)
    exit(1)
}

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = context
NSImage(cgImage: image, size: NSSize(width: image.width, height: image.height))
    .draw(in: NSRect(x: 0, y: 0, width: image.width, height: image.height))

NSColor.white.setFill()
target.insetBy(dx: -2, dy: -2).fill()

let fontSize = target.height * 0.82
let attributes: [NSAttributedString.Key: Any] = [
    .font: NSFont(name: "Helvetica", size: fontSize) ?? NSFont.systemFont(ofSize: fontSize),
    .foregroundColor: NSColor.black
]
NSAttributedString(string: value, attributes: attributes).draw(
    in: target.offsetBy(dx: 0, dy: -target.height * 0.08)
)
context.flushGraphics()
NSGraphicsContext.restoreGraphicsState()

guard let png = representation.representation(using: .png, properties: [:]) else {
    fputs("could not encode the result\n", stderr)
    exit(1)
}
try png.write(to: outputURL, options: .atomic)
print("wrote \(outputURL.lastPathComponent) with item \(item) = \(value)")
