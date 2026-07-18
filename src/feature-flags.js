// Phase 3A ships behind a flag with no authority enabled, so the scanner can be
// exercised in development and staging without appearing in production until an
// authority actually passes the evidence gate.
//
// Set VITE_QR_SCANNER=on to surface the scanner entry point. Even with the flag
// on, the entry point only renders for authorities whose qrCode record has
// `enabled: true` — the flag never bypasses the evidence gate.

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
