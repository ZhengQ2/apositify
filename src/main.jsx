import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ExternalLink, QrCode, ShieldCheck } from 'lucide-react'
import { eRegisters } from './data/e-registers'
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
          <p>It routes users to official e-Registers and clearly flags QR-only jurisdictions.</p>
        </article>
        <article>
          <h3>What I still need from you</h3>
          <p>Please provide your compiled Excel/CSV so the seed data can be expanded and verified for every jurisdiction.</p>
        </article>
      </section>
    </main>
  )
}

function ResultPanel({ selected }) {
  if (!selected) return <p className="status neutral">{t.noSelection}</p>

  if (selected.verificationMode === 'qr_only') {
    return (
      <div className="status warning">
        <QrCode aria-hidden="true" />
        <div>
          <strong>QR-code verification only</strong>
          <p>{t.qrOnly}</p>
          <small>{selected.notes}</small>
        </div>
      </div>
    )
  }

  return (
    <div className="status success">
      <ExternalLink aria-hidden="true" />
      <div>
        <strong>{selected.authority}</strong>
        <p>{selected.notes}</p>
        <a className="button" href={selected.registerUrl} target="_blank" rel="noreferrer">{t.verify}</a>
        <small>{t.privacy}</small>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
