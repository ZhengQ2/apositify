// The scanner is gated behind a flag so it can be exercised in development and
// staging while authority coverage is still being built out. Coverage is no
// longer empty: 15 authorities have a decoded specimen and route at tier 1
// (see gateEnabled() in ./data/qr-codes.js).
//
// Set VITE_QR_SCANNER=on to surface the scanner entry point. It renders for two
// groups, which the classifier then treats very differently:
//
//   - Authorities with a decoded specimen, which route against a verified host
//     allowlist (tier 1).
//   - Authorities whose QR presence is `confirmed` but whose format we have not
//     seen, which fall back to the government-namespace heuristic (tier 2) and
//     get explicitly unverified copy and a weaker action.
//
// Opening the scanner is therefore not the same as passing the evidence gate;
// the gate governs which TIER a payload can reach, not whether the dialog opens.

const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined

export const qrScannerFlagEnabled = env?.VITE_QR_SCANNER === 'on'

// Development only. Surfaces the scanner for every authority whose apostille QR
// is *confirmed*, so the flow can be exercised before any authority has passed
// the specimen gate. This deliberately does NOT relax the security boundary:
// host/port/path allowlisting still applies, so an authority with no documented
// hosts will block every payload — which is the correct outcome, not a bug.
// `reported`, `public_specimen`, `underlying_only`, and `not_established`
// authorities stay unroutable even here.
//
// Never set this in a deployed environment. scripts/validate-data.mjs asserts
// the committed data has no authority enabled, independently of this flag.
export const qrDevEnableConfirmed = env?.VITE_QR_DEV_ENABLE_CONFIRMED === 'on'
