import assert from 'node:assert/strict'
import { eRegisters, sourceUrl } from '../src/data/e-registers.js'
import { verificationFields } from '../src/data/verification-fields.js'
import { validateVerificationField } from '../src/verification-validation.js'
import { QR_EVIDENCE, QR_FUNCTION, QR_PRESENCE, hasEnabledQrScanning, qrCodes, qrRecordsFor } from '../src/data/qr-codes.js'

assert.equal(sourceUrl, 'https://assets.hcch.net/docs/e8e7549d-e34a-452f-9fa3-cf2241aa4197.pdf')
assert.ok(eRegisters.length > 0, 'dataset must not be empty')

const ids = new Set()
const countries = new Set()
const allowedModes = new Set(['online', 'hybrid', 'source_link_missing', 'hybrid_link_missing', 'qr_only', 'manual_contact'])
const modeCounts = Object.fromEntries([...allowedModes].map((mode) => [mode, 0]))

for (const entry of eRegisters) {
  assert.ok(entry.id, 'entry id is required')
  assert.ok(!ids.has(entry.id), `duplicate id: ${entry.id}`)
  ids.add(entry.id)

  assert.ok(Number.isInteger(entry.sourceRecordId), `${entry.id} sourceRecordId is required`)
  assert.ok(entry.country, `${entry.id} country is required`)
  assert.ok(entry.authority, `${entry.id} authority is required`)
  assert.ok(entry.notes, `${entry.id} notes are required`)
  assert.ok(allowedModes.has(entry.verificationMode), `${entry.id} has invalid verificationMode`)

  if (entry.verificationMode === 'online' || entry.verificationMode === 'hybrid') {
    assert.ok(entry.registerUrl, `${entry.id} must expose registerUrl for ${entry.verificationMode} entries`)
    assert.ok(/^https?:\/\//i.test(entry.registerUrl), `${entry.id} registerUrl must be HTTP(S)`)
  } else {
    assert.equal(entry.registerUrl, '', `${entry.id} must not expose registerUrl for ${entry.verificationMode} entries`)
  }

  if (entry.registerLinks) {
    assert.ok(Array.isArray(entry.registerLinks) && entry.registerLinks.length > 0, `${entry.id} registerLinks must be a non-empty list`)
    for (const link of entry.registerLinks) {
      assert.ok(link.label, `${entry.id} register link requires a label`)
      assert.ok(/^https?:\/\//i.test(link.url), `${entry.id} register link must be HTTP(S)`)
    }
  }

  countries.add(entry.country)
  modeCounts[entry.verificationMode] += 1
}

assert.equal(countries.size, 64, 'dataset should cover all 64 HCCH implementation chart contracting-party rows')
assert.equal(eRegisters.length, 97, 'dataset should include all 97 competent-authority rows')
assert.equal(modeCounts.qr_only, 6, 'dataset should include the six QR-only authority rows (includes Rwanda, reclassified 2026-07 after its listed link turned out to be a non-apostille file tracker)')
assert.equal(modeCounts.manual_contact, 5, 'dataset should include five manual-contact authority rows (Connecticut and Utah from expired pilots, plus Nicaragua, Baja California Sur and Rhode Island reclassified 2026-07 after no working e-Register was found; Texas and Austria were restored to online 2026-07 once their real verifiers were identified)')
assert.ok(modeCounts.online + modeCounts.hybrid + modeCounts.source_link_missing + modeCounts.hybrid_link_missing > 0, 'dataset should include e-Register rows')

const directLinkConfigs = Object.values(verificationFields).filter((config) => config.deepLink)
assert.equal(directLinkConfigs.length, 6, 'six authorities should have confirmed direct verification flows')

for (const config of directLinkConfigs) {
  assert.ok(config.fields.every((field) => typeof field === 'object' && field.name && field.label), 'direct-link fields need stable names and labels')
  assert.equal(config.fields.length, config.deepLink.paramOrder.length, 'direct-link field order must match verifier parameters')
}

const brazil = eRegisters.find((entry) => entry.id === 'brazil-national-council-of-justice')
assert.ok(brazil, 'Brazil National Council of Justice entry is required')
assert.equal(brazil.registerUrl, 'https://apostil.cnj.jus.br/pt/validation')
assert.deepEqual(brazil.registerLinks, [
  { label: 'Validate in APOSTIL', url: 'https://apostil.cnj.jus.br/pt/validation' },
  { label: 'Validate in legacy SEI Apostila', url: 'https://apostila.cnj.jus.br/seiapostila/controlador_externo.php?acao=documento_conferir&acao_origem=documento_conferir&lang=pt_BR&id_orgao_acesso_externo=0' }
])
assert.deepEqual(brazil.registerGuide, {
  title: 'Which link should I use?',
  steps: [
    'Choose legacy SEI Apostila for an Apostille issued before 3 August 2020.',
    'Choose APOSTIL for an Apostille issued on or after 3 August 2020.'
  ]
})

// --- Phase 3.1: authority-scoped QR registry -------------------------------

const qrPresence = new Set(QR_PRESENCE)
const qrEvidence = new Set(QR_EVIDENCE)
const qrFunction = new Set(QR_FUNCTION)
const presenceCounts = Object.fromEntries([...qrPresence].map((value) => [value, 0]))

for (const id of Object.keys(qrCodes)) {
  assert.ok(ids.has(id), `qrCodes has an entry for unknown authority id: ${id}`)
}

for (const entry of eRegisters) {
  const records = qrRecordsFor(entry.id)
  assert.ok(records.length > 0, `${entry.id} needs a qrCode record (use not_established when no QR was found)`)

  for (const record of records) {
    assert.ok(qrPresence.has(record.presence), `${entry.id} has invalid qrCode.presence: ${record.presence}`)
    assert.ok(record.evidence === null || qrEvidence.has(record.evidence), `${entry.id} has invalid qrCode.evidence`)
    assert.ok(qrFunction.has(record.function), `${entry.id} has invalid qrCode.function`)
    assert.equal(typeof record.enabled, 'boolean', `${entry.id} qrCode.enabled must be a boolean`)
    assert.ok(record.notes, `${entry.id} qrCode record needs notes explaining the evidence`)
    assert.ok(Array.isArray(record.allowedUrls), `${entry.id} qrCode.allowedUrls must be an array`)

    // Evidence must accompany any positive presence claim.
    if (record.presence === 'confirmed' || record.presence === 'public_specimen') {
      assert.ok(record.evidence, `${entry.id} claims ${record.presence} but cites no evidence source`)
      assert.ok(record.sourceUrl, `${entry.id} claims ${record.presence} but cites no sourceUrl`)
    }
    // The inverse: a not_established/reported row must not carry routing data,
    // so a future edit cannot half-enable an authority by adding hosts alone.
    if (record.presence === 'not_established' || record.presence === 'reported') {
      assert.equal(record.allowedUrls.length, 0, `${entry.id} is ${record.presence} and must not carry allowedUrls`)
    }

    for (const rule of record.allowedUrls) {
      assert.equal(rule.protocol, 'https:', `${entry.id} allowedUrls must be HTTPS unless a legacy endpoint is separately risk-accepted`)
      assert.ok(rule.hostname && !rule.hostname.includes('/'), `${entry.id} allowedUrls.hostname must be a bare hostname, not a path`)
      assert.equal(rule.hostname, rule.hostname.toLowerCase(), `${entry.id} allowedUrls.hostname must be lowercase ASCII`)
      if (rule.pathnamePattern) assert.doesNotThrow(() => new RegExp(rule.pathnamePattern), `${entry.id} has an invalid pathnamePattern`)
    }

    // The production gate. Enabling an authority requires a known function, two
    // current independent specimens, a cited evidence source, and the routing
    // metadata that function needs.
    if (record.enabled) {
      assert.notEqual(record.function, 'unknown', `${entry.id} cannot be enabled with an undocumented QR function`)
      assert.ok(record.specimenCount >= 2, `${entry.id} needs two current independent specimens before enabling`)
      assert.ok(record.specimenTestedAt, `${entry.id} needs a specimenTestedAt date before enabling`)
      assert.ok(record.evidence, `${entry.id} needs an evidence source before enabling`)
      assert.equal(record.presence, 'confirmed', `${entry.id} may only be enabled when presence is confirmed`)
      if (record.function === 'offline_app') {
        assert.ok(record.app?.name, `${entry.id} offline_app records need the government app name`)
      } else {
        assert.ok(record.allowedUrls.length > 0, `${entry.id} needs at least one allowedUrls rule before enabling`)
      }
    }

    presenceCounts[record.presence] += 1
  }
}

// Matches docs/PHASE_3_QR_CODE_RESEARCH.md. Update these together with the
// research doc, never separately.
const confirmedAuthorities = eRegisters.filter((entry) => qrRecordsFor(entry.id).some((record) => record.presence === 'confirmed'))
const confirmedParties = new Set(confirmedAuthorities.map((entry) => entry.country))
// The research counts 23 *parties*. That is 24 *authorities*, because China's
// Mainland MFA and Hong Kong Judiciary are separately confirmed while Macao is
// not — exactly the kind of country-level inheritance the registry must prevent.
assert.equal(confirmedParties.size, 23, 'research documents 23 parties with a confirmed apostille QR')
assert.equal(confirmedAuthorities.length, 24, 'those 23 parties resolve to 24 competent authorities (China contributes two)')
assert.equal(
  eRegisters.filter((entry) => hasEnabledQrScanning(entry.id)).length,
  0,
  'no authority may ship enabled until it has two current specimens and a tested destination (Phase 3C)'
)

assert.equal(validateVerificationField({ format: 'date-iso' }, '2026-02-28'), '')
assert.notEqual(validateVerificationField({ format: 'date-iso' }, '2026-02-30'), '')
assert.equal(validateVerificationField({ format: 'date-dotted' }, '28.02.2026'), '')
assert.notEqual(validateVerificationField({ format: 'date-dotted' }, '2026-02-28'), '')
assert.notEqual(validateVerificationField({ format: 'non-arij-apostille-code' }, 'ARIJ-123'), '')

console.log(`Validated ${eRegisters.length} e-Register entries across ${countries.size} jurisdictions.`)
console.log(`Mode counts: ${JSON.stringify(modeCounts)}`)
console.log(`QR presence counts: ${JSON.stringify(presenceCounts)}`)
