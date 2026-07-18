// Phase 3.6 — QR routing security tests.
//
// These use SYNTHETIC fixture authorities registered at test time. Synthetic
// fixtures exist to exercise the decoder and the security boundary; per the
// Phase 3 evidence gate they can never satisfy a real authority's enablement.
// Every real authority stays disabled, which is asserted in validate-data.mjs.

import assert from 'node:assert/strict'
import { OUTCOME, classifyQrPayload, hostnameMatches, normalizeHostname } from '../src/qr-routing.js'
import { qrCodes } from '../src/data/qr-codes.js'

let passed = 0
function check(name, fn) {
  fn()
  passed += 1
  void name
}

// --- synthetic fixtures ----------------------------------------------------

const base = {
  presence: 'confirmed',
  evidence: 'official_specimen',
  enabled: true,
  specimenCount: 2,
  specimenTestedAt: '2026-07-17',
  sourceUrl: 'https://example.gov/spec',
  checkedAt: '2026-07-17',
  notes: 'Synthetic test fixture.'
}

qrCodes['fixture-verification'] = {
  ...base,
  function: 'verification_url',
  allowedUrls: [{ protocol: 'https:', hostname: 'verify.example.gov', port: '', pathnamePattern: '^/apostille/[A-Z0-9-]{6,32}$' }]
}
qrCodes['fixture-canonical'] = {
  ...base,
  function: 'verification_url',
  allowedUrls: [{
    protocol: 'https:',
    hostname: 'legacy.example.gov',
    port: '',
    pathnamePattern: '^/r/[A-Z0-9]{8}$',
    tokenPattern: '^/r/([A-Z0-9]{8})$',
    canonicalUrlTemplate: 'https://verify.example.gov/apostille/{token}'
  }]
}
qrCodes['fixture-subdomains'] = {
  ...base,
  function: 'portal_or_token',
  allowedUrls: [{ protocol: 'https:', hostname: 'example.gov', port: '', pathnamePattern: null, allowSubdomains: true }]
}
qrCodes['fixture-document'] = {
  ...base,
  function: 'document_url',
  allowedUrls: [{ protocol: 'https:', hostname: 'docs.example.gov', port: '', pathnamePattern: null, allowedSearchParams: ['id'] }]
}
qrCodes['fixture-offline'] = { ...base, function: 'offline_app', allowedUrls: [], app: { name: 'GovCheck' } }
qrCodes['fixture-unknown-fn'] = {
  ...base,
  function: 'unknown',
  allowedUrls: [{ protocol: 'https:', hostname: 'mystery.example.gov', port: '', pathnamePattern: null }]
}

const GOOD = 'https://verify.example.gov/apostille/ABC12345'
const classify = (text, id = 'fixture-verification') => classifyQrPayload(text, id)

// --- hostname normalisation and matching -----------------------------------

check('normalizes case and a trailing root dot', () => {
  assert.equal(normalizeHostname('Verify.Example.GOV.'), 'verify.example.gov')
})

check('exact host matching rejects look-alike suffixes and prefixes', () => {
  const rule = { hostname: 'e-verify.am' }
  assert.equal(hostnameMatches('e-verify.am', rule), true)
  assert.equal(hostnameMatches('evil-e-verify.am', rule), false, 'suffix without a dot boundary must not match')
  assert.equal(hostnameMatches('e-verify.am.attacker.test', rule), false)
  assert.equal(hostnameMatches('sub.e-verify.am', rule), false, 'subdomains need an explicit rule')
})

check('subdomain rule honours the dot boundary', () => {
  const rule = { hostname: 'example.gov', allowSubdomains: true }
  assert.equal(hostnameMatches('portal.example.gov', rule), true)
  assert.equal(hostnameMatches('example.gov', rule), true)
  assert.equal(hostnameMatches('notexample.gov', rule), false)
})

check('IDN homograph host is punycoded and does not match ASCII host', () => {
  // Cyrillic "е" in "vеrify".
  const result = classify('https://vеrify.example.gov/apostille/ABC12345')
  assert.equal(result.kind, OUTCOME.BLOCKED)
  assert.ok(result.host.startsWith('xn--'), 'host should be normalized to punycode')
})

// --- happy paths per function ----------------------------------------------

check('matching verification_url payload yields an official action', () => {
  const result = classify(GOOD)
  assert.equal(result.kind, OUTCOME.OFFICIAL)
  assert.equal(result.function, 'verification_url')
  assert.equal(result.url, GOOD)
  assert.equal(result.host, 'verify.example.gov')
})

check('canonical rebuild uses the stored base, not the payload URL', () => {
  const result = classify('https://legacy.example.gov/r/ZX9Q7T2K', 'fixture-canonical')
  assert.equal(result.kind, OUTCOME.OFFICIAL)
  assert.equal(result.canonical, true)
  assert.equal(result.token, 'ZX9Q7T2K')
  assert.equal(result.url, 'https://verify.example.gov/apostille/ZX9Q7T2K')
})

check('document_url and portal_or_token keep their own function label', () => {
  assert.equal(classify('https://docs.example.gov/file.pdf', 'fixture-document').function, 'document_url')
  assert.equal(classify('https://portal.example.gov/x', 'fixture-subdomains').function, 'portal_or_token')
})

check('offline_app never produces a URL to open', () => {
  const result = classify('BASE64SIGNEDPAYLOAD==', 'fixture-offline')
  assert.equal(result.kind, OUTCOME.OFFLINE_APP)
  assert.equal(result.url, undefined)
  assert.equal(result.app.name, 'GovCheck')
})

check('an allowlisted host with an undocumented function offers no official action', () => {
  const result = classify('https://mystery.example.gov/x', 'fixture-unknown-fn')
  assert.equal(result.kind, OUTCOME.UNSUPPORTED)
  assert.equal(result.reason, 'undocumented_function')
})

// --- adversarial payloads ---------------------------------------------------

const adversarial = [
  ['credentials disguising the host', 'https://verify.example.gov@attacker.test/apostille/ABC12345', OUTCOME.UNSUPPORTED, 'credentials_in_url'],
  ['javascript scheme', 'javascript:alert(1)', OUTCOME.UNSUPPORTED, 'unsupported_scheme'],
  ['data scheme', 'data:text/html;base64,PHNjcmlwdD4=', OUTCOME.UNSUPPORTED, 'unsupported_scheme'],
  ['file scheme', 'file:///etc/passwd', OUTCOME.UNSUPPORTED, 'unsupported_scheme'],
  ['plain text', 'Apostille no. 12345', OUTCOME.UNSUPPORTED, 'not_a_url'],
  ['empty payload', '   ', OUTCOME.UNSUPPORTED, 'empty_payload'],
  ['malformed percent encoding', 'https://verify.example.gov/apostille/%E0%A4%A', OUTCOME.UNSUPPORTED, 'malformed_encoding'],
  ['plain HTTP downgrade', 'http://verify.example.gov/apostille/ABC12345', OUTCOME.BLOCKED, 'protocol_mismatch'],
  ['unexpected port', 'https://verify.example.gov:8443/apostille/ABC12345', OUTCOME.BLOCKED, 'unexpected_port'],
  ['unrelated host', 'https://attacker.test/apostille/ABC12345', OUTCOME.BLOCKED, 'host_not_allowlisted'],
  ['path outside the documented shape', 'https://verify.example.gov/redirect', OUTCOME.BLOCKED, 'path_mismatch'],
  ['open-redirect parameter', 'https://verify.example.gov/apostille/ABC12345?next=https://attacker.test', OUTCOME.BLOCKED, 'unexpected_query_parameter'],
  ['fragment smuggling', 'https://verify.example.gov/apostille/ABC12345#https://attacker.test', OUTCOME.BLOCKED, 'unexpected_fragment'],
  ['encoded path traversal', 'https://verify.example.gov/apostille/..%2F..%2Fadmin', OUTCOME.BLOCKED, 'path_mismatch']
]

for (const [name, payload, kind, reason] of adversarial) {
  check(`rejects ${name}`, () => {
    const result = classify(payload)
    assert.equal(result.kind, kind, `${name}: expected ${kind}, got ${result.kind}`)
    assert.equal(result.reason, reason, `${name}: expected reason ${reason}, got ${result.reason}`)
    assert.ok(!result.url, `${name}: must not produce an openable URL`)
  })
}

check('an oversized payload is refused and not echoed in full', () => {
  const result = classify(`https://verify.example.gov/apostille/${'A'.repeat(5000)}`)
  assert.equal(result.reason, 'payload_too_large')
  assert.ok(result.raw.length <= 256)
})

check('an allowed query parameter passes while others do not', () => {
  assert.equal(classify('https://docs.example.gov/f?id=7', 'fixture-document').kind, OUTCOME.OFFICIAL)
  assert.equal(classify('https://docs.example.gov/f?id=7&url=https://attacker.test', 'fixture-document').kind, OUTCOME.BLOCKED)
})

// --- authority scoping ------------------------------------------------------

check('a valid payload from an adjacent authority is blocked, not opened', () => {
  const result = classify('https://docs.example.gov/file.pdf', 'fixture-verification')
  assert.equal(result.kind, OUTCOME.BLOCKED)
  assert.equal(result.host, 'docs.example.gov')
  assert.ok(!result.url)
})

check('disabled real authorities never route, even on a documented host', () => {
  // Brazil is confirmed with real allowlist hosts but has not passed the gate.
  const result = classifyQrPayload('https://apostil.cnj.jus.br/pt/validation/ABC', 'brazil-national-council-of-justice')
  assert.equal(result.kind, OUTCOME.NOT_ENABLED)
  assert.equal(result.presence, 'confirmed')
  assert.ok(!result.url)
})

check('an unknown authority id is reported as unknown, not enabled', () => {
  const result = classifyQrPayload(GOOD, 'no-such-authority')
  assert.equal(result.kind, OUTCOME.NOT_ENABLED)
  assert.equal(result.reason, 'authority_unknown')
})

check('no non-official outcome ever carries a URL to open', () => {
  const payloads = [GOOD, 'https://attacker.test/x', 'javascript:alert(1)', 'not a url']
  for (const id of ['brazil-national-council-of-justice', 'singapore-singapore-academy-of-law', 'no-such-authority']) {
    for (const payload of payloads) {
      assert.ok(!classifyQrPayload(payload, id).url, `${id} must not produce a URL`)
    }
  }
})

console.log(`QR routing: ${passed} checks passed.`)
