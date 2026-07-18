// Phase 3C — local specimen decoding tool.
//
//   node scripts/decode-specimen.mjs <image> [authority-id]
//
// Decodes a QR from an apostille specimen and, when an authority id is given,
// reports how the production classifier would treat the payload. Runs entirely
// locally; nothing is uploaded and nothing is written back to the repository.
//
// Photographed specimens frequently fail to decode on the first pass, so this
// retries with a few preprocessing variants before giving up — a failure here
// usually means the crop or focus is insufficient, not that the QR is invalid.
//
// IMPORTANT: specimen images must not be committed. Keep them outside the repo
// or under an ignored path, and record only the decoded template in the private
// fixture manifest.

import { Jimp } from 'jimp'
import jsQR from 'jsqr'
import { classifyQrPayload } from '../src/qr-routing.js'
import { qrRecordsFor } from '../src/data/qr-codes.js'

const [, , imagePath, authorityId] = process.argv

if (!imagePath) {
  console.error('Usage: node scripts/decode-specimen.mjs <image> [authority-id]')
  process.exit(1)
}

const image = await Jimp.read(imagePath)
console.log(`Loaded ${imagePath} (${image.width}x${image.height})`)

/** Preprocessing variants, cheapest first. */
function* variants(source) {
  yield ['as-is', source.clone()]
  yield ['greyscale + contrast', source.clone().greyscale().contrast(0.4)]
  yield ['greyscale + normalize', source.clone().greyscale().normalize()]
  for (const scale of [2, 3, 4]) {
    yield [`upscaled x${scale} + greyscale`, source.clone().scale(scale).greyscale().contrast(0.3)]
  }
  yield ['inverted', source.clone().greyscale().invert()]
  for (const threshold of [110, 140, 170]) {
    const img = source.clone().greyscale().scale(2)
    for (let i = 0; i < img.bitmap.data.length; i += 4) {
      const v = img.bitmap.data[i] < threshold ? 0 : 255
      img.bitmap.data[i] = img.bitmap.data[i + 1] = img.bitmap.data[i + 2] = v
    }
    yield [`threshold ${threshold}`, img]
  }
}

let decoded = null
let usedVariant = null

for (const [name, candidate] of variants(image)) {
  const { data, width, height } = candidate.bitmap
  const result = jsQR(new Uint8ClampedArray(data), width, height, { inversionAttempts: 'attemptBoth' })
  if (result?.data) {
    decoded = result.data
    usedVariant = name
    break
  }
  console.log(`  no QR via "${name}"`)
}

if (!decoded) {
  console.log('\nNo QR decoded from any variant.')
  console.log('Most likely causes: too low resolution, motion blur, glare, or the')
  console.log('QR is cropped. A tighter, flat, well-lit crop of just the QR usually fixes it.')
  process.exit(2)
}

console.log(`\nDecoded via "${usedVariant}":`)
console.log(`\n  ${decoded}\n`)

// Structural read-out, so the payload template can be recorded without guessing.
try {
  const url = new URL(decoded)
  console.log('Parsed as a URL:')
  console.log(`  protocol : ${url.protocol}`)
  console.log(`  hostname : ${url.hostname}`)
  console.log(`  port     : ${url.port || '(default)'}`)
  console.log(`  pathname : ${url.pathname}`)
  console.log(`  search   : ${url.search || '(none)'}`)
  console.log(`  fragment : ${url.hash || '(none)'}`)
} catch {
  console.log('Not a URL. Payload is an opaque token, structured text, or a signed blob.')
}

if (authorityId) {
  const records = qrRecordsFor(authorityId)
  if (records.length === 0) {
    console.log(`\nUnknown authority id: ${authorityId}`)
  } else {
    console.log(`\nRegistry state for ${authorityId}:`)
    for (const record of records) {
      console.log(`  presence=${record.presence} function=${record.function} enabled=${record.enabled}`)
      console.log(`  hosts: ${(record.allowedUrls || []).map((rule) => rule.hostname).join(', ') || '(none documented)'}`)
    }
    const outcome = classifyQrPayload(decoded, authorityId)
    console.log(`\nProduction classifier would return: ${outcome.kind}${outcome.reason ? ` (${outcome.reason})` : ''}`)
  }
}

console.log('\nReminder: one specimen is not a gate. Two independent issuances are')
console.log('required before an authority can be enabled.')
