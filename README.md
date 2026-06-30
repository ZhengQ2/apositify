# Apostille Verification Directory

Phase 1 implementation for an Apostille and e-Apostille verification directory.

## What is included

- A React/Vite single-page app.
- Country and issuing-authority dropdowns.
- Buttons that open official e-Register portals in a new tab.
- QR-only handling for jurisdictions where HCCH lists no fixed public link.
- A small localization module so additional languages can be added later.
- A starter seed dataset based on the HCCH operational e-Registers list.

## Data source

The seed dataset is intentionally small and should be replaced or expanded with the compiled Excel/CSV file before production use.

Primary reference: <https://www.hcch.net/en/instruments/conventions/specialised-sections/apostille/operational-e-registers>

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Information still needed

Please provide the compiled Excel/CSV file mentioned in the development plan. That file is needed to complete coverage for all countries/provinces, confirm official URLs, and capture notes such as QR-only verification or date-specific registers.
