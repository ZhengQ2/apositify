# Phase 3C — Specimen acquisition request list

Derived from `src/data/qr-codes.js` on 2026-07-18. This is the **request** list —
what to obtain and why. The decoded results go in the private fixture manifest
(§3.5), **not** in this repository.

## Before you send anything

Apostilles carry personal data: names, dates of birth, document numbers, and the
underlying document's subject matter. Please:

1. **Redact before sending.** Black out names, DOB, addresses, and the underlying
   document details. The QR code, the apostille number, and the issue date are
   what matter.
2. **Do not black out the QR itself** — it is the artifact under test. If the QR
   encodes personal data, that is a finding worth recording, so send it and note
   the concern rather than redacting it away.
3. **Never commit specimens to this repo.** No apostille image, redacted or not,
   belongs in git history. Send them out-of-band and I will record only the
   decoded payload template, host, and redirect chain.

If a specimen is your own document and you would rather not share it at all,
decoding it yourself and sending me just the payload string is enough for most
of what is listed below.

## What counts as a qualifying specimen

The gate needs **two per authority, from independent issuances** — two different
apostilles, not two photos of one. One specimen tells us the payload shape; the
second tells us which parts are stable and which vary per document. A single
specimen cannot distinguish a fixed path segment from a coincidence.

Also useful, in descending order: issue date (payload formats change over time),
whether it is paper or electronic, and the destination page you land on.

---

## Priority 1 — documented host, needs payload confirmation

These already have an allowlisted host from an official source, so a specimen
completes the gate rather than starting it. Highest value per specimen.

| Authority | Function | Known host(s) | What the specimen resolves |
|---|---|---|---|
| Armenia — Ministry of Justice | `verification_url` | `e-verify.am` | Path shape; whether the tracking number is in the URL |
| Brazil — CNJ | `verification_url` | `apostil.cnj.jus.br`, `apostila.cnj.jus.br` | Which host by issue date (split at 3 Aug 2020); path template |
| Chile — national authorities | `verification_url` | `consulta.apostilla.gob.cl` | Confirm the `/QR/<token>` pattern already guessed from the live service |
| China — Mainland MFA | `verification_url` | `consular.mfa.gov.cn` | Path template; whether the last-page QR differs from the sticker QR |
| Colombia — MFA | `verification_url` | `cancilleria.gov.co`, `tramites.cancilleria.gov.co` | Which of the two hosts is current; redirect between them |
| Guatemala — MFA | `verification_url` | `apostilla.minex.gob.gt` | Path template. Note: host is behind a Cloudflare bot challenge |
| Japan — MFA | `portal_or_token` | `ezairyu.mofa.go.jp` | Applies to issuances from 1 Jun 2026. Which fields the QR prefills vs. which the user still types |
| Mexico — Interior (legacy) | `document_url` | `dicoppu.segob.gob.mx` | Confirm it still returns a PDF and has not been migrated |
| Bulgaria — NACID | `unknown` | `apostille.bg` | **Function is unknown** — specimen determines whether this is a lookup, a portal, or a document fetch |

## Priority 2 — confirmed QR, no host documented

The issuing authority or HCCH confirms a QR exists, but no official source gave a
URL. Until a specimen arrives these authorities block every payload — expected
behaviour, not a bug. A specimen here supplies the host from scratch.

| Authority | Function | Evidence basis |
|---|---|---|
| Bangladesh — MFA | `verification_url` | MFA verification instructions |
| Bolivia — MFA | `verification_url` | 2025 MFA publication |
| Costa Rica — MFA | `verification_url` | MFA statement, QR since 12 Jul 2019 |
| Ecuador — MFA and Human Mobility | `verification_url` | HCCH chart |
| Greece — Ministry of Digital Governance | `verification_url` | Official e-Apostille FAQ |
| Kazakhstan — justice authorities | `verification_url` | Government guidance. **Several competent authorities — note which issued yours** |
| Philippines — DFA | `verification_url` | DFA guidance |
| China — Hong Kong Judiciary | `portal_or_token` | Judiciary verification guide (prefills apostille number + reference code) |
| Mexico — Interior (federal e-Apostille) | `verification_url` | HCCH notification. Distinct from the legacy flow above |

## Priority 3 — confirmed QR, function also unknown

HCCH says "via QR code" and nothing further. The specimen has to establish both
the destination *and* what the QR is for — a status result, a portal, or a file.

| Authority | Evidence basis |
|---|---|
| Bahrain — MFA | HCCH: QR generates unique URLs, hence no general lookup link |
| El Salvador — MFA | HCCH: e-Register "Via QR code" |
| Pakistan — MFA | HCCH lists both a conventional link and QR |
| Panama — Judicial Branch | HCCH: "Via QR Code". **Not** the Panama MFA row |
| Russian Federation — Ministry of Justice | HCCH: "Via QR code" |
| Rwanda — MFA | HCCH: link "or via QR code" |

## Priority 4 — special case, no web routing possible

| Authority | Why |
|---|---|
| Luxembourg — MFA | `offline_app`. The QR is read by the government GouvCheck app, not a browser. A specimen is still useful to confirm the payload is not a URL, but this authority will never get an "open" action |

---

## Not on this list, deliberately

- **`public_specimen` (Kosovo, Latvia)** — a QR is visible on publicly filed
  documents, but not issuer-hosted and not current. Needs an issuer-sourced
  specimen before it moves to `confirmed`, so it is not a Phase 3C candidate yet.
- **`reported` (12 parties incl. Belgium, France, UK, Venezuela)** — no primary
  source establishes a QR on the apostille. A specimen here would be a *research*
  finding that changes `presence`, not a gate completion. Still worth sending if
  you have one, but it lands differently.
- **`underlying_only` (Singapore)** — the QR belongs to the source document.
- **`not_established` (26 parties)** — including the entire US, where support is
  per state and no country-wide rule exists.

## What I do with each specimen

1. Decode the payload and record the exact template.
2. Add the host to `allowedUrls` with the tightest `pathnamePattern` two
   specimens justify.
3. Test the destination and record the redirect chain.
4. Add positive fixtures plus adversarial negatives from adjacent authorities.
5. Flip `enabled: true` — one authority per pull request, so evidence, URL rules,
   fixtures, and copy get reviewed together.
