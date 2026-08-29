# Apostille Verification Directory

Phase 1 implementation for an Apostille and e-Apostille verification directory.

## What is included

- A React/Vite single-page app.
- Country and issuing-authority dropdowns generated from the full HCCH e-APP implementation chart JSON.
- Clear states for QR-only authorities, manual/contact verification authorities, and rows whose official “Available Here” URL still needs enrichment.
- A small localization module so additional languages can be added later.
- Data validation covering all 64 contracting-party rows and 97 competent-authority rows in the committed source JSON.

## Data source

The raw source data is `src/data/eAPP_implementation_chart_full.json`, which was extracted from the HCCH e-APP implementation chart PDF. The production-ready app dataset is generated at `src/data/e-registers.cleaned.json` by `npm run clean:data`. The cleaner now supports the corrected JSON shape where `e_register.method` contains the extracted hyperlink URL and `e_register.label` preserves the displayed chart label. Rows without an extracted URL remain clearly marked as QR-only, manual-contact, or needing URL enrichment.

Primary reference: <https://assets.hcch.net/docs/e8e7549d-e34a-452f-9fa3-cf2241aa4197.pdf>

## Development

```bash
npm install
npm run dev
```

## Native iOS app

The SwiftUI iOS app lives in `ios/`. It captures one document photo, checks for a
specimen-verified QR route first, then uses multilingual Apple Vision text recognition
entirely on-device as a fallback. It matches the issuing authority against
the same 97-entry directory, and hands reviewed values to the official verifier.
Run `npm run build:ios-data` after changing the shared register or verification-field
metadata, then open `ios/Apositify.xcodeproj` in Xcode 16 or later. See
`ios/README.md` for the verification and prefill boundaries.

## Native Android app

The Kotlin/Jetpack Compose Android app lives in `android/`. It follows the same
one-photo, QR-first, multilingual OCR fallback, ambiguity review, and secure
verifier boundaries as iOS. Run `npm run build:android-data` after shared catalog
changes, then open the `android/` directory in Android Studio. Setup and test
instructions are in `android/README.md`.

## Build

```bash
npm run build
npm run preview
```

## Data validation

```bash
npm test
npm run test:all
```

Run `npm run clean:data` after editing the raw JSON, then run `npm test`. The validation script checks required fields, stable IDs, expected coverage totals, QR-only rows, manual-contact rows, URL presence for online/hybrid rows, and ensures missing-link rows do not expose placeholder URLs.

`npm run test:all` also runs the native parser tests and the Apple Vision sample
suite. Artificial multilingual Apostilles are rendered and OCRed on every run.
Official HCCH and authority samples can be cached locally with
`npm run fetch:ios-samples`; unreadable or unavailable official samples are
reported as skips and the documents remain under the gitignored `specimens/`
directory. See `ios/ApositifySampleTests/README.md` for fixture and privacy rules.
The country-by-country primary-source review is recorded in
`docs/OFFICIAL_EREGISTRY_SPECIMEN_AUDIT.md`.

## Reading dates

A numeric date such as `12/07/2019` has two readings, and about two dates in
five are ambiguous this way. Most fields submit the date exactly as printed and
so never need it interpreted; where interpretation is required, the order comes
from the certificate itself before the country it was issued in. See
[docs/NUMERIC_DATE_ORDER.md](docs/NUMERIC_DATE_ORDER.md).

## Information still needed

If a future PDF extraction still has rows with `source_link_missing` or `hybrid_link_missing`, enrich `src/data/eAPP_implementation_chart_full.json` with the official URL and rerun `npm run clean:data`.
