# Apostille Verification & e-Register App — Development Plan (Revised)

This revises the original 5-phase plan after two things surfaced during Phase 1 work:

1. **Automating form submission against official government portals (original Phase 2) is the wrong foundation.** It risks violating portal terms of use, requires maintaining a scraper per jurisdiction with no stable contract, and creates real liability if a broken scraper or stale cache asserts "Valid" incorrectly. See "What changed" below.
2. **e-Apostille and e-Register are different things and must not be conflated in data or code.** An **e-Apostille** is the electronic certificate itself (a signed PDF/XML issued by the competent authority). An **e-Register** is the government's own online lookup where anyone can check whether a given Apostille (paper or electronic) is genuine. A jurisdiction can have either, both, or neither — and several rows in our source data pointed at an e-Apostille *application* page when the chart claimed an e-Register. Investigating our "dead link" list (see Appendix) found this exact conflation in Nicaragua and Rhode Island.

## Terminology (binding for schema and code)

| Term | What it is | What it is not |
|---|---|---|
| **e-Apostille** | The electronic certificate/document itself, digitally signed by the issuing authority. Verified by checking a cryptographic signature (Phase 4). | Not a website. Not something you "search" for. |
| **e-Register** | A government-run online portal where you enter an Apostille's identifying details (number, date, etc.) and it tells you whether that Apostille is genuine. | Not the same as an application/appointment portal for requesting a *new* Apostille. |

Every dataset row must carry both `hasEApostille` and `hasERegister` as independent booleans (the richer chart JSON we're ingesting already separates `e_apostille` and `e_register` per authority — preserve that separation all the way to the UI). A jurisdiction with an e-Apostille program and no e-Register should render as "contact the authority to verify" — not as a broken link.

## What changed from the original plan

- **Original Phase 2** (headless-browser automated form submission + result scraping) is replaced with **structured manual verification + smart routing** — no server-side automation, no scraping of result pages, nothing that touches a government portal except a normal user-driven browser navigation.
- **Original Phase 3** (image upload / QR / OCR) is unchanged in spirit but now explicitly described as *feeding into* Phase 2's routing layer, rather than needing its own submission logic.
- Phase 4/5 are lightly corrected (a wrong library recommendation, a scoping suggestion) but structurally the same.

---

## Phase 1 — Directory (shipped)

Country/authority dropdowns backed by the HCCH e-APP implementation chart, with distinct UI states for direct-link, QR-only, manual-contact, and link-missing rows. Live at apostifi.com. No changes needed here beyond re-ingesting the richer per-authority dataset (see "Data foundation" below).

---

## Phase 2 — Structured verification & smart routing (redefined)

**Goal:** let a user who is looking at a paper or electronic Apostille type in what it says, and get routed to the fastest legitimate way to confirm it — without us ever touching, storing, or asserting the verification result ourselves.

### Per-authority routing tiers

Every authority row gets classified into exactly one tier, driven by data, not guesswork:

- **Tier A — Direct link, no fields needed.** The e-Register is a simple portal; Phase 1 already covers this (open link in new tab).
- **Tier B — GET-deep-link.** The e-Register accepts query parameters and a plain URL genuinely opens a working result page. **Confirmed by testing to be rare: only 1 of 73 fielded authorities qualifies** (Ukraine's Ministry of Education — see [APOSTILLE_FIELD_REQUIREMENTS.md](APOSTILLE_FIELD_REQUIREMENTS.md) for the full per-authority breakdown and exact URL template). Several forms that looked GET-based in static HTML (Belgium, Bolivia, Indonesia, Delaware/USA) turned out, once actually filled in and submitted, to be JS/SPA forms or POST forms in disguise — so this tier is populated only from live-verified cases, never guessed from a form's `method` attribute alone. We build the URL client-side from user input and open it — this is indistinguishable from a human typing the same URL, so it carries none of the ToS/automation risk of headless submission.
- **Tier C — POST-only or JS-driven portal, no stable URL scheme.** This is the default outcome for the large majority of authorities (confirmed CAPTCHA-gated, CSRF-token-guarded, or AJAX/SPA-based). We still collect the same fields (number, date, etc.) via a review/edit form, but instead of submitting anything ourselves we show a "here are your values — copy these, then open the official site" panel. The user pastes and submits it themselves, and reads the verdict on the government's own page. We never parse or store the result.
- **Tier D — No e-Register exists.** (Nicaragua, Rhode Island post-pilot, Baja California Sur, Austria, and USA/Texas all landed here after investigation — see Appendix.) Show a clear "contact the issuing authority directly" message with the authority's contact info, exactly like Phase 1's manual-contact state.
- **Tier E — QR-only or hybrid.** Unchanged from Phase 1: QR-only authorities (including Rwanda, reclassified after its listed link turned out to be a non-apostille file tracker) get an informational message; hybrid authorities (Pakistan) get both the link and the QR note.

### Field-definition metadata

A small per-authority config (extending the existing dataset, not a new database) declares: which tier, which fields are required (certificate number, issue date, sticker number, etc.), and for Tier B the URL template. This is the "field definition service" from the original plan — it survives, just without ever driving an automated submission. Implemented in `src/data/verification-fields.js`, with the one confirmed Tier B case wired to a one-click "Verify now" button in the UI.

### Why this is meaningful on its own (not just a stepping-stone to Phase 3)

Phase 1 already gets a user to the right portal. Phase 2's actual new value is: the user no longer has to *guess* what fields that portal wants, and where a deep link is possible, they skip a manual form entirely. This ships and is useful before any OCR/image work exists in Phase 3 — Phase 3 later just becomes another way to fill in the same fields (from an image instead of a keyboard).

### Explicitly out of scope for Phase 2

- No Puppeteer/Playwright, no server-side sessions, no CAPTCHA-solving.
- No parsing or storing of what the official site returns. The app never says "Valid" or "Invalid" itself.
- No caching of verification *results* (the original plan's 30-day result cache is dropped for the same reason — we're not in the business of asserting outcomes).

---

## Phase 3 — Image upload: QR / Barcode / OCR extraction

Unchanged from the original plan's technical approach (ZXing/jsQR for QR/barcode, Tesseract.js for OCR, prefer client-side processing so images don't need to leave the browser when avoidable — better for privacy and for GDPR-style data minimization). The one structural change: extracted fields flow into Phase 2's tier-based routing instead of into a scraper. Concretely:

1. User uploads an image.
2. Client-side QR/barcode scan. If the QR encodes a direct verification URL (the common case — many e-Registers' QR codes are just a link with the record ID baked in), open it directly — this is actually a Tier A-like path requiring zero extra infrastructure.
3. If no QR/barcode, OCR extracts the candidate fields (number, date, etc.) and pre-fills the same review form Phase 2 already has for manual entry, including confidence flags on uncertain characters.
4. From there it's identical to Phase 2's Tier B/C routing — deep link or copy-assist.

---

## Phase 4 — e-Apostille support

This is the one part of the plan that's genuinely about the e-Apostille (the certificate itself), not the e-Register — keep that boundary clear in the UI copy so users don't confuse "upload your e-Apostille file to check its signature" with "look up your Apostille number in a registry."

**Correction to the original plan:** `PyPDF2` does **not** verify PDF digital signatures — it can read signature metadata but doesn't validate the PAdES trust chain. Use `pyHanko` or `endesive` for PDF, and an XAdES-capable library for XML. Budget more time here than the original 1-month estimate; per-country trust chains and certificate formats vary and this is genuinely hard, not routine integration work.

---

## Phase 5 — Mobile app

**Suggested scoping change:** build this as a camera-capable PWA on the existing React codebase first (`getUserMedia` + the same ZXing/Tesseract.js stack from Phase 3), rather than committing to a separate Flutter/React Native codebase up front. This likely covers most of the real-world use case (scan on your phone, verify) without maintaining two codebases. Only invest in a true native app if App Store/Play Store distribution specifically matters (e.g. for discoverability or offline ML Kit-quality OCR).

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
2. **Phase 2** — tier classification for all ~97 authority rows + field-definition metadata + deep-link/copy-assist UI. Realistic at 3–4 weeks given Phase 1's UI patterns already exist to extend.
3. **Phase 3** — QR/barcode/OCR pipeline feeding Phase 2's forms. 6–8 weeks, most of it OCR accuracy tuning and image preprocessing, not routing logic (already built in Phase 2).
4. **Phase 4** — e-Apostille signature verification. Budget 2+ months; this is the hardest phase technically (per-country trust chains) and should not be compressed to hit a date.
5. **Phase 5** — PWA-first mobile scanning experience reusing Phase 3's client-side code; native app only if a specific distribution need justifies the second codebase.
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
