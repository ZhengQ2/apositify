# Apostille Verification & e-Register App — Development Plan (Revised)

This revises the original 5-phase plan after three things surfaced during Phase 1/2 work:

1. **Automating form submission against official government portals (original Phase 2) is the wrong foundation.** It risks violating portal terms of use, requires maintaining a scraper per jurisdiction with no stable contract, and creates real liability if a broken scraper or stale cache asserts "Valid" incorrectly. See "What changed" below.
2. **e-Apostille and e-Register are different things and must not be conflated in data or code.** An **e-Apostille** is the electronic certificate itself (a signed PDF/XML issued by the competent authority). An **e-Register** is the government's own online lookup where anyone can check whether a given Apostille (paper or electronic) is genuine. A jurisdiction can have either, both, or neither — and several rows in our source data pointed at an e-Apostille *application* page when the chart claimed an e-Register. Investigating our "dead link" list (see Appendix) found this exact conflation in Nicaragua and Rhode Island.
3. **Most typed-field e-Registers have no direct online path, but QR support is broader and independent of the Phase 2 routing tiers.** Of 75 fielded authorities tested by actually submitting their live forms, only 6 support one-click deep-linking; the rest are copy-assist. Separate QR research now covers all 64 e-Register parties and identifies 23 parties with QR confirmed by HCCH, an issuing authority, or an official specimen, plus two parties supported only by public non-issuer specimens. Phase 3 therefore remains QR-only—no OCR or other barcode formats—but QR capability is modeled per authority rather than inferred from Tier E. General photo-upload/OCR extraction remains in Phase 5.

## Terminology (binding for schema and code)

| Term | What it is | What it is not |
|---|---|---|
| **e-Apostille** | The electronic certificate/document itself, digitally signed by the issuing authority. Verified by checking a cryptographic signature (Phase 4). | Not a website. Not something you "search" for. |
| **e-Register** | A government-run online portal where you enter an Apostille's identifying details (number, date, etc.) and it tells you whether that Apostille is genuine. | Not the same as an application/appointment portal for requesting a *new* Apostille. |

Every dataset row must carry both `hasEApostille` and `hasERegister` as independent booleans (the richer chart JSON we're ingesting already separates `e_apostille` and `e_register` per authority — preserve that separation all the way to the UI). A jurisdiction with an e-Apostille program and no e-Register should render as "contact the authority to verify" — not as a broken link.

## What changed from the original plan

- **Original Phase 2** (headless-browser automated form submission + result scraping) is replaced with **structured manual verification + smart routing** — no server-side automation, no scraping of result pages, nothing that touches a government portal except a normal user-driven browser navigation.
- **Original Phase 3** (image upload / QR / OCR, all in one phase) is split up: QR-code scanning stays in Phase 3 and is enabled authority by authority only after its payload and official destination are verified. General photo-upload/OCR field extraction moves to Phase 5 and becomes an **in-app-only** feature of the native mobile app — it is explicitly not part of the web product.
- Phase 4 is lightly corrected (a wrong library recommendation) but structurally the same. Phase 5 absorbs the OCR/barcode/image-preprocessing work that used to be Phase 3's, on top of its original mobile-app scope.

---

## Phase 1 — Directory (shipped)

Country/authority dropdowns backed by the HCCH e-APP implementation chart, with distinct UI states for direct-link, QR-only, manual-contact, and link-missing rows. Live at apostifi.com. No changes needed here beyond re-ingesting the richer per-authority dataset (see "Data foundation" below).

---

## Phase 2 — Structured verification & smart routing (redefined)

**Goal:** let a user who is looking at a paper or electronic Apostille type in what it says, and get routed to the fastest legitimate way to confirm it — without us ever touching, storing, or asserting the verification result ourselves.

### Per-authority routing tiers

Every authority row gets classified into exactly one tier, driven by data, not guesswork:

- **Tier A — Direct link, no fields needed.** The e-Register is a simple portal; Phase 1 already covers this (open link in new tab).
- **Tier B — Deep-link (GET URL, or POST auto-submit).** The e-Register either accepts query parameters on a plain URL, or is a clean POST form with no CSRF token/CAPTCHA — the latter is driven by building a hidden `<form>` with the values and auto-submitting it client-side, the same mechanism payment-gateway redirects use (a real navigation, not a blocked cross-origin fetch). **Confirmed by testing to be rare: only 6 of 75 fielded authorities qualify** (Ukraine's Ministry of Education via GET; Bulgaria ×2, Andorra, Costa Rica, and Moldova via POST auto-submit — see [APOSTILLE_FIELD_REQUIREMENTS.md](APOSTILLE_FIELD_REQUIREMENTS.md) for the full per-authority breakdown and exact URL/field templates). Several forms that looked GET-based in static HTML (Belgium, Bolivia, Indonesia, Delaware/USA) turned out, once actually filled in and submitted, to be JS/SPA forms in disguise — so this tier is populated only from live-verified cases, never guessed from a form's `method` attribute alone. Either mechanism is indistinguishable from a human submitting the same form themselves, so it carries none of the ToS/automation risk of headless submission.
- **Tier C — POST-only or JS-driven portal, no stable URL scheme.** This is the default outcome for the large majority of authorities (confirmed CAPTCHA-gated, CSRF-token-guarded, or AJAX/SPA-based). We still collect the same fields (number, date, etc.) via a review/edit form, but instead of submitting anything ourselves we show a "here are your values — copy these, then open the official site" panel. The user pastes and submits it themselves, and reads the verdict on the government's own page. We never parse or store the result.
- **Tier D — No e-Register exists.** (Nicaragua, Rhode Island post-pilot, and Baja California Sur all landed here after investigation — see Appendix. USA/Texas and Austria were briefly misclassified here too, before their real verifiers were found — see corrections in [APOSTILLE_FIELD_REQUIREMENTS.md](APOSTILLE_FIELD_REQUIREMENTS.md).) Show a clear "contact the issuing authority directly" message with the authority's contact info, exactly like Phase 1's manual-contact state.
- **Tier E — QR-only or hybrid.** This remains a Phase 2 routing classification: QR-only authorities get an informational message and hybrid authorities get both the conventional link and QR note. It is not the source of truth for whether an apostille contains a QR. Phase 3 uses separate authority-scoped `qrCode` metadata because many Tier A–C authorities also issue QR-bearing apostilles.

### Field-definition metadata

A small per-authority config (extending the existing dataset, not a new database) declares: which tier, which fields are required (certificate number, issue date, sticker number, etc.), and for Tier B the URL template. This is the "field definition service" from the original plan — it survives, just without ever driving an automated submission. Implemented in `src/data/verification-fields.js`, with the one confirmed Tier B case wired to a one-click "Verify now" button in the UI.

### Why this is meaningful on its own (not just a stepping-stone to Phase 3)

Phase 1 already gets a user to the right portal. Phase 2's actual new value is: the user no longer has to *guess* what fields that portal wants, and where a deep link is possible, they skip a manual form entirely. This ships and is useful independent of Phase 3's QR scanning or Phase 5's photo-upload/OCR — both later just become other ways to fill in the same fields (from a QR code or an image instead of a keyboard).

### Explicitly out of scope for Phase 2

- No Puppeteer/Playwright, no server-side sessions, no CAPTCHA-solving.
- No parsing or storing of what the official site returns. The app never says "Valid" or "Invalid" itself.
- No caching of verification *results* (the original plan's 30-day result cache is dropped for the same reason — we're not in the business of asserting outcomes).

---

## Phase 3 — Safe, authority-scoped QR scanning

### Goal and evidence boundary

Let a user scan a QR from an apostille entirely in the browser and route the decoded content according to a verified authority-specific rule. The app may say that it decoded a QR and that a destination matches a documented official route. It must never say that the apostille is valid; only the issuing authority's result can do that.

The complete evidence baseline is [PHASE_3_QR_CODE_RESEARCH.md](PHASE_3_QR_CODE_RESEARCH.md): 64 of 64 e-Register parties are accounted for; QR is officially confirmed for 23 parties, supported only by public specimens for two, reported but not confirmed for 12, found only on the underlying document for one, and not established for 26. These are party-level counts; implementation and enablement remain authority-scoped.

An official statement that a QR exists is not enough to enable automatic routing. This is not a theoretical caution: Costa Rica's Ministry states its QR "enables authenticity verification", and the decoded specimen turned out to be delimited plain text with no URL in it at all. The Philippines' DFA describes "quick access to the verification link", and the specimen carries only a bare hostname with no document reference. Both would have shipped as broken deep links on the strength of official wording alone.

**The production gate is one decoded specimen**, plus a known payload function, an evidence source, and the routing metadata that function requires. `gateEnabled()` in `src/data/qr-codes.js` is the single authority on this rule — `enabled` is derived there, never hand-written, and `scripts/validate-data.mjs` asserts the derivation stayed honest. Treat that function as normative and this paragraph as commentary; restating the threshold in prose is what let the two drift apart in the first place.

**Revised from two specimens to one on 2026-07-18.** The original bar was written before any specimen existed, when we did not know what these payloads contained. Eighteen decodes later, the calculus is different: a decoded host is empirical fact, and the residual risk of a single specimen is a path template that is too *tight* — which fails closed, showing the user "blocked", rather than routing them somewhere wrong. Canonical URL reconstruction is the one operation where a mistaken template could open a URL the QR never contained, and it still requires two specimens, enforced in `buildDestination()` and asserted in the validator.

### Deliverables

#### 3.1 Data contract and migration

- Add `qrCode` metadata independently of `verificationMode`; do not infer one from the other.
- Scope each record to a competent authority and, where necessary, an issuance generation or effective date. This is required for China, Mexico, Panama, Bulgaria, Kazakhstan, Ukraine, the UK, and the United States.
- Use the following minimum fields:

```js
qrCode: {
  presence: 'confirmed', // confirmed | public_specimen | reported | underlying_only | not_established
  evidence: 'authority', // hcch | authority | official_specimen | public_specimen | null
  function: 'verification_url', // verification_url | portal_or_token | document_url | offline_app | unknown
  enabled: false,
  allowedUrls: [
    {
      protocol: 'https:',
      hostname: 'example.gov',
      port: '',
      pathnamePattern: '^/verify/[A-Za-z0-9_-]+$'
    }
  ],
  specimenCount: 0,
  specimenTestedAt: null,
  sourceUrl: 'https://…',
  notes: null
}
```

- Keep path/query rules separate from hostname matching. Hostnames use exact normalized matching unless a specific subdomain rule is documented; paths are checked against authority-specific patterns only after the host passes.
- Extend `scripts/validate-data.mjs` to reject `enabled: true` unless the authority has a known function, a decoded specimen, an evidence source, and the routing metadata required by that function. It must also reject a rule that binds only a host without constraining the path, an authority that mixes URL-based and non-URL functions, and any canonical-reconstruction template backed by fewer than two specimens.

#### 3.2 Scanner component

- Add a reusable QR scanner launched from the selected authority panel.
- Support live camera scanning and a saved-image file picker at feature parity.
- Decode locally; never upload, retain, log, or place the image or decoded payload in analytics.
- Stop camera tracks when the dialog closes, the authority changes, a result is obtained, or the page is hidden.
- Model explicit UI states: idle, requesting permission, scanning, decoding file, decoded, blocked destination, unsupported payload, no QR found, and camera unavailable.
- Preserve keyboard operation, visible focus, screen-reader status announcements, and a non-camera fallback.
- Choose the decoder through a short implementation spike using real fixtures. The dependency must support still images and camera frames, remain QR-only in the product UI, and add no network processing.

#### 3.3 Payload classification and safe routing
- Parse decoded text with the platform `URL` parser. Reject credentials, non-HTTP(S) schemes, unexpected ports, malformed hosts, and look-alike domains.
- Normalize the hostname to ASCII and compare it exactly with the selected authority's allowlist. Never use substring matching.
- Validate the documented path/query shape. Where possible, extract only the verified record token and rebuild a canonical URL from the stored official base instead of opening the raw decoded URL.
- A browser-only app cannot reliably inspect an arbitrary cross-origin redirect chain before navigation. Do not promise that it can. For enabled authorities, document tested redirects and prefer canonical URLs without open redirect parameters. Show the expected official host before the user leaves the app, open in a new tab, and never label the navigation itself as verification.
- Treat payload functions distinctly:
  - `verification_url`: show the normalized official destination and an “Open official verification” action.
  - `portal_or_token`: open the documented portal and prefill only fields whose extraction mapping is specimen-tested; otherwise show the token for copying.
  - `document_url`: label it “Retrieve official document,” not “Verify.”
  - `offline_app`: provide instructions for the named government app; do not attempt to reproduce its signature validation.
  - `unknown`: show the decoded content with a warning and no official-verification action.
- If the selected authority and payload rule do not match, block the official action and show the decoded hostname/content without opening it automatically.

#### 3.4 User experience integration

- Show “Scan QR” in the public UI only when the selected authority has `enabled: true`. Confirmed-but-not-enabled authorities retain their informational QR guidance until the evidence gate is complete.
- Exercise disabled authorities only through the development fixture harness; do not expose public-specimen-only or reported cases as supported scanning routes.
- Keep conventional e-Register actions available for hybrid authorities; scanning is an additional input route, never a replacement.
- Explain that a QR on the underlying document is not an apostille QR and exclude `underlying_only` authorities from the apostille scanner entry point.
- Use function-specific copy and avoid the words “valid,” “invalid,” or “verified” for any conclusion made by this app.

#### 3.5 Specimen and rollout workstream

- Maintain a private, access-controlled fixture manifest containing redacted specimen provenance, issuance date, decoded payload type, URL template, redirects, and test checksum. Do not commit personal documents to the repository.
- Create synthetic QR fixtures only for decoder and security tests. Synthetic fixtures cannot satisfy an authority's evidence gate.
- Prioritize specimen acquisition in this order:
  1. Authorities with an official specimen and a documented host or portal: Armenia, Chile, China (Mainland), Greece, Hong Kong, Japan, and Mexico federal.
  2. HCCH/authority-confirmed QR systems whose payload still needs a specimen: Bahrain, Bangladesh, Bolivia, Costa Rica, Ecuador, El Salvador, Pakistan, Panama Judicial Branch, Russian Federation, Rwanda, and Kazakhstan.
  3. Authority-specific cases needing tighter scope: Brazil, Bulgaria, Colombia, Guatemala, and the Philippines.
  4. Public-specimen-only and reported parties remain disabled until issuer evidence and current specimens are obtained.
- Enable one authority per pull request so evidence, URL rules, fixtures, and copy can be reviewed together.

#### 3.6 Tests

- Unit-test URL parsing, IDN normalization, exact-host matching, optional subdomain rules, path patterns, token extraction, and canonical URL reconstruction.
- Include adversarial cases: look-alike suffixes, user-info credentials, encoded host/path confusion, non-HTTPS URLs, unexpected ports, malformed percent encoding, JavaScript/data/file schemes, fragments, and open-redirect parameters.
- Test every function type and every scanner state.
- Test camera denial, no camera, switching cameras where supported, closing while scanning, authority changes, repeated scans, corrupt images, multiple QR codes, and very large images.
- Run accessibility checks for dialog focus, status announcements, labels, error recovery, and keyboard-only file selection.
- For every enabled authority, add positive fixture tests for all accepted URL templates and negative fixtures from adjacent authorities.

### Release sequence

1. **3A — Foundation:** schema, validator, scanner UI, local decoding, state/accessibility tests, and blocked-by-default routing. Released behind a feature flag with no authority enabled, since no specimen had been decoded yet.
2. **3B — Security and function routing:** canonical URL builder, function-specific result UI, adversarial tests, and privacy verification.
3. **3C — Authority pilots:** acquire and decode a current specimen, then enable authorities as their evidence lands. A second specimen from an independent issuance remains valuable — it is what unlocks canonical URL reconstruction — but it is no longer a precondition for routing.
4. **3D — Expansion and maintenance:** continue evidence-gated enablement; add QR endpoints to link monitoring and revalidate enabled authorities periodically.

### Acceptance criteria

1. Images and decoded payloads remain on-device and are absent from logs and analytics.
2. Camera resources are always released and file selection works when camera access is unavailable or denied.
3. No decoded destination opens automatically.
4. An “official” action appears only when the selected authority is enabled and the payload matches its complete protocol/host/port/path rule.
5. Each enabled authority has at least one decoded specimen, a documented payload function, positive fixtures, and adversarial tests. Any authority whose rule reconstructs a canonical URL has two specimens from independent issuances.
6. `document_url`, `portal_or_token`, `offline_app`, `unknown`, and mismatched-authority results cannot be presented as successful verification.
7. The app never asserts whether an apostille is valid or invalid.

### Explicitly out of scope

Barcode formats other than QR, OCR, image enhancement, automatic country/authority recognition, server-side URL fetching, result-page scraping, result caching, offline cryptographic verification, and general apostille photo upload remain outside Phase 3. OCR and other barcode formats remain in Phase 5.

---

## Phase 4 — e-Apostille support

This is the one part of the plan that's genuinely about the e-Apostille (the certificate itself), not the e-Register — keep that boundary clear in the UI copy so users don't confuse "upload your e-Apostille file to check its signature" with "look up your Apostille number in a registry."

**Correction to the original plan:** `PyPDF2` does **not** verify PDF digital signatures — it can read signature metadata but doesn't validate the PAdES trust chain. Use `pyHanko` or `endesive` for PDF, and an XAdES-capable library for XML. Budget more time here than the original 1-month estimate; per-country trust chains and certificate formats vary and this is genuinely hard, not routine integration work.

---

## Phase 5 — Mobile app with in-app-only photo upload/OCR

**Rescoped:** this phase now absorbs the barcode-scanning and OCR field-extraction work cut from Phase 3. Given that most authorities only offer copy-assist even with perfectly-extracted fields, and that reliable OCR from a photo genuinely benefits from native camera integration (framing guidance, autofocus, on-device recognition quality) rather than a plain web file-upload input, photo-upload/OCR is now scoped as an **in-app-only** capability of the native mobile app — it will not exist on the website at all, by design, not just as a "PWA for now" placeholder.

What this phase covers:
- A native mobile app (Flutter or React Native) with camera-based photo capture of an Apostille.
- On-device OCR (e.g. Google ML Kit on Android/iOS, or a bundled Tesseract model) extracts candidate field values (number, date, sticker number, etc.), with confidence flags on uncertain characters for the user to correct.
- Barcode formats beyond QR (1D Code 128, PDF417, etc.) are handled here too, since some jurisdictions use them instead of QR.
- Extracted fields feed into the same Phase 2 field-definition routing (deep link / copy-assist) already built for the web app — the routing logic isn't duplicated, only the input method (photo vs. keyboard vs. QR) differs.
- QR scanning is also available natively here (better performance than browser camera APIs), in addition to the web version from Phase 3 — the web QR path isn't replaced, just no longer the only place QR scanning happens.

This is a genuine native-app commitment, not a PWA stand-in — a previous version of this plan suggested a camera-capable PWA to avoid a second codebase, but since photo-upload/OCR is now explicitly in-app-only, that PWA path no longer applies to this feature. (A PWA could still make sense purely for surfacing Phase 1–3's existing web features on mobile, but that's a distribution question, not a requirement for this phase.)

---

## Data foundation & maintenance (new section — lessons from this session)

Link rot and data-entry conflation are the actual ongoing operational cost of this app, not a one-time seed. A pass over 84 unique e-Register URLs from the HCCH chart found:

- **3 URLs wrapped in Outlook Safelinks redirects** (an artifact of the PDF being extracted from a forwarded email) — needed unwrapping to the real destination.
- **1 URL with analytics tracking cruft** appended (Dominican Republic) — stripped to the clean path.
- **1 likely copy-paste error** in the source chart (Costa Rica's URL was identical to Colombia's) — needs manual sourcing, not blind trust of the PDF.
- **Scheme issues** (Armenia, West Virginia): the listed `http://` URL was refused; `https://` on the identical host worked. Cheap to detect, cheap to fix.
- **Domain migrations**: North Carolina and Tennessee both retired their old state-government subdomains in favor of new portals; the old ones now time out or 404 outright.
- **False-positive "broken" links**: Guatemala's e-Register returned 403 to our automated health-check but is actually live — it sits behind a Cloudflare bot-challenge that only blocks non-browser requests. A health-check script needs to distinguish "challenge page" from "actually down" (e.g. detect Cloudflare's "Just a moment..." interstitial) before flagging a row for human review.
- **True negatives — no e-Register exists at all**: Nicaragua and Rhode Island (post-pilot) only have *application* portals, not verification ones; Baja California Sur's site claims QR/code verification is possible but has no working link anywhere. These should be tagged Tier D (contact-only), not treated as a URL to fix.

**Recommendation:** keep the health-check script from this investigation (`scripts/` already has `clean-eapp-data.mjs` and `validate-data.mjs`) and add a `scripts/check-links.mjs` that runs periodically (manually for now; a scheduled job later), flags non-200s, and — critically — flags Cloudflare/bot-challenge pages separately from real failures so a human isn't stuck re-verifying the same false positive every cycle.

---

## Revised timeline (high-level)

Dropping the automation-fleet requirement shortens Phase 2 meaningfully versus the original estimate — it's now a data-modeling and forms task, not a scraping-infrastructure task.

1. **Phase 1** — done.
2. **Phase 2** — done (tier classification, field-definition metadata, deep-link/copy-assist UI, live for all 97 authority rows).
3. **Phase 3** — safe QR scanning in four releases. Engineering foundation and security routing should be estimated separately from authority rollout: approximately 2–3 weeks for 3A/3B, followed by evidence-dependent 3C/3D enablement. Specimen acquisition is an external dependency and must not be hidden inside a fixed engineering estimate.
4. **Phase 4** — e-Apostille signature verification. Budget 2+ months; this is the hardest phase technically (per-country trust chains) and should not be compressed to hit a date.
5. **Phase 5** — native mobile app with in-app-only photo-upload/OCR and barcode scanning, absorbing the complexity cut from Phase 3. Budget accordingly (this now carries the OCR accuracy tuning and image-preprocessing work that used to be Phase 3's, on top of standard native-app development) — realistically the largest single phase after Phase 4.
6. **Ongoing** — link-health monitoring and dataset reconciliation against HCCH updates (see Data foundation above) — this is a permanent cost, not a milestone.

---

## Appendix — dead-link investigation detail (this session)

| Authority | Original status | Finding | Resolution |
|---|---|---|---|
| Armenia | Timeout | `http://` connection refused; `https://` works | Fix scheme |
| West Virginia | 404 | Same path, `https://` returns 200 | Fix scheme |
| Guatemala | 403 | Cloudflare bot-challenge, site is live | Keep link; note bot-gate in health-check tooling |
| Peru | Timeout | Stale filename in URL; base path is live and correct | Update URL |
| North Carolina | Timeout | Domain retired; verification tool now embedded at `sosnc.gov/divisions/authentications` | Update URL |
| Tennessee | Timeout | `tnbear.tn.gov` retired; replaced by `tncab.tnsos.gov/portal/apostille-search` | Update URL |
| Rhode Island | 503 | Pilot program ended Sept 2025; remaining site is an application portal only | Reclassify Tier D (contact-only) |
| Baja California Sur | Timeout | Site claims code/QR verification but has no working link | Reclassify Tier D (contact-only) |
| Nicaragua | DNS failure | No e-Register exists; only an appointment-booking system for new applications | Reclassify Tier D (contact-only) |
