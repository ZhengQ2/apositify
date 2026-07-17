import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AlertTriangle, Check, Copy, ExternalLink, MailQuestion, QrCode, ShieldCheck, UploadCloud } from 'lucide-react'
import { eRegisters, sourceUrl } from './data/e-registers'
import { verificationFields } from './data/verification-fields'
import { messages as t } from './i18n/en'
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
        <div className="badge"><ShieldCheck size={18} /> Phase 1 directory</div>
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
          <h3>What Phase 1 does</h3>
          <p>It uses the full HCCH chart JSON to show every listed contracting party and competent authority.</p>
        </article>
        <article>
          <h3>Production data status</h3>
          <p>Rows with extracted official URLs enable direct redirects; QR-only and missing-link rows are clearly marked instead of exposing placeholder links.</p>
        </article>
      </section>

      <p className="source-note"><a href={sourceUrl} target="_blank" rel="noreferrer">HCCH e-APP implementation chart source PDF</a></p>
    </main>
  )
}

function ResultPanel({ selected }) {
  if (!selected) return <p className="status neutral">{t.noSelection}</p>

  const details = [
    selected.eRegisterNumber ? `e-Register marker: ${selected.eRegisterNumber}` : null,
    selected.eApostilleDate ? `e-Apostille since: ${selected.eApostilleDate}` : null
  ].filter(Boolean)

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
        <a className="button" href={selected.registerUrl} target="_blank" rel="noreferrer">{t.verify}</a>
        <small>{t.privacy}</small>
        <VerificationHelper entry={selected} />
      </div>
    </div>
  )
}

function VerificationHelper({ entry }) {
  const config = verificationFields[entry.id]
  const [values, setValues] = useState({})
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setValues({})
    setCopied(false)
  }, [entry.id])

  if (!config) return null

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

  const onFieldChange = (field, value) => {
    setValues((prev) => ({ ...prev, [field]: value }))
    setCopied(false)
  }

  const hasAnyValue = config.fields.some((field) => (values[field] || '').trim())
  const allFieldsFilled = config.fields.every((field) => (values[field] || '').trim())
  const summary = config.fields
    .map((field) => `${field}: ${(values[field] || '').trim() || '(not entered)'}`)
    .join('\n')

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(summary)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const deepLinkReady = Boolean(config.deepLink) && allFieldsFilled
  const deepLinkMethod = config.deepLink?.method === 'post' ? 'post' : 'get'

  const deepLinkUrl = deepLinkReady && deepLinkMethod === 'get'
    ? (() => {
        const url = new URL(config.deepLink.baseUrl)
        Object.entries(config.deepLink.extraParams || {}).forEach(([key, value]) => url.searchParams.set(key, value))
        config.deepLink.paramOrder.forEach((param, index) => {
          url.searchParams.set(param, values[config.fields[index]].trim())
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
    config.deepLink.paramOrder.forEach((param, index) => appendHidden(param, values[config.fields[index]].trim()))
    document.body.appendChild(form)
    form.submit()
    document.body.removeChild(form)
  }

  return (
    <div className="verify-helper">
      <h4>{t.helperTitle}</h4>
      <p className="muted small-muted">{config.deepLink ? t.helperIntroDeepLink : t.helperIntro}</p>
      {config.fields.map((field) => (
        <label key={field} className="field-row">
          <span>{field}</span>
          <input
            type="text"
            value={values[field] || ''}
            onChange={(event) => onFieldChange(field, event.target.value)}
          />
        </label>
      ))}
      {config.note && <small>{config.note}</small>}
      {deepLinkUrl && (
        <a className="button" href={deepLinkUrl} target="_blank" rel="noreferrer">
          <ExternalLink size={16} aria-hidden="true" />
          {t.verifyNow}
        </a>
      )}
      {deepLinkReady && deepLinkMethod === 'post' && (
        <button type="button" className="button" onClick={onDeepLinkPost}>
          <ExternalLink size={16} aria-hidden="true" />
          {t.verifyNow}
        </button>
      )}
      {hasAnyValue && !deepLinkReady && (
        <div className="copy-panel">
          <p className="muted small-muted">{t.helperCopyIntro}</p>
          <pre>{summary}</pre>
          <button type="button" className="button secondary" onClick={onCopy}>
            {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            {copied ? t.copied : t.copyValues}
          </button>
        </div>
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
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
