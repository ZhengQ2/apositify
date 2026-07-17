# Apostille Verification & e-Register App — Development Plan (Revised)

This revises the original 5-phase plan after three things surfaced during Phase 1/2 work:

1. **Automating form submission against official government portals (original Phase 2) is the wrong foundation.** It risks violating portal terms of use, requires maintaining a scraper per jurisdiction with no stable contract, and creates real liability if a broken scraper or stale cache asserts "Valid" incorrectly. See "What changed" below.
2. **e-Apostille and e-Register are different things and must not be conflated in data or code.** An **e-Apostille** is the electronic certificate itself (a signed PDF/XML issued by the competent authority). An **e-Register** is the government's own online lookup where anyone can check whether a given Apostille (paper or electronic) is genuine. A jurisdiction can have either, both, or neither — and several rows in our source data pointed at an e-Apostille *application* page when the chart claimed an e-Register. Investigating our "dead link" list (see Appendix) found this exact conflation in Nicaragua and Rhode Island.
3. **Most authorities have no direct online path at all — Phase 2's own research confirmed this.** Of 75 fielded authorities tested by actually submitting their live forms, only 6 support one-click deep-linking; the rest are copy-assist. Given that, building a full QR/barcode/OCR image pipeline into the general web product (original Phase 3) front-loads OCR complexity onto the cases where it can't lead anywhere better than copy-assist anyway. Phase 3 is now scoped down to just QR-code scanning for the authorities that actually support it (Tier E); general photo-upload/OCR extraction moves to Phase 5, as an in-app-only feature of the native mobile app rather than a web feature — see below.

## Terminology (binding for schema and code)

| Term | What it is | What it is not |
|---|---|---|
| **e-Apostille** | The electronic certificate/document itself, digitally signed by the issuing authority. Verified by checking a cryptographic signature (Phase 4). | Not a website. Not something you "search" for. |
| **e-Register** | A government-run online portal where you enter an Apostille's identifying details (number, date, etc.) and it tells you whether that Apostille is genuine. | Not the same as an application/appointment portal for requesting a *new* Apostille. |

Every dataset row must carry both `hasEApostille` and `hasERegister` as independent booleans (the richer chart JSON we're ingesting already separates `e_apostille` and `e_register` per authority — preserve that separation all the way to the UI). A jurisdiction with an e-Apostille program and no e-Register should render as "contact the authority to verify" — not as a broken link.

## What changed from the original plan

- **Original Phase 2** (headless-browser automated form submission + result scraping) is replaced with **structured manual verification + smart routing** — no server-side automation, no scraping of result pages, nothing that touches a government portal except a normal user-driven browser navigation.
- **Original Phase 3** (image upload / QR / OCR, all in one phase) is split up: QR-code scanning stays in Phase 3, scoped to only the authorities that actually support QR verification. General photo-upload/OCR field extraction moves to Phase 5 and becomes an **in-app-only** feature of the native mobile app — it is explicitly not part of the web product.
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
- **Tier E — QR-only or hybrid.** Unchanged from Phase 1: QR-only authorities (including Rwanda, reclassified after its listed link turned out to be a non-apostille file tracker) get an informational message; hybrid authorities (Pakistan) get both the link and the QR note.

### Field-definition metadata

A small per-authority config (extending the existing dataset, not a new database) declares: which tier, which fields are required (certificate number, issue date, sticker number, etc.), and for Tier B the URL template. This is the "field definition service" from the original plan — it survives, just without ever driving an automated submission. Implemented in `src/data/verification-fields.js`, with the one confirmed Tier B case wired to a one-click "Verify now" button in the UI.

### Why this is meaningful on its own (not just a stepping-stone to Phase 3)

Phase 1 already gets a user to the right portal. Phase 2's actual new value is: the user no longer has to *guess* what fields that portal wants, and where a deep link is possible, they skip a manual form entirely. This ships and is useful independent of Phase 3's QR scanning or Phase 5's photo-upload/OCR — both later just become other ways to fill in the same fields (from a QR code or an image instead of a keyboard).

### Explicitly out of scope for Phase 2

- No Puppeteer/Playwright, no server-side sessions, no CAPTCHA-solving.
- No parsing or storing of what the official site returns. The app never says "Valid" or "Invalid" itself.
- No caching of verification *results* (the original plan's 30-day result cache is dropped for the same reason — we're not in the business of asserting outcomes).

---

## Phase 3 — QR-code scanning (downscoped)

**Rescoped:** the original Phase 3 (QR + barcode + OCR from an uploaded image) tried to cover every authority uniformly. Given Phase 2's own research found the large majority of authorities have no deep link and would only get copy-assist value out of extracted fields anyway, that made OCR the most expensive part of the plan for the least payoff. Phase 3 now covers **only QR-code scanning, only for the authorities that actually support QR verification** — the existing Tier E set (QR-only: Bahrain, El Salvador, Luxembourg, Panama/Órgano Judicial, Russian Federation; hybrid: Pakistan) plus any authority whose e-Register also happens to expose a QR option. Barcode scanning and OCR field extraction are cut from this phase entirely and move to Phase 5 (see below).

**Why QR-only is a good place to stop for the web product:** many of these QR codes encode a direct verification URL (the record ID is baked into the link itself), so scanning one client-side (`getUserMedia` + a lightweight decoder like `jsQR`, no server round-trip) and opening the decoded URL is a true one-tap verification — no field-definition metadata needed, no OCR accuracy problem, no image ever leaves the browser. This is a small, self-contained feature: it only touches the handful of Tier E authorities, and it slots into the existing Phase 1 "scan the QR code" messaging by actually doing the scan instead of just telling the user to do it themselves.

Workflow:
1. User opens their camera in-browser (or uses a file picker as a fallback for a saved QR image).
2. Client-side QR decode. If it resolves to a URL, open it directly.
3. If the authority is hybrid (QR + a real e-Register link, e.g. Pakistan), the QR path is offered alongside Phase 2's existing link/routing — not a replacement for it.

Out of scope for this phase (see Phase 5): barcode formats other than QR, OCR of any kind, and general photo upload for authorities without QR support.

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
3. **Phase 3** — QR-code scanning for the ~6-7 Tier E authorities only. Much smaller than the original OCR-inclusive scope: 1–2 weeks, mostly camera-permission UX and wiring the decoded URL into the existing Phase 1/2 flow, no OCR accuracy work at all.
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
