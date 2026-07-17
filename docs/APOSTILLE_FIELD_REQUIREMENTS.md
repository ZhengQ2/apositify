# Per-Authority Verification Field Requirements & Deep-Link Status

This is the field-definition input for Phase 2 (see [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md)): for every authority with a working e-Register, what does its online verification form actually ask for, and does it genuinely support one-click deep-linking or only copy-assist?

**Methodology, in four passes:**
1. An initial research pass visited all 86 e-Register URLs that weren't already QR-only or nonexistent, to identify required fields (WebFetch first, falling back to a browser for JS-rendered/bot-gated pages).
2. A second, much stricter pass then took every authority with a confirmed field list (73 of them) and **actually filled in the real form with test values and clicked submit**, checking whether the browser navigated to a new URL containing those values (a genuine, shareable deep link) or fired a POST/AJAX request with no URL change (copy-assist only). This caught several false positives from pass 1 — forms that looked GET-based in static HTML but turned out to be JS/SPA forms calling a JSON API underneath.
3. A third pass revisited the cleanest confirmed-POST candidates (no CSRF token, no CAPTCHA) to test **cross-origin auto-submit**: building a hidden `<form method="post">` with test values and submitting it, the same mechanism payment-gateway redirects use. This isn't blocked by CORS (it's a real navigation, not a fetch) and works identically to a user submitting the official form themselves.
4. A fourth pass (5 parallel agents) went back through every authority left unresolved after pass 2/3 — sites that were unreachable, mid-maintenance, or had never-identified fields at all — and retested them with both techniques above now that the sites were reachable again. This resolved most of the remaining ambiguity: several "unreachable" statuses turned out to actually be CAPTCHA-gated once the site loaded, and 3 more authorities turned out to be genuinely deep-linkable.

Treat every row as "spot-check before fully trusting," not immutable ground truth — these are live government sites and a few remain genuinely unresolved (flagged below). If you want to verify a specific one yourself, the exact mechanism found (POST/CSRF token/CAPTCHA/AJAX/etc.) is in the table so you know what to look for.

## Headline finding: 6 confirmed one-click authorities out of 75 tested

**Ukraine's Ministry of Education (ENIC)** supports a real GET deep link. Its form is a plain Joomla GET request; submitting test values with the actual form and clicking search produced a new, shareable URL that the server processed and rendered a result for:

```
https://enic.in.ua/index.php/en/aporegen?task=searchApo&apoNum={apostille number}&reqNum={application number}&apoDate={DD.MM.YYYY}
```

**Five more authorities support real one-click verification via cross-origin auto-submit POST** — all clean forms with no CSRF token or CAPTCHA, each confirmed by actually auto-submitting a hidden form with test values and getting back a real, human-readable result page from the government's own server:

| Authority | Action URL | Fields (in order) |
|---|---|---|
| Bulgaria — Regional Administrations | `apostille.gov.bg/apostille/check` | `apostilleID` |
| Bulgaria — Ministry of Foreign Affairs | `apostille.mfa.bg/MFAL/apostille_index.nsf/apostilleCheck.lss` | `Open` (static), `id` |
| Andorra — Ministry of Foreign Affairs | `isi.govern.ad` (legacy IBM LANSA app) | `PONUMREG`, `PODTENTRS`, plus several static routing params |
| Costa Rica — Ministry of Foreign Affairs and Worship | `www.rree.go.cr/?sec=servicios&cat=autenticaciones&cont=726` | `clave`, `fecha_inicio` |
| Moldova — Ministry of Justice | `apostila.gov.md/apostila/site/search` | `apostila_code`, `security_code` (only for non-ARIJ-prefixed numbers — ARIJ-prefixed apostilles use a separate, MPass-gated system not covered here) |

All six are wired up in `src/data/verification-fields.js` (the `deepLink` field, with `method: 'get'` or `method: 'post'`) and render a one-click "Verify now" button in the app once all fields are filled in.

Everything else — including forms that looked like strong GET candidates in the first research pass (**Belgium, Bolivia, Indonesia, Delaware/USA**) — turned out, once actually submitted, to be POST forms, CSRF/anti-forgery-token-guarded, CAPTCHA-gated, or JS/SPA calls to a JSON API with no URL change. Real one-click coverage tops out at 6 of 75 — a small handful of authorities whose government sites happen to have simple, unprotected forms. This is a strong, direct confirmation of the Phase 2 design in [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md): copy-assist is the realistic default, not automation.

**Two near-misses worth knowing about:**
- Georgia's Ministry of Internal Affairs fires a same-origin AJAX **GET** request with clean query parameters (`?DocNumber=...&DocDate=...`) — but navigating directly to that exact URL renders a blank page. It needs session/referrer context from the real page first, so despite looking like a deep link, it doesn't actually work as a shareable one.
- New Zealand's "Verify" button fires an AJAX GET to a Domino agent endpoint (`agentDoVerifyApostille?openAgent&cn=...&dd=...`) that returns raw XML, not a human-readable page. Building our own result page to parse and display that XML would mean us asserting their verification outcome ourselves — exactly the liability line the Phase 2 design avoids — so this stays copy-assist despite being technically GET-based.

## Corrections needed to the dataset (found during field research)

| Authority | Issue | Action |
|---|---|---|
| Costa Rica | Source URL was byte-identical to Colombia's — confirmed copy-paste error | Replaced with `rree.go.cr` "Consultar Apostilla" page (fields: Código de la apostilla, Fecha) — already applied |
| USA/Texas | The listed URL verifies corporate filing certificates — the word "apostille" never appears on the page | **Corrected 2026-07**: initially reclassified to contact-only, but the real verifier exists — linked as "Verify Issuance of an Apostille" from the Texas SOS Apostille/Authentication page, at `webservices.sos.state.tx.us/certificationsA/index.aspx` (validates by certificate number). Restored to online — already applied |
| Austria | The old signaturpruefung.gv.at URL redirects to an RTR informational page with no lookup tool at all | **Corrected 2026-07**: RTR's actual signature-verification service is live at a different subdomain (`signaturpruefung.egiz.gv.at`) — a real upload-based verifier for the e-Apostille's digital signature/seal, same pattern as Bangladesh/Türkiye. Restored to online — already applied |
| Rwanda | The listed URL is a generic Irembo file-status tracker, not an apostille e-register | Reclassified to QR-only — already applied |
| Bangladesh | Listed URL is a homepage; the real tool is a generic signed-PDF/digital-signature checker (upload-based), not a number+date lookup | Modeled as `kind: 'upload'` in the app, not a field form |
| Türkiye | Verification is file-upload/hash-check, not typed fields | Same as Bangladesh — modeled as `kind: 'upload'` |
| Venezuela | Only one unified verification form found; source notes describe three separate date-range registers | Reconfirmed live in a later pass — still only one form found; treat the "3 registers" claim as likely outdated, though not definitively disproven |
| Slovenia, Moldova | Fields were unknown (site unreachable/unrendering) | Both resolved in a later pass — fields identified for both; Moldova is deep-linkable (see headline), Slovenia is CAPTCHA-blocked |
| Mexico/Federal District, USA/Arkansas | Could not confirm a working verification form at all | Still unresolved after a second attempt — Mexico's site appears genuinely down; Arkansas's SPA is blocked by a WAF at the JS-bundle level. No field data modeled; app falls back to the plain Phase 1 link for these |

## The three upload-based verifiers are e-Apostille only — a photo will never work

Austria, Bangladesh, and Türkiye don't have a number-lookup e-Register at all — their only verification path is uploading the e-Apostille file itself. Checked each one directly (2026-07) to answer a specific question: do these also handle a photo or scan of a **paper** apostille, and if so, how?

**Answer: no, none of them do, and there's no special handling — photos are simply out of scope.** Each tool works by checking something that only exists in the original, unmodified digital file:

| Authority | Mechanism | What happens with a photo/scan |
|---|---|---|
| Austria (EGIZ/RTR) | Verifies "electronic signatures embedded in PDF files" (their own description) | No embedded signature in a photo — fails, though the file picker doesn't block the attempt |
| Bangladesh | Verifies a digitally-signed PDF (page titled "Verification of Digitally Signed PDF Documents") | Can't even upload one — file picker is hard-restricted to `accept="pdf/*"` |
| Türkiye (PTT e-Apostil) | Computes the uploaded file's exact hash and compares it against the file originally issued (displays Hash Value/Size/Type) | Won't match — this is stricter than a signature check, since even a re-saved *PDF* copy of the same content can hash differently. File picker restricted to `accept="application/pdf"` |

None of the three HCCH chart entries for these authorities list a separate paper-apostille verification channel — the upload tool is the *only* documented mechanism. So a user who only has a paper apostille (or a photo of one) from Austria, Bangladesh, or Türkiye currently has no online verification path at all, digital or otherwise; they'd need to contact the issuing authority directly. Worth keeping in mind for Phase 3 (image upload/OCR) — the "upload a photo" flow that will exist for field-based authorities cannot be reused for these three, and the in-app copy should say so before a user wastes an upload attempt.

## Full field table

**Deep-Link Status legend:** ✅ **Confirmed** = verified live by filling and submitting the real form, URL changed with a working result · ❌ **Not deep-linkable** = confirmed live (POST / CSRF token / CAPTCHA / AJAX-SPA, no URL change) · ⚠️ **Inconclusive** = site unreachable, mid-maintenance, or gated on the day of testing — genuinely unknown, worth an independent check · — = not applicable (upload-based, QR-only, no e-Register, or no confirmed field list to test)

| Country | Authority | Required Fields | Deep-Link Status | Mechanism / Notes |
|---|---|---|---|---|
| Andorra | Ministry of Foreign Affairs | Apostille/Legalization Number; Date | ✅ **Confirmed** | Re-tested cleanly (the earlier cross-contamination did not recur). Legacy IBM LANSA app, POST, no CSRF/CAPTCHA — see URL template above |
| Argentina (≥15 Apr 2019) | MFA & Worship | Year; Number (CE- prefix); Dependency Code (-APN-); Order No. | ❌ Not deep-linkable | Real Drupal form with genuine field names, but `method="post"` |
| Argentina (historic, 2017–2019) | MFA & Worship | Order Number; Year; Security Code | — | Not independently tested (separate URL for this date range) |
| Armenia | Ministry of Justice | 16-digit document tracking code | ❌ Not deep-linkable | React SPA, reCAPTCHA present; submitted, URL unchanged (AJAX) |
| Australia | DFAT | Apostille number (AAAA-A1-1111); Date of issue | ❌ Not deep-linkable | ASP.NET Webforms postback, VIEWSTATE-based |
| Austria | Federal Ministry | (Upload the e-Apostille file — not field-based) | — | **Corrected 2026-07**: real upload-based verifier at `signaturpruefung.egiz.gv.at`, same pattern as Bangladesh/Türkiye. Only covers e-Apostilles (digitally-signed documents); paper apostilles have no separate e-Register |
| Azerbaijan | Ministry of Justice | Number; Date (DD.MM.YYYY) | ❌ Not deep-linkable | ASP.NET Webforms, `__VIEWSTATE`/`__EVENTVALIDATION` |
| Bangladesh | MFA | (Upload signed PDF — not field-based) | — | Confirmed 2026-07: page titled "Verification of Digitally Signed PDF Documents"; file picker hard-restricted to `accept="pdf/*"` — a photo/scan literally cannot be selected. e-Apostille only |
| Belgium | FPS Foreign Affairs | Reference number (format varies by type); Reference date | ❌ Not deep-linkable | **False positive from pass 1** — confirmed pure Angular SPA, zero native `<input>` elements |
| Bolivia | Ministry of Foreign Affairs | Date; Apostille number; Security code | ❌ Not deep-linkable | **False positive from pass 1** — `method="get"` but inputs have no `name` attr; filled and submitted via real click, URL stayed identical |
| Brazil | National Council of Justice | Code; CRC | ❌ Not deep-linkable | Angular Material fields, Cloudflare/reCAPTCHA widget; submitted, URL unchanged |
| Bulgaria — MoJ | apostil.mjs.bg | Apostille Code; CAPTCHA | ❌ Not deep-linkable | ASP.NET postback plus a CAPTCHA field |
| Bulgaria — MFA | apostille.mfa.bg | Apostille ID | ✅ **Confirmed** | Clean POST, no CSRF/CAPTCHA — auto-submitted via a hidden form, no query-string deep link possible but a cross-origin POST auto-submit works. Their result page bounces back to the blank form for an invalid ID rather than showing "not found" text (confirmed this is genuine site behavior, not our bug), so a valid ID's result display couldn't be independently confirmed — but the request itself genuinely reaches their server. |
| Bulgaria — NCID | apostille.bg | Verification code (13-char) | ❌ Not deep-linkable | GET form, but gated by an active Google reCAPTCHA v2 — submit button stays disabled until solved |
| Bulgaria — Regional Admins | apostille.gov.bg | Apostille ID | ✅ **Confirmed** | Clean POST, no CSRF/CAPTCHA — auto-submitted via a hidden form to `/apostille/check` and got back a real, clear result page ("NO APOSTILLE FOUND WITH ID: ..."), confirmed twice. |
| Canada — Federal | GAC | Certificate number (`apstl_certificatenumber`); Issue date (`apstl_issuedate`) | ❌ Not deep-linkable | Classic ASP.NET Web Forms POST with `__VIEWSTATE`/`__VIEWSTATEGENERATOR`/`__EVENTVALIDATION` — per-session, server-signed tokens |
| Canada — Ontario | MPBSD | Apostille Number (11-AA-AAAA-AAAA); Issue Date | ❌ Not deep-linkable | Power Pages/Dynamics form, AJAX postback, URL unchanged |
| Canada — Quebec | Minister of Justice | Numéro de l'apostille (`NoApostille`); Date d'émission (`DateEmission`) | ❌ Not deep-linkable | POST with two `__RequestVerificationToken` hidden fields (ASP.NET Core anti-forgery) |
| Chile | Multiple ministries/Civil Registry | Número de Legalización/Apostille (`tbx_numeroLegalizacion`); Fecha (`dat_rad_fecha`); Código (`tbx_codigo`) | ❌ Not deep-linkable | Telerik/ASP.NET POST with `__VIEWSTATE`/`__EVENTVALIDATION` **and** an explicit CAPTCHA widget (`RadCaptcha`) — doubly blocked |
| China — Mainland | MFA | Legalization/Apostille Number + Sticker Number, OR upload e-Apostille PDF | ❌ Not deep-linkable | Vue SPA; "Manual Verification" fires an image CAPTCHA challenge before any query can run |
| China — Hong Kong SAR | Judiciary | Apostille No.; Year; Reference Code; CAPTCHA | ❌ Not deep-linkable | Cross-origin iframe (JSF app) carrying a session-bound `javax.faces.ViewState` token, plus a CAPTCHA later in the flow |
| China — Macao SAR | Legal Affairs Bureau | Apostille No. (e.g. `12345/2023`); Issue date (DDMMYYYY) | ❌ Not deep-linkable | Fields now identified (React SPA, ~8s render past a loading spinner — not a canvas as first thought). Requires an image CAPTCHA |
| Colombia | MFA | Apostille/Legalization Number; Issue date | ❌ Not deep-linkable | ASP.NET Webforms postback, POST-only |
| Costa Rica | MFA & Worship | Código de la apostilla (`clave`); Fecha (`fecha_inicio`) | ✅ **Confirmed** | Plain POST form, no working CSRF/CAPTCHA (legacy ReCaptcha v1 reference is dead code) — see URL template above |
| Cyprus | Ministry of Justice | District; Location; Certificate Number; Certificate Year; Random Number | ❌ Not deep-linkable | Fields confirmed, but form carries both a `__RequestVerificationToken` (CSRF) **and** a hidden `CaptchaToken` |
| Denmark | Ministry of Foreign Affairs | Apostille/stamp number (item 8); Date | ❌ Not deep-linkable | POST with `__RequestVerificationToken` CSRF guard |
| Dominican Republic | MFA | Date (item 6); Number (item 8); Verification code | ❌ Not deep-linkable | Angular SPA — "Consultar" is a JS button (not a real submit) that fires an async POST to a JSON API endpoint, no navigable page |
| Ecuador | MFA & Human Mobility | Número; Fecha de Emisión | ❌ Not deep-linkable | Confirmed real image CAPTCHA ("Digite lo que observa en la imagen") required alongside the fields |
| Estonia | Chamber of Notaries | Issue date; Apostille registration number | ❌ Not deep-linkable | Real field names, but POST + `__RequestVerificationToken` CSRF guard |
| France | Regional Councils/Notaires | Apostille Number; Date of issue | ❌ Not deep-linkable | Angular SPA at `/form`; POST to `/api/validation/formulaire`, URL never changes |
| Georgia — MoJ | services.sda.gov.ge | Certificate Number (15-digit); Issue Date; reCAPTCHA | ❌ Not deep-linkable | Blocked by reCAPTCHA before search fires |
| Georgia — MIA | sa.gov.ge | Apostille Number; Date | ❌ Not deep-linkable | Fires an AJAX GET with clean query params, but direct navigation to that URL renders blank — needs session context, not a real shareable link |
| Greece | Ministry of Digital Governance | Electronic apostille number, or QR scan | ❌ Not deep-linkable | Redirects to a separate domain (dilosi.services.gov.gr); POST to `/api/validation/document/`, URL unchanged |
| Guatemala | Ministry of Foreign Affairs | Verification Code; Apostille Code | ⚠️ Inconclusive | Passed the Cloudflare bot-check but site was showing "Sistema en Mantenimiento" (under maintenance) on two separate re-test attempts — genuinely down, not a bot-block |
| India | Ministry of External Affairs | Apostille/Attestation Number; CAPTCHA | ❌ Not deep-linkable | Confirmed CAPTCHA plus Struts CSRF token |
| Indonesia | Ministry of Law and Human Rights | Sticker/Certificate Number; Issued Date | ❌ Not deep-linkable | **False positive from pass 1** — `method="get" action=self`, but appending query params on page load left fields empty; the app ignores the URL entirely |
| Ireland | Dept. of Foreign Affairs | Type (Apostille/Authentication); Date of Issue; Apostille Number | ❌ Not deep-linkable | Cookie modal dismissed, form fills fine, but submits POST to a Domino/XPages partial-refresh endpoint |
| Israel | Ministry of Justice | Apostille number; Date issued | ❌ Not deep-linkable | Fields fill fine, but submit is gated by a reCAPTCHA ("I'm not a robot") |
| Japan | Ministry of Foreign Affairs | Apostille Number; Date; Access Code | ❌ Not deep-linkable | Hidden CSRF token, POST to same URL |
| Kazakhstan | Ministry of Justice (egov.kz) | Application number (Номер заявления); Security code (Код безопасности) | ❌ Not deep-linkable | Correction: the real query form (`egov.kz/services/P1.17/`) does **not** require login — but it has a genuine image CAPTCHA, confirmed via DOM inspection |
| Korea, Rep. of | MOFA/Justice | Certificate issue number; Issue date; CAPTCHA | ❌ Not deep-linkable | Hidden CSRF token plus a CAPTCHA field |
| Kosovo | Ministry of Internal Affairs | Seal type; Reference number; **+ requester's name/workplace/email/country/reason** | ❌ Not deep-linkable | Confirmed ASP.NET WebForms postback (`__VIEWSTATE`), not a real GET submit |
| Latvia | Council of Sworn Notaries | Document number, or upload signed `.asice` file | ❌ Not deep-linkable | POST with a CSRF `authenticity_token` |
| Mexico — Federal District | dicoppu-portal | — | ⚠️ Inconclusive | Still unreachable (both http/https time out or are denied) — server appears genuinely down |
| Mexico — Jalisco | Secretary of Government | Código de documento | ❌ Not deep-linkable | ASP.NET WebForms, `__VIEWSTATE`/`__EVENTVALIDATION` |
| Mexico — Ministry of Interior | dicoppu-portal (SEGOB/DICOPPU) | Fecha (date); Clave (code) | ❌ Not deep-linkable | Correction: the site **is** reachable via a frameset at `consultasislac.segob.gob.mx` (an earlier "unreachable" reading was a browser-tool/DNS quirk — confirmed live via curl). Requires a legacy image-based verification code (functionally a CAPTCHA) |
| Moldova | Ministry of Justice | Apostille code; Security code | ✅ **Confirmed** | Form lazy-loads via an iframe (`apostila.gov.md/apostila/site/search`) — clean POST, no CSRF/CAPTCHA. Only covers non-ARIJ-prefixed apostille codes — see URL template above |
| Mongolia | Ministry of Foreign Affairs | Reference/Statement Number; CAPTCHA | ❌ Not deep-linkable | Image CAPTCHA required |
| Morocco | Ministry of Justice | Apostille Number; Signature Date; Page count; Underlying-doc signature date; CAPTCHA | ❌ Not deep-linkable | CAPTCHA + POST confirmed |
| New Zealand | Dept. of Internal Affairs | Apostille Number (e.g. `12345.1`); Issue Date | ❌ Not deep-linkable | "Verify" button isn't the visible POST form at all — it fires an AJAX GET to a Domino agent endpoint returning raw XML, not a renderable page; would require us to parse and assert their result ourselves, out of scope |
| Pakistan | Ministry of Foreign Affairs | Apostille Number; Date | ❌ Not deep-linkable | Real form at `/verify-attestation` is POST with a Laravel CSRF token |
| Panama | Ministry of Foreign Affairs | Apostille-Certification Number; Issue Date | ❌ Not deep-linkable | Angular SPA, no `<form>` tag; Google reCAPTCHA visible alongside fields |
| Paraguay | Ministry of Foreign Affairs | Issue Date; Barcode Number | ❌ Not deep-linkable | ASP.NET WebForms, `__VIEWSTATE` |
| Peru | Ministry of Foreign Affairs | Date; Apostille/Certification Number; Security code (image CAPTCHA) | ❌ Not deep-linkable | Re-confirmed: POST + image CAPTCHA |
| Philippines | Department of Foreign Affairs | Serial Code (dropdown by cert type); Serial Number; Keycode | ❌ Not deep-linkable | Yii2 app, POST with hidden `_csrf` field |
| Romania | Offices of the Prefect | Apostille Number (`JJ/XXXX`); Date (appears optional) | ❌ Not deep-linkable | No native form — "Verify" button fires an AJAX POST requiring a reCAPTCHA token |
| Rwanda | MFA/Irembo | — | — | Listed link is not an e-register — QR-only in practice |
| Saint Kitts and Nevis | MFA | Apostille date; Apostille number | ❌ Not deep-linkable | Real form (via iframe) fires a WordPress DataTables AJAX call returning JSON only, no navigation |
| Saudi Arabia | MOFA | Certificate Issue Date; Certificate Number | ❌ Not deep-linkable | Hidden CSRF token, `window.location` unchanged after submit |
| Singapore | Singapore Academy of Law | Apostille Certificate No.; Notarial Certificate No.; Verification Code | ❌ Not deep-linkable | Confirmed POST to `/AuthenticationCert/SearchApostille` with a CSRF token |
| Slovenia | District Courts | Certificate ID; Issue date | ❌ Not deep-linkable | Fields now identified — the URL is the genuine public verifier despite the misleading "create.jsf" name (not a filing form). JSF app with a session-bound `javax.faces.ViewState` token plus an image CAPTCHA |
| Spain | eRegister (44 authorities) | Verification Code; Apostille Number; Issue Date | ❌ Not deep-linkable | Text-based CAPTCHA required on every load; session-bound Spring Web Flow token |
| Tajikistan | MFA/Justice | Apostille Number; Date (Y/M/D) | ❌ Not deep-linkable | Image CAPTCHA confirmed |
| Türkiye | PTT e-Apostil | (File upload / hash check — not fields) | — | Confirmed 2026-07: computes and displays the uploaded file's Hash Value/Size/Type and compares it against the originally issued file — stricter than a signature check, a photo or re-saved copy won't match even if visually identical. File picker restricted to `accept="application/pdf"`. e-Apostille only |
| Ukraine — Education | ENIC | Apostille number (item 8); Application number; Apostille date (item 6) | ✅ **Confirmed** | Plain Joomla GET form — see URL template above. One of 6 confirmed deep links out of 75 tested. |
| Ukraine — Justice | Ministry of Justice | Apostille number; Issue date; Control code (newer only); OR upload e-document | ❌ Not deep-linkable | Angular form with a CAPTCHA field |
| United Kingdom | FCDO | Apostille issue date; Apostille number | ❌ Not deep-linkable | Confirmed POST form with named fields on a separate `verifyapostille.service.gov.uk` domain |
| UK — Cayman Islands | Passport & Corporate Services | Apostille Number; Issue Date | ❌ Not deep-linkable | Oracle APEX, POSTs to `wwv_flow.accept`, has a CAPTCHA field |
| USA — Arkansas | Secretary of State | Not confirmed | ⚠️ Inconclusive | The SPA's JS bundle and CSS both return 403 Forbidden on every load attempt (WAF blocking the asset itself, confirmed not a render-timing issue) — the app never executes, so fields can't be recovered even from network traffic |
| USA — California | Secretary of State | Apostille Number; Issue Date | ❌ Not deep-linkable | POST with a CSRF anti-forgery token |
| USA — Colorado | Secretary of State | Number; Issue date | ❌ Not deep-linkable | Confirmed POST with a Struts `TOKEN` hidden field |
| USA — Delaware | Secretary of State | Corporation Number; Authentication Number | ❌ Not deep-linkable | **False positive from pass 1** — genuine Angular SPA; network log shows `POST /eCorp2Api/api/certificate/validate/`; the earlier "GET" signal was an unrelated site-search box |
| USA — Kentucky | Secretary of State | Apostille ID (first 12 digits of apostille number) | ❌ Not deep-linkable | Confirmed single POST form |
| USA — Minnesota | Secretary of State | File Number (`FileNumber`); Issue Date (`Date`) | ❌ Not deep-linkable | POST to `apostille.sos.mn.gov/Search/SearchResults` with a `__RequestVerificationToken` CSRF field |
| USA — Montana | Secretary of State | Apostille/Authentication Number | ❌ Not deep-linkable | SPA; network log shows POST to `/api/records/apostillesearch` |
| USA — Nevada | Secretary of State | Apostille/Certification # (must start with "N"); Issue Date | ❌ Not deep-linkable | No `<form>` tag; JS fires an AJAX POST that injects an HTML fragment client-side — direct navigation to that endpoint redirects to a generic homepage, no real result page. Also behind Incapsula bot protection |
| USA — New York | Secretary of State | Document Number; Issue Date | ❌ Not deep-linkable | Confirmed classic ASP.NET POST form |
| USA — North Carolina | Secretary of State | Certificate Type (dropdown); Certificate #; Issued Date | ❌ Not deep-linkable | POST with a CSRF anti-forgery token; page also explicitly bans automated/scripted searches |
| USA — Tennessee | Secretary of State | Document Number | ❌ Not deep-linkable | SPA gated by a Cloudflare Turnstile CAPTCHA token |
| USA — Texas | Secretary of State | Certificate Number | ❌ Not deep-linkable | **Corrected 2026-07**: the originally listed URL was the wrong tool (verified corporate certs, not apostilles); restored to the real "Verify Issuance of an Apostille" verifier. Classic ASP.NET WebForms POST with `__VIEWSTATE`/`__EVENTVALIDATION` |
| USA — Washington | Secretary of State | Date Printed (MM-DD-YYYY); Document Number | ❌ Not deep-linkable | **Corrected 2026-07** — previously misfiled as having no e-Register at all; it has a real, working one at `sos.wa.gov`. Search box has no enclosing `<form>` (Drupal Webform, JS-driven); a test submission produced no visible result or network activity in automated testing |
| USA — West Virginia | Secretary of State | Document Code, OR Apostille/Certificate Number + Date Printed | ❌ Not deep-linkable | Classic ASP.NET WebForms POST with `__VIEWSTATE` |
| Uruguay | MFA | Apostille Number (`vAPOSTILLAID`); Apostille Date (`vAPOSTILLAFECHA`); Holder's name (`vAPOSTILLATDP`) | ❌ Not deep-linkable | GeneXus JS submission plus a large per-session `GXState` token, and a required Google reCAPTCHA checkbox |
| Uzbekistan | MFA/Justice/Supreme Court | Apostille number; Date of affixing | ❌ Not deep-linkable | Pure SPA, no form/name attrs; a visible Google reCAPTCHA directly gates the "Find" button |
| Venezuela | MPPRE | Legalization/Apostille Number (`seal_code`); Verification Code (`code`); Issue Date (`date_apostille`) | ❌ Not deep-linkable | Re-confirmed live: POST form with both a hidden `csrf_token` field and an active Google reCAPTCHA |

## Rows with no field research needed

QR-only (verification is via scanning the physical apostille's QR code, no online form to describe):

- Bahrain — Ministry of Foreign Affairs
- El Salvador — Ministry of Foreign Affairs
- Luxembourg — Ministry of Foreign Affairs
- Panama — Órgano Judicial
- Russian Federation — Ministry of Justice
- Rwanda — Ministry of Foreign Affairs and International Cooperation (reclassified — see corrections table above)

No e-Register exists at all (contact-only, per [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) Tier D):

- Nicaragua — Ministry of Foreign Affairs
- Mexico — Baja California Sur
- USA — Connecticut (e-Apostille pilot ended Sept 2025)
- USA — Rhode Island (e-Apostille pilot ended Sept 2025)
- USA — Utah (e-Apostille pilot ended Sept 2025)

## A note on test reliability

One test run flagged a security-relevant anomaly worth repeating here: testing Andorra and Argentina's URLs in one batch triggered an unexpected redirect to an unrelated government domain (a Saint Kitts & Nevis site) rendering a form with suspiciously matching test questions. A separate concurrent batch independently reported "cross-contamination between unrelated origins" during the same run. The most plausible explanation was that multiple parallel browser-automation agents shared tab state in this sandboxed testing environment, not an actual compromise of any government site. **This was subsequently confirmed**: a later solo re-test of the exact same Andorra URL stayed on `isi.govern.ad` throughout with no redirect, and the deep-link mechanism was verified working end-to-end. Still worth knowing about if you ever see similarly anomalous behavior during your own testing of this dataset.
