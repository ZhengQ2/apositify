# Per-Authority Verification Field Requirements

This is the field-definition input for Phase 2 (see [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md)): for every authority with a working e-Register, what does its online verification form actually ask for, and can we deep-link it or only assist a manual submission?

**Methodology:** three parallel research passes visited all 86 e-Register URLs that weren't already known to be QR-only or nonexistent (WebFetch first, falling back to a real browser for JS-rendered/bot-gated pages). This is automated best-effort research against live government sites — treat every row as "verify before hard-coding," not ground truth. Sites change; some entries below are the researcher's best inference where a form's submission mechanism couldn't be fully confirmed.

## Headline finding: this validates dropping automation from Phase 2

**CAPTCHAs, session-bound ASP.NET/JSF ViewState forms, and JS-only SPAs with no accessible `<form>` element are the norm, not the exception.** Of the 86 authorities researched, exactly **4 confirmed a plain GET submission** that could be deep-linked client-side (Belgium, Bolivia, Indonesia, Delaware — USA), plus a couple of ambiguous GET-shaped-but-SPA-mediated cases (Brazil, Greece, Guatemala) that likely don't actually work as a bare link. Everything else is POST, unclear/JS-driven, or blocked by a CAPTCHA that a human has to solve. This confirms the Phase 2 design from [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md): even if we wanted to automate submission, most of these portals are built specifically to resist it. Tier C (collect fields, show the official link, let the human paste and submit) is the realistic default — Tier B (deep link) is the rare exception, not the common case.

## Corrections needed to the dataset (found during this research)

| Authority | Issue | Action |
|---|---|---|
| Costa Rica | Source URL was byte-identical to Colombia's — confirmed copy-paste error | Replace with `rree.go.cr` "Consultar Apostilla" page (fields: Código de la apostilla, Fecha) |
| USA/Texas | The listed URL verifies corporate filing certificates — the word "apostille" never appears on the page | Not a valid apostille verifier; needs a fresh URL for Texas's actual Authentications Unit, or reclassify as contact-only until found |
| Austria | Redirects to an RTR informational page with no lookup tool at all | Reclassify Tier D (contact-only) — despite the chart marking it "Available Here" |
| Rwanda | The listed URL is a generic Irembo file-status tracker, not an apostille e-register | Rely on the QR-code path only (already hybrid in source data); drop the link-based tier |
| Bangladesh | Listed URL is a homepage; the real tool is a generic signed-PDF/digital-signature checker (upload-based), not a number+date lookup | Reclassify as e-Apostille signature check (Phase 4-style), not a Phase 2 field-based e-Register |
| Türkiye | Verification is file-upload/hash-check, not typed fields | Same as Bangladesh — Phase 4-style, not Phase 2 |
| Venezuela | Only one unified verification form found; source notes describe three separate date-range registers | Needs manual confirmation — may have been consolidated since the chart was written |
| Slovenia, Moldova, Mexico/Federal District, USA/Arkansas | Could not confirm a working verification form (site unreachable, state-authentication-gated, or blank SPA under automation) | Needs manual human check before classifying |

## Full field table

Legend: **GET** = confirmed deep-linkable · **POST** = confirmed session/CAPTCHA-bound, form-assist only · **Unclear** = JS/SPA, no accessible form action · **N/A** = no field-based verification exists

| Country | Authority | Required Fields | Submission | Notes |
|---|---|---|---|---|
| Andorra | Ministry of Foreign Affairs | Apostille/Legalization Number; Date | Unclear | Legacy IBM LANSA CGI app |
| Argentina (≥15 Apr 2019) | MFA & Worship | Year; Number (CE- prefix); Dependency Code (-APN-); Order No. | Unclear | Embedded widget, not directly reachable |
| Argentina (historic, 2017–2019) | MFA & Worship | Order Number; Year; Security Code | Unclear | Separate URL for this date range |
| Armenia | Ministry of Justice | 16-digit document tracking code | POST | Generic document checker, not apostille-specific |
| Australia | DFAT | Apostille number (AAAA-A1-1111); Date of issue | Likely POST/AJAX | Only apostilles ≥14 Dec 2015 |
| Austria | — | — | — | **No verification tool exists** — reclassify Tier D |
| Azerbaijan | Ministry of Justice | Number; Date (DD.MM.YYYY) | POST | Must use http:// (https fails) |
| Bangladesh | MFA | (Upload signed PDF — not field-based) | Upload | Reclassify as e-Apostille signature check |
| Belgium | FPS Foreign Affairs | Reference number (format varies by type); Reference date | **GET** | Deep-linkable |
| Bolivia | Ministry of Foreign Affairs | Date; Apostille number; Security code | **GET** | Deep-linkable |
| Brazil | National Council of Justice | Code; CRC | GET-shaped, Cloudflare + reCAPTCHA gated | Not reliably deep-linkable in practice |
| Bulgaria — MoJ | apostil.mjs.bg | Apostille Code; CAPTCHA | POST | |
| Bulgaria — MFA | apostille.mfa.bg | Apostille ID | POST | Lotus Domino backend |
| Bulgaria — NCID | apostille.bg | Verification code (13-char) | **GET** | Deep-linkable |
| Bulgaria — Regional Admins | apostille.gov.bg | Apostille ID | POST | |
| Canada — Federal | GAC | Certificate number; Certified-on date | Unclear (PowerApps portal) | Excludes Ontario/Quebec |
| Canada — Ontario | MPBSD | Apostille Number (11-AA-AAAA-AAAA); Issue Date | Unclear | Only apostilles ≥11 Jan 2024 |
| Canada — Quebec | Minister of Justice | Numéro de l'apostille; Date d'émission | Unclear | Only apostilles ≥11 Jan 2024 |
| Chile | Multiple ministries/Civil Registry | Legalization/Apostille Number; Date; Verification code; CAPTCHA | POST | |
| China — Mainland | MFA | Legalization/Apostille Number + Sticker Number, OR upload e-Apostille PDF | Unclear | Pre-7 Nov 2023 requires mobile QR scan |
| China — Hong Kong SAR | Judiciary | Apostille No.; Year; Reference Code; CAPTCHA | POST | Only apostilles ≥1 Sept 2014 |
| China — Macao SAR | Legal Affairs Bureau | Confirmed real portal; exact fields not extractable (canvas UI) | Unclear | |
| Colombia | MFA | Apostille/Legalization Number; Issue date | POST | |
| Costa Rica | MFA & Worship | Código de la apostilla; Fecha | Ambiguous | **URL corrected — see above** |
| Cyprus | Ministry of Justice | District; Location; Certificate Number; Certificate Year; Random Number | POST | Only apostilles ≥1 June 2020 |
| Denmark | Ministry of Foreign Affairs | Apostille/stamp number (item 8); Date | POST | |
| Dominican Republic | MFA | Date (item 6); Number (item 8); Verification code | **GET** | Deep-linkable |
| Ecuador | MFA & Human Mobility | Number; Issuance Date; image CAPTCHA | Unclear | |
| Estonia | Chamber of Notaries | Issue date; Apostille registration number | POST | |
| France | Regional Councils/Notaires | Apostille Number; Date of issue | Unclear (Angular SPA) | |
| Georgia — MoJ | services.sda.gov.ge | Certificate Number (15-digit); Issue Date; reCAPTCHA | Unclear | |
| Georgia — MIA | sa.gov.ge | Apostille Number; Date | POST | |
| Greece | Ministry of Digital Governance | Electronic apostille number, or QR scan | Unclear (SPA route) | Real form on a different domain (dilosi.services.gov.gr) |
| Guatemala | Ministry of Foreign Affairs | Verification Code; Apostille Code | Unclear | Cloudflare-gated; blocks automated tools, works in a real browser |
| India | Ministry of External Affairs | Apostille/Attestation Number; CAPTCHA | Unclear | |
| Indonesia | Ministry of Law and Human Rights | Sticker/Certificate Number; Issued Date | **GET** | Deep-linkable |
| Ireland | Dept. of Foreign Affairs | Type (Apostille/Authentication); Date of Issue; Apostille Number | Unclear | Cookie modal blocks initial view |
| Israel | Ministry of Justice | Apostille number; Date issued | Unclear | WebFetch blocked (403); browser works |
| Japan | Ministry of Foreign Affairs | Apostille Number; Date; Access Code | POST | Only QR-code apostilles ≥1 June 2026 |
| Kazakhstan | Ministry of Justice (egov.kz) | Application number; Security code; CAPTCHA | Unclear | Requires egov.kz login |
| Korea, Rep. of | MOFA/Justice | Certificate issue number; Issue date; CAPTCHA | Unclear | Login normally required |
| Kosovo | Ministry of Internal Affairs | Seal type; Reference number; **+ requester's name/workplace/email/country/reason** | POST | Unusually asks for verifier's own personal info |
| Latvia | Council of Sworn Notaries | Document number, or upload signed `.asice` file | Unclear | |
| Mexico — Federal District | dicoppu-portal | — | — | **Site unreachable** — needs manual check |
| Mexico — Jalisco | Secretary of Government | Código de documento | POST | |
| Moldova | Ministry of Justice | Not confirmed | Unclear | Both sub-systems gated/unrendered — needs manual check |
| Mongolia | Ministry of Foreign Affairs | Reference/Statement Number; CAPTCHA | Unclear | Generic e-Mongolia checker |
| Morocco | Ministry of Justice | Apostille Number; Signature Date; Page count; Underlying-doc signature date; CAPTCHA | POST | |
| New Zealand | Dept. of Internal Affairs | Apostille Number (e.g. `12345.1`); Issue Date | POST | Real tool 2 links deep from given URL |
| Pakistan | Ministry of Foreign Affairs | Apostille Number; Date | POST | Also has QR-scan alternative (hybrid) |
| Panama | Ministry of Foreign Affairs | Apostille-Certification Number; Issue Date | Unclear (React SPA) | |
| Paraguay | Ministry of Foreign Affairs | Issue Date; Barcode Number | POST | |
| Peru | Ministry of Foreign Affairs | Date; Apostille/Certification Number; Security code (image CAPTCHA) | POST | |
| Philippines | Department of Foreign Affairs | Serial Code (dropdown by cert type); Serial Number; Keycode | Unclear | Apostilles without keycodes or pre-late-2022 need email verification instead |
| Romania | Offices of the Prefect | Apostille Number (`JJ/XXXX`); Date (appears optional) | Unclear | Covers apostilles since 1 Nov 2004 only |
| Rwanda | MFA/Irembo | — | — | **Listed link is not an e-register** — QR-only in practice |
| Saint Kitts and Nevis | MFA | Apostille date; Apostille number | Unclear | Real form is embedded via iframe |
| Saudi Arabia | MOFA | Certificate Issue Date; Certificate Number | Unclear | Arabic primary, English toggle |
| Singapore | Singapore Academy of Law | Apostille Certificate No.; Notarial Certificate No.; Verification Code (fields differ pre/post 16 Sept 2021) | Unclear | Two parallel cert regimes by date |
| Slovenia | District Courts | Not confirmed | Unclear | Site unreachable; naming suggests a filing form, not verification |
| Spain | eRegister (44 authorities) | Verification Code; Apostille Number; Issue Date | POST | ASCII-art text CAPTCHA |
| Tajikistan | MFA/Justice | Apostille Number; Date (Y/M/D) | POST | Image CAPTCHA |
| Türkiye | PTT e-Apostil | (File upload / hash check — not fields) | Upload | Phase 4-style, not field-based |
| Ukraine — Education | ENIC | Apostille number (item 8); Application number; Apostille date (item 6) | Unclear | Covers apostilles from 18 Jan 2013 |
| Ukraine — Justice | Ministry of Justice | Apostille number; Issue date; Control code (newer only); OR upload e-document | Unclear (Angular SPA) | Listed URL stale — use bare domain root |
| United Kingdom | FCDO | Apostille issue date; Apostille number | POST | Separate `verifyapostille.service.gov.uk` domain |
| UK — Cayman Islands | Passport & Corporate Services | Apostille Number; Issue Date | POST | Oracle APEX; WAF blocks WebFetch, browser works |
| USA — Arkansas | Secretary of State | Not confirmed | Unclear | React SPA renders blank under automation |
| USA — California | Secretary of State | Apostille Number; Issue Date | POST | Only apostilles issued in last 5 years |
| USA — Colorado | Secretary of State | Number; Issue date | POST | Covers apostilles ≥4/5/2011 |
| USA — Delaware | Secretary of State | Corporation Number; Authentication Number | **GET** | Deep-linkable; valid only within 1 year of issuance |
| USA — Kentucky | Secretary of State | Apostille ID (first 12 digits of apostille number) | POST | |
| USA — Minnesota | Secretary of State | File Number; Issue Date | POST | Only records ≥5/15/2018 |
| USA — Montana | Secretary of State | Apostille/Authentication Number | Unclear | |
| USA — Nevada | Secretary of State | Apostille/Certification # (must start with "N"); Issue Date | Unclear | Separate page for "C"/"B"-prefixed numbers |
| USA — New York | Secretary of State | Document Number; Issue Date | POST | Only apostilles ≥4/9/2013 |
| USA — North Carolina | Secretary of State | Certificate Type (dropdown); Certificate #; Issued Date | POST | Explicitly bans automated/scripted searches |
| USA — Tennessee | Secretary of State | Document Number | Unclear | Only filings ≥3/24/2014 |
| USA — Texas | Secretary of State | Document Number | POST | **Wrong tool — verifies corporate certs, not apostilles** |
| USA — West Virginia | Secretary of State | Document Code, OR Apostille/Certificate Number + Date Printed | POST | Hidden honeypot anti-bot field; must use https |
| Uruguay | MFA | Apostille Number; Apostille Date; Document holder's name | POST | Pre-18/09/2023 needs only the number |
| Uzbekistan | MFA/Justice/Supreme Court | Apostille number; Date of affixing | Unclear | Also displays scanned document after lookup |
| Venezuela | MPPRE | Legalization/Apostille Number; Verification Code; Issue Date | POST | reCAPTCHA present; only one form found (see correction above) |

## Rows with no field research needed

QR-only (verification is via scanning the physical apostille's QR code, no online form to describe):

- Bahrain — Ministry of Foreign Affairs
- El Salvador — Ministry of Foreign Affairs
- Luxembourg — Ministry of Foreign Affairs
- Panama — Órgano Judicial
- Russian Federation — Ministry of Justice

No e-Register exists at all (contact-only, per [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) Tier D):

- Nicaragua — Ministry of Foreign Affairs
- Mexico — Baja California Sur
- USA — Connecticut (e-Apostille pilot ended Sept 2025)
- USA — Rhode Island (e-Apostille pilot ended Sept 2025)
- USA — Utah (e-Apostille pilot ended Sept 2025)
- USA — Washington (no hyperlink extractable from source chart)
