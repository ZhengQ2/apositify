export const messages = {
  appTitle: 'Apostille Verification Directory',
  subtitle: 'Find official e-Registers for Apostilles and e-Apostilles issued under the Hague Apostille Convention.',
  countryLabel: 'Country or jurisdiction',
  countryPlaceholder: 'Select a country',
  authorityLabel: 'Issuing authority',
  authorityPlaceholder: 'Select an authority',
  verify: 'Open official e-Register',
  qrOnly: 'This authority uses QR-code verification. Scan the QR code printed on the Apostille to open the official verification URL.',
  linkMissing: 'This authority is listed as having an online e-Register, but a direct link is not available in this directory yet.',
  hybridLinkMissing: 'This authority supports QR verification and may also have an online e-Register, but a direct link is not available in this directory yet.',
  hybrid: 'This authority lists both an official e-Register link and QR-code verification.',
  manualContact: 'No fixed online verifier is available for this authority. Use the contact or status details below.',
  noSelection: 'Select a country and authority to continue.',
  sourceNote: 'Source data is derived from the HCCH e-APP implementation chart.',
  privacy: 'You are leaving this site for an official government or authority portal. Do not enter sensitive data unless you trust the destination.',
  helperTitle: 'What you’ll need',
  helperIntroDeepLink: 'Enter the values exactly as printed on your Apostille. Once every field is valid, we’ll open the official verification result directly.',
  verifyNow: 'Verify now',
  uploadKindNote: 'This authority verifies by uploading the original Apostille file instead of looking up a number.',

  // Phase 3 — QR scanning. Copy here must never assert an outcome: this app can
  // say what it decoded and where a destination leads, never whether an
  // Apostille is genuine. Avoid "valid", "invalid", and "verified" as verdicts.
  qrScanCta: 'Scan the QR code on your Apostille',
  qrDialogTitle: 'Scan Apostille QR code',
  qrDialogIntro: 'Point your camera at the QR code printed on the Apostille from {authority}, or choose a saved photo. The image is read on your device and never uploaded.',
  qrClose: 'Close scanner',
  qrVideoLabel: 'Live camera preview for QR scanning',
  qrUseCamera: 'Use camera',
  qrRestartCamera: 'Restart camera',
  qrUseFile: 'Choose an image',
  qrPrivacyNote: 'Images and decoded content stay on your device. Nothing is uploaded, stored, or logged.',

  qrStateIdle: 'Choose the camera or an image file to start.',
  qrStateRequesting: 'Waiting for camera permission…',
  qrStateScanning: 'Scanning. Hold the QR code steady in frame.',
  qrStateDecodingFile: 'Reading the selected image…',
  qrStateDecoded: 'QR code read. See the result below.',
  qrNoCodeFound: 'No QR code found in that image. Try a closer, sharper photo of just the QR code.',
  qrUnreadableImage: 'That file could not be opened as an image. Try a JPEG or PNG.',
  qrMultipleCodes: 'More than one QR code is in frame. Move closer so only the Apostille QR code is visible.',
  // Same condition, different recovery: you cannot "move closer" to a saved file.
  qrMultipleCodesFile: 'That image contains more than one QR code, so we cannot tell which one is the Apostille’s. Crop it to just the Apostille QR code and try again.',
  qrCameraDenied: 'Camera permission was declined. You can still choose a saved image instead.',
  qrCameraUnavailable: 'No camera is available on this device. Choose a saved image instead.',
  qrCameraInsecure: 'The camera needs a secure (HTTPS) connection. Choose a saved image instead.',

  qrDestinationHost: 'You will open:',
  qrDecodedHost: 'Decoded destination:',
  qrExtractedToken: 'Reference read from the code:',
  qrNotAVerdict: 'This app does not decide whether an Apostille is genuine. Only the issuing authority’s own result page can tell you that.',

  qrFnVerificationTitle: 'Official lookup page found',
  qrFnVerificationBody: 'This code points to the issuing authority’s own lookup page for this Apostille. Open it and read the result there.',
  qrOpenVerification: 'Open official lookup',
  qrFnPortalTitle: 'Official portal found',
  qrFnPortalBody: 'This code opens the authority’s portal. You will still need to enter the details printed on the Apostille to see a result.',
  qrOpenPortal: 'Open official portal',
  qrFnDocumentTitle: 'Official document retrieval',
  qrFnDocumentBody: 'This code retrieves a copy of the document from the authority’s service. It returns a file, not a status result.',
  qrOpenDocument: 'Retrieve official document',
  qrFnOfflineTitle: 'Checked with a government app',
  qrFnOfflineBody: 'This authority’s QR code is read by the official {app} app. Install it from the authority’s published link and scan the code there.',
  qrFnOfflineBodyGeneric: 'This authority’s QR code is read by an official government app rather than a web page. Follow the authority’s published instructions.',

  qrBlockedTitle: 'Destination does not match this authority',
  qrBlockedBody: 'The code was read, but its destination does not match the rules we hold for the authority you selected. It has not been opened.',
  qrBlockedNoOpen: 'If you expected an official page, check that you selected the right issuing authority, and treat the destination above with caution.',
  qrNotEnabledTitle: 'QR routing not available for this authority yet',
  qrNotEnabledBody: 'The code was read, but this authority’s QR format has not been confirmed against official specimens, so no destination is offered. Here is the raw content:',
  qrUnsupportedTitle: 'Code content not recognised',
  qrUnsupportedBody: 'This code does not contain a documented official address. Here is the raw content:',

  // Tier 2 — government namespace, no specimen. The copy must make the weaker
  // basis explicit and must not use the word verify.
  qrGovTitle: 'Government address — format not confirmed',
  qrGovBody: 'This code points to an address inside {country}\u2019s government domain, but we have not confirmed this authority\u2019s QR format against a real Apostille. Check the address below looks right before continuing.',
  qrGovFullUrl: 'Full address in the code:',
  qrGovOpen: 'Continue to this address',
  qrGovCaution: 'We cannot tell you whether this page belongs to the issuing authority or what it will show.',

  qrFieldsTitle: 'Details stored in the code',
  qrFieldsBody: 'This authority\u2019s QR does not link anywhere. It stores the Apostille\u2019s own details so they can be compared against the printed certificate.',
  qrFieldsShape: 'Order of the stored values:',
  qrFieldsPersonal: 'This code contains personal details, so we are not displaying its contents. Compare it against your Apostille using a QR reader you control.',
  qrFieldsReveal: 'Show contents anyway',

  // There is no reporting endpoint, so this copies to the clipboard and lets the
  // user send it themselves. The copy must not imply anything was transmitted.
  qrReportPrompt: 'Was this the wrong result?',
  qrReportBody: 'We may not support this authority\u2019s QR format yet. You can copy what the code contained and send it to us — nothing leaves your device on its own.',
  qrReportCta: 'Show what you can copy',
  qrReportPreviewLabel: 'Copy this and email it to us:',
  qrReportWarn: 'Check this for personal details first. Some authorities encode names and document numbers in the QR itself.',
  qrReportConfirm: 'Copy to clipboard',
  qrReportCancel: 'Cancel',
  qrReportDone: 'Copied. Email it to {email} and we\u2019ll look at adding support.',
  qrReportCopyFailed: 'Your browser blocked clipboard access. Select the text above and copy it manually, then email it to {email}.',
  qrReportEmail: 'qr-specimens@apostifi.com',

  qrSectionHeading: 'QR code on this Apostille',
  // Fallback guidance when in-app scanning is unavailable. This MUST branch on
  // the QR's function: telling someone to "check the destination is an official
  // address" is wrong advice for a QR that has no destination at all.
  qrInfoConfirmed: 'Apostilles from this authority are documented to carry a QR code. In-app scanning is not offered yet — scan it with your phone’s camera and check the destination is an official government address.',
  qrInfoConfirmedFields: 'Apostilles from this authority carry a QR code, but it does not link anywhere — it stores the Apostille’s own details so they can be compared against the printed certificate. It may include personal details, so take care where you scan it.',
  qrInfoConfirmedOfflineApp: 'Apostilles from this authority carry a QR code that is read by the official {app} app rather than a web page. Install it from the authority’s own published link and scan the code there.',
  qrInfoConfirmedOfflineAppGeneric: 'Apostilles from this authority carry a QR code that is read by an official government app rather than a web page. Follow the authority’s published instructions.',
  qrInfoConfirmedDocument: 'Apostilles from this authority carry a QR code. In-app scanning is not offered yet — scanning it with your phone’s camera retrieves a copy of the document from the authority’s service, not a status result. Check the address is an official government one before opening it.',
  qrInfoReported: 'A QR code on this authority’s Apostilles has been reported but not confirmed from an official source. Use the lookup route above.',
  qrInfoUnderlyingOnly: 'Any QR code you see may belong to the underlying document rather than to the Apostille itself. A QR on the source document does not verify the Apostille.'
}
