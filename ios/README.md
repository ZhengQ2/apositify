# Apositify for iOS

A native SwiftUI app for iOS 17 and later. It captures one photo of a paper
Apostille, checks QR codes against authority-scoped specimen rules first, then
recognizes multilingual text locally with Apple Vision as a fallback. It matches the country and
issuing authority against the repository's e-Register directory, and prepares the
fields required by the authority's official verifier.

## Open and run

1. Run `npm run build:ios-data` from the repository root after changing the web
   directory or verification-field metadata.
2. Open `ios/Apositify.xcodeproj` in Xcode 16 or later.
3. Select an iPhone device or simulator and run the `Apositify` scheme.

Camera capture is only available on a real supported iPhone or iPad.
The photo-picker flow can be exercised in the simulator.

## Sample regression tests

Run `npm run test:ios-samples` to render and OCR the required artificial
multilingual Apostilles. Run `npm run fetch:ios-samples` first to add the public
HCCH and authority-published samples to the local, gitignored cache. The suite
tests OCR, right-to-left and repeated multilingual labels, template-label words
that appear inside real values, localized dates, authority matching,
non-standard fields, and both verified and refused QR routing. See
`ApositifySampleTests/README.md` for details.

`npm run test:ios-core` is the companion suite. It builds recognition results
directly instead of going through Apple Vision, so parser behaviour — including
scripts Vision may not recognize on a given machine, and two-column layouts
whose geometry the artificial renderer cannot reproduce — fails deterministically
rather than skipping.

## Verification boundary

Text recognition and matching produce suggestions, not a validity result. The user
must review every extracted value. Six authority portals have confirmed GET or POST
handoffs and receive those reviewed values directly. Other portals open with a
copy-assist strip because their CAPTCHA, CSRF, or session-bound forms make reliable
prefill impossible. Only the issuing authority's response verifies an Apostille.
