// Phase 3.2 / 3.4 — the scanner dialog.
//
// Two input routes at parity: live camera, and a saved image from the file
// picker. The file picker is not a degraded fallback — it is the only route that
// works when camera permission is denied, no camera exists, or the page is not
// in a secure context, and it must stay keyboard-operable throughout.
//
// The dialog never claims an apostille is valid. It reports what it decoded and,
// only for an authority that passed the evidence gate, offers to open a
// destination that matched that authority's complete URL rule.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Camera, ExternalLink, FileImage, QrCode, ShieldAlert, Smartphone, X } from 'lucide-react'
import { CAMERA_ERROR, DECODE, decodeFromFile, decodeFromVideo, requestCameraStream, stopStream } from './qr-decoder'
import { OUTCOME, classifyQrPayload } from './qr-routing'
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

export function QrScannerDialog({ authorityId, authorityName, onClose }) {
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

  const releaseCamera = useCallback(() => {
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
        setState((current) => (current === STATE.SCANNING ? STATE.IDLE : current))
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [releaseCamera])

  useEffect(() => {
    closeRef.current?.focus()
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const handlePayload = useCallback((text) => {
    releaseCamera()
    setResult(classifyQrPayload(text, authorityId))
    setDecodeIssue(null)
    setState(STATE.DECODED)
  }, [authorityId, releaseCamera])

  const startCamera = useCallback(async () => {
    setResult(null)
    setDecodeIssue(null)
    setState(STATE.REQUESTING)
    const { stream, error } = await requestCameraStream()
    if (error) {
      setCameraError(error)
      setState(STATE.CAMERA_ERROR)
      return
    }
    streamRef.current = stream
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      await videoRef.current.play().catch(() => {})
    }
    setState(STATE.SCANNING)
    timerRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current) return
      const decoded = await decodeFromVideo(videoRef.current, canvasRef.current)
      if (decoded.status === DECODE.OK) handlePayload(decoded.text)
      else if (decoded.status === DECODE.MULTIPLE) setDecodeIssue(DECODE.MULTIPLE)
      else setDecodeIssue(null)
    }, SCAN_INTERVAL_MS)
  }, [handlePayload])

  const onFileChange = useCallback(async (event) => {
    const file = event.target.files?.[0]
    event.target.value = '' // allow re-picking the same file after a failed scan
    if (!file) return
    releaseCamera()
    setResult(null)
    setDecodeIssue(null)
    setState(STATE.DECODING_FILE)
    if (!canvasRef.current) canvasRef.current = document.createElement('canvas')
    const decoded = await decodeFromFile(file, canvasRef.current)
    if (decoded.status === DECODE.OK) {
      handlePayload(decoded.text)
      return
    }
    setDecodeIssue(decoded.status)
    setState(STATE.NO_QR)
  }, [handlePayload, releaseCamera])

  const statusMessage = useMemo(() => {
    switch (state) {
      case STATE.REQUESTING: return t.qrStateRequesting
      case STATE.SCANNING: return decodeIssue === DECODE.MULTIPLE ? t.qrMultipleCodes : t.qrStateScanning
      case STATE.DECODING_FILE: return t.qrStateDecodingFile
      case STATE.NO_QR: return decodeIssue === DECODE.UNREADABLE ? t.qrUnreadableImage : t.qrNoCodeFound
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

        {result && <QrResult result={result} />}

        <small>{t.qrPrivacyNote}</small>
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
function QrResult({ result }) {
  if (result.kind === OUTCOME.OFFICIAL) {
    const copy = {
      verification_url: { title: t.qrFnVerificationTitle, body: t.qrFnVerificationBody, action: t.qrOpenVerification },
      portal_or_token: { title: t.qrFnPortalTitle, body: t.qrFnPortalBody, action: t.qrOpenPortal },
      document_url: { title: t.qrFnDocumentTitle, body: t.qrFnDocumentBody, action: t.qrOpenDocument }
    }[result.function]

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
