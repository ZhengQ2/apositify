import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AlertTriangle, ExternalLink, MailQuestion, QrCode, ShieldCheck } from 'lucide-react'
import { eRegisters, sourceUrl } from './data/e-registers'
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
      </div>
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
