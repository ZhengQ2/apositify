# Phase 3C — Specimen status and outstanding requests

Generated from `src/data/qr-codes.js` on 2026-07-18, after decoding 18 specimens.
Regenerate rather than hand-editing: an earlier hand-written version drifted from
the registry within a day, listing five hosts that the decodes had already
disproved.

## Handling rules

Apostilles carry personal data, and so, sometimes, does the QR itself — Costa
Rica's encodes the signatory's and authenticating official's names.

1. **Redact before sending.** Black out names, DOB, addresses, and the underlying
   document details. Leave the QR, the apostille number, and the issue date.
2. **Do not commit specimens.** No apostille image belongs in git history. Keep
   them under `specimens/` (gitignored) or outside the repo, and never in
   `public/`, which is copied into the production build.
3. **Decoded values stay out of the repo too.** Not only names: an apostille
   number plus check code is a working lookup credential on a live government
   verifier, and those verifiers return the underlying record. Record the payload
   SHAPE and substitute synthetic values of the same form. The registry records
   Costa Rica's field *order* and never its values, and every example payload in
   `qr-codes.js` and the test suite uses synthetic identifiers.

## What a second specimen buys

One specimen makes the host empirical fact, so we bind host + path + declared
query params. It cannot tell a stable path segment from a coincidence, so
canonical URL reconstruction — rebuilding the destination from our own stored
base rather than opening what the QR supplied — stays locked until a second
independent issuance confirms which parts vary.

## Decoded — one specimen held (18)

These route today. A **second specimen from an independent issuance** unlocks
canonical URL reconstruction, which is the remaining tightening step.

| Authority | Function | Verified host(s) |
|---|---|---|
| Armenia — Ministry of Justice | `verification_url` | `e-verify.am` |
| Bahrain — Ministry of Foreign Affairs | `verification_url` | `www.mofa.gov.bh` |
| Brazil (apostil-current) — National Council of Justice | `verification_url` | `apostil.org.br` |
| Brazil (sei-legacy) — National Council of Justice | `verification_url` | `www.cnj.jus.br` |
| Bulgaria — National Center for Information and Documenta | `document_url` | `apostille.nacid.bg` |
| Chile — Relevant authorities of the Ministries of Jus | `verification_url` | `consulta.apostilla.gob.cl` |
| China — China (Mainland): Ministry of Foreign Affairs | `verification_url` | `consular.mfa.gov.cn` |
| China — Hong Kong SAR: The Registrar, the Senior Depu | `portal_or_token` | `www.e-services.judiciary.hk` |
| Colombia — Ministry of Foreign Affairs | `verification_url` | `tramites.cancilleria.gov.co` |
| Costa Rica — Ministry of Foreign Affairs and Worship | `embedded_fields` | — |
| Ecuador — Ministry of Foreign Affairs and Human Mobilit | `verification_url` | `serviciosciudadanos.cancilleria.gob.ec` |
| Guatemala — Ministry of Foreign Affairs | `verification_url` | `apostilla.minex.gob.gt` |
| Japan — Ministry of Foreign Affairs | `portal_or_token` | `www.ezairyu.mofa.go.jp` |
| Mexico (legacy-physical-certificate) — Ministry of Interior | `document_url` | `consultasislac.segob.gob.mx` |
| Pakistan — Ministry of Foreign Affairs | `verification_url` | `apostille.mofa.gov.pk` |
| Panama — Ministry of Foreign Affairs | `verification_url` | `sigob.mire.gob.pa` |
| Philippines — Department of Foreign Affairs | `portal_or_token` | `e-registry.apostille.gov.ph` |
| Russian Federation — Ministry of Justice | `verification_url` | `minjust.gov.ru` |

Four are HTTP-only and carry an explicit `insecureAccepted` risk acceptance:
Armenia, China (Mainland), Mexico, Panama. Testing whether HTTPS works on those
same hosts would let us drop the exceptions.

## Still needed — no decoded specimen (9)

Confirmed by HCCH or the authority, but the payload has never been seen. These
fall back to the tier-2 government-namespace heuristic and get explicitly
unverified copy.

| Authority | Function | Verified host(s) |
|---|---|---|
| Bangladesh — Ministry of Foreign Affairs of the Government | `verification_url` | — |
| Bolivia — Ministry of Foreign Affairs | `verification_url` | — |
| El Salvador — Ministry of Foreign Affairs | `unknown` | — |
| Greece — Ministry of Digital Governance | `verification_url` | — |
| Kazakhstan — Relevant authorities of several Ministries an | `verification_url` | — |
| Luxembourg — Ministry of Foreign Affairs | `offline_app` | — |
| Mexico (federal-e-apostille) — Ministry of Interior | `verification_url` | — |
| Panama — Órgano Judicial | `verification_url` | — |
| Rwanda — Ministry of Foreign Affairs and International | `document_url` | — |

## Excluded, deliberately

| Case | Why |
|---|---|
| Bangladesh | Its only specimen decoded to `apostille.training.mygov.bd` — a training environment. Not allowlisted at any tier; `looksNonProduction()` blocks that host shape. A production specimen is still wanted. |
| Kosovo, Latvia | `public_specimen` — QR visible on publicly filed apostilles, but not issuer-hosted and not current. |
| 15 reported parties | No primary source establishes a QR on the apostille. A specimen here changes `presence`, rather than completing a gate. |
| Singapore | `underlying_only` — the QR belongs to the source document. |
| 54 not-established authorities | Including all 17 US states; support is per state with no country-wide rule. |
