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

/**
 * Draw `source` into `canvas` at no more than MAX_DECODE_EDGE, returning the
 * context so the caller can decide whether to read pixels back.
 *
 * Split from the ImageData read on purpose: the native detector reads the canvas
 * directly, and getImageData() on a large surface is expensive enough that doing
 * it eagerly would waste the work whenever native detection succeeds.
 */
function drawScaled(source, sourceWidth, sourceHeight, canvas) {
  const { width, height } = fitDimensions(sourceWidth, sourceHeight)
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  context.drawImage(source, 0, 0, width, height)
  return context
}

function readImageData(context) {
  return context.getImageData(0, 0, context.canvas.width, context.canvas.height)
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
    // Two DIFFERENT codes in frame means we cannot tell which one the user
    // meant, so refuse and ask them to reframe. Identical codes are not
    // ambiguous -- documents legitimately print the same QR twice (sticker and
    // page) -- and the jsQR fallback already treats agreement as OK, so the
    // native path must match or Chrome and Safari would disagree on the same
    // photo.
    if (codes.length > 1) {
      const distinct = new Set(codes.map((code) => code.rawValue))
      if (distinct.size > 1) return { status: DECODE.MULTIPLE }
    }
    return { status: DECODE.OK, text: codes[0].rawValue }
  } catch {
    return null
  }
}

/**
 * Decode a single camera frame. `canvas` is reused across frames by the caller.
 *
 * Unlike the file path, the native detector is handed the <video> element
 * directly. That is deliberate: a camera frame is bounded by the hardware and
 * the getUserMedia constraints rather than chosen by the user, and browsers can
 * read the element without a CPU copy. Forcing a canvas draw on every frame
 * would add cost to the common case to bound a size the camera cannot produce.
 */
export async function decodeFromVideo(video, canvas) {
  if (!video?.videoWidth || !video?.videoHeight) return { status: DECODE.NONE }
  const native = await decodeWithNative(video)
  if (native) return native
  const context = drawScaled(video, video.videoWidth, video.videoHeight, canvas)
  if (!context) return { status: DECODE.UNREADABLE }
  return decodeImageData(readImageData(context))
}

/** Decode a user-picked image file. Same capability as the camera path. */
export async function decodeFromFile(file, canvas) {
  if (!file) return { status: DECODE.UNREADABLE }
  // No MIME pre-check: file pickers report an empty type for perfectly valid
  // images surprisingly often (extension-less downloads, some HEIC exports),
  // and createImageBitmap below is the authoritative test either way.
  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    // Corrupt, truncated, or an unsupported codec.
    return { status: DECODE.UNREADABLE }
  }
  try {
    // Downscale BEFORE either decoder sees the image. A file is user-chosen and
    // unbounded -- a modern phone photo is 48MP, which is ~192MB once decoded --
    // so handing the raw bitmap to the native detector spent time and memory on
    // resolution that cannot help: measured 2.2x slower at 48MP, with the same
    // symbol found either way. Both decoders now read the same capped canvas.
    const context = drawScaled(bitmap, bitmap.width, bitmap.height, canvas)
    if (!context) return { status: DECODE.UNREADABLE }
    const native = await decodeWithNative(canvas)
    if (native) return native
    return decodeImageData(readImageData(context))
  } finally {
    // Release the full-resolution bitmap as soon as the capped copy exists.
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
