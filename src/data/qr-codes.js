// Authority-scoped QR metadata (Phase 3.1).
//
// This registry is INDEPENDENT of `verificationMode` in `e-registers.cleaned.json`.
// Never infer one from the other: many Tier A–C authorities with a conventional
// e-Register also issue QR-bearing apostilles, and `verificationMode: 'qr_only'`
// only describes how the *e-Register* is reached, not what is printed on the paper.
//
// Every record is derived from docs/PHASE_3_QR_CODE_RESEARCH.md (last checked
// 2026-07-17). Presence labels carry the narrow meanings defined there:
//
//   confirmed        HCCH chart, the issuing authority, or an official specimen
//                    states that the apostille itself bears a QR.
//   public_specimen  A QR is visible on a publicly filed apostille that is not
//                    hosted by the issuer. Appearance only — not routable.
//   reported         Credible but non-issuer evidence. Not routable.
//   underlying_only  A QR was found on the underlying document, not the apostille.
//   not_established  The review did not establish a QR. This is NOT proof of absence.
//
// `enabled: true` is the production gate and requires TWO current, redacted
// specimens from independent issuances plus a tested destination. No authority
// passes that gate yet, so every record below is `enabled: false` and the public
// scanner entry point stays hidden. Enable one authority per pull request.
//
// A value may be a single record or an array of generation-scoped records (used
// where an authority changed its QR flow — e.g. Mexico's legacy vs e-Apostille QR).

import { qrDevEnableConfirmed } from '../feature-flags.js'

export const QR_PRESENCE = ['confirmed', 'public_specimen', 'reported', 'underlying_only', 'not_established']
export const QR_EVIDENCE = ['hcch', 'authority', 'official_specimen', 'public_specimen']
export const QR_FUNCTION = ['verification_url', 'portal_or_token', 'document_url', 'offline_app', 'embedded_fields', 'unknown']

const CHECKED_AT = '2026-07-17'

/** Baseline record. Only `presence`/`notes` differ for the long negative tail. */
function record(presence, notes, extra = {}) {
  return {
    presence,
    evidence: null,
    function: 'unknown',
    enabled: false,
    allowedUrls: [],
    specimenCount: 0,
    specimenTestedAt: null,
    sourceUrl: null,
    checkedAt: CHECKED_AT,
    notes,
    ...extra
  }
}

/** No QR established on the apostille — absence of evidence, not evidence of absence. */
const notEstablished = (notes) => record('not_established', notes)

const HCCH_CHART = 'https://assets.hcch.net/docs/e8e7549d-e34a-452f-9fa3-cf2241aa4197.pdf'

export const qrCodes = {
  // ---------------------------------------------------------------------------
  // Confirmed by the current HCCH implementation chart
  // ---------------------------------------------------------------------------
  'bahrain-ministry-of-foreign-affairs': record('confirmed', 'HCCH states the e-Register uses QR codes to generate unique URLs. Specimen confirms, but the payload carries NO scheme -- a bare host string.', {
    evidence: 'hcch',
    function: 'verification_url',
    specimenCount: 1,
    specimenTestedAt: '2026-07-18',
    // Specimen 2026-07-18: www.mofa.gov.bh/legalization?id=000000
    normalizeSchemelessTo: 'https:',
    allowedUrls: [{
      protocol: 'https:', hostname: 'www.mofa.gov.bh', port: '',
      pathnamePattern: '^/legalization/?$', allowedSearchParams: ['id']
    }],
    sourceUrl: HCCH_CHART
  }),
  'ecuador-ministry-of-foreign-affairs-and-human-mobility': record('confirmed', 'HCCH states the e-Apostille email includes a QR that opens the official verification link.', {
    evidence: 'hcch',
    function: 'verification_url',
    specimenCount: 1,
    specimenTestedAt: '2026-07-18',
    // Specimen 2026-07-18: https://serviciosciudadanos.cancilleria.gob.ec/
    //   ValidacionApostillaURL/DatosApostillaURL?validaDocumento=000000000000000
    allowedUrls: [{
      protocol: 'https:', hostname: 'serviciosciudadanos.cancilleria.gob.ec', port: '',
      pathnamePattern: '^/ValidacionApostillaURL/DatosApostillaURL$',
      allowedSearchParams: ['validaDocumento']
    }],
    sourceUrl: HCCH_CHART
  }),
  'el-salvador-ministry-of-foreign-affairs': record('confirmed', 'HCCH lists the e-Register as “Via QR code”. Payload shape still needs a specimen.', {
    evidence: 'hcch',
    sourceUrl: HCCH_CHART
  }),
  'luxembourg-ministry-of-foreign-affairs': record('confirmed', 'Verification runs through the government GouvCheck app, not a web URL. Do not attempt to reproduce its signature validation.', {
    evidence: 'hcch',
    function: 'offline_app',
    sourceUrl: 'https://assets.hcch.net/docs/a3c419ec-9cef-45af-aaa9-498517c8734c.pdf',
    app: { name: 'GouvCheck', publisher: 'Government of Luxembourg' }
  }),
  'pakistan-ministry-of-foreign-affairs': record('confirmed', 'Specimen confirms a QR deep link carrying the apostille number and issue date as query parameters.', {
    evidence: 'hcch',
    function: 'verification_url',
    specimenCount: 1,
    specimenTestedAt: '2026-07-18',
    // Specimen 2026-07-18: https://apostille.mofa.gov.pk/verify-attestation-by-qr
    //   ?apostille_number=APO-XXXX-XXXX-XXXX&day=31&month=07&year=2025
    allowedUrls: [{
      protocol: 'https:', hostname: 'apostille.mofa.gov.pk', port: '',
      pathnamePattern: '^/verify-attestation-by-qr/?$',
      allowedSearchParams: ['apostille_number', 'day', 'month', 'year']
    }],
    sourceUrl: HCCH_CHART
  }),
  'panama-organo-judicial': record('confirmed', 'HCCH lists this authority’s e-Register as “Via QR Code”. Does not apply to Panama’s Ministry of Foreign Affairs.', {
    evidence: 'hcch',
    sourceUrl: HCCH_CHART
  }),
  'russian-federation-ministry-of-justice': record('confirmed', 'Specimen confirms a QR deep link carrying a UUID apostille id.', {
    evidence: 'hcch',
    function: 'verification_url',
    specimenCount: 1,
    specimenTestedAt: '2026-07-18',
    // Specimen 2026-07-18: https://minjust.gov.ru/ru/pages/apostil-ispf/
    //   ?aposId=00000000-0000-0000-0000-000000000000
    allowedUrls: [{
      protocol: 'https:', hostname: 'minjust.gov.ru', port: '',
      pathnamePattern: '^/ru/pages/apostil-ispf/?$',
      allowedSearchParams: ['aposId']
    }],
    sourceUrl: HCCH_CHART
  }),
  'rwanda-ministry-of-foreign-affairs-and-international-cooperation': record('confirmed', 'HCCH lists the e-Register as available by link “or via QR code”.', {
    evidence: 'hcch',
    sourceUrl: HCCH_CHART
  }),

  // ---------------------------------------------------------------------------
  // Confirmed by the issuing authority or an official specimen
  // ---------------------------------------------------------------------------
  'armenia-ministry-of-justice': record('confirmed', 'HCCH-hosted specimen instructs verification by tracking number or QR.', {
    evidence: 'official_specimen',
    function: 'verification_url',
    specimenCount: 1,
    specimenTestedAt: '2026-07-18',
    // Specimen 2026-07-18: http://e-verify.am/?tnum=AP00-0000-0000-0000
    // Plain HTTP and the record id rides in ?tnum=. Not a government domain.
    allowedUrls: [{
      protocol: 'http:', hostname: 'e-verify.am', port: '', pathnamePattern: '^/$',
      allowedSearchParams: ['tnum'], insecureAccepted: true
    }],
    sourceUrl: 'https://assets.hcch.net/docs/7148c8b9-6d72-41d3-9239-4c1991fda6d8.pdf'
  }),
  'bangladesh-ministry-of-foreign-affairs-of-the-government-of-bangladesh': record('confirmed', 'MFA verification instructions state each e-Apostille contains a QR and that scanning it verifies the authentication.', {
    evidence: 'authority',
    function: 'verification_url',
    // Specimen 2026-07-18 decoded to
    // https://apostille.training.mygov.bd/application-details/1795368240
    // That is a TRAINING environment. Deliberately NOT allowlisted: a test
    // system must never be presented as an official verification result.
    // A production specimen is still required.
    specimenCount: 0,
    sourceUrl: 'https://mofa-servicedirectory.apostille.mygov.bd/how-to-verify'
  }),
  'bolivia-ministry-of-foreign-affairs': record('confirmed', '2025 MFA publication states digital apostilles carry a unique QR verification code. Exact payload needs a specimen.', {
    evidence: 'authority',
    function: 'verification_url',
    sourceUrl: 'https://cancilleria.gob.bo/mre/wp-content/uploads/2025/11/APOSTILLA-version-digital-2025.pdf'
  }),
  'brazil-national-council-of-justice': [
    record('confirmed', 'Current CNJ system. Specimen host is apostil.org.br -- NOT the apostil.cnj.jus.br guessed from the CNJ validation page, and not a government domain at all.', {
      scope: 'apostil-current',
      evidence: 'authority',
      function: 'verification_url',
      specimenCount: 1,
    specimenTestedAt: '2026-07-18',
      // Specimen 2026-07-18: https://apostil.org.br/v?number=0000000-00&crc=00000000
      allowedUrls: [{
        protocol: 'https:', hostname: 'apostil.org.br', port: '',
        pathnamePattern: '^/v/?$', allowedSearchParams: ['number', 'crc']
      }],
      sourceUrl: 'https://www.cnj.jus.br/poder-judiciario/relacoes-internacionais/apostila-da-haia/validacao-de-apostila/'
    }),
    record('confirmed', 'Legacy SEI Apostila, for apostilles issued before 3 August 2020. Specimen host is www.cnj.jus.br, not the apostila.cnj.jus.br subdomain previously recorded.', {
      scope: 'sei-legacy',
      evidence: 'authority',
      function: 'verification_url',
      specimenCount: 1,
    specimenTestedAt: '2026-07-18',
      // Specimen 2026-07-18: https://www.cnj.jus.br/seiapostila/controlador_externo.php
      //   ?acao=documento_conferir&id_orgao_acesso_externo=0&cv=0000000&crc=11111111
      allowedUrls: [{
        protocol: 'https:', hostname: 'www.cnj.jus.br', port: '',
        pathnamePattern: '^/seiapostila/controlador_externo\\.php$',
        allowedSearchParams: ['acao', 'id_orgao_acesso_externo', 'cv', 'crc']
      }],
      sourceUrl: 'https://www.cnj.jus.br/poder-judiciario/relacoes-internacionais/apostila-da-haia/validacao-de-apostila/'
    })
  ],
  'bulgaria-national-center-for-information-and-documentation': record('confirmed', 'HCCH competent-authority information states this authority’s e-Apostilles have used a QR since June 2020. Does not extend to the other Bulgarian authorities.', {
    evidence: 'authority',
    function: 'document_url',
    specimenCount: 1,
    specimenTestedAt: '2026-07-18',
    // Specimen 2026-07-18:
    // https://apostille.nacid.bg/api/Public/ElectronicApostille/AAA0000A0AAA
    // Host is apostille.nacid.bg, not the apostille.bg previously recorded, and
    // the path is an /api/ endpoint returning the record rather than a page --
    // so this is document retrieval, not a human-readable status result.
    allowedUrls: [{
      protocol: 'https:', hostname: 'apostille.nacid.bg', port: '',
      pathnamePattern: '^/api/Public/ElectronicApostille/[A-Z0-9]{8,20}$'
    }],
    sourceUrl: 'https://www.hcch.net/en/instruments/conventions/authorities1/print1/?cid=41'
  }),
  'chile-relevant-authorities-of-the-ministries-of-justice-education-health-foreign-affairs-and-the-civil-and-identification-registration-service': record('confirmed', 'The official service exposes QR-specific verification results under a /QR/ path.', {
    evidence: 'authority',
    function: 'verification_url',
    specimenCount: 1,
    specimenTestedAt: '2026-07-18',
    // Specimen 2026-07-18: https://consulta.apostilla.gob.cl/QR/AAAAAAAAAAAAAAAAAAAAAA==
    // Confirms the /QR/<base64> shape inferred from the live service.
    allowedUrls: [{ protocol: 'https:', hostname: 'consulta.apostilla.gob.cl', port: '', pathnamePattern: '^/QR/[A-Za-z0-9%+/=_-]+$' }],
    sourceUrl: 'https://consulta.apostilla.gob.cl/'
  }),
  'china-china-mainland-ministry-of-foreign-affairs': record('confirmed', 'Official e-Apostille sample instructs recipients to scan the QR on the last page. Mainland only — does not transfer to Hong Kong or Macao.', {
    evidence: 'official_specimen',
    function: 'verification_url',
    specimenCount: 1,
    specimenTestedAt: '2026-07-18',
    // Specimen 2026-07-18: http://consular.mfa.gov.cn/VERIFY/#/XXXXXXXXXXXX
    // Plain HTTP, and the record id is in the FRAGMENT (hash-router SPA), which
    // is never sent to the server -- so it must be preserved, not stripped.
    allowedUrls: [{
      protocol: 'http:', hostname: 'consular.mfa.gov.cn', port: '',
      pathnamePattern: '^/VERIFY/?$', allowFragment: true,
      fragmentPattern: '^#/[A-Za-z0-9_-]{6,64}$', insecureAccepted: true
    }],
    sourceUrl: 'https://cs.mfa.gov.cn/gyls/lsgz/fwxx/202506/P020250617541458190587.pdf'
  }),
  'china-hong-kong-sar-the-registrar-the-senior-deputy-registrar-and-the-deputy-registrar-of-the-high-court': record('confirmed', 'Judiciary’s official mobile verification guide says to scan the QR on the Apostille Certificate; it prefills apostille number and reference code, so the user still completes a portal form.', {
    evidence: 'authority',
    function: 'portal_or_token',
    sourceUrl: 'https://www.judiciary.hk/doc/en/court_services_facilities/hc/eAPOS_Help_Apostille_Verification_mobile.pdf'
  }),
  'colombia-ministry-of-foreign-affairs': record('confirmed', 'Official circular states the apostille can be verified with its QR.', {
    evidence: 'authority',
    function: 'verification_url',
    specimenCount: 1,
    specimenTestedAt: '2026-07-18',
    // Specimen 2026-07-18: https://tramites.cancilleria.gov.co/Ciudadano/
    //   ConsultaApostilla/consulta.aspx?cod=A0AAAA00000000&fecha=4/27/2022
    allowedUrls: [{
      protocol: 'https:', hostname: 'tramites.cancilleria.gov.co', port: '',
      pathnamePattern: '^/Ciudadano/ConsultaApostilla/consulta\\.aspx$',
      allowedSearchParams: ['cod', 'fecha']
    }],
    sourceUrl: 'https://www.cancilleria.gov.co/normograma/compilacion/docs/circular_minrelaciones_0040_2015.htm'
  }),
  'costa-rica-ministry-of-foreign-affairs-and-worship': record('confirmed', 'CORRECTION: the QR is NOT a URL. The specimen decodes to delimited plain text carrying the apostille\u2019s own fields. The MFA statement that the QR "enables authenticity verification" was true; inferring a verification URL from it was not.', {
    evidence: 'authority',
    function: 'embedded_fields',
    specimenCount: 1,
    specimenTestedAt: '2026-07-18',
    // Specimen 2026-07-18 shape (values withheld -- the payload carries the
    // names of the signatory and the authenticating official):
    fieldShape: 'issueDate//code//authenticatingOfficial//signatory//capacity',
    containsPersonalData: true,
    sourceUrl: 'https://www.rree.go.cr/?cat=prensa&cont=593&id=4848&sec=servicios'
  }),
  'greece-ministry-of-digital-governance': record('confirmed', 'Official e-Apostille FAQ states the e-Apostille itself bears a QR and can be verified by scanning it.', {
    evidence: 'authority',
    function: 'verification_url',
    sourceUrl: 'https://e-apostille.gov.gr/faq/'
  }),
  'guatemala-ministry-of-foreign-affairs': record('confirmed', 'Official presentation/specimen labels the QR and verification code as the means to validate authenticity. Host sits behind a Cloudflare bot challenge for non-browser requests.', {
    evidence: 'official_specimen',
    function: 'verification_url',
    specimenCount: 1,
    specimenTestedAt: '2026-07-18',
    // Specimen 2026-07-18:
    // https://apostilla.minex.gob.gt/public/verificar/apostilla/0000000000/AAAAAA
    allowedUrls: [{
      protocol: 'https:', hostname: 'apostilla.minex.gob.gt', port: '',
      pathnamePattern: '^/public/verificar/apostilla/[0-9]{6,20}/[A-Za-z0-9]{4,16}$'
    }],
    sourceUrl: 'https://www.minex.gob.gt/userfiles/apostilla.pdf'
  }),
  'japan-ministry-of-foreign-affairs': record('confirmed', 'Applies to apostilles issued from 1 June 2026. The QR (or printed URL) opens the authenticity-search site; the user must still enter certificate number, certification date, and access code.', {
    evidence: 'authority',
    function: 'portal_or_token',
    specimenCount: 1,
    specimenTestedAt: '2026-07-18',
    // Specimen 2026-07-18: https://www.ezairyu.mofa.go.jp/eregister/eregi/authcheck
    // Host is www.ezairyu... (not the bare ezairyu... previously recorded), and
    // the URL carries NO record id -- confirming portal_or_token: the user must
    // still type certificate number, certification date, and access code.
    allowedUrls: [{
      protocol: 'https:', hostname: 'www.ezairyu.mofa.go.jp', port: '',
      pathnamePattern: '^/eregister/eregi/authcheck/?$'
    }],
    sourceUrl: 'https://www.mofa.go.jp/mofaj/toko/page22_000552.html',
    appliesFrom: '2026-06-01'
  }),
  'kazakhstan-relevant-authorities-of-several-ministries-and-services': record('confirmed', 'Government guidance states each e-Apostille has a unique registration number and QR. Kazakhstan has several competent authorities — coverage must be mapped before enabling.', {
    evidence: 'authority',
    function: 'verification_url',
    sourceUrl: 'https://www.gov.kz/memleket/entities/adilet-kst/press/article/details/218365'
  }),
  'mexico-ministry-of-interior': [
    record('confirmed', 'Legacy federal flow: scanning the QR downloads the apostille/legalisation PDF. This is document retrieval, not a status result.', {
      scope: 'legacy-physical-certificate',
      evidence: 'authority',
      function: 'document_url',
      specimenCount: 1,
      specimenTestedAt: '2026-07-18',
      // Specimen 2026-07-18: http://consultasislac.segob.gob.mx/csislac/qr.do?a=1&b=000000
      // Host is consultasislac.segob.gob.mx, not the dicoppu.segob.gob.mx named
      // in the published QR documentation. Plain HTTP.
      allowedUrls: [{
        protocol: 'http:', hostname: 'consultasislac.segob.gob.mx', port: '',
        pathnamePattern: '^/csislac/qr\\.do$', allowedSearchParams: ['a', 'b'],
        insecureAccepted: true
      }],
      sourceUrl: 'https://dicoppu.segob.gob.mx/work/models/DICOPPU/QR/index.html'
    }),
    record('confirmed', 'Current federal e-Apostille: HCCH notification states verification is by scanning the QR on the certificate. Exact redirect/payload still needs a current specimen. Does not extend to Jalisco, Mexico City, or Baja California Sur.', {
      scope: 'federal-e-apostille',
      evidence: 'authority',
      function: 'verification_url',
      sourceUrl: 'https://assets.hcch.net/docs/0ec80097-944c-49e6-a379-16f40a8e629c.pdf'
    })
  ],
  'philippines-department-of-foreign-affairs': record('confirmed', 'DFA guidance states the QR provides quick access to the verification link. Allowlist the current host only after decoding a current specimen.', {
    evidence: 'authority',
    function: 'verification_url',
    sourceUrl: 'https://bernepe.dfa.gov.ph/134-notarial-services/apostille-certificates'
  }),

  // ---------------------------------------------------------------------------
  // QR visible on a public, non-issuer specimen only — appearance, not routing
  // ---------------------------------------------------------------------------
  'kosovo-ministry-of-foreign-affairs-department-for-consular-affairs-ministry-of-internal-affairs-civil-registration-agency': record('public_specimen', 'A publicly filed 2022 apostille visibly contains a QR and an instruction to verify through it. Not issuer-hosted, not current, payload not decoded.', {
    evidence: 'public_specimen',
    sourceUrl: 'https://opencorporates.al/documents/dokumenta/1656937270Cert_Biznesi_me_Apostile%20IMBUS%20PEJA%20L.L.C..pdf.pdf7_4_2022.pdf'
  }),
  'latvia-council-of-sworn-notaries': record('public_specimen', 'A publicly filed bundle shows a QR on the accompanying “Information on E-Apostille” page — not necessarily on the apostille itself. Prints a notary.lv verify URL.', {
    evidence: 'public_specimen',
    sourceUrl: 'https://opencorporates.al/documents/dokumenta/1702468848DOC023.pdf.pdf12_13_2023.pdf'
  }),

  // ---------------------------------------------------------------------------
  // Reported — credible but not established from an issuer source or specimen
  // ---------------------------------------------------------------------------
  'belgium-federal-public-service-foreign-affairs-foreign-trade-and-development-cooperation': record('reported', 'FPS guidance confirms lookup by apostille number and date but does not say the apostille bears a QR. Consular guidance about a QR on an electronic *legalisation* is not evidence for apostilles.'),
  'dominican-republic-ministry-of-foreign-affairs': record('reported', 'An Austrian government recognition guide states Dominican apostilles can be verified by QR. Receiving-country evidence only; MIREX pages reviewed do not make the claim.'),
  'france-regional-councils-and-interdepartmental-chambers-of-notaries': record('reported', 'Official sources confirm e-Apostilles and a national index, but do not establish a QR on every apostille.'),
  'georgia-ministry-of-internal-affairs': record('reported', 'Party-level report only; not resolved to this authority. Do not transfer a finding between Georgian authorities.'),
  'georgia-ministry-of-justice': record('reported', 'Party-level report only; not resolved to this authority. Do not transfer a finding between Georgian authorities.'),
  'india-ministry-of-external-affairs': record('reported', 'Official e-Sanad pages confirm the e-Register, not an apostille QR.'),
  'indonesia-ministry-of-law-and-human-rights': record('reported', 'A live official verification portal exists and non-issuer guidance reports a QR; no issuer statement or specimen found.'),
  'israel-ministry-of-justice': record('reported', 'No issuer-hosted text or official specimen proving a QR on the apostille was found.'),
  'morocco-ministry-of-justice': record('reported', 'No issuer-hosted text or official specimen proving a QR on the apostille was found.'),
  'ukraine-ministry-of-education-and-science': record('reported', 'Party-level report only. The Ministry of Education and Science and the Ministry of Justice run separate registers; a statement for one does not apply to the other.'),
  'ukraine-ministry-of-justice': record('reported', 'Party-level report only. The Ministry of Education and Science and the Ministry of Justice run separate registers; a statement for one does not apply to the other.'),
  'uruguay-ministry-of-foreign-affairs': record('reported', 'An official system specification requires the printed electronic apostille to display a QR. A specification is not proof of deployment; no issued specimen found.'),
  'uzbekistan-ministry-of-foreign-affairs-ministry-of-justice-supreme-court-and-other-authorities': record('reported', 'No issuer-hosted text or official specimen proving a QR on the apostille was found.'),
  'venezuela-ministry-of-people-s-power-of-foreign-affairs': record('reported', 'Official services expose code/field lookup and PDF validation. Treat the QR function as unknown until a current specimen is decoded.'),
  'china-macao-sar-director-of-the-legal-affairs-bureau': record('reported', 'Unverified. Do not transfer the Mainland or Hong Kong result to Macao.'),

  // ---------------------------------------------------------------------------
  // QR found only on the underlying document
  // ---------------------------------------------------------------------------
  'singapore-singapore-academy-of-law': record('underlying_only', 'The reviewed QR evidence concerns an underlying source document, not the apostille. Excluded from the apostille scanner entry point.'),

  // ---------------------------------------------------------------------------
  // Not established — see docs/PHASE_3_QR_CODE_RESEARCH.md negative search record
  // ---------------------------------------------------------------------------
  'andorra-ministry-of-foreign-affairs': notEstablished('An e-Register exists, but reviewed sources describe typed-field lookup without proving an apostille QR.'),
  'argentina-ministry-of-foreign-affairs-and-worship': notEstablished('The official verifier uses the apostille number and can return the registered PDF; no apostille QR established.'),
  'australia-department-of-foreign-affairs-and-trade': notEstablished('Typed-field lookup; no apostille QR established.'),
  'austria-federal-ministry-for-europe-integration-and-foreign-affairs': notEstablished('Verification is by signature-check upload of the original e-Apostille file; no apostille QR established.'),
  'azerbaijan-ministry-of-justice': notEstablished('Typed-field lookup; no apostille QR established.'),
  'canada-minister-of-justice-of-the-province-of-quebec': notEstablished('No apostille QR established for this authority.'),
  'canada-ministry-of-justice-and-attorney-general-of-the-province-saskatchewan': notEstablished('No apostille QR established for this authority.'),
  'canada-ministry-of-justice-of-the-province-of-alberta': notEstablished('No apostille QR established for this authority.'),
  'canada-ministry-of-public-and-business-service-delivery-and-procurement-of-the-province-of-ontario': notEstablished('No apostille QR established for this authority.'),
  'canada-ministry-of-the-attorney-general-of-the-province-of-british-columbia': notEstablished('No apostille QR established for this authority.'),
  'canada-the-department-of-foreign-affairs-trade-and-development-of-canada': notEstablished('No apostille QR established for this authority.'),
  'cyprus-ministry-of-justice-and-public-order': notEstablished('A new official apostille-validation site was announced 30 March 2026. Separate Cypriot digital-document services use QR, but no source says the apostille does.'),
  'denmark-ministry-of-foreign-affairs': notEstablished('Typed-field lookup; no apostille QR established.'),
  'estonia-chamber-of-notaries': notEstablished('Typed-field lookup; no apostille QR established.'),
  'ireland-department-of-foreign-affairs': notEstablished('Typed-field lookup; no apostille QR established.'),
  'korea-republic-of-ministry-of-foreign-affairs-ministry-of-justice': notEstablished('The MFA publishes an official e-Apostille sample, but no QR was established on it. A statutory QR-bearing form titled “Certificate of Authentication” is a different document.'),
  'moldova-republic-of-ministry-of-justice': notEstablished('Official guidance describes an apostille code and security code. QR specimens found concerned the underlying document or a chamber-of-commerce certificate of origin.'),
  'mongolia-ministry-of-foreign-affairs': notEstablished('No apostille QR established.'),
  'new-zealand-department-of-internal-affairs': notEstablished('Typed-field lookup; no apostille QR established.'),
  'nicaragua-ministry-of-foreign-affairs': notEstablished('No e-Register exists (application portal only); no apostille QR established.'),
  'paraguay-ministry-of-foreign-affairs': notEstablished('No apostille QR established.'),
  'peru-ministry-of-foreign-affairs': notEstablished('Official guidance requires the *underlying* digital document to carry a QR; it does not prove a QR on the apostille.'),
  'romania-offices-of-the-prefect': notEstablished('The official service confirms digital apostilles and a typed-field verifier; no source or specimen proves a QR.'),
  'saint-kitts-and-nevis-ministry-of-foreign-affairs': notEstablished('No apostille QR established.'),
  'saudi-arabia-ministry-of-foreign-affairs': notEstablished('Saudi guidance discusses accepting QR-bearing *foreign* apostilles; it does not prove Saudi-issued apostilles carry one.'),
  'slovenia-11-district-courts': notEstablished('No apostille QR established.'),
  'spain-44-judicial-and-administrative-competent-authorities': notEstablished('The official register uses CSV, apostille number, and issue date; no apostille QR established.'),
  'tajikistan-ministry-of-foreign-affairs-ministry-of-justice': notEstablished('The official verifier uses manual fields and a CAPTCHA; no specimen or issuer statement proving QR was found.'),
  'turkiye-supervisory-competent-authorities-ministry-of-justice-ministry-of-internal-affairs': notEstablished('QR references in official Turkish sources concern underlying e-government documents or foreign e-Apostilles.'),
  'united-kingdom-cayman-islands-passport-and-corporate-services-office': notEstablished('Separate e-Register from the FCDO. No apostille QR established.'),
  'united-kingdom-foreign-and-commonwealth-office': notEstablished('GOV.UK verification requires issue date and apostille number; neither the service guidance nor reviewed specimens establish a QR.'),
  'panama-ministry-of-foreign-affairs': record('confirmed', 'CORRECTION: a specimen shows this authority DOES issue QR-bearing apostilles. The decoded host is sigob.mire.gob.pa (MIRE = Ministerio de Relaciones Exteriores), so the finding belongs here, not to the Judicial Branch row that HCCH flags as QR.', {
    evidence: 'official_specimen',
    function: 'verification_url',
    specimenCount: 1,
    specimenTestedAt: '2026-07-18',
    // Specimen 2026-07-18: http://sigob.mire.gob.pa/reportes/MIA/PA/
    //   autenticaciones/apostille.aspx?args=<opaque hex blob>
    // Plain HTTP, and the record reference is one opaque ?args= blob.
    allowedUrls: [{
      protocol: 'http:', hostname: 'sigob.mire.gob.pa', port: '',
      pathnamePattern: '^/reportes/MIA/PA/autenticaciones/apostille\\.aspx$',
      allowedSearchParams: ['args'], insecureAccepted: true
    }],
    sourceUrl: HCCH_CHART
  }),
  'bulgaria-ministry-of-foreign-affairs': notEstablished('The June 2020 QR statement covers the National Centre for Information and Documentation only.'),
  'bulgaria-ministry-of-justice': notEstablished('The June 2020 QR statement covers the National Centre for Information and Documentation only.'),
  'bulgaria-regional-administrations': notEstablished('The June 2020 QR statement covers the National Centre for Information and Documentation only.'),
  'mexico-baja-california-sur': notEstablished('The site claims code/QR verification but exposes no working link. Must not inherit the federal result.'),
  'mexico-federal-district-legal-department': notEstablished('Must not inherit the federal Ministry of the Interior result.'),
  'mexico-jalisco-secretary-of-government': notEstablished('Must not inherit the federal Ministry of the Interior result.'),

  // United States — the HCCH entry covers participating state authorities, not a
  // federal e-Register. No country-wide rule exists; every state needs its own evidence.
  'united-states-of-america-arkansas-secretary-of-state': notEstablished('US QR support is per state. No evidence for this authority.'),
  'united-states-of-america-california-secretary-of-state': notEstablished('US QR support is per state. No evidence for this authority.'),
  'united-states-of-america-colorado-secretary-of-state': notEstablished('US QR support is per state. No evidence for this authority.'),
  'united-states-of-america-connecticut-secretary-of-state': notEstablished('US QR support is per state. No evidence for this authority.'),
  'united-states-of-america-delaware-secretary-of-state': notEstablished('US QR support is per state. No evidence for this authority.'),
  'united-states-of-america-kentucky-secretary-of-state': notEstablished('US QR support is per state. No evidence for this authority.'),
  'united-states-of-america-minnesota-secretary-of-state': notEstablished('US QR support is per state. No evidence for this authority.'),
  'united-states-of-america-montana-secretary-of-state': notEstablished('US QR support is per state. No evidence for this authority.'),
  'united-states-of-america-nevada-secretary-of-state': notEstablished('US QR support is per state. No evidence for this authority.'),
  'united-states-of-america-new-york-secretary-of-state': notEstablished('US QR support is per state. No evidence for this authority.'),
  'united-states-of-america-north-carolina-secretary-of-state': notEstablished('US QR support is per state. No evidence for this authority.'),
  'united-states-of-america-rhode-island-secretary-of-state': notEstablished('Pilot ended September 2025; remaining site is an application portal. No apostille QR established.'),
  'united-states-of-america-tennessee-secretary-of-state': notEstablished('US QR support is per state. No evidence for this authority.'),
  'united-states-of-america-texas-secretary-of-state': notEstablished('US QR support is per state. No evidence for this authority.'),
  'united-states-of-america-utah-office-of-lieutenant-governor': notEstablished('US QR support is per state. No evidence for this authority.'),
  'united-states-of-america-washington-secretary-of-state': notEstablished('US QR support is per state. No evidence for this authority.'),
  'united-states-of-america-west-virginia-secretary-of-state': notEstablished('US QR support is per state. No evidence for this authority.')
}

/** All records for an authority id, always as an array (empty when unknown). */
export function qrRecordsFor(authorityId) {
  const value = qrCodes[authorityId]
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

/** Records an enabled scanner may route against. Empty unless the evidence gate passed. */
export function enabledQrRecordsFor(authorityId) {
  const records = qrRecordsFor(authorityId)
  // Dev-only bypass of the *enablement* gate — never of the URL allowlist.
  // See qrDevEnableConfirmed in ../feature-flags.js.
  if (qrDevEnableConfirmed) return records.filter((entry) => entry.presence === 'confirmed')
  return records.filter((entry) => entry.enabled)
}

/** True when the public "Scan QR" entry point may be shown for this authority. */
export function hasEnabledQrScanning(authorityId) {
  return enabledQrRecordsFor(authorityId).length > 0
}

// --- Enablement gate --------------------------------------------------------
//
// `enabled` is DERIVED, never hand-written. Setting it by hand is how an
// authority ends up routable without the evidence behind it, so the literal
// value in each record above is overwritten here from the evidence itself.
//
// Specimen count controls how tightly we bind, not merely whether we route:
//
//   0 specimens  Not routable. An official statement that a QR exists does not
//                tell us what it contains -- Costa Rica proved that, where the
//                authority's own "enables verification" wording turned out to
//                describe embedded text rather than a URL.
//   1 specimen   The host is empirical fact, decoded from a real apostille, so
//                we bind to host + path + declared query params. We do NOT
//                reconstruct a canonical URL: one sample cannot distinguish a
//                stable path segment from a coincidence.
//   2 specimens  Canonical reconstruction unlocks (see buildDestination in
//                ../qr-routing.js), so navigation targets a URL we built rather
//                than one the QR handed us.

function gateEnabled(record) {
  if (record.presence !== 'confirmed') return false
  if (record.function === 'unknown') return false
  if (record.specimenCount < 1) return false
  if (record.function === 'offline_app') return Boolean(record.app?.name)
  if (record.function === 'embedded_fields') return Boolean(record.fieldShape)
  return (record.allowedUrls || []).length > 0
}

for (const value of Object.values(qrCodes)) {
  for (const entry of Array.isArray(value) ? value : [value]) {
    entry.enabled = gateEnabled(entry)
  }
}
