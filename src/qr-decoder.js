// Phase 3.2 — on-device QR decoding.
//
// Everything here runs locally. No image, frame, or decoded payload is uploaded,
// retained, logged, or passed to analytics. Frames are drawn to a canvas that is
// reused and overwritten, and nothing is kept after a decode returns.
//
// Decoder selection (the 3.2 spike, resolved): prefer the browser's native
// `BarcodeDetector` restricted to `qr_code` — no bundle cost, hardware-accelerated
// where present, and it reports *how many* codes are in frame, which we need to
// refuse ambiguous multi-code images. Where it is missing (currently Safari and
// Firefox) fall back to jsQR: pure JS, operates on raw ImageData so still images
// and camera frames share one path, QR-only by construction, and no network use.

import jsQR from 'jsqr'

export const DECODE = {
  OK: 'ok',
  NONE: 'none',
  MULTIPLE: 'multiple',
  UNREADABLE: 'unreadable'
}

// Large photos are downscaled before decoding: a 48MP camera roll image is both
// slow to scan and no more decodable than a 1600px one.
const MAX_DECODE_EDGE = 1600

let detectorPromise = null

function getNativeDetector() {
  if (detectorPromise) return detectorPromise
  detectorPromise = (async () => {
    if (typeof globalThis.BarcodeDetector !== 'function') return null
    try {
      const formats = await globalThis.BarcodeDetector.getSupportedFormats()
      if (!formats.includes('qr_code')) return null
      return new globalThis.BarcodeDetector({ formats: ['qr_code'] })
    } catch {
      return null
    }
  })()
  return detectorPromise
}

/** Scale so the longest edge is at most `maxEdge`, never scaling up. */
export function fitDimensions(width, height, maxEdge = MAX_DECODE_EDGE) {
  const longest = Math.max(width, height)
  if (!longest || longest <= maxEdge) return { width, height }
  const ratio = maxEdge / longest
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) }
}

function drawToImageData(source, sourceWidth, sourceHeight, canvas) {
  const { width, height } = fitDimensions(sourceWidth, sourceHeight)
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  context.drawImage(source, 0, 0, width, height)
  return context.getImageData(0, 0, width, height)
}

/**
 * jsQR reports at most one symbol per pass, so a naive fallback would silently
 * accept an ambiguous frame that the native detector correctly refuses. To keep
 * both paths equivalent, decode once, blank out the region the symbol occupied,
 * and decode again: a second hit means more than one code is in frame.
 */
function decodeImageData(imageData) {
  if (!imageData) return { status: DECODE.UNREADABLE }
  const { data, width, height } = imageData
  const first = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' })
  if (!first?.data) return { status: DECODE.NONE }

  const masked = new Uint8ClampedArray(data)
  maskRegion(masked, width, height, first.location)
  const second = jsQR(masked, width, height, { inversionAttempts: 'attemptBoth' })
  if (second?.data && second.data !== first.data) return { status: DECODE.MULTIPLE }

  return { status: DECODE.OK, text: first.data }
}

/** Paint the bounding box of a decoded symbol white so a re-scan skips it. */
function maskRegion(pixels, width, height, location) {
  if (!location) return
  const corners = [
    location.topLeftCorner, location.topRightCorner,
    location.bottomLeftCorner, location.bottomRightCorner
  ].filter(Boolean)
  if (corners.length === 0) return

  const pad = 4
  const minX = Math.max(0, Math.floor(Math.min(...corners.map((c) => c.x)) - pad))
  const maxX = Math.min(width - 1, Math.ceil(Math.max(...corners.map((c) => c.x)) + pad))
  const minY = Math.max(0, Math.floor(Math.min(...corners.map((c) => c.y)) - pad))
  const maxY = Math.min(height - 1, Math.ceil(Math.max(...corners.map((c) => c.y)) + pad))

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const i = (y * width + x) * 4
      pixels[i] = pixels[i + 1] = pixels[i + 2] = 255
      pixels[i + 3] = 255
    }
  }
}

async function decodeWithNative(source) {
  const detector = await getNativeDetector()
  if (!detector) return null
  try {
    const codes = await detector.detect(source)
    if (codes.length === 0) return { status: DECODE.NONE }
    // Two codes in frame means we cannot tell which one the user meant. Asking
    // them to reframe is safer than picking one and routing on it.
    if (codes.length > 1) return { status: DECODE.MULTIPLE }
    return { status: DECODE.OK, text: codes[0].rawValue }
  } catch {
    return null
  }
}

/** Decode a single camera frame. `canvas` is reused across frames by the caller. */
export async function decodeFromVideo(video, canvas) {
  if (!video?.videoWidth || !video?.videoHeight) return { status: DECODE.NONE }
  const native = await decodeWithNative(video)
  if (native) return native
  return decodeImageData(drawToImageData(video, video.videoWidth, video.videoHeight, canvas))
}

/** Decode a user-picked image file. Same capability as the camera path. */
export async function decodeFromFile(file, canvas) {
  if (!file || !file.type?.startsWith('image/')) return { status: DECODE.UNREADABLE }
  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    // Corrupt, truncated, or an unsupported codec.
    return { status: DECODE.UNREADABLE }
  }
  try {
    const native = await decodeWithNative(bitmap)
    if (native) return native
    return decodeImageData(drawToImageData(bitmap, bitmap.width, bitmap.height, canvas))
  } finally {
    bitmap.close?.()
  }
}

export const CAMERA_ERROR = {
  DENIED: 'denied',
  UNAVAILABLE: 'unavailable',
  INSECURE_CONTEXT: 'insecure_context'
}

/**
 * Request a rear-facing camera stream. `getUserMedia` needs a secure context;
 * localhost counts as trustworthy for development.
 */
export async function requestCameraStream() {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    const insecure = typeof window !== 'undefined' && window.isSecureContext === false
    return { error: insecure ? CAMERA_ERROR.INSECURE_CONTEXT : CAMERA_ERROR.UNAVAILABLE }
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false
    })
    return { stream }
  } catch (error) {
    const denied = error?.name === 'NotAllowedError' || error?.name === 'SecurityError'
    return { error: denied ? CAMERA_ERROR.DENIED : CAMERA_ERROR.UNAVAILABLE }
  }
}

/** Release every track. Called on close, authority change, result, and page hide. */
export function stopStream(stream) {
  stream?.getTracks().forEach((track) => track.stop())
}
