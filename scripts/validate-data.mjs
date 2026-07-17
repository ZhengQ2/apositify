import assert from 'node:assert/strict'
import { eRegisters, sourceUrl } from '../src/data/e-registers.js'

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

  countries.add(entry.country)
  modeCounts[entry.verificationMode] += 1
}

assert.equal(countries.size, 64, 'dataset should cover all 64 HCCH implementation chart contracting-party rows')
assert.equal(eRegisters.length, 97, 'dataset should include all 97 competent-authority rows')
assert.equal(modeCounts.qr_only, 6, 'dataset should include the six QR-only authority rows (includes Rwanda, reclassified 2026-07 after its listed link turned out to be a non-apostille file tracker)')
assert.equal(modeCounts.manual_contact, 6, 'dataset should include six manual-contact authority rows (Connecticut and Utah from expired pilots, plus Nicaragua, Baja California Sur, Rhode Island and Austria reclassified 2026-07 after no working e-Register was found; Texas was restored to online 2026-07 once its real "Verify Issuance of an Apostille" verifier was identified)')
assert.ok(modeCounts.online + modeCounts.hybrid + modeCounts.source_link_missing + modeCounts.hybrid_link_missing > 0, 'dataset should include e-Register rows')

console.log(`Validated ${eRegisters.length} e-Register entries across ${countries.size} jurisdictions.`)
console.log(`Mode counts: ${JSON.stringify(modeCounts)}`)
