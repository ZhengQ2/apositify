# Phase 3: QR Code Support — Research & Implementation Guide

This document maps QR-code adoption across apostille-issuing authorities to prepare for Phase 3's scoped QR-scanning feature. It covers **which countries' apostilles actually carry a QR code**, what each QR code *does* when scanned, a critical fraud caveat, and the resulting implementation strategy.

> **This version is backed by targeted per-country research (July 2026).** Eleven parallel research passes hunted for *actual specimen apostilles* (government sample PDFs, HCCH country presentations/questionnaires, embassy specimens, real scanned documents) — not marketing claims — across ~70 authorities. Every row below is tagged with whether a real specimen was seen or only official text was read. An earlier draft equated "QR support" with our own `verificationMode: "qr_only"` tag (6 authorities); that was circular. QR is a property of the physical/electronic apostille, largely **orthogonal** to whether an e-Register exists — and the real footprint is several times larger.

## The finding that shapes the whole feature: a QR is not automatically a verification link

Scanning research found **four functionally different things** a QR on an apostille can encode. They are not interchangeable, and conflating them is a security risk:

| Fn | What scanning does | Verification value | Confirmed examples (specimen or official docs) |
|----|--------------------|--------------------|------------------------------------------------|
| **A** | Opens the authority's own e-Register page showing this apostille's STATUS | ✅ High — genuine one-tap verification, result from the government | China (Mainland), India, Philippines, Colombia, Chile, Guatemala, Brazil, Armenia, Ecuador, Greece* |
| **B** | Downloads/opens the apostille PDF — **not** a status check | ⚠️ Low, and dangerous — proves nothing | **Venezuela, Mexico (federal/SEGOB)** |
| **C** | Opens the portal but the user must still type a code/number (or the QR just encodes that code) | ➖ Medium — saves typing, still a manual check | UK, Japan (post-Jun-2026), Korea, Singapore, Hong Kong (typed ref code) |
| **D** | Cryptographically-signed QR verified **offline by a dedicated government app** (no URL) | ✅ High, but app-gated | **Luxembourg** (GouvCheck app) |

\* Greece's QR rides on the underlying gov.gr document (function A → `docs.gov.gr/validate`); the apostille *layer* itself is checked by a typed number.

**A recurring lesson across the research:** many systems marketed as "scan to verify" are really **function C** — the QR opens the portal, but you still type a reference/access code. True one-tap deep-link-to-status (A) is rarer than the marketing implies, and several "QR" mentions actually belong to the *underlying document*, not the apostille (Cyprus, Singapore, Australia, Argentina).

### ⚠️ QR codes are an active fraud vector — this is the liability line

Venezuelan consular guidance explicitly documents a fraud scheme: **forgers host a fake "verification page" image, encode its URL in a QR, and print it on a counterfeit apostille** so scanning "confirms" the fake. Because a QR is just opaque encoded text, **a QR that opens a convincing verification page proves nothing on its own.** Function-B cases (Venezuela, Mexico federal) are especially weak — the QR only fetches a PDF, which a forger controls entirely.

This maps onto the liability boundary in [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md): the app must never assert a verification result itself, and must never launder a fraudster's page as the government's.

**Binding design rule for Phase 3:** after decoding a QR to a URL, **validate the decoded host against the known-official domain for that authority** (table below) *before* treating it as verification. If the host doesn't match, do **not** auto-open it as "verification" — show the raw decoded content and warn that it does not match the official domain on file. The research below gives us the actual official hosts to seed that allowlist. This is the single most important safety feature of the phase.

---

## Country / authority QR status (research results)

**Confidence:** ✅ **Confirmed** = a real specimen or the issuing authority's own QR documentation was seen · 🟡 **Likely** = credible official description, no specimen · ❓ **Uncertain** = conflicting/thin evidence · ⬜ **No QR** = verification is a typed code / paper only, no scannable QR found.

### ✅ Confirmed QR present — function A (genuine verification deep-link)

These are the strongest Phase 3 candidates: a real specimen (or the government's own QR docs) shows a QR that deep-links to the authority's own status page.

| Country | Authority | Official host (allowlist seed) | Evidence |
|---|---|---|---|
| China — Mainland | MFA | `consular.mfa.gov.cn/VERIFY` | Specimen: QR top-left + apostille no. + sticker no. |
| India | MEA (eSanad) | `esanad.nic.in/eregister` | HCCH/MEA specimen; result screen shows "Status: Verified" |
| Philippines | DFA | `apostille.gov.ph` / `e-app1.apostille.gov.ph` | DFA specimen (QR on certificate face + serial/keycode) |
| Colombia | MFA (Cancillería) | `cancilleria.gov.co/apostilla` | Cancillería/HCCH specimen; QR shows base doc + apostille live |
| Chile | MINREL / Civil Registry | `consulta.apostilla.gob.cl` | **Loaded a live result page** ("APOSTILLE IS VALID") |
| Guatemala | MINEX | `apostilla.minex.gob.gt` | MINEX/HCCH specimen; QR top-right "Código de Verificación" |
| Brazil | CNJ | `cnj.jus.br` / `apostil.cnj.jus.br` | CNJ portal + notariado manual; QR + Código/CRC → status |
| Armenia | Ministry of Justice | `e-apostille.am` / `e-verify.am` | MoJ HCCH specimen; QR bottom-right + 16-char control no. |
| Ecuador | MREMH (Cancillería) | `serviciosciudadanos.cancilleria.gob.ec` | MREMH manual specimen (QR/2D + barcode). Fn A/C |
| Greece | Min. Digital Governance | `docs.gov.gr/validate` (source doc); `e-apostille.gov.gr` (apostille no.) | HCCH specimen. QR on source doc (A); apostille layer typed (C) |

### ⚠️ Confirmed QR present — function B (PDF download only; weak/dangerous)

| Country | Authority | Official host | Evidence / caveat |
|---|---|---|---|
| Venezuela | MPPRE | `consultalegalizacionve.mppre.gob.ve` | QR only downloads the PDF; **documented QR fraud scheme**. Verify by typing 3 fields |
| Mexico — Federal | SEGOB / DICOPPU | `dicoppu.segob.gob.mx` (gob.mx) | SEGOB's own docs: QR triggers a PDF download, no status screen |

### ✅ Confirmed present — function uncertain

| Country | Authority | Official host | Evidence |
|---|---|---|---|
| Dominican Republic | MIREX | `servicios.mirex.gob.do` | MIREX guide specimen (p.18) shows QR + "Código de verificación"; A-vs-C unresolved |
| France | Notariat | `apostille-index.notaires.fr` | e-apostille electronic-only since May 2025, "with a QR code"; likely A |
| Belgium | FPS Foreign Affairs | `legalweb.diplomatie.be` (LegalWeb) | Paper abolished 2018; e-apostille carries a QR; likely A/C |

### 🟡 Likely QR present (official description, no specimen seen) — function D noted

| Country | Authority | Official host / app | Likely fn | Note |
|---|---|---|---|---|
| **Luxembourg** | MFA | **GouvCheck app** (no URL) | **D** | Offline app-verified signed QR — *not* a browser deep-link. Needs distinct handling |
| Ukraine | Ministry of Justice | `apostille.minjust.gov.ua` | A | Civil-status apostilles carry QR (mandatory since Feb 2026) |
| Russian Federation | MoJ / Rosobrnadzor | MoJ registry / Rosobrnadzor | A | QR on the *electronic* apostille/extract (explains our `qr_only` tag) |
| Bahrain | MFA | not publicly confirmed | A | Own HCCH questionnaire: "Category 2 QR Technology for Verification" |
| Panama | Órgano Judicial / MIRE | `apostillaelectronica.mire.gob.pa` | A | Asserted by OJ & press; official *template* shows no QR box — treat `qr_only` as Likely |
| El Salvador | MFA | `apostilla.rree.gob.sv` | A/C | Government sources describe a QR; no specimen |
| Pakistan | MFA | `apostille.mofa.gov.pk` | A/C | QR sticker since 2019; verify page is manual no.+date (no on-page scan field) |
| Bangladesh | MFA | `mofa-servicedirectory.apostille.mygov.bd` | A | "Scan the QR to verify"; possibly PIN-gated. (Our data marks it upload-only — QR is additional) |
| Georgia | PSDA (MoJ) | `apostille.cra.ge` | A (+C) | QR + 14-digit code |
| Uzbekistan | MoJ | `apostille.gov.uz` / `davxizmat.uz` | A | Issued "with a QR code" since 2022 |
| Israel | Ministry of Justice | `eregister.justice.gov.il` | A | Digital-only apostille; HCCH e-APP notification |
| Morocco | Interior / Justice | `apostille.ma` | A/C | QR + file number emailed |
| Indonesia | Ministry of Law (AHU) | `apostille.ahu.go.id/verifikasi` | A | Consistent descriptions; only placeholder images seen |
| Portugal | Ministério Público / IRN | `apostila.ministeriopublico.pt` | A/C | 100% electronic apostila since 2025; "seal with a QR code" |
| United Kingdom | FCDO | `verifyapostille.service.gov.uk` | C | e-apostille PDF reportedly carries a QR; official verify is typed no.+date |
| Saudi Arabia | MOFA | `services.mofa.gov.sa` | A/C | Industry sources only (portal geo-blocked from test env) |
| China — Macao | DSAJ | `doc-check.rn.dsaj.gov.mo` | A/C | "QR code for verification"; portal JS-rendered, function unconfirmed |
| Mexico — Jalisco | Sec. Gral. de Gobierno | `verificacion.jalisco.gob.mx` | A | State QR described; no specimen |

### ⬜ No scannable QR on the apostille — typed-code / paper verification (do NOT build a QR path)

| Country | Authority | Verification method | Evidence |
|---|---|---|---|
| Spain | Ministry of Justice eRegister | Typed **CSV** + number + date (a text code, not a QR) | Confirmed (official trámite page) |
| Kazakhstan | Ministry of Justice | Typed application no. + security code (e-register). "QR" belongs to the eGov app's doc-sharing, not the apostille | **Corrected**: my earlier draft wrongly marked this Confirmed-A |
| Netherlands | District courts | Paper sticker + hologram; no e-apostille yet | Confirmed |
| Italy | Prefettura / Procura | Paper ink stamp; no e-register | Confirmed |
| Ireland | DFA | Typed number + date (online register) | Likely (no QR) |
| Denmark | MFA | Typed date + number (E-Register) | Confirmed (no QR) |
| Estonia | Chamber of Notaries | Register link + apostille number | No QR evidenced |
| Slovenia | District Courts | Online e-Register lookup | HCCH questionnaire: no QR |
| Latvia | Sworn Notaries | Typed number **or** upload signed `.asice` file | No confirmed QR |
| Cyprus | Ministry of Justice | Typed cert no. + district + year. (QR exists only on *underlying* civil certs) | Confirmed (no QR on apostille) |
| Canada | Global Affairs + provinces | Typed certificate no. + date | Confirmed (no QR) |
| UK — Cayman Islands | Deputy Governor's Office | Typed certificate no. + date (`gov.ky/verifyapostille`) | Confirmed (no QR) |
| Australia | DFAT | Typed details (paper apostille only; QR is on the underlying police cert) | Confirmed (no QR) |
| New Zealand | Dept. of Internal Affairs | Specimen prints a **text URL**, then type no. + date | Confirmed (no QR) |
| Türkiye | MFA (paper) / PTT (e) | Paper: no QR. e-apostille: file-upload/hash check (our existing `upload` model) | Likely |
| Hong Kong | Judiciary | Typed reference code; new e-apostille = signed PDF (signature trust) | No QR in official text |
| Tajikistan | MFA / MoJ | Typed apostille number | Likely no QR |
| Kosovo | MIA / Civil Reg. | Paper, wet signature + seal | Likely no QR |
| Uruguay | MRREE | Typed number + date + holder | No QR evidenced |
| Argentina | MFA | Typed CE-number (signed PDF, embedded original) | No QR on apostille confirmed |

### ❓ Genuinely uncertain (thin/blocked evidence — needs regional access or a sample)

Azerbaijan (sticker + hologram; no QR shown), Mongolia (e-Register since Sept 2025 but QR not stated), Bolivia (e-apostille exists; QR unconfirmed), Paraguay (verification field is likely a **1D barcode**, not a QR), Saint Kitts and Nevis (appears to be a traditional paper stamp), Peru (verification portal is official, but no specimen confirms a QR sits on the apostille itself), Saudi Arabia (see Likely — industry sources only). Several regional portals (Azerbaijan, Uzbekistan, Georgia, Türkiye, Saudi) were geo/SSL-blocked from a US-only test environment, so those rest on official text, not a rendered specimen.

---

## Headline counts (vs. the original "6+1" guess)

- **Confirmed QR on the apostille (specimen or official QR docs): ~15** — 10 function-A (China Mainland, India, Philippines, Colombia, Chile, Guatemala, Brazil, Armenia, Ecuador, Greece), 2 function-B (Venezuela, Mexico federal), 3 confirmed-present-but-function-uncertain (Dominican Republic, France, Belgium).
- **Likely QR (official description, no specimen): ~18** — including Luxembourg (function **D**, app-based), Ukraine, Russia, and much of the `qr_only`/hybrid set our data already had.
- **Confirmed NO QR (typed-code / paper): ~20** — a large group, including most of Europe's e-registers (Spain uses a typed CSV, not a QR) and the entire Anglosphere set (Canada, Cayman, Australia, New Zealand) plus Hong Kong.
- **Corrections to earlier drafts:** Kazakhstan downgraded (typed security code, not a QR); Cyprus's QR is on underlying certs, not the apostille; Luxembourg needs a fourth function type (offline app); Türkiye paper has no QR (e-apostille is upload/hash, matching our existing model).

**Takeaway:** QR is real and widespread, but concentrated in Latin America, South/Central Asia, and newer e-Apostille adopters — and a big slice of "e-apostille" countries (especially Europe + Anglosphere) verify by **typed code, not a scannable QR**. Phase 3 should target the Confirmed-A set first, treat B/D as special cases, and *not* build a QR path for the typed-code group.

---

## Recommended schema change

Add an independent field to each dataset row instead of overloading `verificationMode`:

```js
qrCode: {
  present: true,                     // true | false | 'unknown'
  function: 'deeplink',              // 'deeplink'(A) | 'pdf_download'(B) | 'token'(C) | 'app_offline'(D)
  officialHost: 'apostille.gov.ph',  // seeds the domain-validation allowlist
  confidence: 'confirmed'            // 'confirmed' | 'likely' | 'uncertain'
}
```

The `officialHost` values in the tables above are the starting allowlist for the domain-validation rule. This lets an `online` authority *also* advertise a QR path, and keeps the fraud guard data-driven.

---

## Implementation strategy for Phase 3

### Scope

**In:** client-side QR scanning (camera via `getUserMedia` + a file-picker fallback), decode, **domain-validate against the authority's `officialHost`**, then route by function. Applies to every `qrCode.present` authority — prioritizing the Confirmed-A set.

**Out (Phase 5, native app):** non-QR barcodes (Paraguay's 1D barcode, Code 128, PDF417, Aztec), OCR field extraction, photo capture of paper apostilles.

### Routing by function

- **A (deep-link), host matches official:** open it → user reads the government's own result. One-tap verification.
- **A, host does NOT match official:** ⚠️ stop. Show "This QR points to `X`, which is not `authority.officialHost` — do not trust it as verification." (the fraud guard).
- **B (PDF download — Venezuela, Mexico federal):** explicitly tell the user the QR only fetches the document and is **not** proof of authenticity; route them to the real e-Register form.
- **C (token / opens portal then type):** extract the code, pre-fill the Phase 2 field form, and send them to the official portal to complete it.
- **D (Luxembourg / GouvCheck):** don't try to open anything — instruct the user to verify with the government's own app. We can't and shouldn't replicate offline signature validation.
- Never parse, store, or assert the government's result ourselves (same rule as Phase 2).

### Technical notes

- **Decoder:** `jsQR` (client-only, lightweight). ZXing-JS only if we later pull barcode work forward.
- **Camera:** `getUserMedia` needs HTTPS (or localhost); request on user tap, fall back to file picker on denial.
- **Mobile:** modern iOS Safari (15+) / Android; desktop varies — file-picker fallback is mandatory.
- **Privacy:** decode entirely in-browser; the image never leaves the device — say so in the UI.

### Discovery work still needed (the real gate before coding a given authority)

1. **Obtain 2–3 real specimens** for the Likely rows before wiring their QR path — especially to confirm function (A vs C) and the exact `officialHost`. Priority: the `qr_only`/hybrid authorities our app already surfaces (Panama, El Salvador, Bahrain, Pakistan, Russia, Ukraine) and the high-traffic Likely-A set (Georgia, Uzbekistan, Israel, Indonesia, Portugal, France, Belgium).
2. **Decode the QRs we've only seen in low-res specimens** (Dominican Republic, Ecuador) to settle A-vs-C and capture the URL template.
3. **Re-check the geo-blocked portals** (Azerbaijan, Uzbekistan, Georgia, Türkiye, Saudi) from an in-region vantage or with real document images.
4. **Fold QR `officialHost` monitoring into** the planned `scripts/check-links.mjs` — QR endpoints rot exactly like e-Register links.

Until a given authority's sample is analyzed, the safe fallback is: decode, apply the domain check, show the raw content, and do **not** claim it's verification.

---

## Success criteria for Phase 3

1. ✅ QR scanning works client-side (no server round-trip) for every `qrCode.present` authority with a confirmed sample.
2. ✅ Decoded URLs are **domain-validated against the authority's `officialHost`**; non-matching hosts are refused as verification and flagged.
3. ✅ Functions B (PDF-only), C (token), and D (offline app) are each handled distinctly from A — the app never presents a PDF download, a mismatched page, or an unverifiable app-QR as "verified."
4. ✅ File-picker fallback is at parity with live camera; permission denial degrades gracefully.
5. ✅ The app never asserts a verification outcome itself (Phase 2 liability rule preserved).
6. ✅ Every supported authority's QR flow is tested against a real sample apostille, not a synthetic QR.

---

## Methodology & honesty notes

- Eleven regional research passes (July 2026), each instructed to find real specimens, not marketing, and to tag specimen-seen vs. text-only. Agents self-corrected several PDF-extraction hallucinations (phantom "QR" reads for Slovenia, Latvia, Mongolia were caught and removed) and one Portugal/Brazil source cross-contamination — so the negatives here are deliberate, not gaps.
- **Confidence is capped by evidence type:** "Confirmed" means a specimen or the authority's own QR documentation was actually viewed; "Likely" means credible official text without a specimen. Treat every row as "spot-check before trusting," especially before wiring a live QR path.
- Specimen artifacts captured during research (Colombia, Ecuador, India, Philippines, Dominican Republic, Panama template) are cached under the session `tool-results/` and `scratchpad/pdfimg/` directories if a follow-up needs to decode them.

## Sources (representative; per-country URLs captured in the research passes)

Official/primary: HCCH e-APP operational e-Registers list and country presentations/questionnaires (China, India, Philippines, Colombia, Ecuador, Guatemala, Armenia, Greece, New Zealand, Slovenia, Bahrain, Mongolia); government portals — `apostille.gov.ph`, `esanad.nic.in`, `consular.mfa.gov.cn`, `cancilleria.gov.co`, `consulta.apostilla.gob.cl`, `apostilla.minex.gob.gt`, `cnj.jus.br`, `e-apostille.am`, `servicios.mirex.gob.do`, `apostille.minjust.gov.ua`, `dicoppu.segob.gob.mx`, `consultalegalizacionve.mppre.gob.ve`, `sede.mjusticia.gob.es`, `legalweb.diplomatie.be`, `apostille-index.notaires.fr`, `verifyapostille.service.gov.uk`, `dia.govt.nz`, `apostille-gac.powerappsportals.com`, `gov.ky/verifyapostille`, plus the GouvCheck app (Luxembourg / CTIE).

Internal:
- [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) — Phase 3 scope & liability boundary
- [APOSTILLE_FIELD_REQUIREMENTS.md](APOSTILLE_FIELD_REQUIREMENTS.md) — per-authority field/deep-link research
- `src/data/e-registers.cleaned.json` · `src/data/verification-fields.js` — dataset (add the `qrCode` field)
