# Apostille Verification Directory

Phase 1 implementation for an Apostille and e-Apostille verification directory.

## What is included

- A React/Vite single-page app.
- Country and issuing-authority dropdowns generated from the full HCCH e-APP implementation chart JSON.
- Clear states for QR-only authorities, manual/contact verification authorities, and rows whose official “Available Here” URL still needs enrichment.
- A small localization module so additional languages can be added later.
- Data validation covering all 64 contracting-party rows and 97 competent-authority rows in the committed source JSON.

## Data source

The raw source data is `src/data/eAPP_implementation_chart_full.json`, which was extracted from the HCCH e-APP implementation chart PDF. The production-ready app dataset is generated at `src/data/e-registers.cleaned.json` by `npm run clean:data`. The raw file preserves the numbered chart markers, but its `schema_note` states that URLs embedded behind “Available Here” are not included. For production safety, the cleaned dataset does not fabricate those missing links; it marks those rows as needing URL enrichment before direct redirect buttons are enabled.

Primary reference: <https://assets.hcch.net/docs/e8e7549d-e34a-452f-9fa3-cf2241aa4197.pdf>

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Data validation

```bash
npm test
```

Run `npm run clean:data` after editing the raw JSON, then run `npm test`. The validation script checks required fields, stable IDs, expected coverage totals, QR-only rows, manual-contact rows, and ensures missing HCCH embedded links are not exposed as placeholder URLs.

## Information still needed

To enable one-click redirection for all online e-Registers, enrich `src/data/eAPP_implementation_chart_full.json` or the normalized dataset with the official URLs hidden behind the HCCH “Available Here” links.
