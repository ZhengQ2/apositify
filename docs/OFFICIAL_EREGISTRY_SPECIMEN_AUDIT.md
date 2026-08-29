# Official e-Registry specimen audit

Audited 2026-08-29 against the 92 online, hybrid, or QR-only competent-authority
entries in Apositify's copy of the [HCCH e-APP implementation
chart](https://assets.hcch.net/docs/e8e7549d-e34a-452f-9fa3-cf2241aa4197.pdf).
Those entries cover 63 jurisdictions. Separate authorities within Canada,
Bulgaria, China, Georgia, Mexico, Panama, Ukraine, the United Kingdom, and the
United States were checked separately.

## Admission rule

An automated official-sample test must be issuer- or HCCH-published, contain no
private live lookup credential, download reproducibly, render as a single test
image, and meet its declared Apple Vision OCR anchor threshold. A legal annex is
described as an **official model**, not a filled specimen. Live public records,
training systems, and low-resolution images are not admitted merely to increase
the sample count.

Status meanings:

- **Tested** — admitted to `official-samples.json` and passing Apple Vision OCR.
- **Located, not admitted** — an official model/specimen exists, but failed a
  reproducibility, OCR, currency, privacy, or authority-specificity gate.
- **No public specimen located** — official service material was checked, but no
  issuer-published certificate image or PDF was found.

## Country-by-country result

| Jurisdiction | Result | Authority-level finding |
|---|---|---|
| Andorra | No public specimen located | Ministry of Foreign Affairs verifier found; no issuer-published certificate model found. |
| Argentina | **Tested** | The Foreign Ministry's [digital legalisation guide](https://cancilleria.gob.ar/userfiles/2017/instructivo-legalizaciones-digital.pdf), page 6, contains a filled 2019 model. |
| Armenia | No public specimen located | Ministry of Justice verifier and QR evidence exist, but no safe issuer-published certificate specimen was found. |
| Australia | No public specimen located | DFAT's verification service was checked; no public specimen was found. |
| Austria | **Tested** | Filled bilingual 2015 e-Apostille in an [HCCH-hosted Austrian presentation](https://assets.hcch.net/docs/2e3572d7-3c60-45a5-95fb-b6ba2f02e363.pdf), page 5. |
| Azerbaijan | **Tested** | The Foreign Ministry publishes a [blank bilingual official model](https://mfa.gov.az/files/shares/Consulate/Apostille.pdf), page 5. It is kept as an OCR model without asserting Ministry-of-Justice routing. |
| Bahrain | No public specimen located | QR-only verification is supported from decoded issuer evidence; no public specimen was found. |
| Bangladesh | Located, not admitted | The only downloadable certificate found was hosted on a training/staging service, so it remains deliberately excluded. |
| Belgium | No public specimen located | Federal Foreign Affairs e-Register found; no issuer-published certificate specimen found. |
| Bolivia | Located, not admitted | Foreign Ministry publications explain the national digital Apostille and include generic material, but no extractable, authority-specific filled specimen passed the gate. |
| Brazil | Located, not admitted | CNJ publishes a [physical stamp model](https://www.cnj.jus.br/modelo-do-carimbo/) and rules, not a safe current full-certificate specimen. A public live Apostille record was excluded. |
| Bulgaria | No public specimen located | Ministry of Justice, Ministry of Foreign Affairs, NACID, and Regional Administration systems were checked separately; no public issuer specimen found. |
| Canada | No public specimen located | Global Affairs Canada, British Columbia, Alberta, Saskatchewan, Ontario, and Quebec were checked separately. Official guidance describes the allonge, but no public specimen was found. |
| Chile | Located, not admitted | A live government verification record was discoverable, but it contains personal data and working lookup material; it is not a specimen. |
| China | **Tested in Mainland China** | The MFA's [2025 bilingual e-Apostille specimen](https://cs.mfa.gov.cn/gyls/szzc/xgxw/202506/t20250617_11650152.shtml) is tested. A second QR was decoded on 2026-08-29 from a provincially issued certificate, which carries a plain barcode instead of the MFA's `E########` sticker and whose QR therefore omits `paperNo` entirely; the fragment rule now treats that parameter as optional. Its values are not recorded here. Hong Kong SAR and Macao SAR were checked separately; no issuer-published certificate specimen was admitted. |
| Colombia | No public specimen located | Current Foreign Ministry verifier found. Older government notifications describe historical formats, but no current issuer specimen passed the gate. |
| Costa Rica | Located, not admitted | The Foreign Ministry's [official verification page](https://www.rree.go.cr/index.php?cat=autenticaciones&cont=726&sec=servicios) links “ver ejemplo de apostilla,” but its specimen endpoint currently returns 404. |
| Cyprus | **Tested** | The Ministry of Justice publishes a [current model effective 1 February 2026](https://apostille-validation.mjpo.gov.cy/Validate/Guidance). |
| Denmark | No public specimen located | Foreign Ministry e-Register found; no issuer-published certificate specimen found. |
| Dominican Republic | Located, not admitted | Official material reproduces the Convention's generic blank annex, not a current Dominican issuing-format specimen. |
| Ecuador | No public specimen located | Foreign Ministry verifier and specimen-derived QR route exist; no public issuer specimen found. |
| El Salvador | No public specimen located | QR-only implementation is recorded, but no primary-source certificate specimen was found. |
| Estonia | No public specimen located | Chamber of Notaries e-Register found; no issuer-published certificate specimen found. |
| France | No public specimen located | Notarial e-Register found; no issuer-published certificate specimen found. |
| Georgia | Located, not admitted | The official legislation portal publishes a [Georgian-English national model](https://www.matsne.gov.ge/ka/document/view/31174), but its PDF download did not resolve reproducibly for the fixture fetcher. Ministry of Justice and Ministry of Internal Affairs were checked separately. |
| Greece | No public specimen located | Digital Governance e-Apostille service found; no public issuer specimen found. |
| Guatemala | No public specimen located | Foreign Ministry verifier and decoded QR evidence exist; no issuer-published specimen found. |
| India | No public specimen located | e-Sanad e-Register and government guidance found; no issuer-published certificate specimen found. |
| Indonesia | Located, not admitted | The official AHU user manual contains an Apostille example, but the published attachment could not be downloaded reproducibly during the audit. |
| Ireland | No public specimen located | Department of Foreign Affairs authentications register found; no public issuer specimen found. |
| Israel | Located, not admitted | An official government blank bilingual model was identified, but the BlobFolder download returned 403 during reproducibility testing. |
| Japan | No public specimen located | MFA e-Register found; no issuer-published certificate specimen found. |
| Kazakhstan | No public specimen located | Government e-service found; no public issuer specimen found. |
| Korea, Republic of | Located, not admitted | The MFA publishes an [online Apostille certificate sample attachment](https://overseas.mofa.go.kr/es-ko/brd/m_8091/view.do?seq=1266391), but the attachment download timed out during reproducibility testing. |
| Kosovo | **Tested** | The official Government Regulation 19/2016 contains a blank Albanian-Serbian-English national model in Annex I, page 23. |
| Latvia | Located, not admitted | Non-issuer public filings show Apostilles, but no current issuer-published specimen was found; third-party/public-record specimens remain excluded. |
| Luxembourg | No public specimen located | QR/offline verification implementation found; no public issuer specimen found. |
| Mexico | Located, not admitted | Federal District, Jalisco, and federal Ministry of Interior systems were checked separately. Official material reproduces a generic Convention model, not a current authority-specific specimen. |
| Moldova, Republic of | No public specimen located | Ministry of Justice e-Register and document guidance found; no Apostille certificate specimen found. |
| Mongolia | Located, not admitted | Foreign Ministry news imagery was found, but it did not provide a reproducible, readable certificate fixture. |
| Morocco | Located, not admitted | The Ministry of Justice publishes `specimen_apostille.pdf`, but the official server repeatedly timed out or reset the connection. |
| New Zealand | Located, not admitted | Department of Internal Affairs material shows document bundles, not a readable certificate specimen. |
| Pakistan | No public specimen located | MFA hybrid verification service and decoded QR evidence exist; no issuer-published certificate specimen found. |
| Panama | No public specimen located | The Judicial Branch QR-only authority and Ministry of Foreign Affairs online authority were checked separately; neither yielded a safe public specimen. |
| Paraguay | **Tested** | The Foreign Ministry's [Decree 520/2013](https://www.mre.gov.py/wp-content/uploads/normativa-institucional/11_Decreto_N_520-13.Apostilla.pdf) contains the official trilingual national model on page 3. |
| Peru | No public specimen located | Foreign Ministry verifier and workflow manuals found; no issuer-published certificate specimen found. |
| Philippines | **Tested** | DFA's own FAQ still returns 403 to the fixture fetcher, but the DFA's [`PH E-APOSTILLE` authority presentation](https://assets.hcch.net/docs/976f8908-34b2-4ae8-9fd6-a69e797f8777.pdf), page 2, is HCCH-hosted and downloads reproducibly. It carries a filled specimen numbered `0000001` whose QR points at the DFA staging host, so the fixture asserts that the code does **not** route. |
| Romania | Located, not admitted | Official prefecture legislation includes a blank legal model, but no current issuing-format specimen was established. |
| Russian Federation | Located, not admitted | Ministry of Justice material publishes the Convention model text; no current issuer-format certificate specimen was found. |
| Rwanda | **Tested** | The official gazette's trilingual Convention annex, page 16, is tested for Kinyarwanda-English-French OCR. It is classified as an official legal model, not a filled specimen. |
| Saint Kitts and Nevis | No public specimen located | Foreign Ministry verifier found; no issuer-published certificate specimen found. |
| Saudi Arabia | Located, not admitted | A live Foreign Ministry certificate was discoverable through a print endpoint; it is a real record, not a specimen, and was excluded. |
| Singapore | **Tested** | IMDA/Singapore Academy of Law publish a [filled 2024 e-Apostille specimen](https://www.imda.gov.sg/-/media/imda/files/news-and-events/media-room/media-releases/2024/09/announcement-of-e-apostille-and-gpt-legal/annex-a.pdf). |
| Slovenia | No public specimen located | District Courts e-Register found; no issuer-published certificate specimen found. |
| Spain | No public specimen located | Ministry of Justice explains that successful lookups display an identical PDF image, but no public specimen or safe lookup credential is published. All 44 authorities share the audited register. |
| Tajikistan | No public specimen located | Joint MFA/Ministry of Justice verifier found; no issuer-published certificate specimen found. |
| Türkiye | Located, not admitted | An official education-service manual appears to contain a filled example, but the published PDF was corrupt/incomplete when fetched and could not be rendered reproducibly. |
| Ukraine | No public specimen located | Ministry of Education and Science and Ministry of Justice systems were checked separately; no safe issuer-published certificate specimen passed the gate. |
| United Kingdom | No public specimen located | FCDO confirms paper and electronic Apostilles and provides verification, but no public certificate specimen was found. The Cayman Islands authority was checked separately with the same result. |
| United States of America | **Tested for Texas** | Texas publishes a filled [Sample Universal Apostille](https://www.sos.state.tx.us/statdoc/apostilleforms.shtml). Arkansas, California, Colorado, Delaware, Kentucky, Minnesota, Montana, Nevada, New York, North Carolina, Tennessee, Washington, and West Virginia were checked separately. Arkansas only shows an angled brochure photo; a Minnesota live filing was excluded; no other issuer specimen was admitted. |
| Uruguay | No public specimen located | Foreign Ministry e-Register and current application guide found; no issuer-published certificate specimen found. |
| Uzbekistan | No public specimen located | The official e-Register can display scanned Apostilles after a valid lookup, but publishes no safe specimen credential or certificate model. |
| Venezuela | Located, not admitted | The Foreign Ministry publishes [historical and current official models](https://mppre.gob.ve/documentos-legalizaciones-apostilla), but the current image is only 431×578 and met 2 of 4 OCR anchors, so it was skipped as requested. |

## Automated coverage after this audit

The suite now contains 18 official fixtures:

- seven HCCH multilingual models, covering every published label ordering so
  that stripping a chained multilingual label is exercised in each direction;
- eleven jurisdiction-specific official specimens/models covering Argentina,
  Austria, Azerbaijan, Mainland China, Cyprus, Kosovo, Paraguay, the
  Philippines, Rwanda, Singapore, and Texas.

Together with fourteen artificial regressions, the Apple Vision sample suite
reports **31 passed, 1 skipped, 0 failed**. The skip is the Greek fixture, which
this machine's Apple Vision has no recognizer for; its parsing is asserted
without OCR in `ApositifyTests`. The manifest stores only source metadata and
expectations; downloaded source documents remain in the gitignored
`specimens/official-test-cache` directory.
