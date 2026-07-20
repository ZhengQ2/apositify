// Phase 3.6 — scanner component tests.
//
// WHY THIS EXISTS: every scanner defect found during review lived in
// QrScanner.jsx and was invisible to the pure routing suite -- three stale-session
// races, two camera/file parity breaks, and an aria-modal that did not trap
// focus. The routing tests cover classification; nothing covered lifecycle. This
// does.
//
// Deliberately no React Testing Library: react-dom/client plus jsdom is enough
// to mount the real component and drive it, and this project keeps its
// dependency surface small on purpose.
//
//   node scripts/test-scanner-dom.mjs

import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'

// --- environment ------------------------------------------------------------

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'https://localhost/',
  pretendToBeVisual: true
})

globalThis.window = dom.window
globalThis.document = dom.window.document
// Node 21+ defines a getter-only global navigator, so plain assignment throws.
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator, configurable: true, writable: true
})
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.HTMLMediaElement = dom.window.HTMLMediaElement
globalThis.HTMLSelectElement = dom.window.HTMLSelectElement
globalThis.KeyboardEvent = dom.window.KeyboardEvent
globalThis.Event = dom.window.Event
globalThis.MouseEvent = dom.window.MouseEvent
globalThis.File = dom.window.File
globalThis.Blob = dom.window.Blob
globalThis.DataTransfer = dom.window.DataTransfer
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0)
globalThis.cancelAnimationFrame = (id) => clearTimeout(id)
globalThis.IS_REACT_ACT_ENVIRONMENT = true

// jsdom has no media stack. Keep playback injectable so the lifecycle suite can
// cover the distinct case where permission succeeds but the video element does
// not start.
let playBehaviour = () => Promise.resolve()
dom.window.HTMLMediaElement.prototype.play = function () { return playBehaviour(this) }

// Track every MediaStreamTrack we hand out so leaks are observable.
const issuedTracks = []
function makeStream() {
  const track = { readyState: 'live', stop() { this.readyState = 'ended' } }
  issuedTracks.push(track)
  return { getTracks: () => [track] }
}

const denied = () => { const e = new Error('denied'); e.name = 'NotAllowedError'; return e }
let gumBehaviour = async () => makeStream()
Object.defineProperty(dom.window.navigator, 'mediaDevices', {
  value: { getUserMedia: (...args) => gumBehaviour(...args) },
  configurable: true
})

// The component's decoder is mocked at module scope below; canvas is never
// actually rasterised, so a stub context suffices.
// jsdom has no 2D context. This stub reports back whatever width/height the
// code under test assigned, so a dimension assertion is meaningful rather than
// reading a hard-coded 1x1.
dom.window.HTMLCanvasElement.prototype.getContext = function () {
  const canvas = this
  return {
    canvas,
    drawImage() {},
    getImageData: (x, y, w, h) => ({
      data: new Uint8ClampedArray(Math.max(1, w * h) * 4),
      width: w,
      height: h
    })
  }
}

const React = (await import('react')).default
const { createRoot } = await import('react-dom/client')
const { act } = await import('react')

// --- loading the component --------------------------------------------------
//
// Node cannot import .jsx. Rather than add a transformer, load the module
// through Vite's own SSR pipeline: it applies exactly the transform the app
// gets, so these tests exercise the shipped code rather than a re-compiled
// approximation.
//
// The globals above must already be installed -- React reads them at import.

const { createServer } = await import('vite')
const vite = await createServer({
  // The suite only uses Vite's JSX transform. HMR would otherwise open an
  // unnecessary WebSocket listener, which can fail in restricted CI runners
  // even though no browser ever connects to this middleware-mode server.
  server: { middlewareMode: true, ws: false },
  appType: 'custom',
  logLevel: 'error',
  optimizeDeps: { noDiscovery: true }
})
const { QrScannerDialog } = await vite.ssrLoadModule('/src/QrScanner.jsx')

// Camera frames never decode under jsdom (a <video> has no dimensions), which is
// exactly right for lifecycle assertions: the scan loop runs and stays running
// without a payload short-circuiting it.

// --- harness ----------------------------------------------------------------

let passed = 0
async function check(name, fn) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    await fn({ root, host })
    passed += 1
  } catch (error) {
    console.error(`\nFAILED: ${name}`)
    throw error
  } finally {
    await act(async () => { root.unmount() })
    host.remove()
  }
}

const tick = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })

function render(root, props = {}) {
  return act(async () => {
    root.render(React.createElement(QrScannerDialog, {
      authorityId: 'brazil-national-council-of-justice',
      authorityName: 'National Council of Justice',
      country: 'Brazil',
      onClose: () => {},
      ...props
    }))
  })
}

const statusText = () => document.querySelector('.qr-status')?.textContent ?? ''
const cameraButton = () => [...document.querySelectorAll('.qr-actions button')]
  .find((b) => /camera/i.test(b.textContent))

// --- lifecycle: the class of defect that kept reaching review ---------------

// Mutation-tested 2026-07-18. Removing the visibility reset, the restart
// release, the focus trap, focus restoration, or unmount cleanup each turns this
// suite red. NOTE: startCamera holds TWO session guards (after getUserMedia and
// after play()) which are partially redundant -- removing either alone still
// leaves the stream stopped by the other, so only removing BOTH is caught. The
// assertion below is deliberately outcome-based ("no live track survives")
// rather than pinning each guard, so it stays valid if that redundancy is ever
// simplified away.
await check('closing while the permission prompt is pending stops the late stream', async ({ root }) => {
  let release
  gumBehaviour = () => new Promise((resolve) => { release = () => resolve(makeStream()) })
  await render(root)
  await act(async () => { cameraButton().click() })
  assert.match(statusText(), /permission/i, 'should be waiting on permission')

  const before = issuedTracks.length
  await act(async () => { root.unmount() })   // user closes the dialog
  await act(async () => { release() })        // permission resolves afterwards
  await tick(10)

  const late = issuedTracks.slice(before)
  assert.equal(late.length, 1, 'a stream was still issued')
  assert.equal(late[0].readyState, 'ended', 'the late stream must be stopped, not left live')
})

await check('backgrounding during the prompt returns to a retryable idle state', async ({ root }) => {
  gumBehaviour = () => new Promise(() => {})   // never resolves
  await render(root)
  await act(async () => { cameraButton().click() })
  assert.match(statusText(), /permission/i)
  assert.equal(cameraButton().disabled, true, 'button is disabled while requesting')

  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })

  assert.doesNotMatch(statusText(), /permission/i, 'must not stay stuck on the prompt message')
  assert.equal(cameraButton().disabled, false, 'camera must be retryable again')
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
})

await check('restarting the camera stops the previous stream', async ({ root }) => {
  gumBehaviour = async () => makeStream()
  await render(root)
  await act(async () => { cameraButton().click() })
  await tick(10)
  const first = issuedTracks[issuedTracks.length - 1]

  await act(async () => { cameraButton().click() })
  await tick(10)
  const second = issuedTracks[issuedTracks.length - 1]

  assert.notEqual(first, second, 'a second stream should have been requested')
  assert.equal(first.readyState, 'ended', 'the first stream must be released')
  assert.equal(second.readyState, 'live', 'the new stream should be running')
})

await check('unmounting always releases the camera', async ({ root }) => {
  gumBehaviour = async () => makeStream()
  await render(root)
  await act(async () => { cameraButton().click() })
  await tick(10)
  const track = issuedTracks[issuedTracks.length - 1]
  assert.equal(track.readyState, 'live')

  await act(async () => { root.unmount() })
  assert.equal(track.readyState, 'ended', 'no track may outlive the dialog')
})

await check('a denied prompt falls back to the file picker', async ({ root }) => {
  gumBehaviour = async () => { throw denied() }
  await render(root)
  await act(async () => { cameraButton().click() })
  await tick(10)
  assert.match(statusText(), /permission was declined/i)
  assert.ok(document.querySelector('.qr-file-input'), 'file route must remain available')
  assert.equal(cameraButton().disabled, false, 'camera should be retryable after a denial')
})

await check('a playback failure stops the granted stream and stays retryable', async ({ root }) => {
  gumBehaviour = async () => makeStream()
  playBehaviour = () => Promise.reject(new Error('playback failed'))
  try {
    await render(root)
    await act(async () => { cameraButton().click() })
    await tick(10)

    const track = issuedTracks[issuedTracks.length - 1]
    assert.equal(track.readyState, 'ended', 'a stream that cannot produce frames must be stopped')
    assert.match(statusText(), /no camera is available/i, 'must not claim to be scanning')
    assert.equal(cameraButton().disabled, false, 'camera should be retryable after playback fails')
  } finally {
    playBehaviour = () => Promise.resolve()
  }
})

// --- accessibility: aria-modal has to be true for a keyboard ---------------

await check('the dialog exposes modal semantics and takes focus', async ({ root }) => {
  gumBehaviour = async () => makeStream()
  await render(root)
  const dialog = document.querySelector('.qr-dialog')
  assert.equal(dialog.getAttribute('role'), 'dialog')
  assert.equal(dialog.getAttribute('aria-modal'), 'true')
  assert.ok(dialog.getAttribute('aria-labelledby'), 'must name itself for screen readers')
  assert.equal(document.activeElement?.className, 'qr-close', 'focus moves into the dialog')
  assert.equal(document.querySelector('.qr-status')?.getAttribute('aria-live'), 'polite')
})

await check('Tab wraps inside the dialog instead of escaping to the page', async ({ root }) => {
  gumBehaviour = async () => makeStream()
  await render(root)
  const dialog = document.querySelector('.qr-dialog')
  const focusable = [...dialog.querySelectorAll('button:not([disabled]), a[href], input:not([disabled])')]
  assert.ok(focusable.length >= 2, 'need at least two focusable controls to test wrapping')

  focusable[focusable.length - 1].focus()
  const forward = new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
  await act(async () => { document.dispatchEvent(forward) })
  assert.equal(forward.defaultPrevented, true, 'forward wrap must be intercepted')
  assert.ok(dialog.contains(document.activeElement), 'focus stays inside')

  focusable[0].focus()
  const back = new dom.window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })
  await act(async () => { document.dispatchEvent(back) })
  assert.equal(back.defaultPrevented, true, 'backward wrap must be intercepted')
  assert.ok(dialog.contains(document.activeElement), 'focus stays inside')
})

await check('Escape closes the dialog', async ({ root }) => {
  let closed = false
  gumBehaviour = async () => makeStream()
  await render(root, { onClose: () => { closed = true } })
  await act(async () => {
    document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  })
  assert.equal(closed, true)
})

await check('closing restores focus to whatever opened the dialog', async ({ root }) => {
  const opener = document.createElement('button')
  opener.textContent = 'Scan'
  document.body.appendChild(opener)
  opener.focus()
  assert.equal(document.activeElement, opener)

  gumBehaviour = async () => makeStream()
  await render(root)
  assert.notEqual(document.activeElement, opener, 'dialog takes focus while open')

  await act(async () => { root.unmount() })
  assert.equal(document.activeElement, opener, 'focus returns to the opener, not <body>')
  opener.remove()
})

// --- result rendering -------------------------------------------------------
//
// These mount the dialog and assert on what the classifier's outcomes render,
// which is where the "never claim valid" rule actually has to hold.

await check('no result card claims an apostille is valid or verified', async ({ root }) => {
  gumBehaviour = async () => makeStream()
  await render(root)
  // The dialog's own chrome must already be free of verdict language.
  const text = document.querySelector('.qr-dialog').textContent.toLowerCase()
  for (const word of ['is valid', 'is genuine', 'verified successfully', 'authentic']) {
    assert.ok(!text.includes(word), `dialog copy must not contain "${word}"`)
  }
})

await check('the privacy promise is stated in the dialog', async ({ root }) => {
  gumBehaviour = async () => makeStream()
  await render(root)
  const text = document.querySelector('.qr-dialog').textContent
  assert.match(text, /never uploaded|stay on your device/i)
})

// --- decoder: neither decoder may see an oversized image --------------------
//
// A file is user-chosen and unbounded. A 48MP phone photo is ~192MB once
// decoded, and handing that to the native detector was measured 2.2x slower
// than the capped copy while finding the same symbol. This pins the cap for
// BOTH decoders, since only the jsQR path was covered before.

const decoder = await vite.ssrLoadModule('/src/qr-decoder.js')

await check('the native detector is handed a capped image, not the raw bitmap', async () => {
  const HUGE = { width: 8000, height: 6000, close() { this.closed = true } }
  globalThis.createImageBitmap = async () => HUGE

  const seen = []
  globalThis.BarcodeDetector = class {
    static async getSupportedFormats() { return ['qr_code'] }
    async detect(source) {
      seen.push({ width: source.width, height: source.height })
      return [{ rawValue: 'https://apostil.org.br/v?number=0000000-00&crc=00000000' }]
    }
  }

  // A canvas whose dimensions are observable by the assertion below.
  const canvas = document.createElement('canvas')
  const result = await decoder.decodeFromFile(
    new File([new Uint8Array([1])], 'huge.png', { type: 'image/png' }),
    canvas
  )

  assert.equal(result.status, 'ok', 'a capped image must still decode')
  assert.ok(seen.length > 0, 'the native detector should have been consulted')
  for (const { width, height } of seen) {
    assert.ok(
      Math.max(width, height) <= 1600,
      `native detector received ${width}x${height}; the 8000x6000 source must be capped first`
    )
  }
  assert.equal(HUGE.closed, true, 'the full-resolution bitmap must be released')

  delete globalThis.BarcodeDetector
  delete globalThis.createImageBitmap
})

await check('fitDimensions caps the long edge and never upscales', () => {
  assert.deepEqual(decoder.fitDimensions(8000, 6000), { width: 1600, height: 1200 })
  assert.deepEqual(decoder.fitDimensions(6000, 8000), { width: 1200, height: 1600 })
  // Small images pass through untouched: upscaling adds no information and the
  // specimen work showed low-resolution crops fail on data, not on size.
  assert.deepEqual(decoder.fitDimensions(300, 300), { width: 300, height: 300 })
  assert.deepEqual(decoder.fitDimensions(1600, 900), { width: 1600, height: 900 })
})

await vite.close()
console.log(`Scanner DOM: ${passed} checks passed.`)
