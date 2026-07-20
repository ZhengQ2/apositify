# Phase 3: QR Code Support — Verified Research and Implementation Guide

Last checked: **17 July 2026**.

This document answers two separate questions:

1. Which authorities operate an e-Register?
2. Which apostilles actually contain a QR code, and what does that QR do?

Those questions must not be conflated. An e-Register may use typed fields, file upload, a QR-only deep link, or more than one method. Conversely, a QR on the underlying public document is not a QR on the apostille.

## Authoritative coverage baseline

The coverage baseline is the HCCH's current [Implementation Chart of the e-APP](https://assets.hcch.net/docs/e8e7549d-e34a-452f-9fa3-cf2241aa4197.pdf). It lists **64 Contracting Parties with an e-Register component**. A Party may have several competent authorities and not every competent authority in that Party necessarily participates.

The HCCH's separate [operational e-Registers web page](https://www.hcch.net/en/instruments/conventions/specialised-sections/operational-e-registers) currently contains only 61 numbered entries and omits Japan, Luxembourg, and Saudi Arabia. The newer implementation chart includes all three. This guide therefore uses the chart, not the lagging web page, for completeness.

The previous version was incomplete. It did not account for Andorra, Austria, Bulgaria, Costa Rica, Moldova, Nicaragua, Romania, Rwanda, the United States, and several other e-Register parties. It also described France and Belgium as confirmed QR systems without linking primary evidence that actually says their apostilles contain a QR.

## Evidence rules

The status labels below have deliberately narrow meanings:

- **Confirmed — HCCH:** the current HCCH chart expressly says the e-Register is available via QR, or expressly describes the QR verification flow.
- **Confirmed — authority:** the issuing authority expressly says that the apostille contains a QR, or an official specimen shows it.
- **Confirmed — public specimen:** a publicly accessible apostille specimen shows a QR, but the copy is not hosted by the issuer. This confirms appearance only; it is not sufficient for production routing without a current specimen and payload test.
- **Reported / sample required:** credible evidence suggests a QR, but the exact current apostille and decoded payload have not been verified from a primary source.
- **Underlying document only:** a QR was found on a source document, not on the apostille itself.
- **Not established:** the review did not establish a QR on the apostille. This does **not** mean that no QR exists. The existence of a typed or upload e-Register is not proof of absence.

This replaces the old “No QR” category, which made several claims from absence of evidence.

## Complete e-Register coverage (64 of 64 parties)

| QR status | Parties covered | Count |
|---|---|---:|
| Confirmed — HCCH | Bahrain; Ecuador; El Salvador; Luxembourg; Pakistan; Panama; Russian Federation; Rwanda | 8 |
| Confirmed — authority or official specimen | Armenia; Bangladesh; Bolivia; Brazil; Bulgaria; Chile; China; Colombia; Costa Rica; Greece; Guatemala; Japan; Kazakhstan; Mexico; Philippines | 15 |
| Confirmed — public specimen only | Kosovo; Latvia | 2 |
| Reported / current sample and payload still required | Belgium; Dominican Republic; France; Georgia; India; Indonesia; Israel; Morocco; Ukraine; Uruguay; Uzbekistan; Venezuela | 12 |
| QR found only on an underlying document, not established on apostille | Singapore | 1 |
| QR on apostille not established | Andorra; Argentina; Australia; Austria; Azerbaijan; Canada; Cyprus; Denmark; Estonia; Ireland; Korea (Republic of); Moldova (Republic of); Mongolia; New Zealand; Nicaragua; Paraguay; Peru; Romania; Saint Kitts and Nevis; Saudi Arabia; Slovenia; Spain; Tajikistan; Türkiye; United Kingdom; United States of America | 26 |
| **Total** |  | **64** |

Country-level counting hides authority-level differences:

- **China:** Mainland and Hong Kong are confirmed; Macao remains reported. Hong Kong's Judiciary publishes a QR-verification guide. Do not transfer either result to Macao.
- **Mexico:** the federal Ministry of the Interior is confirmed. Its older physical certificate flow and newer e-Apostille flow are documented separately below. Jalisco, Mexico City, and Baja California Sur must not inherit the federal result.
- **Panama:** the HCCH chart says the Judicial Branch e-Register is via QR, while the Ministry of Foreign Affairs has a conventional link.
- **Ukraine:** the Ministry of Education and Science and Ministry of Justice operate separate registers. Do not assume that a QR statement for one applies to the other.
- **United Kingdom:** the FCDO and Cayman Islands have separate e-Registers. The official UK service requires issue date and apostille number; no primary source reviewed here establishes a QR on the UK apostille.
- **United States:** the HCCH chart lists participating state authorities, not a federal e-Register. QR support must be researched and configured per state, never inherited at country level.

## QR functions that the product must distinguish

| Type | Decoded result | Product treatment |
|---|---|---|
| `verification_url` | A unique official e-Register URL for the apostille | Validate the complete URL and offer to open it |
| `portal_or_token` | A portal URL and/or a token; the user must still enter fields | Open the official portal and prefill only when the token format is verified |
| `document_url` | An official copy of the apostille or source document | Label it “official document retrieval,” not a status result |
| `offline_app` | A signed payload validated by a government app | Direct the user to the named official app |
| `unknown` | Payload has not been decoded and documented | Show decoded content cautiously; make no verification claim |

An official PDF URL is not “proof of nothing,” as the old version stated. If the URL and every redirect remain on an allowlisted government service, it is evidence that the government service returned that file. It may still be a document-retrieval flow rather than an e-Register status result, and the UI must say which it is.

## Confirmed QR cases

### Explicitly confirmed in the current HCCH chart

| Party / authority | What the primary source establishes | Function confidence |
|---|---|---|
| Bahrain — MFA | HCCH says the e-Register uses QR codes to generate unique URLs and therefore has no general lookup link | `verification_url` confirmed |
| Ecuador — MFA and Human Mobility | HCCH says the e-Apostille email includes a QR that directs the user to the official verification link | `verification_url` confirmed |
| El Salvador — MFA | HCCH lists the e-Register as “Via QR code” | QR confirmed; payload needs a specimen |
| Luxembourg — MFA | HCCH lists the e-Register as “Via QR code”; Luxembourg's 2026 HCCH presentation says the apostille uses the GouvCheck app | `offline_app` confirmed |
| Pakistan — MFA | HCCH lists both a conventional e-Register link and QR | QR confirmed; deep-link versus portal behavior needs a specimen |
| Panama — Judicial Branch | An [authority-hosted HCCH notification](https://www.organojudicial.gob.pa/uploads/blogs.dir/26/2024/10/913/e-app-notification-panama-no-7-of-2024.pdf) says its e-Register is available through the QR on e-Apostilles issued since April 2023 | `verification_url` confirmed; payload needs a specimen |
| Russian Federation — Ministry of Justice | HCCH lists the e-Register as “Via QR code” | QR confirmed; payload needs a specimen |
| Rwanda — MFA and International Cooperation | Official [Irembo guidance](https://support.irembo.gov.rw/en/support/solutions/articles/47001262102-legalization-of-public-documents-from-rwanda-to-be-used-abroad-apostille) says the apostille certificate QR links to the legalized document | `document_url` confirmed; payload needs a specimen |

Luxembourg is not merely “likely.” The [official HCCH presentation](https://assets.hcch.net/docs/a3c419ec-9cef-45af-aaa9-498517c8734c.pdf) states that GouvCheck verifies the authenticity of the apostille through the QR and requires installation of the free app.

### Confirmed by an issuing authority or official specimen

| Party / scope | Verified conclusion | Allowlist candidate |
|---|---|---|
| Armenia — Ministry of Justice | An [HCCH specimen](https://assets.hcch.net/docs/7148c8b9-6d72-41d3-9239-4c1991fda6d8.pdf) says to verify using the tracking number or QR | `e-verify.am` |
| Brazil — CNJ | CNJ says the QR printed on the physical apostille is used to consult authenticity; its [validation page](https://www.cnj.jus.br/poder-judiciario/relacoes-internacionais/apostila-da-haia/validacao-de-apostila/) identifies the two official systems | `apostil.cnj.jus.br`, `apostila.cnj.jus.br` |
| Bulgaria — National Centre for Information and Documentation only | HCCH's [competent-authority information](https://www.hcch.net/en/instruments/conventions/authorities1/print1/?cid=41) says its e-Apostilles have used a QR since June 2020 | `apostille.bg` |
| Chile — competent national authorities | The official service exposes [QR-specific verification results](https://consulta.apostilla.gob.cl/QR/c9O7AqA9OzJijzI3m8d8Aw%3D%3D) | `consulta.apostilla.gob.cl` |
| China — Mainland MFA | An [official e-Apostille sample](https://cs.mfa.gov.cn/gyls/lsgz/fwxx/202506/P020250617541458190587.pdf) instructs recipients to scan the QR on the last page | `consular.mfa.gov.cn` |
| Colombia — MFA | An [official circular](https://www.cancilleria.gov.co/normograma/compilacion/docs/circular_minrelaciones_0040_2015.htm) says the apostille can be verified with its QR | `cancilleria.gov.co`, `tramites.cancilleria.gov.co` |
| Guatemala — MFA | An [official presentation/specimen](https://www.minex.gob.gt/userfiles/apostilla.pdf) labels the QR and verification code as the means to validate authenticity | `apostilla.minex.gob.gt` |
| Japan — MFA, apostilles issued from 1 June 2026 | The [MFA FAQ](https://www.mofa.go.jp/mofaj/toko/page22_000552.html) says the QR or printed URL opens the authenticity-search site; the user must then enter certificate number, certification date, and access code | `portal_or_token`; `ezairyu.mofa.go.jp` |
| Philippines — DFA | The [DFA FAQ](https://www.apostille.gov.ph/faqs/) says scanning the QR opens the verification service and that the e-Registry requires the serial code, serial number, and keycode | `portal_or_token`; specimen host `e-registry.apostille.gov.ph` |

Additional official confirmations found during the specimen audit:

| Party / scope | Verified conclusion | Function confidence |
|---|---|---|
| Bangladesh — MFA | The MFA's [verification instructions](https://mofa-servicedirectory.apostille.mygov.bd/how-to-verify) expressly say that each e-Apostille contains a QR and that scanning it verifies the MFA authentication and the documents | `verification_url` confirmed; current specimen still required before allowlisting redirects |
| Bolivia — MFA | A 2025 [official MFA publication](https://cancilleria.gob.bo/mre/wp-content/uploads/2025/11/APOSTILLA-version-digital-2025.pdf) says digital apostilles include a unique QR verification code for online authenticity checking | QR and verification purpose confirmed; exact payload needs a specimen |
| Costa Rica — MFA | The MFA states that apostilles have contained a QR since 12 July 2019 and that it enables [authenticity verification](https://www.rree.go.cr/?cat=prensa&cont=593&id=4848&sec=servicios) | QR and verification purpose confirmed; exact payload needs a specimen |
| Greece — Ministry of Digital Governance / Ministry of Justice | The official [e-Apostille FAQ](https://e-apostille.gov.gr/faq/) says the e-Apostille itself bears a QR and can be verified by scanning it | `verification_url` confirmed |
| Kazakhstan — justice authorities | Government guidance says each e-Apostille has a unique registration number and QR and is checked through the [official authority site](https://www.gov.kz/memleket/entities/adilet-kst/press/article/details/218365) | QR and online-verification purpose confirmed; authority coverage must be mapped because Kazakhstan has several competent authorities |
| Mexico — federal Ministry of the Interior | The legacy federal [QR documentation](https://dicoppu.segob.gob.mx/work/models/DICOPPU/QR/index.html) says scanning downloads the apostille/legalisation PDF for authenticity checking. A later [HCCH notification](https://assets.hcch.net/docs/0ec80097-944c-49e6-a379-16f40a8e629c.pdf) says federal e-Apostilles are verified by scanning the QR on the certificate | legacy flow is `document_url`; current e-Apostille QR is confirmed but its exact redirect/payload still needs a current specimen |

China's confirmation is also authority-specific. The Mainland MFA specimen cited above covers Mainland China. Hong Kong's Judiciary separately publishes an [official mobile verification guide](https://www.judiciary.hk/doc/en/court_services_facilities/hc/eAPOS_Help_Apostille_Verification_mobile.pdf) that says to scan the QR displayed on the Apostille Certificate; the QR prefills the apostille number and reference code. Macao remains unverified.

For the Philippines, a redacted [2024 public specimen](https://www.filedocsphil.com/dfa-apostille-vs-philippine-e-apostille/) decoded to the bare hostname `e-registry.apostille.gov.ph`, with no scheme, path, or document reference. The official e-Registry is therefore treated as a portal where the user must enter the three printed fields, not as a one-tap status result.

### QR shown by a public, non-issuer specimen

These findings substantiate QR presence but do not pass the production gate:

| Party | Specimen evidence | Limitation |
|---|---|---|
| Kosovo | A [publicly filed 2022 apostille specimen](https://opencorporates.al/documents/dokumenta/1656937270Cert_Biznesi_me_Apostile%20IMBUS%20PEJA%20L.L.C..pdf.pdf7_4_2022.pdf) visibly contains a QR and an instruction to verify through it | Not issuer-hosted; not current; payload was not independently decoded |
| Latvia | In a [publicly filed document bundle](https://opencorporates.al/documents/dokumenta/1702468848DOC023.pdf.pdf12_13_2023.pdf), the accompanying Latvian “Information on E-Apostille” page visibly contains a QR and prints a unique `notary.lv/apostille/verify/...` URL; Latvian service providers also report the QR | Not issuer-hosted; the QR is on the accompanying information page; a current specimen must be obtained and decoded before routing |

Japan belongs in the e-Register coverage and its QR is confirmed, not merely mentioned in an introductory example. It is a portal flow, not one-tap status.

## Claims that remain unverified after primary-source and specimen searches

The following previous claims must not be shipped as facts until a current apostille is obtained and decoded:

- Belgium: the [FPS guidance](https://diplomatie.belgium.be/en/legalisation-documents/legalisation-more-detailed-information/e-apostille-e-legalisation) confirms lookup by apostille number and date, but the reviewed page does not say the apostille contains a QR. Belgian consular guidance about a QR on an electronic **legalisation** is not evidence that Belgian apostilles use the same format.
- Dominican Republic: an [Austrian government recognition guide](https://www.bmb.gv.at/en/Topics/school/legislation/risq/cr.html) says Dominican apostilles are electronic and can be verified by QR or through MIREX. This is official receiving-country evidence, but direct MIREX pages reviewed here do not make the QR claim and no specimen was captured; keep it reported.
- France: official sources confirm e-Apostilles and the national index, but the reviewed sources do not establish a QR on every apostille.
- United Kingdom: [GOV.UK verification guidance](https://www.gov.uk/verify-apostille) requires issue date and apostille number and does not document a QR.
- Venezuela: official services expose code/field lookup and PDF validation. The old claims that its QR “only downloads the PDF” and that official consular guidance documents the described fake-page scheme were not supported by a cited primary source in the draft. Treat the QR function as `unknown` until a current specimen is decoded.
- Georgia, India, Indonesia, Israel, Morocco, Ukraine, and Uzbekistan: the searches did not find issuer-hosted text or an official specimen that proves a QR on the apostille. India's official e-Sanad pages confirm the e-Register, not an apostille QR. Indonesia has a live official verification portal and non-issuer guidance reporting a QR, so it remains reported rather than confirmed.
- Uruguay: an [official system specification](https://www.uruguayxxi.gub.uy/uploads/llamado/bc7710dfcb96eb97906c994cd7d69a619c5f73a6.pdf) requires the printed electronic apostille to display a QR leading to public consultation. A specification is not proof of deployment, and no issued specimen was found, so this remains reported.
- Portugal was discussed in the old draft, but it is **not one of the 64 e-Register parties in the current HCCH chart**. It may have an electronic apostille service; it is outside this guide's stated e-Register baseline unless HCCH adds it.

Greece was previously misclassified: its official FAQ proves that the QR is on the e-Apostille. For Singapore, the reviewed QR evidence still concerns an underlying source document and must not be mapped to `qrCode.presence: 'confirmed'` for the apostille.

### Negative search record: no apostille QR established

For the following parties, searches of the issuing authority/e-Register, official guidance, general web results, PDFs, and available public specimens did not establish a QR on the apostille. The positive facts below explain why no inference was made from a QR elsewhere:

| Parties | What was established instead |
|---|---|
| Andorra; Australia; Austria; Azerbaijan; Canada; Denmark; Estonia; Ireland; Mongolia; New Zealand; Nicaragua; Paraguay; Saint Kitts and Nevis; Slovenia | An e-Register and/or e-Apostille service exists, but the reviewed sources describe typed-field lookup, issuance, or the conventional apostille process without proving an apostille QR |
| Argentina | The official verifier uses the apostille number and can return the registered PDF; no apostille QR was established |
| Cyprus | A new official apostille-validation site was announced on [30 March 2026](https://www.gov.cy/mjpo/anakoinosi/epivevaiosi-aythentikotitas-eggrafon-me-sfragida-apostille-meso-diadiktyoy/). Separate Cypriot digital-document services use QR, but no source reviewed says the apostille does |
| Korea (Republic of) | The MFA provides an official e-Apostille sample attachment, but searchable official text did not establish a QR on the apostille. A statutory form with a QR is titled “Certificate of Authentication”; it must not be silently treated as the apostille form |
| Moldova (Republic of) | Official guidance says the e-Apostille uses an apostille code and security code. QR specimens found concerned the underlying document or a Chamber of Commerce certificate of origin, not the Ministry of Justice apostille |
| Peru | Official digital-apostille guidance requires the **underlying digital document** to have a QR/link that allows verification; it does not prove a QR on the apostille |
| Romania | The official service confirms digital apostilles and a typed-field verifier, but no reviewed source or specimen proves a QR |
| Saudi Arabia | Saudi guidance found in the search discusses accepting QR-bearing **foreign** apostilles; it does not prove that Saudi-issued apostilles contain a QR |
| Spain | The official register uses CSV, apostille number, and issue date; no apostille QR was established |
| Tajikistan | The official verifier was found, but it uses manual fields/CAPTCHA and no specimen or issuer statement proving QR was found |
| Türkiye | The official e-Apostille portal verifies uploaded/entered document information. QR references found in official Turkish sources concern underlying e-government documents or foreign e-Apostilles, not necessarily Turkish apostilles |
| United Kingdom | FCDO confirms e-Apostilles and manual online verification, but neither its service guidance nor the reviewed specimens establish a QR |
| United States of America | The HCCH e-Register entry covers participating state authorities rather than the federal government. Searches found general commercial claims but no basis for a country-wide QR rule; every state and the federal Office of Authentications require separate evidence |

## Security boundary

A QR is untrusted input. A matching logo, page design, or the presence of HTTPS does not make its destination official.

Before offering an “official verification” action:

1. Parse with the platform `URL` parser; reject malformed URLs, credentials in URLs, non-HTTP(S) schemes, and unexpected ports.
2. Require HTTPS except for a documented legacy endpoint that has been separately risk-accepted.
3. Compare the normalized ASCII hostname against an authority-specific list. Store **hostnames**, not paths such as `/VERIFY` or `/eregister`.
4. Use exact hostname matching by default. Permit subdomains only through an explicit rule such as `allowSubdomains: true`; never use substring or `endsWith(officialHost)` without a dot-boundary check.
5. A browser-only app cannot reliably inspect an arbitrary cross-origin redirect chain before navigation. During authority onboarding, test and document the known chain; prefer reconstructing a canonical official URL from the verified token rather than opening the raw payload; show the expected official host before navigation. If a server-side redirect inspector is ever introduced, validate every hop with the same rules.
6. Match the authority as well as the country. This is essential for Mexico, Panama, China, Canada, Ukraine, the UK, and the United States.
7. Do not fetch or render an untrusted destination inside an app-controlled verification frame. Show the decoded host and require a user action to leave the app.
8. Label the result according to the known function. Opening an official page is not the same as the app independently verifying the apostille.

Host validation mitigates malicious destinations; it does not by itself prove that a decoded identifier belongs to the document being scanned. The government's result page remains the source of truth.

## Data model

QR support is authority-scoped and independent of the existing verification mode:

```js
qrCode: {
  presence: 'confirmed', // 'confirmed' | 'reported' | 'not_established'
  evidence: 'hcch',      // 'hcch' | 'authority' | 'specimen' | null
  function: 'verification_url',
  hosts: [
    { hostname: 'apostilla.minex.gob.gt', allowSubdomains: false }
  ],
  specimenTested: true,
  checkedAt: '2026-07-17',
  sourceUrl: 'https://…',
  notes: null
}
```

Do not use `present: false` merely because no QR was found. `not_established` accurately represents the evidence. Do not store a URL path in `hostname`.

## Phase 3 implementation scope

- Decode QR images entirely on-device, from camera or file picker.
- Route only authorities with `presence: 'confirmed'` and a tested current specimen.
- Apply authority-specific protocol, host, port, and path validation before showing an official-verification action; use canonical URL reconstruction and onboarding-tested redirect behavior where available.
- Treat `document_url`, `portal_or_token`, `offline_app`, and `unknown` separately.
- Preserve a file-picker fallback when camera permission or camera access is unavailable.
- Do not upload or retain scanned images.
- Do not claim that the app verified an apostille merely because it decoded or opened a QR.

`getUserMedia()` requires a secure context and user permission; localhost is generally treated as trustworthy for development. Browser and device support should be tested against the project's supported matrix rather than asserted as “iOS 15+ / Android” without test evidence.

## Gate before enabling an authority

For each authority:

1. Obtain at least two current, redacted specimens from independent issuances.
2. Decode and record the exact payload type and URL template.
3. Confirm the destination and any redirect chain from an official source.
4. Verify whether the result is status verification, a portal requiring fields, document retrieval, or app-only validation.
5. Add positive tests and adversarial tests: look-alike host, subdomain confusion, credentials, non-HTTPS URL, unexpected port, and safe-host-to-unsafe-host redirect.
6. Recheck the source and hosts periodically; government endpoints change.

Until that gate is complete, the safe behavior is to show the raw decoded content with a warning and no “verify” label.

## Sources

Selected primary sources used for this correction (country-specific sources are also linked inline above):

- [HCCH — Implementation Chart of the e-APP (current 64-party baseline)](https://assets.hcch.net/docs/e8e7549d-e34a-452f-9fa3-cf2241aa4197.pdf)
- [HCCH — operational e-Registers web list (currently lagging at 61 entries)](https://www.hcch.net/en/instruments/conventions/specialised-sections/operational-e-registers)
- [HCCH — Luxembourg e-APP presentation](https://assets.hcch.net/docs/a3c419ec-9cef-45af-aaa9-498517c8734c.pdf)
- [Panama Judicial Branch — authority-hosted HCCH e-APP notification](https://www.organojudicial.gob.pa/uploads/blogs.dir/26/2024/10/913/e-app-notification-panama-no-7-of-2024.pdf)
- [Rwanda Irembo — apostille application and certificate guidance](https://support.irembo.gov.rw/en/support/solutions/articles/47001262102-legalization-of-public-documents-from-rwanda-to-be-used-abroad-apostille)
- [Japan MFA — apostille verification FAQ](https://www.mofa.go.jp/mofaj/toko/page22_000552.html)
- [HCCH — Armenia e-Apostille specimen](https://assets.hcch.net/docs/7148c8b9-6d72-41d3-9239-4c1991fda6d8.pdf)
- [Brazil CNJ — apostille FAQ](https://www.cnj.jus.br/perguntas-frequentes-5/)
- [Brazil CNJ — validation services](https://www.cnj.jus.br/poder-judiciario/relacoes-internacionais/apostila-da-haia/validacao-de-apostila/)
- [Belgium FPS Foreign Affairs — e-Apostille / e-Legalisation](https://diplomatie.belgium.be/en/legalisation-documents/legalisation-more-detailed-information/e-apostille-e-legalisation)
- [UK FCDO — verify an Apostille](https://www.gov.uk/verify-apostille)
- [Singapore Academy of Law — e-Register](https://legalisation.sal.sg/AuthenticationCert/Search)
- [Venezuela MPPRE — current validation service](https://consultalegalizacionve.mppre.gob.ve/)

Internal implementation references:

- [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md)
- [APOSTILLE_FIELD_REQUIREMENTS.md](APOSTILLE_FIELD_REQUIREMENTS.md)
- `src/data/e-registers.cleaned.json`
- `src/data/verification-fields.js`
