import assert from 'node:assert/strict'
import { eRegisters, sourceUrl } from '../src/data/e-registers.js'
import { verificationFields } from '../src/data/verification-fields.js'
import { validateVerificationField } from '../src/verification-validation.js'

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
    'Choose APOSTIL if the Apostille identifies the APOSTIL system.',
    'Choose legacy SEI Apostila if the Apostille identifies the SEI Apostila system.',
    'If neither system is named, use the verification URL printed on the Apostille.'
  ]
})

assert.equal(validateVerificationField({ format: 'date-iso' }, '2026-02-28'), '')
assert.notEqual(validateVerificationField({ format: 'date-iso' }, '2026-02-30'), '')
assert.equal(validateVerificationField({ format: 'date-dotted' }, '28.02.2026'), '')
assert.notEqual(validateVerificationField({ format: 'date-dotted' }, '2026-02-28'), '')
assert.notEqual(validateVerificationField({ format: 'non-arij-apostille-code' }, 'ARIJ-123'), '')

console.log(`Validated ${eRegisters.length} e-Register entries across ${countries.size} jurisdictions.`)
console.log(`Mode counts: ${JSON.stringify(modeCounts)}`)
