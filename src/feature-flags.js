// Phase 3A ships behind a flag with no authority enabled, so the scanner can be
// exercised in development and staging without appearing in production until an
// authority actually passes the evidence gate.
//
// Set VITE_QR_SCANNER=on to surface the scanner entry point. Even with the flag
// on, the entry point only renders for authorities whose qrCode record has
// `enabled: true` — the flag never bypasses the evidence gate.

const env = typeof import.meta !== 'undefined' ? import.meta.env : undefined

export const qrScannerFlagEnabled = env?.VITE_QR_SCANNER === 'on'
