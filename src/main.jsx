import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AlertTriangle, ExternalLink, MailQuestion, QrCode, ShieldCheck, UploadCloud } from 'lucide-react'
import { eRegisters, sourceUrl } from './data/e-registers'
import { verificationFields } from './data/verification-fields'
import { messages as t } from './i18n/en'
import { fieldKey, fieldLabel, validateVerificationField } from './verification-validation'
import { hasEnabledQrScanning, qrRecordsFor } from './data/qr-codes'
import { qrScannerFlagEnabled } from './feature-flags'
import { QrScannerDialog } from './QrScanner'
import './styles.css'

function App() {
  const [country, setCountry] = useState('')
  const [authorityId, setAuthorityId] = useState('')

  const countries = useMemo(() => [...new Set(eRegisters.map((entry) => entry.country))].sort(), [])
  const authorities = useMemo(
    () => eRegisters.filter((entry) => entry.country === country).sort((a, b) => a.authority.localeCompare(b.authority)),
    [country]
  )
  const selected = eRegisters.find((entry) => entry.id === authorityId)

  const onCountryChange = (event) => {
    setCountry(event.target.value)
    setAuthorityId('')
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="badge"><ShieldCheck size={18} /> Official sources only</div>
        <h1>{t.appTitle}</h1>
        <p>{t.subtitle}</p>
      </section>

      <section className="card" aria-labelledby="directory-heading">
        <h2 id="directory-heading">Start verification</h2>
        <p className="muted">Choose the jurisdiction and issuing authority shown on your Apostille.</p>

        <label>
          <span>{t.countryLabel}</span>
          <select value={country} onChange={onCountryChange}>
            <option value="">{t.countryPlaceholder}</option>
            {countries.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>

        <label>
          <span>{t.authorityLabel}</span>
          <select value={authorityId} onChange={(event) => setAuthorityId(event.target.value)} disabled={!country}>
            <option value="">{t.authorityPlaceholder}</option>
            {authorities.map((entry) => (
              <option key={entry.id} value={entry.id}>{entry.authority}</option>
            ))}
          </select>
        </label>

        <ResultPanel selected={selected} />
      </section>

      <section className="notes-grid">
        <article>
          <h3>How it works</h3>
          <p>Choose the country and issuing authority, then follow the official verification route listed for that authority.</p>
        </article>
        <article>
          <h3>What to expect</h3>
          <p>Some authorities support direct online lookup, while others require a QR code, a file upload, or direct contact with the issuing office.</p>
        </article>
      </section>

      <p className="source-note"><a href={sourceUrl} target="_blank" rel="noreferrer">Source: HCCH e-APP implementation chart</a></p>
    </main>
  )
}

function ResultPanel({ selected }) {
  if (!selected) return <p className="status neutral">{t.noSelection}</p>

  const details = [
    selected.eRegisterNumber ? `e-Register marker: ${selected.eRegisterNumber}` : null,
    selected.eApostilleDate ? `e-Apostille since: ${selected.eApostilleDate}` : null
  ].filter(Boolean)
  const registerLinks = selected.registerLinks || [{ label: t.verify, url: selected.registerUrl }]

  if (selected.verificationMode === 'qr_only') {
    return <Status icon={<QrCode aria-hidden="true" />} title="QR-code verification only" message={t.qrOnly} selected={selected} details={details} tone="warning" />
  }

  if (selected.verificationMode === 'manual_contact') {
    return <Status icon={<MailQuestion aria-hidden="true" />} title="Contact authority to verify" message={t.manualContact} selected={selected} details={details} tone="warning" />
  }

  if (selected.verificationMode === 'source_link_missing' || selected.verificationMode === 'hybrid_link_missing') {
    return (
      <Status
        icon={<AlertTriangle aria-hidden="true" />}
        title="Official link needs enrichment"
        message={selected.verificationMode === 'hybrid_link_missing' ? t.hybridLinkMissing : t.linkMissing}
        selected={selected}
        details={details}
        tone="warning"
      />
    )
  }

  return (
    <div className="status success">
      <ExternalLink aria-hidden="true" />
      <div>
        <strong>{selected.authority}</strong>
        <p>{selected.verificationMode === 'hybrid' ? t.hybrid : selected.notes}</p>
        {selected.registerGuide && (
          <div className="register-guide">
            <strong>{selected.registerGuide.title}</strong>
            <ol>
              {selected.registerGuide.steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </div>
        )}
        <div className="register-links">
          {registerLinks.map((link) => (
            <a key={link.url} className="button" href={link.url} target="_blank" rel="noreferrer">{link.label}</a>
          ))}
        </div>
        <small>{t.privacy}</small>
        <VerificationHelper entry={selected} />
        <QrSection entry={selected} />
      </div>
    </div>
  )
}

/**
 * Phase 3.4 entry point.
 *
 * The scanner opens for two groups, which then get very different treatment
 * from the classifier:
 *
 *   - Authorities with a decoded specimen, which can route against a verified
 *     host allowlist (tier 1).
 *   - Authorities whose QR presence is `confirmed`, whose format we have not
 *     seen, AND whose function is URL-based, which fall back to the
 *     government-namespace heuristic (tier 2) and get explicitly unverified copy.
 *
 * Everything else keeps guidance instead, because opening a scanner that can
 * only answer "not enabled" is worse than the text it replaces:
 *   - `offline_app` and `embedded_fields` without a specimen have no URL for
 *     tier 2 to match, so their guidance (use GouvCheck; compare the printed
 *     fields) is the actually useful answer.
 *   - `underlying_only` is excluded outright: the QR belongs to the source
 *     document, not the Apostille.
 *   - `reported` and `public_specimen` give no basis to route at all.
 */
// Functions whose payload is a URL, and which tier 2 can therefore help with.
// offline_app and embedded_fields are non-routable by nature: their payloads are
// a signed blob and delimited text, so a government-namespace heuristic has
// nothing to match and the scanner can only report "not enabled".
const TIER_2_CAPABLE = new Set(['verification_url', 'portal_or_token', 'document_url', 'unknown'])

function QrSection({ entry }) {
  const [open, setOpen] = useState(false)
  const records = qrRecordsFor(entry.id)
  // A confirmed authority is only worth opening the scanner for if it can
  // actually reach a tier. Luxembourg is confirmed offline_app with no specimen:
  // scanning it returns NOT_ENABLED and costs the user the GouvCheck
  // instructions that confirmedGuidance() would otherwise show.
  const tier2Candidate = records.some(
    (record) => record.presence === 'confirmed' && TIER_2_CAPABLE.has(record.function)
  )
  const scannable = qrScannerFlagEnabled && (hasEnabledQrScanning(entry.id) || tier2Candidate)

  useEffect(() => setOpen(false), [entry.id])

  if (records.length === 0) return null

  if (scannable) {
    return (
      <div className="verify-helper">
        <button type="button" className="button secondary" onClick={() => setOpen(true)}>
          <QrCode size={16} aria-hidden="true" /> {t.qrScanCta}
        </button>
        {open && (
          <QrScannerDialog
            authorityId={entry.id}
            authorityName={entry.authority}
            country={entry.country}
            onClose={() => setOpen(false)}
          />
        )}
      </div>
    )
  }

  const presences = new Set(records.map((record) => record.presence))
  const guidance = presences.has('underlying_only')
    ? t.qrInfoUnderlyingOnly
    : presences.has('confirmed')
      ? confirmedGuidance(records)
      : presences.has('public_specimen') || presences.has('reported')
        ? t.qrInfoReported
        : null
  if (!guidance) return null

  return (
    <div className="verify-helper">
      <div className="verify-helper-heading">
        <QrCode size={16} aria-hidden="true" />
        <span>{t.qrSectionHeading}</span>
      </div>
      <small>{guidance}</small>
    </div>
  )
}

/**
 * Guidance shown when in-app scanning is unavailable. It has to branch on the
 * QR's function: "check the destination is an official government address" is
 * actively wrong for Costa Rica, whose QR is local field data with no
 * destination, and for Luxembourg, whose QR is read by a government app.
 */
function confirmedGuidance(records) {
  const confirmed = records.filter((record) => record.presence === 'confirmed')
  const functions = new Set(confirmed.map((record) => record.function))

  // Only collapse to a single non-URL message when every confirmed record for
  // this authority agrees; a mixed authority still needs the URL wording.
  if (functions.size === 1) {
    if (functions.has('embedded_fields')) return t.qrInfoConfirmedFields
    if (functions.has('offline_app')) {
      const appName = confirmed.find((record) => record.app?.name)?.app?.name
      return appName
        ? t.qrInfoConfirmedOfflineApp.replace('{app}', appName)
        : t.qrInfoConfirmedOfflineAppGeneric
    }
    if (functions.has('document_url')) return t.qrInfoConfirmedDocument
  }
  return t.qrInfoConfirmed
}

function VerificationHelper({ entry }) {
  const config = verificationFields[entry.id]
  const [values, setValues] = useState({})
  const [touched, setTouched] = useState({})

  useEffect(() => {
    setValues({})
    setTouched({})
  }, [entry.id])

  if (!config || (config.kind !== 'upload' && !config.deepLink)) return null

  if (config.kind === 'upload') {
    return (
      <div className="verify-helper">
        <div className="verify-helper-heading">
          <UploadCloud size={16} aria-hidden="true" />
          <span>{t.uploadKindNote}</span>
        </div>
        {config.note && <small>{config.note}</small>}
      </div>
    )
  }

  const onFieldChange = (field, index, value) => {
    const key = fieldKey(field, index)
    setValues((prev) => ({ ...prev, [key]: value }))
    setTouched((prev) => ({ ...prev, [key]: true }))
  }

  const errors = Object.fromEntries(config.fields.map((field, index) => {
    const key = fieldKey(field, index)
    return [key, validateVerificationField(field, values[key] || '')]
  }))
  const deepLinkReady = Boolean(config.deepLink) && Object.values(errors).every((error) => !error)
  const deepLinkMethod = config.deepLink?.method === 'post' ? 'post' : 'get'

  const deepLinkUrl = deepLinkReady && deepLinkMethod === 'get'
    ? (() => {
        const url = new URL(config.deepLink.baseUrl)
        Object.entries(config.deepLink.extraParams || {}).forEach(([key, value]) => url.searchParams.set(key, value))
        config.deepLink.paramOrder.forEach((param, index) => {
          url.searchParams.set(param, values[fieldKey(config.fields[index], index)].trim())
        })
        return url.toString()
      })()
    : null

  const onDeepLinkPost = () => {
    const form = document.createElement('form')
    form.method = 'post'
    form.action = config.deepLink.actionUrl
    form.target = '_blank'
    form.rel = 'noreferrer'
    const appendHidden = (name, value) => {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = name
      input.value = value
      form.appendChild(input)
    }
    Object.entries(config.deepLink.extraParams || {}).forEach(([key, value]) => appendHidden(key, value))
    config.deepLink.paramOrder.forEach((param, index) => appendHidden(param, values[fieldKey(config.fields[index], index)].trim()))
    document.body.appendChild(form)
    form.submit()
    document.body.removeChild(form)
  }

  return (
    <div className="verify-helper">
      <h4>{t.helperTitle}</h4>
      <p className="muted small-muted">{t.helperIntroDeepLink}</p>
      {config.fields.map((field, index) => {
        const key = fieldKey(field, index)
        const error = errors[key]
        return (
        <label key={key} className="field-row">
          <span>{fieldLabel(field)}</span>
          <input
            type="text"
            value={values[key] || ''}
            placeholder={field.placeholder}
            aria-invalid={touched[key] && Boolean(error)}
            aria-describedby={touched[key] && error ? `${key}-error` : undefined}
            onChange={(event) => onFieldChange(field, index, event.target.value)}
          />
          {touched[key] && error && <small id={`${key}-error`} className="field-error">{error}</small>}
        </label>
        )
      })}
      {config.note && <small>{config.note}</small>}
      {deepLinkUrl && (
        <a className="button" href={deepLinkUrl} target="_blank" rel="noreferrer">
          <ExternalLink size={16} aria-hidden="true" />
          {t.verifyNow}
        </a>
      )}
      {deepLinkMethod === 'post' && (
        <button type="button" className="button" onClick={onDeepLinkPost} disabled={!deepLinkReady}>
          <ExternalLink size={16} aria-hidden="true" />
          {t.verifyNow}
        </button>
      )}
    </div>
  )
}

function Status({ icon, title, message, selected, details, tone }) {
  return (
    <div className={`status ${tone}`}>
      {icon}
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
        <small>{selected.notes}</small>
        {details.length > 0 && <small>{details.join(' · ')}</small>}
        <QrSection entry={selected} />
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
