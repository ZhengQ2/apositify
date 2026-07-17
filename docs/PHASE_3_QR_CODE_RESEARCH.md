# Phase 3: QR Code Support — Research & Implementation Guide

This document covers QR-code adoption across apostille-issuing authorities, technical encoding details discovered during Phase 2 research, and implementation strategy for Phase 3's scoped QR-scanning feature.

## Jurisdictions supporting QR verification

### QR-only (6 authorities)

These authorities issue apostilles with QR codes and have **no online number-lookup e-Register at all** — QR scanning is the only remote verification path.

| Country | Authority | Source of QR code | Verification mechanism |
|---------|-----------|-------------------|------------------------|
| **Bahrain** | Ministry of Foreign Affairs | Printed/embedded on physical apostille | Scanning decodes to verification URL or result |
| **El Salvador** | Ministry of Foreign Affairs | Printed/embedded on physical apostille | Scanning decodes to verification URL or result |
| **Luxembourg** | Ministry of Foreign Affairs | Printed/embedded on physical apostille | Scanning decodes to verification URL or result |
| **Panama** | Órgano Judicial | Printed/embedded on physical apostille | Scanning decodes to verification URL or result |
| **Russian Federation** | Ministry of Justice | Printed/embedded on physical apostille | Scanning decodes to verification URL or result |
| **Rwanda** | Ministry of Foreign Affairs and International Cooperation | Printed/embedded on physical apostille | Scanning decodes to verification URL or result |

### Hybrid (1 authority)

This authority issues apostilles with QR codes **and** also provides an online number-lookup e-Register for cases where QR scanning isn't practical (PDF-only apostille, QR unreadable due to damage, etc.).

| Country | Authority | QR-only path | Also supports | Online form fields |
|---------|-----------|-------------|---------------|------------------|
| **Pakistan** | Ministry of Foreign Affairs | Scanning decodes to verification URL | Number-based lookup | Apostille Number; Date |

### Conditional QR support (known cases)

Several authorities mentioned QR as a fallback or alternative within their existing online forms, though these did not test as having primary QR-verification portals:

- **Cyprus** — form lists "CAPTCHA or scan QR code" as alternatives for human verification
- **Costa Rica** — explicitly noted in form design, but testing found no exposed QR-code endpoint
- **Greece** — form explicitly offers "Electronic apostille number, **or QR scan**" as input alternatives (both route to the same POST verification)

**Note:** These are modeled as field-based (Tier C) in Phase 2 since their online forms exist and work fine; QR is a user convenience option at the government's discretion, not a primary route. If you discover a specific jurisdiction where QR scanning is *faster* than the web form (e.g., a dedicated QR-only endpoint they don't advertise in their web UI), flag it and it can be split into a separate QR-scanning row.

---

## QR code content & encoding (from Phase 2 research)

### What does the QR code encode?

Research during Phase 2 testing and document review found two main patterns:

#### Pattern 1: Direct URL encoding (most common)

The QR code encodes a complete, navigable URL that, when opened in a browser, displays the verification result directly. Examples observed:

- **Ukraine (ENIC)** — encodes the deep-link template `enic.in.ua/index.php/en/aporegen?task=searchApo&apoNum={number}&reqNum={reqNum}&apoDate={date}` with actual values substituted
- **Bulgaria** — several authorities encode URLs to their POST-based verification endpoints with embedded parameters
- **Bahrain, El Salvador, Luxembourg, Panama, Russian Federation** — exact encoding unknown without physical apostille samples, but government documentation for several indicates direct URL encoding is the model

**Implication for Phase 3:** Scanning → decode → navigate directly is likely to work for many of these, with no need for a field form after the QR is read.

#### Pattern 2: Code/token encoding

The QR code encodes a reference code or security token (not a full URL) that the government's website can use to look up the record:

- **Rwanda** — originally reclassified as QR-only after finding that the listed URL (`irembo.gov.rw`) was a generic file-status tracker with no apostille-specific lookup. The actual QR-based verification mechanism is unknown without a physical sample.
- **Pakistan (hybrid)** — the QR code likely encodes the apostille number and/or date for convenience, decoding to that same form's input fields

**Implication for Phase 3:** Scanning → decode → extract fields → submit to the authority's form. This requires knowing the exact encoding scheme per authority — likely a per-country research task if we want to support it.

### Barcode formats beyond QR

The HCCH chart references several authorities with "code" or "barcode" verification; Phase 2 research was QR-focused. Known non-QR formats used in apostilles include:

- **Code 128** — some European authorities (e.g., Czech Republic, referenced but not in our 75-authority set)
- **PDF417** — some US states and Latin American jurisdictions
- **Aztec Code** — less common but used by some Caribbean/Latin American authorities

**Note:** The Phase 3 plan explicitly excludes non-QR barcode scanning in the web product; it stays scoped to QR only. Barcode support beyond QR is moved to Phase 5 (native mobile app).

---

## Authorities with QR capability noted but not in the primary set

These appeared in research but fell outside the 75-authority scope we tested (either no confirmed e-Register row, pilot programs, or historical data):

| Jurisdiction | Status | QR capability | Notes |
|--------------|--------|-----|-------|
| **USA — Connecticut** | e-Apostille pilot (ended Sept 2025) | Issued with QR codes | Pilot ended; no longer issuing. Not in HCCH chart. |
| **USA — Rhode Island** | e-Apostille pilot (ended Sept 2025) | Issued with QR codes | Pilot ended Sept 2025; remaining site is application-only, not verification. Reclassified Tier D (contact-only). |
| **USA — Utah** | e-Apostille pilot (ended Sept 2025) | Issued with QR codes | Pilot ended; no longer issuing. Not in HCCH chart. |
| **China — Mainland** | Online + alternate paths | Mentioned in forms | Some forms reference QR as a fallback, but no primary QR-verification endpoint found during Phase 2 research. |

---

## Implementation strategy for Phase 3

### Scope

**In:** QR-code scanning for the 6 QR-only authorities + Pakistan (hybrid) using `getUserMedia` (browser camera) or a fallback file picker (for saved QR images).

**Out of Phase 3, into Phase 5:** Barcode formats other than QR, OCR field extraction, photo upload of paper apostilles.

### User workflow

1. User navigates to an apostille they're trying to verify.
2. App detects it's from a QR-only jurisdiction or offers QR as an alternative (hybrid).
3. User taps "Scan QR code" → browser requests camera permission.
4. User points camera at the apostille's QR code → client-side `jsQR` or similar library decodes it.
5. Decoded content is processed:
   - **If it's a URL:** open it directly (one-tap verification, same as Phase 2's deep-link mechanism).
   - **If it's a code/token:** attempt to match against known patterns per authority; if a pattern exists, build and submit a form; otherwise, show the code and let the user paste it into the official site.
6. Result is displayed (either from the government's page or, if the code was decoded but no form pattern exists, as a fallback).

### Fallback for no camera / saved image

- File picker input that accepts `.png`, `.jpg`, `.jpeg`, `.gif` (common image formats).
- Same `jsQR` decode-and-process logic.
- Useful for users on a desktop or with a camera-incompatible browser, or who have a saved screenshot of a QR code.

### Technical considerations

- **QR decode library:** `jsQR` (https://github.com/cozmo/jsQR) is lightweight, client-only, and well-tested. Alternative: `zxing` (ZXing JavaScript), but jsQR is smaller.
- **Camera permissions:** `getUserMedia` API; request only on user action (button tap), not page load. Handle permission denial gracefully.
- **HTTPS requirement:** `getUserMedia` only works over HTTPS (or `localhost` for testing).
- **Mobile considerations:** browser camera works on most modern mobile browsers (iOS 15+, Android 4.4+). Desktop browsers vary; fallback to file picker is essential.

### Phase 3 data needs

To implement the code-decoding paths (if QR codes in some jurisdictions encode tokens rather than URLs), we need:

1. **Sample QR codes from each jurisdiction** (or documentation of their encoding scheme).
2. **Per-authority decode mapping:** a config that says "if authority is Rwanda and QR contains X pattern, extract fields Y and Z" — similar to the existing `verification-fields.js` structure, but for QR decoding.

This is a research task that happens in parallel with the implementation:

- Request sample apostilles from the government or a service that issues apostilles in those countries.
- Decode them and document the format.
- Build decode mappings accordingly.

**Until this research is done:** the fallback is to show the raw decoded text to the user ("Here's what the QR code contained: `...`") and guide them to paste it into the official site manually.

### UI/UX patterns

1. **QR button placement:** For QR-only jurisdictions, a prominent "Scan QR code" button replaces the usual "Open official e-Register" link. For hybrid (Pakistan), both buttons appear side-by-side.
2. **Camera UI:** Consider a full-screen camera viewfinder with corner guides (like a mobile banking app) for better UX. Minimum requirement: a simple `<video>` element with the camera stream.
3. **Scanning success:** Once a QR is decoded, show the result inline (either the government's verification page in an iframe or, for auto-submit URLs, a "Verified!" banner).
4. **Scanning failure:** If `getUserMedia` fails or no camera is detected, present the file-picker fallback without friction.
5. **Hybrid option:** For Pakistan, clearly label which button leads to which flow — "Scan QR" vs. "Enter apostille number manually."

---

## Recommended discovery tasks before implementation

1. **Obtain sample apostilles** from each of the 6 QR-only jurisdictions + Pakistan (hybrid). This is essential to understand QR encoding.
   - Contact embassies, notary services, or government sites directly.
   - Look for public examples on government websites (some post sample documents).

2. **Document QR encoding schemes** — for each jurisdiction, extract and analyze 2–3 QR samples:
   - Does it encode a full URL? If so, does it navigate directly to a result page or to a form?
   - Does it encode a code/token? If so, what format and what does the official site expect?
   - Are there any per-record parameters (date, sticker number, etc.) or is the QR self-contained?

3. **Verify camera API support** in the target user base:
   - Test on iOS Safari (historically the most restrictive).
   - Test on older Android browsers.
   - Establish minimum OS versions for full QR support; design graceful fallbacks for older devices.

4. **Test with real government sites:**
   - For authorities that publish sample apostilles with QR codes, scan them and follow the decoded URL to confirm it works.
   - Document any quirks (e.g., does the government's URL require a referrer, or expire after a time limit?).

---

## Related Phase 3 risks & mitigations

### Risk 1: QR code format variation per authority

**Problem:** Each government may encode QR differently (URL vs. token vs. mixed). Without sample apostilles, we can't build decode logic.

**Mitigation:** 
- Discovery phase (above) must include analyzing actual QR codes from each jurisdiction.
- Start Phase 3 implementation with URL-based decoding only (simplest case); add token-based decoding only for authorities where we've verified the encoding scheme.
- Fallback to "show the raw decoded text" for authorities we can't decode yet.

### Risk 2: Government changes QR encoding or URL structure

**Problem:** Like link rot in Phase 2, QR encoding can become stale or change. A government might migrate their verification endpoint.

**Mitigation:**
- Plan for ongoing monitoring (add to the `scripts/check-links.mjs` health-check mentioned in DEVELOPMENT_PLAN.md § Data foundation).
- Document the QR format per authority so changes are easy to spot.
- Version the decode mappings (similar to how we version the e-registers dataset).

### Risk 3: Camera permissions / privacy concerns

**Problem:** Some users won't grant camera permission; iOS in particular prompts noisily.

**Mitigation:**
- File-picker fallback for every camera-based flow (already planned above).
- Clear messaging: "We'll use your camera to scan the QR code — the image is never sent to our servers."
- Consider offering the option to upload an image instead of live-camera scanning on first-time setup.

---

## Success criteria for Phase 3

1. ✅ QR scanning works for all 6 QR-only + 1 hybrid authority without server-side API calls (purely client-side decode).
2. ✅ User can scan a physical apostille's QR code in under 3 seconds (from button tap to result displayed).
3. ✅ File-picker fallback works identically to live camera on desktop / older browsers.
4. ✅ Decoded QR result (whether URL or token) navigates to a verification result that does **not** come from our servers (user sees the government's own page or result).
5. ✅ App handles camera permission denial gracefully (offers file picker, doesn't crash).
6. ✅ All 7 authorities' QR flows are tested against real sample apostilles (not mocked QR codes).

---

## Appendix: Authorities removed from QR consideration

| Jurisdiction | Original status | Why removed from QR support |
|--------------|-----------------|-----|
| **Rwanda** | Initially QR-only per source data | Irembo file-status tracker is not an apostille e-register; actual QR-verification mechanism unknown without a sample apostille. Kept as QR-only in the dataset pending sample verification. |
| **Cyprus** | Offers "CAPTCHA or QR code" in form | But the form itself is also available and works fine via field-based lookup (Tier C); QR is a user convenience option the government offers, not a primary path. No dedicated QR-only endpoint found. |
| **Greece** | Offers "Number or QR code" as input alternatives | Both route to the same POST form; form-based lookup is primary and works (Tier C). No dedicated QR verification portal. |
| **Costa Rica** | QR noted in form but no separate endpoint | Form-based lookup works; QR appeared to be a planned feature mentioned in comments but not exposed in the UI. |

---

## References & further reading

- [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) — Phase 3 scope & timeline
- [APOSTILLE_FIELD_REQUIREMENTS.md](APOSTILLE_FIELD_REQUIREMENTS.md) — detailed per-authority research results
- `src/data/verification-fields.js` — per-authority configuration (will add QR decode mappings here in Phase 3)
- `src/data/e-registers.cleaned.json` — master dataset with `verificationMode: "qr_only"` and `"hybrid"` entries
