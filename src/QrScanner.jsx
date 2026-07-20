// Phase 3.2 / 3.4 — the scanner dialog.
//
// Two input routes at parity: live camera, and a saved image from the file
// picker. The file picker is not a degraded fallback — it is the only route that
// works when camera permission is denied, no camera exists, or the page is not
// in a secure context, and it must stay keyboard-operable throughout.
//
// The dialog never claims an apostille is valid. It reports what it decoded, and
// may offer to leave the app at one of two strengths:
//
//   tier 1  The authority has a decoded specimen and the payload matched its
//           complete protocol/host/port/path rule. Primary action, "open the
//           official lookup".
//   tier 2  No specimen for this authority, but the host sits in the party's
//           government namespace. Secondary action, "continue to this address",
//           with copy stating outright that the format is unconfirmed.
//
// Neither is a verification claim. See ./qr-routing.js for the tier rules.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Camera, ClipboardCopy, ExternalLink, FileImage, Landmark, QrCode, ShieldAlert, Smartphone, X } from 'lucide-react'
import { CAMERA_ERROR, DECODE, decodeFromFile, decodeFromVideo, requestCameraStream, stopStream } from './qr-decoder'
import { OUTCOME, classifyQrPayload, isReportable } from './qr-routing'
import { messages as t } from './i18n/en'

const STATE = {
  IDLE: 'idle',
  REQUESTING: 'requesting_permission',
  SCANNING: 'scanning',
  DECODING_FILE: 'decoding_file',
  DECODED: 'decoded',
  NO_QR: 'no_qr',
  CAMERA_ERROR: 'camera_error'
}

const SCAN_INTERVAL_MS = 250

export function QrScannerDialog({ authorityId, authorityName, country, onClose }) {
  const [state, setState] = useState(STATE.IDLE)
  const [result, setResult] = useState(null)
  const [decodeIssue, setDecodeIssue] = useState(null)
  const [cameraError, setCameraError] = useState(null)

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const closeRef = useRef(null)
  const dialogRef = useRef(null)

  // The decode canvas is created lazily and shared by both input routes. It must
  // exist before the camera interval starts, not only on the file path.
  const ensureCanvas = useCallback(() => {
    if (!canvasRef.current) canvasRef.current = document.createElement('canvas')
    return canvasRef.current
  }, [])

  // Bumped on every release. A getUserMedia() promise that resolves after the
  // dialog closed compares its captured value against this and, if stale, stops
  // the stream it was handed instead of installing it.
  const sessionRef = useRef(0)

  const releaseCamera = useCallback(() => {
    sessionRef.current += 1
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    stopStream(streamRef.current)
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  // Camera tracks are released on close, on unmount, when the authority changes,
  // once a result is obtained, and when the page is hidden.
  useEffect(() => releaseCamera, [releaseCamera])
  useEffect(() => {
    releaseCamera()
    setState(STATE.IDLE)
    setResult(null)
    setDecodeIssue(null)
  }, [authorityId, releaseCamera])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        releaseCamera()
        // releaseCamera() bumps the session, so any in-flight async work returns
        // early without touching state. That means EVERY transient state has to
        // be reset here, not just SCANNING: leaving REQUESTING stuck shows
        // "Waiting for camera permission…" forever with the camera button
        // disabled, and leaving DECODING_FILE stuck shows "Reading the selected
        // image…" forever. Both are easy to hit on mobile by backgrounding the
        // browser during the permission prompt or a slow decode.
        setState((current) => (
          current === STATE.SCANNING || current === STATE.REQUESTING || current === STATE.DECODING_FILE
            ? STATE.IDLE
            : current
        ))
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [releaseCamera])

  useEffect(() => {
    // aria-modal promises assistive tech that content outside the dialog is
    // inert, so keyboard focus has to actually honour that: trap Tab inside the
    // dialog, and put focus back on the element that opened it when we close --
    // otherwise a keyboard user is dropped at the top of the document and has to
    // tab all the way back to where they were.
    const opener = document.activeElement
    closeRef.current?.focus()

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )].filter((el) => el.offsetParent !== null || el === document.activeElement)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      } else if (!dialogRef.current.contains(document.activeElement)) {
        // Focus escaped (e.g. via a click on the backdrop area): pull it back.
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus()
    }
  }, [onClose])

  const handlePayload = useCallback((text) => {
    releaseCamera()
    setResult(classifyQrPayload(text, authorityId, country))
    setDecodeIssue(null)
    setState(STATE.DECODED)
  }, [authorityId, country, releaseCamera])

  const startCamera = useCallback(async () => {
    // Restarting while a scan is live must release the previous stream and
    // interval first, or the old camera track keeps running with nothing holding
    // a reference that could stop it.
    releaseCamera()
    const session = sessionRef.current
    setResult(null)
    setDecodeIssue(null)
    setState(STATE.REQUESTING)
    const { stream, error } = await requestCameraStream()
    // The permission prompt can outlive the dialog. If anything released the
    // camera while we were waiting, this stream belongs to a dead session.
    if (session !== sessionRef.current) {
      stopStream(stream)
      return
    }
    if (error) {
      setCameraError(error)
      setState(STATE.CAMERA_ERROR)
      return
    }
    streamRef.current = stream
    ensureCanvas()
    const video = videoRef.current
    if (!video) {
      // React normally commits the REQUESTING state before getUserMedia settles,
      // but an unusually fast implementation (or a renderer interruption) can
      // still leave us without the element that owns the stream. Do not report
      // "Scanning" when there is nowhere to obtain frames from.
      releaseCamera()
      setCameraError(CAMERA_ERROR.UNAVAILABLE)
      setState(STATE.CAMERA_ERROR)
      return
    }
    video.srcObject = stream
    try {
      await video.play()
    } catch {
      // Permission and playback are separate failure points. A browser may hand
      // us a live stream and still refuse or fail to start the video element.
      // Suppressing that rejection leaves the camera on while the dialog claims
      // to be scanning an element that will never produce a frame.
      if (session !== sessionRef.current) {
        stopStream(stream)
        return
      }
      releaseCamera()
      setCameraError(CAMERA_ERROR.UNAVAILABLE)
      setState(STATE.CAMERA_ERROR)
      return
    }
    // play() is a second await, and camera startup can be slow. If the dialog
    // closed or the authority changed during it, cleanup has already run and
    // will not run again -- so installing an interval here would leave a timer
    // ticking against a dead dialog.
    if (session !== sessionRef.current) {
      stopStream(stream)
      return
    }
    setState(STATE.SCANNING)

    // setInterval does not wait for an async callback. Decoding a large frame
    // can exceed SCAN_INTERVAL_MS -- more so since the jsQR path now runs a
    // second masked pass to detect multiple codes -- so without this guard the
    // decodes overlap, burn CPU, and race each other's state updates.
    let decoding = false
    timerRef.current = setInterval(async () => {
      if (decoding) return
      if (!videoRef.current || !canvasRef.current) return
      decoding = true
      try {
        const decoded = await decodeFromVideo(videoRef.current, canvasRef.current)
        if (session !== sessionRef.current) return
        if (decoded.status === DECODE.OK) handlePayload(decoded.text)
        else if (decoded.status === DECODE.MULTIPLE) setDecodeIssue(DECODE.MULTIPLE)
        else setDecodeIssue(null)
      } finally {
        decoding = false
      }
    }, SCAN_INTERVAL_MS)
  }, [ensureCanvas, handlePayload, releaseCamera])

  const onFileChange = useCallback(async (event) => {
    const file = event.target.files?.[0]
    event.target.value = '' // allow re-picking the same file after a failed scan
    if (!file) return
    releaseCamera()
    // Same stale-session guard as the camera path. Decoding a large image is
    // slow, and the user can pick another file, start the camera, change
    // authority, or close the dialog while it runs. Without this, the older
    // decode still calls handlePayload(), which releases the newer camera scan
    // and shows a destination read from the file the user already moved on from.
    const session = sessionRef.current
    setResult(null)
    setDecodeIssue(null)
    setState(STATE.DECODING_FILE)
    const decoded = await decodeFromFile(file, ensureCanvas())
    if (session !== sessionRef.current) return
    if (decoded.status === DECODE.OK) {
      handlePayload(decoded.text)
      return
    }
    setDecodeIssue(decoded.status)
    setState(STATE.NO_QR)
  }, [ensureCanvas, handlePayload, releaseCamera])

  const statusMessage = useMemo(() => {
    switch (state) {
      case STATE.REQUESTING: return t.qrStateRequesting
      case STATE.SCANNING: return decodeIssue === DECODE.MULTIPLE ? t.qrMultipleCodes : t.qrStateScanning
      case STATE.DECODING_FILE: return t.qrStateDecodingFile
      case STATE.NO_QR:
        // The file path can report MULTIPLE too, not just NONE/UNREADABLE.
        // Collapsing it into "no QR code found" told the user the opposite of
        // what happened and sent them looking for a code that was already there.
        if (decodeIssue === DECODE.UNREADABLE) return t.qrUnreadableImage
        if (decodeIssue === DECODE.MULTIPLE) return t.qrMultipleCodesFile
        return t.qrNoCodeFound
      case STATE.CAMERA_ERROR: return cameraErrorMessage(cameraError)
      case STATE.DECODED: return t.qrStateDecoded
      default: return t.qrStateIdle
    }
  }, [state, decodeIssue, cameraError])

  return (
    <div className="qr-backdrop" onClick={onClose}>
      <div
        className="qr-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-dialog-title"
        ref={dialogRef}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="qr-dialog-head">
          <h3 id="qr-dialog-title"><QrCode size={18} aria-hidden="true" /> {t.qrDialogTitle}</h3>
          <button type="button" className="qr-close" ref={closeRef} onClick={onClose} aria-label={t.qrClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <p className="muted small-muted">{t.qrDialogIntro.replace('{authority}', authorityName)}</p>
        <p className="qr-status" role="status" aria-live="polite">{statusMessage}</p>

        {state === STATE.SCANNING || state === STATE.REQUESTING ? (
          <video ref={videoRef} className="qr-video" muted playsInline aria-label={t.qrVideoLabel} />
        ) : null}

        <div className="qr-actions">
          <button type="button" className="button secondary" onClick={startCamera} disabled={state === STATE.REQUESTING}>
            <Camera size={16} aria-hidden="true" /> {state === STATE.SCANNING ? t.qrRestartCamera : t.qrUseCamera}
          </button>
          <label className="button secondary qr-file-label">
            <FileImage size={16} aria-hidden="true" /> {t.qrUseFile}
            <input type="file" accept="image/*" onChange={onFileChange} className="qr-file-input" />
          </label>
        </div>

        {result && <QrResult result={result} country={country} />}

        <small>{t.qrPrivacyNote}</small>
      </div>
    </div>
  )
}

/**
 * Payload is the apostille's own field data. It may contain names, so the values
 * stay hidden behind an explicit reveal and only the field ORDER is shown by
 * default.
 */
function EmbeddedFieldsResult({ result }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <div className="status neutral qr-result">
      <QrCode aria-hidden="true" />
      <div>
        <strong>{t.qrFieldsTitle}</strong>
        <p>{t.qrFieldsBody}</p>
        {result.fieldShape && (
          <p className="qr-host">{t.qrFieldsShape} <code>{result.fieldShape}</code></p>
        )}
        {result.containsPersonalData && !revealed ? (
          <>
            <small>{t.qrFieldsPersonal}</small>
            <button type="button" className="button secondary" onClick={() => setRevealed(true)}>
              {t.qrFieldsReveal}
            </button>
          </>
        ) : (
          <pre className="qr-raw">{result.raw}</pre>
        )}
        <small>{t.qrNotAVerdict}</small>
      </div>
    </div>
  )
}

function cameraErrorMessage(error) {
  if (error === CAMERA_ERROR.DENIED) return t.qrCameraDenied
  if (error === CAMERA_ERROR.INSECURE_CONTEXT) return t.qrCameraInsecure
  return t.qrCameraUnavailable
}

/**
 * Function-specific result copy. The words "valid", "invalid", and "verified"
 * are deliberately absent from every branch: opening an official page is not the
 * same as this app having verified an apostille.
 */
function QrResult({ result, country }) {
  return (
    <>
      <QrResultBody result={result} country={country} />
      {isReportable(result) && <ReportPanel result={result} />}
    </>
  )
}

/**
 * Reporting is copy-to-clipboard, not submission: there is no backend to receive
 * a report, and a button labelled "Send" that transmits nothing would tell the
 * user they had reported when they had not.
 *
 * The payload is shown verbatim first, because a QR can carry personal data --
 * Costa Rica's encodes the signatory's and authenticating official's names. The
 * user sees exactly what they are about to copy before anything reaches the
 * clipboard, and nothing ever leaves the device on its own.
 */
function ReportPanel({ result }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)

  const payload = JSON.stringify(
    { authority: result.authorityId, outcome: result.kind, payload: result.raw },
    null,
    2
  )

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(payload)
      setCopied(true)
    } catch {
      // Clipboard access can be blocked by permissions policy or an insecure
      // context. Saying "Copied" then would be a false success: the user walks
      // away believing they have the text. Keep the preview on screen so they
      // can select it by hand, and say what happened.
      setCopyFailed(true)
    }
  }

  if (copied) {
    return (
      <p className="qr-report-done" role="status">
        {t.qrReportDone.replace('{email}', t.qrReportEmail)}
      </p>
    )
  }

  return (
    <div className="qr-report">
      <strong>{t.qrReportPrompt}</strong>
      <p className="small-muted">{t.qrReportBody}</p>
      {!open ? (
        <button type="button" className="button secondary" onClick={() => setOpen(true)}>
          <ClipboardCopy size={16} aria-hidden="true" /> {t.qrReportCta}
        </button>
      ) : (
        <div className="qr-report-preview">
          <small>{t.qrReportPreviewLabel}</small>
          <pre className="qr-raw">{payload}</pre>
          <small className="qr-report-warn"><AlertTriangle size={14} aria-hidden="true" /> {t.qrReportWarn}</small>
          {copyFailed && (
            <small className="qr-report-warn" role="status">
              <AlertTriangle size={14} aria-hidden="true" /> {t.qrReportCopyFailed.replace('{email}', t.qrReportEmail)}
            </small>
          )}
          <div className="qr-actions">
            <button type="button" className="button" onClick={onCopy}>{t.qrReportConfirm}</button>
            <button type="button" className="button secondary" onClick={() => setOpen(false)}>{t.qrReportCancel}</button>
          </div>
        </div>
      )}
    </div>
  )
}

function QrResultBody({ result, country }) {
  const officialCopy = result.kind === OUTCOME.OFFICIAL
    ? {
        verification_url: { title: t.qrFnVerificationTitle, body: t.qrFnVerificationBody, action: t.qrOpenVerification },
        portal_or_token: { title: t.qrFnPortalTitle, body: t.qrFnPortalBody, action: t.qrOpenPortal },
        document_url: { title: t.qrFnDocumentTitle, body: t.qrFnDocumentBody, action: t.qrOpenDocument }
      }[result.function]
    : null

  // An OFFICIAL result whose function has no copy would crash on copy.title and
  // take the whole dialog down. Unreachable with today's registry (the
  // classifier filters unknown, offline_app, and embedded_fields before tier 1),
  // but a data mistake should degrade to the no-action fallback below, not to a
  // white screen -- and the fallback never overclaims, which is the safe
  // direction for this app.
  if (result.kind === OUTCOME.OFFICIAL && officialCopy) {
    const copy = officialCopy
    return (
      <div className="status success qr-result">
        <ExternalLink aria-hidden="true" />
        <div>
          <strong>{copy.title}</strong>
          <p>{copy.body}</p>
          <p className="qr-host">{t.qrDestinationHost} <code>{result.host}</code></p>
          {result.token && <p className="qr-host">{t.qrExtractedToken} <code>{result.token}</code></p>}
          <a className="button" href={result.url} target="_blank" rel="noreferrer noopener">
            <ExternalLink size={16} aria-hidden="true" /> {copy.action}
          </a>
          <small>{t.qrNotAVerdict}</small>
        </div>
      </div>
    )
  }

  if (result.kind === OUTCOME.OFFLINE_APP) {
    return (
      <div className="status warning qr-result">
        <Smartphone aria-hidden="true" />
        <div>
          <strong>{t.qrFnOfflineTitle}</strong>
          <p>{result.app?.name ? t.qrFnOfflineBody.replace('{app}', result.app.name) : t.qrFnOfflineBodyGeneric}</p>
          <small>{t.qrNotAVerdict}</small>
        </div>
      </div>
    )
  }

  // Tier 2. Deliberately a different visual tone from OFFICIAL, with an action
  // labelled "continue to this address" rather than anything resembling
  // verification, because the only thing established is the namespace.
  if (result.kind === OUTCOME.UNVERIFIED_GOVERNMENT) {
    return (
      <div className="status warning qr-result">
        <Landmark aria-hidden="true" />
        <div>
          <strong>{t.qrGovTitle}</strong>
          <p>{t.qrGovBody.replace('{country}', country || '')}</p>
          <p className="qr-host">{t.qrDecodedHost} <code>{result.host}</code></p>
          {/*
            Tier 1 can show the host alone: the payload matched a closed template,
            so the rest of the URL is already known-good. Tier 2 has no template,
            so the host is the ONLY thing established -- showing just that would
            present a government hostname while hiding whatever path and query
            the user is about to open.
          */}
          <p className="qr-host">{t.qrGovFullUrl}</p>
          <pre className="qr-raw qr-gov-url">{result.url}</pre>
          <a className="button secondary" href={result.url} target="_blank" rel="noreferrer noopener">
            <ExternalLink size={16} aria-hidden="true" /> {t.qrGovOpen}
          </a>
          <small>{t.qrGovCaution}</small>
          <small>{t.qrNotAVerdict}</small>
        </div>
      </div>
    )
  }

  if (result.kind === OUTCOME.EMBEDDED_FIELDS) {
    return <EmbeddedFieldsResult result={result} />
  }

  if (result.kind === OUTCOME.BLOCKED) {
    return (
      <div className="status warning qr-result">
        <ShieldAlert aria-hidden="true" />
        <div>
          <strong>{t.qrBlockedTitle}</strong>
          <p>{t.qrBlockedBody}</p>
          <p className="qr-host">{t.qrDecodedHost} <code>{result.host}</code></p>
          <small>{t.qrBlockedNoOpen}</small>
        </div>
      </div>
    )
  }

  // NOT_ENABLED and UNSUPPORTED both end here: show what was decoded, plainly,
  // with no official action and no verification language.
  return (
    <div className="status warning qr-result">
      <AlertTriangle aria-hidden="true" />
      <div>
        <strong>{result.kind === OUTCOME.NOT_ENABLED ? t.qrNotEnabledTitle : t.qrUnsupportedTitle}</strong>
        <p>{result.kind === OUTCOME.NOT_ENABLED ? t.qrNotEnabledBody : t.qrUnsupportedBody}</p>
        <pre className="qr-raw">{result.raw}</pre>
        <small>{t.qrNotAVerdict}</small>
      </div>
    </div>
  )
}
