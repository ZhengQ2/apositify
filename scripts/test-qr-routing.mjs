// Phase 3.6 — QR routing security tests.
//
// Two fixture families:
//
//   Synthetic authorities registered at test time, which exercise the security
//   boundary in isolation. They can never satisfy a real authority's gate.
//
//   Real specimens decoded 2026-07-18 from actual apostilles, which pin the
//   behaviour the schema grew to accommodate. Personal values are withheld.

import assert from 'node:assert/strict'
import { OUTCOME, TRUST, classifyQrPayload, hostnameMatches, isReportable, normalizeHostname } from '../src/qr-routing.js'
import { qrCodes } from '../src/data/qr-codes.js'
import { governmentSuffixes, matchesGovernmentSuffix } from '../src/data/government-domains.js'

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
  allowedUrls: [{ protocol: 'https:', hostname: 'verify.example.gov', port: '', pathnamePattern: '^/apostille/[A-Z0-9-]{6,32}$', documentRef: 'path' }]
}
qrCodes['fixture-canonical'] = {
  ...base,
  function: 'verification_url',
  allowedUrls: [{
    protocol: 'https:',
    hostname: 'legacy.example.gov',
    port: '',
    pathnamePattern: '^/r/[A-Z0-9]{8}$',
    documentRef: 'path',
    tokenPattern: '^/r/([A-Z0-9]{8})$',
    canonicalUrlTemplate: 'https://verify.example.gov/apostille/{token}'
  }]
}
qrCodes['fixture-subdomains'] = {
  ...base,
  function: 'portal_or_token',
  allowedUrls: [{ protocol: 'https:', hostname: 'example.gov', port: '', pathnamePattern: null, allowSubdomains: true, documentRef: 'none' }]
}
qrCodes['fixture-document'] = {
  ...base,
  function: 'document_url',
  allowedUrls: [{ protocol: 'https:', hostname: 'docs.example.gov', port: '', pathnamePattern: null, allowedSearchParams: ['id'], documentRef: 'path' }]
}
qrCodes['fixture-offline'] = { ...base, function: 'offline_app', allowedUrls: [], app: { name: 'GovCheck' } }
qrCodes['fixture-unknown-fn'] = {
  ...base,
  function: 'unknown',
  allowedUrls: [{ protocol: 'https:', hostname: 'mystery.example.gov', port: '', pathnamePattern: null, documentRef: 'path' }]
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

check('a confirmed authority with no specimen still never routes', () => {
  // Greece is confirmed by its own e-Apostille FAQ but has no decoded specimen,
  // so an official statement alone must not make it routable.
  const result = classifyQrPayload('https://e-apostille.gov.gr/verify/ABC', 'greece-ministry-of-digital-governance')
  assert.equal(result.kind, OUTCOME.NOT_ENABLED)
  assert.equal(result.presence, 'confirmed')
  assert.ok(!result.url)
})

check('a superseded host no longer routes after a specimen corrected it', () => {
  // apostil.cnj.jus.br was inferred from the CNJ validation page and was wrong;
  // the specimen showed apostil.org.br. The stale host must now be rejected.
  const result = classifyQrPayload('https://apostil.cnj.jus.br/pt/validation/ABC', 'brazil-national-council-of-justice')
  assert.equal(result.kind, OUTCOME.BLOCKED)
  assert.ok(!result.url)
})

check('an unknown authority id is reported as unknown, not enabled', () => {
  const result = classifyQrPayload(GOOD, 'no-such-authority')
  assert.equal(result.kind, OUTCOME.NOT_ENABLED)
  assert.equal(result.reason, 'authority_unknown')
})

check('no non-official outcome ever carries a URL to open', () => {
  const payloads = [GOOD, 'https://attacker.test/x', 'javascript:alert(1)', 'not a url']
  for (const id of ['greece-ministry-of-digital-governance', 'singapore-singapore-academy-of-law', 'no-such-authority']) {
    for (const payload of payloads) {
      assert.ok(!classifyQrPayload(payload, id).url, `${id} must not produce a URL`)
    }
  }
})



// ---------------------------------------------------------------------------
// Real-specimen regression fixtures (decoded 2026-07-18)
//
// Every payload below came off an actual apostille. They are the reason the
// schema grew fragments, scheme normalisation, per-rule HTTP acceptance, and
// the embedded_fields function -- so they must keep classifying correctly.
// Personal values are withheld; only structural payloads appear here.
// ---------------------------------------------------------------------------

const realSpecimens = [
  ['armenia-ministry-of-justice', 'http://e-verify.am/?tnum=AP00-0000-0000-0000', 'Armenia: plain HTTP + query token'],
  ['bahrain-ministry-of-foreign-affairs', 'www.mofa.gov.bh/legalization?id=000000', 'Bahrain: scheme-less payload'],
  ['brazil-national-council-of-justice', 'https://apostil.org.br/v?number=0000000-00&crc=00000000', 'Brazil current: non-government .org.br host'],
  ['brazil-national-council-of-justice', 'https://www.cnj.jus.br/seiapostila/controlador_externo.php?acao=documento_conferir&id_orgao_acesso_externo=0&cv=0000000&crc=11111111', 'Brazil legacy: judiciary .jus.br host'],
  ['bulgaria-national-center-for-information-and-documentation', 'https://apostille.nacid.bg/api/Public/ElectronicApostille/AAA0000A0AAA', 'Bulgaria: API document retrieval'],
  ['chile-relevant-authorities-of-the-ministries-of-justice-education-health-foreign-affairs-and-the-civil-and-identification-registration-service', 'https://consulta.apostilla.gob.cl/QR/AAAAAAAAAAAAAAAAAAAAAA==', 'Chile: base64 path token'],
  ['china-china-mainland-ministry-of-foreign-affairs', 'http://consular.mfa.gov.cn/VERIFY/#/XXXXXXXXXXXX', 'China: HTTP + fragment-carried token'],
  ['colombia-ministry-of-foreign-affairs', 'https://tramites.cancilleria.gov.co/Ciudadano/ConsultaApostilla/consulta.aspx?cod=A0AAAA00000000&fecha=4/27/2022', 'Colombia: two query params'],
  ['ecuador-ministry-of-foreign-affairs-and-human-mobility', 'https://serviciosciudadanos.cancilleria.gob.ec/ValidacionApostillaURL/DatosApostillaURL?validaDocumento=000000000000000', 'Ecuador'],
  ['guatemala-ministry-of-foreign-affairs', 'https://apostilla.minex.gob.gt/public/verificar/apostilla/0000000000/AAAAAA', 'Guatemala: two path segments'],
  ['japan-ministry-of-foreign-affairs', 'https://www.ezairyu.mofa.go.jp/eregister/eregi/authcheck', 'Japan: portal with no token'],
  ['mexico-ministry-of-interior', 'http://consultasislac.segob.gob.mx/csislac/qr.do?a=1&b=000000', 'Mexico legacy: HTTP document retrieval'],
  ['pakistan-ministry-of-foreign-affairs', 'https://apostille.mofa.gov.pk/verify-attestation-by-qr?apostille_number=APO-XXXX-XXXX-XXXX&day=31&month=07&year=2025', 'Pakistan: four query params'],
  ['philippines-department-of-foreign-affairs', 'e-registry.apostille.gov.ph', 'Philippines: scheme-less portal with no document reference'],
  ['panama-ministry-of-foreign-affairs', 'http://sigob.mire.gob.pa/reportes/MIA/PA/autenticaciones/apostille.aspx?args=8A818DBB929408D4', 'Panama MFA: opaque args blob'],
  ['russian-federation-ministry-of-justice', 'https://minjust.gov.ru/ru/pages/apostil-ispf/?aposId=00000000-0000-0000-0000-000000000000', 'Russia: UUID query token']
]

for (const [id, payload, label] of realSpecimens) {
  check(`real specimen routes: ${label}`, () => {
    const result = classifyQrPayload(payload, id)
    assert.equal(result.kind, OUTCOME.OFFICIAL, `${label}: expected OFFICIAL, got ${result.kind} (${result.reason})`)
    assert.equal(result.trust, TRUST.VERIFIED, `${label}: must be specimen-verified trust`)
    assert.ok(result.url, `${label}: should produce a destination`)
    // One specimen must never unlock canonical reconstruction.
    assert.equal(result.canonical, false, `${label}: one specimen cannot justify canonical rebuild`)
  })
}

check('Philippines scheme-less QR stays a manual-entry portal flow', () => {
  const result = classifyQrPayload('e-registry.apostille.gov.ph', 'philippines-department-of-foreign-affairs')
  assert.equal(result.kind, OUTCOME.OFFICIAL)
  assert.equal(result.function, 'portal_or_token')
  assert.equal(result.schemeNormalized, true)
  assert.equal(result.url, 'https://e-registry.apostille.gov.ph/')
})

check('Costa Rica payload is embedded field data, not a destination', () => {
  const result = classifyQrPayload(
    '12/07/2019//NCDXATKNWGC//Official Name//Signatory Name//Certificador de Registro',
    'costa-rica-ministry-of-foreign-affairs-and-worship'
  )
  assert.equal(result.kind, OUTCOME.EMBEDDED_FIELDS)
  assert.ok(!result.url, 'embedded field data has no destination to open')
  assert.equal(result.containsPersonalData, true, 'payload carries names and must be flagged')
})

check('Bangladesh training host stays unroutable', () => {
  const result = classifyQrPayload('https://apostille.training.mygov.bd/application-details/1795368240',
    'bangladesh-ministry-of-foreign-affairs-of-the-government-of-bangladesh')
  assert.equal(result.kind, OUTCOME.NOT_ENABLED)
  assert.ok(!result.url)
})

// --- Tier 2: government-domain fallback ------------------------------------

check('tier 2 offers cautious routing for an unmapped authority on a gov host', () => {
  const result = classifyQrPayload('https://apostille.gov.rw/verify/ABC123', 'rwanda-ministry-of-foreign-affairs-and-international-cooperation', 'Rwanda')
  assert.equal(result.kind, OUTCOME.UNVERIFIED_GOVERNMENT)
  assert.equal(result.trust, TRUST.GOVERNMENT)
  assert.equal(result.matchedSuffix, 'gov.rw')
})

check('tier 2 refuses a look-alike government domain', () => {
  for (const host of ['https://gov.rw.attacker.test/x', 'https://notgov.rw/x', 'https://evil-gov.rw/x']) {
    const result = classifyQrPayload(host, 'rwanda-ministry-of-foreign-affairs-and-international-cooperation', 'Rwanda')
    assert.equal(result.kind, OUTCOME.BLOCKED, `${host} must not match gov.rw`)
    assert.ok(!result.url)
  }
})

check('tier 2 refuses non-production hosts inside the government namespace', () => {
  const result = classifyQrPayload('https://apostille.training.gov.rw/x', 'rwanda-ministry-of-foreign-affairs-and-international-cooperation', 'Rwanda')
  assert.equal(result.kind, OUTCOME.BLOCKED)
  assert.equal(result.reason, 'non_production_host')
})

check('tier 2 requires HTTPS', () => {
  const result = classifyQrPayload('http://apostille.gov.rw/x', 'rwanda-ministry-of-foreign-affairs-and-international-cooperation', 'Rwanda')
  assert.equal(result.kind, OUTCOME.BLOCKED)
  assert.equal(result.reason, 'government_host_insecure')
})

check('tier 2 never overrides a specimen-verified authority', () => {
  // Brazil has verified hosts, so a different .gov.br host is a mismatch and
  // must NOT fall through to the government-domain heuristic.
  const result = classifyQrPayload('https://something-else.gov.br/verify/X', 'brazil-national-council-of-justice', 'Brazil')
  assert.equal(result.kind, OUTCOME.BLOCKED)
  assert.notEqual(result.trust, TRUST.GOVERNMENT)
})

check('tier 2 is off when no country is supplied', () => {
  const result = classifyQrPayload('https://apostille.gov.rw/verify/ABC123', 'rwanda-ministry-of-foreign-affairs-and-international-cooperation')
  assert.notEqual(result.kind, OUTCOME.UNVERIFIED_GOVERNMENT, 'tier 2 must not engage without a country')
  assert.ok(!result.url, 'no destination may be offered')
})

check('adversarial payloads stay blocked for every real enabled authority', () => {
  const hostile = [
    'javascript:alert(1)',
    'https://apostil.org.br@attacker.test/v',
    'https://apostil.org.br.attacker.test/v?number=1&crc=2',
    'https://apostil.org.br:8443/v?number=1&crc=2',
    'https://apostil.org.br/v?number=1&crc=2&next=https://attacker.test'
  ]
  for (const payload of hostile) {
    const result = classifyQrPayload(payload, 'brazil-national-council-of-justice', 'Brazil')
    assert.notEqual(result.kind, OUTCOME.OFFICIAL, `${payload} must not route`)
    assert.ok(!result.url, `${payload} must not produce a URL`)
  }
})

check('no government suffix is a bare ccTLD', () => {
  for (const [country, suffixes] of Object.entries(governmentSuffixes)) {
    for (const suffix of suffixes) {
      assert.ok(suffix.includes('.') || suffix === 'gov', `${country}: '${suffix}' is a bare TLD`)
    }
  }
})

check('tier 2 does not accept an arbitrary host in the country ccTLD', () => {
  // Greece previously listed the bare 'gr' suffix, which made every .gr host a
  // government namespace.
  const result = classifyQrPayload('https://not-the-government.gr/verify/X', 'greece-ministry-of-digital-governance', 'Greece')
  assert.equal(result.kind, OUTCOME.BLOCKED)
  assert.equal(result.reason, 'not_a_government_host')
  assert.ok(!result.url)
})

check('tier 2 still accepts the real government namespace', () => {
  const result = classifyQrPayload('https://e-apostille.gov.gr/verify/X', 'greece-ministry-of-digital-governance', 'Greece')
  assert.equal(result.kind, OUTCOME.UNVERIFIED_GOVERNMENT)
  assert.equal(result.matchedSuffix, 'gov.gr')
})

// --- a matching host and path is not a document reference -------------------

const referenceless = [
  ['Brazil current', 'brazil-national-council-of-justice', 'https://apostil.org.br/v'],
  ['Brazil current, blank value', 'brazil-national-council-of-justice', 'https://apostil.org.br/v?number=&crc='],
  ['Brazil legacy', 'brazil-national-council-of-justice', 'https://www.cnj.jus.br/seiapostila/controlador_externo.php?acao=documento_conferir&id_orgao_acesso_externo=0'],
  ['Pakistan', 'pakistan-ministry-of-foreign-affairs', 'https://apostille.mofa.gov.pk/verify-attestation-by-qr'],
  ['Pakistan, date only', 'pakistan-ministry-of-foreign-affairs', 'https://apostille.mofa.gov.pk/verify-attestation-by-qr?day=31&month=07&year=2025'],
  ['Armenia', 'armenia-ministry-of-justice', 'http://e-verify.am/'],
  ['Russia', 'russian-federation-ministry-of-justice', 'https://minjust.gov.ru/ru/pages/apostil-ispf/'],
  ['Ecuador', 'ecuador-ministry-of-foreign-affairs-and-human-mobility', 'https://serviciosciudadanos.cancilleria.gob.ec/ValidacionApostillaURL/DatosApostillaURL'],
  ['Colombia', 'colombia-ministry-of-foreign-affairs', 'https://tramites.cancilleria.gov.co/Ciudadano/ConsultaApostilla/consulta.aspx?fecha=4/27/2022'],
  ['Panama', 'panama-ministry-of-foreign-affairs', 'http://sigob.mire.gob.pa/reportes/MIA/PA/autenticaciones/apostille.aspx'],
  ['Bahrain', 'bahrain-ministry-of-foreign-affairs', 'www.mofa.gov.bh/legalization'],
  ['Mexico legacy', 'mexico-ministry-of-interior', 'http://consultasislac.segob.gob.mx/csislac/qr.do?a=1']
]

for (const [label, id, payload] of referenceless) {
  check(`refuses a reference-free payload: ${label}`, () => {
    const result = classifyQrPayload(payload, id)
    assert.notEqual(result.kind, OUTCOME.OFFICIAL, `${label}: right host and path but no apostille reference must not route`)
    assert.equal(result.reason, 'missing_required_query_parameter', `${label}: got ${result.reason}`)
    assert.ok(!result.url)
  })
}

check('China without its fragment carries no reference and must not route', () => {
  const result = classifyQrPayload('http://consular.mfa.gov.cn/VERIFY/', 'china-china-mainland-ministry-of-foreign-affairs')
  assert.notEqual(result.kind, OUTCOME.OFFICIAL)
  assert.equal(result.reason, 'missing_required_fragment')
  assert.ok(!result.url)
})

check('Japan legitimately carries no reference and still routes as a portal', () => {
  // The QR opens the portal; the user types the details. This is the one shape
  // where a reference-free payload is correct, and it must not regress.
  const result = classifyQrPayload('https://www.ezairyu.mofa.go.jp/eregister/eregi/authcheck', 'japan-ministry-of-foreign-affairs')
  assert.equal(result.kind, OUTCOME.OFFICIAL)
  assert.equal(result.function, 'portal_or_token')
})

check('every enabled URL rule declares where the document reference lives', () => {
  for (const value of Object.values(qrCodes)) {
    for (const entry of Array.isArray(value) ? value : [value]) {
      if (!entry.enabled) continue
      for (const rule of entry.allowedUrls || []) {
        assert.ok(['path', 'query', 'fragment', 'none'].includes(rule.documentRef),
          `${rule.hostname} is missing documentRef`)
        if (rule.documentRef === 'none') {
          assert.equal(entry.function, 'portal_or_token',
            `${rule.hostname} carries no reference, so it cannot be a ${entry.function}`)
        }
      }
    }
  }
})

// --- Hong Kong: judiciary.hk, not gov.cn ------------------------------------

const HK = 'china-hong-kong-sar-the-registrar-the-senior-deputy-registrar-and-the-deputy-registrar-of-the-high-court'

check('Hong Kong specimen routes as a portal', () => {
  const result = classifyQrPayload(
    'https://www.e-services.judiciary.hk/judservice-web/?apc=AAAA&afc=BBBB&aToken=CCCC',
    HK
  )
  assert.equal(result.kind, OUTCOME.OFFICIAL)
  assert.equal(result.function, 'portal_or_token')
  assert.equal(result.host, 'www.e-services.judiciary.hk')
})

check('Hong Kong without aToken carries no reference', () => {
  const result = classifyQrPayload('https://www.e-services.judiciary.hk/judservice-web/?apc=AAAA', HK)
  assert.notEqual(result.kind, OUTCOME.OFFICIAL)
  assert.equal(result.reason, 'missing_required_query_parameter')
})

check('Hong Kong and Mainland China do not inherit each other', () => {
  const MAINLAND = 'china-china-mainland-ministry-of-foreign-affairs'
  // A Hong Kong payload must not route as Mainland...
  const hkAsMainland = classifyQrPayload(
    'https://www.e-services.judiciary.hk/judservice-web/?aToken=CCCC', MAINLAND)
  assert.notEqual(hkAsMainland.kind, OUTCOME.OFFICIAL)
  // ...nor a Mainland payload as Hong Kong.
  const mainlandAsHk = classifyQrPayload('http://consular.mfa.gov.cn/VERIFY/#/XXXXXXXXXXXX', HK)
  assert.notEqual(mainlandAsHk.kind, OUTCOME.OFFICIAL)
})

check('tier 2 for the China party accepts Hong Kong domains, not only gov.cn', () => {
  // Macao is confirmed-but-unmapped and shares the China party entry. A
  // gov.cn-only suffix list would reject a genuine Hong Kong government host.
  assert.equal(matchesGovernmentSuffix('anything.judiciary.hk', 'China'), 'judiciary.hk')
  assert.equal(matchesGovernmentSuffix('anything.gov.hk', 'China'), 'gov.hk')
  assert.equal(matchesGovernmentSuffix('anything.gov.cn', 'China'), 'gov.cn')
  assert.equal(matchesGovernmentSuffix('notjudiciary.hk', 'China'), null)
})

// --- embedded_fields must match the documented shape ------------------------

const CR = 'costa-rica-ministry-of-foreign-affairs-and-worship'

check('a payload matching the documented shape is field data', () => {
  const result = classifyQrPayload('12/07/2019//NCDXATKNWGC//Official Name//Signatory Name//Certificador de Registro', CR)
  assert.equal(result.kind, OUTCOME.EMBEDDED_FIELDS)
  assert.equal(result.containsPersonalData, true)
})

const wrongShape = [
  ['plain word', 'hello'],
  ['unrelated text', 'random text with no delimiters'],
  ['mailto scheme', 'mailto:x@y.z'],
  ['javascript scheme', 'javascript:alert(1)'],
  ['delimiter present but too few fields', 'a//b'],
  ['one field short', '12/07/2019//NCDXATKNWGC//Official Name//Signatory Name'],
  ['one field too many', '12/07/2019//NCDXATKNWGC//A//B//C//D'],
  ['empty field in the middle', '12/07/2019//NCDXATKNWGC////Signatory//Capacity'],
  ['wrong date format', '2019-07-12//NCDXATKNWGC//A//B//C']
]

for (const [label, payload] of wrongShape) {
  check(`embedded_fields refuses the wrong shape: ${label}`, () => {
    const result = classifyQrPayload(payload, CR)
    assert.notEqual(result.kind, OUTCOME.EMBEDDED_FIELDS,
      `${label}: must not be presented as this authority's apostille details`)
    assert.equal(result.kind, OUTCOME.UNSUPPORTED)
    // Unsupported is reportable, so the user is offered a way to tell us about
    // a format we do not handle. Misclassifying as embedded_fields hid that.
    assert.ok(isReportable(result), `${label}: should offer a report path`)
  })
}

check('every enabled embedded_fields authority can actually be shape-checked', () => {
  for (const value of Object.values(qrCodes)) {
    for (const entry of Array.isArray(value) ? value : [value]) {
      if (!entry.enabled || entry.function !== 'embedded_fields') continue
      assert.ok(entry.fieldDelimiter, 'embedded_fields needs a fieldDelimiter')
      assert.ok(entry.fieldShape, 'embedded_fields needs a fieldShape')
    }
  }
})

// --- static routing parameters must hold their documented value -------------

const SEI = 'https://www.cnj.jus.br/seiapostila/controlador_externo.php'
const BR = 'brazil-national-council-of-justice'

check('Brazil legacy accepts the verified static values', () => {
  const result = classifyQrPayload(
    `${SEI}?acao=documento_conferir&id_orgao_acesso_externo=0&cv=0000000&crc=11111111`, BR)
  assert.equal(result.kind, OUTCOME.OFFICIAL)
})

const staticTamper = [
  ['a different SEI action', `${SEI}?acao=procedimento_trabalhar&id_orgao_acesso_externo=0&cv=0000000&crc=11111111`],
  ['a different orgao id', `${SEI}?acao=documento_conferir&id_orgao_acesso_externo=999&cv=0000000&crc=11111111`],
  ['both static values changed', `${SEI}?acao=x&id_orgao_acesso_externo=9&cv=0000000&crc=11111111`],
  ['static parameter omitted entirely', `${SEI}?id_orgao_acesso_externo=0&cv=0000000&crc=11111111`],
  ['static parameter left empty', `${SEI}?acao=&id_orgao_acesso_externo=0&cv=0000000&crc=11111111`]
]

for (const [label, payload] of staticTamper) {
  check(`Brazil legacy refuses ${label}`, () => {
    const result = classifyQrPayload(payload, BR)
    assert.notEqual(result.kind, OUTCOME.OFFICIAL,
      `${label}: must not be labelled the official lookup for this Apostille`)
    assert.equal(result.reason, 'static_query_parameter_mismatch')
    assert.ok(!result.url)
  })
}

check('Mexico legacy pins its static parameter too', () => {
  const MX = 'mexico-ministry-of-interior'
  const ok = classifyQrPayload('http://consultasislac.segob.gob.mx/csislac/qr.do?a=1&b=000000', MX)
  assert.equal(ok.kind, OUTCOME.OFFICIAL)
  const tampered = classifyQrPayload('http://consultasislac.segob.gob.mx/csislac/qr.do?a=9&b=000000', MX)
  assert.equal(tampered.reason, 'static_query_parameter_mismatch')
  assert.ok(!tampered.url)
})

check('a static parameter is never also the document reference', () => {
  for (const value of Object.values(qrCodes)) {
    for (const entry of Array.isArray(value) ? value : [value]) {
      if (!entry.enabled) continue
      for (const rule of entry.allowedUrls || []) {
        for (const key of Object.keys(rule.staticSearchParams || {})) {
          assert.ok(!(rule.requiredSearchParams || []).includes(key),
            `${rule.hostname}: '${key}' cannot be both static and the document reference`)
          assert.ok((rule.allowedSearchParams || []).includes(key),
            `${rule.hostname}: static '${key}' must be an allowed key`)
        }
      }
    }
  }
})

// --- duplicate query keys make a payload ambiguous --------------------------

const duplicates = [
  ['static value, tampered second', `${SEI}?acao=documento_conferir&acao=procedimento_trabalhar&id_orgao_acesso_externo=0&cv=0000000&crc=11111111`],
  ['static value, tampered first', `${SEI}?acao=procedimento_trabalhar&acao=documento_conferir&id_orgao_acesso_externo=0&cv=0000000&crc=11111111`],
  ['duplicated document reference', `${SEI}?acao=documento_conferir&id_orgao_acesso_externo=0&cv=0000000&cv=9999999&crc=11111111`],
  ['duplicated checksum', `${SEI}?acao=documento_conferir&id_orgao_acesso_externo=0&cv=0000000&crc=11111111&crc=deadbeef`]
]

for (const [label, payload] of duplicates) {
  check(`refuses a duplicated query key: ${label}`, () => {
    const result = classifyQrPayload(payload, BR)
    assert.notEqual(result.kind, OUTCOME.OFFICIAL)
    assert.equal(result.reason, 'duplicate_query_parameter')
    assert.ok(!result.url, 'must not open a URL whose parameters are ambiguous')
  })
}

check('duplicate rejection applies to every real specimen that has a query', () => {
  // Take each REAL specimen payload and duplicate one of its own query keys.
  // Building synthetic probe URLs would fail on path_mismatch first and pass
  // this assertion for the wrong reason.
  let covered = 0
  for (const [id, payload, label] of realSpecimens) {
    let url
    try { url = new URL(payload) } catch { continue }
    const keys = [...url.searchParams.keys()]
    if (keys.length === 0) continue

    const baseline = classifyQrPayload(payload, id)
    assert.equal(baseline.kind, OUTCOME.OFFICIAL, `${label}: baseline should route`)

    const tampered = `${payload}&${keys[0]}=duplicated`
    const result = classifyQrPayload(tampered, id)
    assert.equal(result.reason, 'duplicate_query_parameter',
      `${label}: duplicating ${keys[0]} should be rejected, got ${result.reason}`)
    assert.ok(!result.url)
    covered += 1
  }
  // Guard against the assertion silently covering nothing.
  assert.ok(covered >= 8, `expected several query-carrying specimens, covered ${covered}`)
})

check('every real specimen still routes after duplicate rejection', () => {
  for (const [id, payload, label] of realSpecimens) {
    const result = classifyQrPayload(payload, id)
    assert.equal(result.kind, OUTCOME.OFFICIAL, `${label} regressed: ${result.reason}`)
  }
})

console.log(`QR routing: ${passed} checks passed.`)
