import assert from 'node:assert/strict'
import { eRegisters } from '../src/data/e-registers.js'

assert.ok(eRegisters.length > 0, 'dataset must not be empty')

const ids = new Set()
for (const entry of eRegisters) {
  assert.ok(entry.id, 'entry id is required')
  assert.ok(!ids.has(entry.id), `duplicate id: ${entry.id}`)
  ids.add(entry.id)
  assert.ok(entry.country, `${entry.id} country is required`)
  assert.ok(entry.authority, `${entry.id} authority is required`)
  assert.ok(['online', 'qr_only'].includes(entry.verificationMode), `${entry.id} has invalid verificationMode`)

  if (entry.verificationMode === 'online') {
    assert.ok(entry.registerUrl, `${entry.id} registerUrl is required for online registers`)
    const url = new URL(entry.registerUrl)
    assert.equal(url.protocol, 'https:', `${entry.id} must use an HTTPS URL`)
  }

  if (entry.verificationMode === 'qr_only') {
    assert.equal(entry.registerUrl, '', `${entry.id} QR-only entries must not have a fixed URL`)
  }
}

console.log(`Validated ${eRegisters.length} e-Register entries.`)
