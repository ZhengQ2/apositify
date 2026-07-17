# Phase 3: QR Code Support — Research & Implementation Guide

This document maps QR-code adoption across apostille-issuing authorities to prepare for Phase 3's scoped QR-scanning feature. It covers **which countries' apostilles actually carry a QR code**, what each QR code *does* when scanned, a critical fraud caveat, and the resulting implementation strategy.

> **Correction to an earlier draft of this document.** A first pass equated "QR support" with the `verificationMode: "qr_only"` tag in our own dataset (6 authorities). That was circular and wrong. The `qr_only` tag means "the *only* verification path we found is QR" — it says nothing about the far larger set of authorities that print a QR code on the apostille **and also** run an online e-Register. QR is a property of the physical/electronic apostille, largely **orthogonal** to whether an e-Register exists. External research (below) shows QR codes are widespread — especially across Latin America, newer e-Apostille adopters, and South/Central Asia — including on apostilles from authorities we currently classify as `online` or even `upload`.

## The one finding that shapes the whole feature: not every QR is a verification link

Scanning research surfaced **three functionally different things** a QR code on an apostille can encode. They are not interchangeable, and treating them as such is a security risk:

| QR function | What scanning does | Verification value | Examples (by report) |
|---|---|---|---|
| **A. Deep-link to a verification result** | Opens the authority's own e-Register page showing this apostille's status | ✅ High — genuine one-tap verification, result comes from the government | Kazakhstan (MoJ registry), India eSanad (PDF-with-QR → e-Register), many e-Apostille systems |
| **B. Download the apostille PDF** | Fetches the apostille document itself — **not** a verification result | ⚠️ Low, and dangerous — proves nothing about authenticity | Venezuela (QR only downloads the PDF) |
| **C. Encode a code/token** | Yields a reference number the user must type into the official form | ➖ Medium — saves typing, still needs the e-Register | Some hybrid systems; Pakistan likely |

### ⚠️ QR codes are an active fraud vector — this is the liability line

Venezuelan consular-services guidance explicitly warns: **fraudsters generate a fake "verification page" image, encode it in a QR code, and print it on a forged apostille** so that scanning the QR "confirms" the fake. Because a QR code is just opaque encoded text, **a QR that opens a convincing-looking verification page proves nothing on its own** — the page could be attacker-controlled.

This maps directly onto the liability boundary in [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md): the app must never assert a verification result itself, and must never launder a fraudster's page as if it were the government's.

**Binding design rule for Phase 3:** after decoding a QR to a URL, **validate the decoded host against the known-official domain for that authority** (from our dataset) *before* treating it as verification. If the host doesn't match, do **not** auto-open it as "verification" — show the raw decoded content and warn the user it does not match the official domain on file. This turns our existing per-authority `registerUrl` data into a QR allowlist and is the single most important safety feature of this phase.

---

## Country / authority QR status

**Confidence legend:** ✅ **Confirmed** = specific, credible source describes a QR on that authority's apostille · 🟡 **Likely** = regional pattern or secondary source, needs a sample to confirm · ❓ **Needs sample** = plausible but unconfirmed · ➖ **No/queuing-only** = no verification QR found (or QR is for something else).

All confidence here is documentary — **none of these were confirmed against a physical apostille sample.** Obtaining samples (see Discovery tasks) is the gate before writing decode logic for any given authority. Treat this table as a research lead list, not ground truth.

### Already `qr_only` in our dataset (QR is the primary/only path)

| Country | Authority | QR function (expected) | Confidence |
|---|---|---|---|
| Bahrain | Ministry of Foreign Affairs | A (deep-link) | ❓ Needs sample |
| El Salvador | Ministry of Foreign Affairs | A (deep-link) | ❓ Needs sample |
| Luxembourg | Ministry of Foreign Affairs | A (deep-link) | ❓ Needs sample |
| Panama | Órgano Judicial | A (deep-link) | ❓ Needs sample |
| Russian Federation | Ministry of Justice | A (deep-link) | ❓ Needs sample |
| Rwanda | MFA & Int'l Cooperation | A or C — listed link was a generic file tracker | ❓ Needs sample |

### `hybrid` in our dataset (QR **and** online e-Register)

| Country | Authority | QR function (expected) | Confidence |
|---|---|---|---|
| Pakistan | Ministry of Foreign Affairs | C (token) → its own number-lookup form; MFA site lists "QR-Code Scan" as a method | ✅ Confirmed |

### Currently `online` / `upload` in our dataset — but the apostille carries a QR (the important, previously-missed set)

These are the authorities my first draft missed entirely. They have working online forms (so they're not `qr_only`), but their apostilles **also** carry a QR code that in most cases deep-links to the same e-Register.

| Country | Our current mode | QR evidence | QR function | Confidence |
|---|---|---|---|---|
| **Philippines** | online (fields) | DFA e-Apostille: verify by **scanning the QR on the cover sheet**, or link, or serial+keycode at `e-app1.apostille.gov.ph/eAppVerification` | A (deep-link) | ✅ Confirmed |
| **India** | online (fields, CAPTCHA) | MEA affixes a **QR-coded sticker with unique ID**; digital apostille is a PDF with QR → verify via eSanad e-Register | A (deep-link) | ✅ Confirmed |
| **Kazakhstan** | online (fields, CAPTCHA) | e-Apostille carries a QR that **directs to the MoJ registry** verification page | A (deep-link) | ✅ Confirmed |
| **Bangladesh** | upload | MFA guide: **scan the QR code** to verify it was authenticated by MoFA Bangladesh (in addition to the signed-PDF upload tool) | A (deep-link) | ✅ Confirmed |
| **Ukraine** | Education: deep-link GET; Justice: online | Since **Feb 2026**, apostilles on civil-status certificates are issued via the Unified electronic register and **must contain a QR code** | A (deep-link) | ✅ Confirmed |
| **Colombia** | online (fields) | Apostilles carry a QR; Cancillería runs a full online apostille + verification system | A (deep-link) | ✅ Confirmed |
| **Venezuela** | online (fields, CAPTCHA) | Apostilles carry a QR, **but it only downloads the PDF** — official guidance says verify via the site, not the QR; **known fraud vector** | **B (PDF only)** | ✅ Confirmed |
| **Ecuador** | online (fields, CAPTCHA) | Regional reporting: "all apostilles have QR codes" + number/code/date security elements | A (deep-link) | 🟡 Likely |
| **Peru** | online (fields, CAPTCHA) | Same regional reporting as Ecuador | A (deep-link) | 🟡 Likely |
| **Chile** | online (fields, CAPTCHA) | e-Apostille issued/stored electronically, verifiable online; e-Registers use QR to generate unique verification URLs | A (deep-link) | 🟡 Likely |
| **Uruguay** | online (fields) | Regional pattern (Southern Cone e-Apostille rollout) | A (deep-link) | ❓ Needs sample |
| **Dominican Republic** | online (fields) | Regional pattern; MFA runs an online verifier | A/C | ❓ Needs sample |

### United States — special case (mostly paper + e-Register, QR uncommon)

US practice is distinct and a good source of **false positives** to avoid:

- Most US states that appear in our dataset (California, Texas, New York, North Carolina, Arkansas, Delaware, Tennessee, West Virginia) issue **paper apostilles with an online e-Register**, *not* a QR printed on the document. Where a QR does appear on a US e-Apostille, it routes to the state's e-Register.
- **Texas "QR" is a trap:** the QR at the Texas SOS office is for **queuing at the walk-in desk**, not document verification. Do not model it as an apostille QR.
- The former e-Apostille pilots (Connecticut, Rhode Island, Utah — all ended Sept 2025) issued QR-coded e-Apostilles, but they no longer issue and their verification sites are gone/application-only (Tier D in our dataset).

**Takeaway:** for the US, default to the existing field-based / e-Register flow. Only add a QR path for a specific state once a real sample apostille with a verification QR is in hand.

### Authorities that mention QR only as a form alternative (not a separate scan path)

Greece and Cyprus expose "enter number **or** scan QR" *inside* their online forms; both route to the same POST verification. These stay Tier C (field-based) in Phase 2 — the QR is a convenience the government offers on its own page, not a separate endpoint we'd scan client-side. No action for Phase 3 unless a sample shows a distinct QR-only route.

---

## How big is the real footprint?

- **Confirmed QR on the apostille:** ~8 authorities beyond the `qr_only`/`hybrid` set (Philippines, India, Kazakhstan, Bangladesh, Ukraine, Colombia, Venezuela, + Pakistan), plus the 6 existing `qr_only`. That's already **~2–3× my original "6+1" estimate**, and it excludes the "likely" tier.
- **Likely / regional:** Ecuador, Peru, Chile, Uruguay, Dominican Republic and probably more of Latin America — the region has broadly rolled out QR-bearing e-Apostilles.
- **Direction of travel:** newer adopters (Ukraine's 2026 civil-status rollout is the clearest example) are making QR *mandatory*. The set will grow; the dataset needs a dedicated `hasQrCode` flag rather than inferring QR from `verificationMode`.

**Recommended schema change:** add an independent boolean/enum to each dataset row — e.g. `qrCode: { present: true, function: 'deeplink' | 'pdf_download' | 'token' | 'unknown', officialHost: 'apostille.gov.ph' }` — instead of overloading `verificationMode`. This lets an `online` authority also advertise a QR path, and gives the domain-validation rule (above) its allowlist source.

---

## Implementation strategy for Phase 3

### Scope

**In:** client-side QR scanning (camera via `getUserMedia`, plus a file-picker fallback for saved images), decode, **domain-validate against the authority's official host**, then either open the verified deep-link or show the decoded token/content for the user to use on the official site. Applies to every authority with `qrCode.present` — the `qr_only` set, the hybrid set, and the `online`-with-QR set above.

**Out (moved to Phase 5, native app):** non-QR barcodes (Code 128, PDF417, Aztec), OCR field extraction, photo capture of paper apostilles.

### User workflow

1. User selects the authority. If it has `qrCode.present`, offer **"Scan QR code"** (alongside "Open official e-Register" for hybrid/online authorities; as the primary action for `qr_only`).
2. Camera permission requested **on tap** (never on load). File-picker fallback always available.
3. Client-side decode (`jsQR`).
4. **Domain-validate** the decoded content:
   - **Function A (deep-link), host matches official:** open it directly → user reads the government's own result. One-tap verification.
   - **Function A, host does NOT match:** ⚠️ stop. Show "This QR points to `X`, which is not `authority.officialHost`. Do not trust it as verification." (fraud guard).
   - **Function B (PDF download, e.g. Venezuela):** explicitly tell the user the QR only fetches the document and is **not** proof of authenticity; route them to the real e-Register form instead.
   - **Function C (token):** extract and pre-fill the Phase 2 field form / show the value to paste.
5. Never parse, store, or assert the government's result ourselves (same rule as Phase 2).

### Technical notes

- **Decoder:** `jsQR` (client-only, lightweight). Alternative: ZXing-JS (heavier, more formats — only needed if we later pull some barcode work forward).
- **Camera:** `getUserMedia` requires HTTPS (or localhost). Request on user action; handle denial by falling back to the file picker without friction.
- **Mobile:** works on modern iOS Safari (15+) and Android; desktop varies — file-picker fallback is mandatory, not optional.
- **Privacy:** decode happens entirely in-browser; the image never leaves the device. Say so in the UI.

### Data / discovery work (the real gate)

1. **Obtain 2–3 sample apostilles** from each `qrCode.present` authority (embassies, notary/apostille services, or public sample documents governments post). This is required before writing decode logic — we cannot guess the encoding.
2. For each sample, record: is it function A/B/C? What host does a URL point to (→ populate `officialHost`)? Any per-record params or expiry/referrer requirements?
3. Populate the new `qrCode` schema field per authority; version it like the e-registers dataset.
4. Extend the planned `scripts/check-links.mjs` health-check to also flag when a known QR `officialHost` stops resolving or changes — QR endpoints rot exactly like e-Register links do.

Until a given authority's sample is analyzed, the safe fallback is: decode, show the raw text, and (if it's a URL) apply the domain check but do **not** claim it's verification.

---

## Success criteria for Phase 3

1. ✅ QR scanning works client-side (no server round-trip) for every `qrCode.present` authority with a confirmed sample.
2. ✅ Decoded URLs are **domain-validated against the authority's official host**; non-matching hosts are refused as verification and flagged to the user.
3. ✅ Function B (PDF-only, Venezuela-style) and function C (token) QRs are handled distinctly from function A — the app never presents a PDF download or a mismatched page as "verified."
4. ✅ File-picker fallback is at parity with live camera; camera-permission denial degrades gracefully.
5. ✅ The app never asserts a verification outcome itself (Phase 2 liability rule preserved).
6. ✅ Every supported authority's QR flow is tested against a real sample apostille, not a synthetic QR.

---

## Open questions / risks

- **Encoding varies per authority** — no single standard. Mitigation: sample-driven, per-authority decode config; URL-deep-link (function A) first, tokens later.
- **QR fraud** (documented for Venezuela; structurally possible anywhere) — Mitigation: the domain-validation rule is non-negotiable and is the core safety mechanism of this phase.
- **Endpoint/host rot** — Mitigation: fold QR `officialHost` monitoring into the link-health script.
- **Regional "likely" rows unconfirmed** — Mitigation: don't ship a QR path for a "likely"/"needs sample" authority until a sample confirms function and host.
- **Scope creep to OCR/barcodes** — Mitigation: keep those in Phase 5 per [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md); Phase 3 is QR-only.

---

## Sources

External research (July 2026):
- [IUCA — Is a QR Code Mandatory for an Apostille?](https://iuca.org/is-qr-code-mandatory-for-an-apostille/)
- [Apostille.ong — The Non-Mandatory Nature of QR Codes on Apostilles](https://apostille.ong/debunking-the-myth-the-non-mandatory-nature-of-qr-codes-on-apostilles/)
- [Philippines DFA — e-Apostille (verify via QR on cover sheet)](https://www.apostille.gov.ph/e-apostille/) · [DFA e-App verification portal](https://e-app1.apostille.gov.ph/eAppVerification)
- [India MEA eSanad](https://esanad.nic.in/) · [eSanad on National Government Services Portal](https://services.india.gov.in/service/detail/e-register-esanad-1)
- [Bangladesh MoFA — e-Apostille Verification Guide (scan QR)](https://mofa-servicedirectory.apostille.mygov.bd/how-to-verify)
- [Pakistan MoFA apostille portal (QR-Code Scan method)](https://apostille.mofa.gov.pk/)
- [Ukraine 2026 — QR-code apostille on civil-status certificates](https://prikhodko.com.ua/en/media/media/article/affixing-an-apostille-with-a-qr-code-to-a-civil-registration-certificate-new-procedure-for-2026/)
- [Serviapostilla — Venezuela QR only downloads the PDF; QR fraud warning](https://serviapostillainternacional.wordpress.com/2021/08/08/apostillas-con-codigo-qr-son-validas/)
- [Colombia Cancillería — Verificación de Apostilla](https://tramites.cancilleria.gov.co/apostillalegalizacion/consulta/documento.aspx)
- [ezApostille — e-Apostille in the USA (states with e-Registers)](https://www.ezapostille.com/what-is-e-apostille-in-the-usa-states-that-provide-digital-apostille-services/)
- [Global Document Solutions — e-Apostille Registry by Country](https://www.globaldocumentsolutions.com/e-apostille-registry-by-country/)
- [Apostille London — Countries Accepting the e-Apostille in 2026](https://apostillelondon.com/blog/countries-accepting-the-e-apostille/)

Internal:
- [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) — Phase 3 scope & liability boundary
- [APOSTILLE_FIELD_REQUIREMENTS.md](APOSTILLE_FIELD_REQUIREMENTS.md) — per-authority field/deep-link research
- `src/data/e-registers.cleaned.json` · `src/data/verification-fields.js` — dataset (needs the new `qrCode` field)
