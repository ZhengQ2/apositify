# Apostille sample regression suite

This suite exercises the same Apple Vision OCR, authority matching, field
parsing, localized date handling, and specimen-verified QR routing used by the
iOS app.

## Test sets

- `sample-fixtures.json` contains redacted artificial certificates. They are
  rendered to images at test time, then read through Apple Vision. These are
  required regression tests, except where a fixture sets `"optional": true`
  because Apple Vision may have no recognizer for its script; those skip
  instead of failing, and the same parsing is asserted without OCR in
  `ApositifyTests`.
- `official-samples.json` records public PDF or image source URLs, page numbers
  where applicable, languages, and non-sensitive expectations for samples
  published by the HCCH and issuing authorities. The source files themselves are downloaded to
  `specimens/official-test-cache`, which is gitignored.

The official set includes multilingual HCCH models and issuer-published filled
specimens or blank models. Filled samples assert standard item numbers and dates
where the source is readable enough, as well as OCR readability and authority
matching. A sample may also set `"qrMustNotRoute": true`, which requires that a
QR is decoded and that no decoded payload routes — the Philippine specimen's
published code points at the DFA staging host, outside the authority's
documented route.

Every fixture is also re-run under reversed, interleaved and rotated line
order, and must extract identical values each time. Line order is the one input
that moves between scans of the same page — a slightly different angle
re-orders a two-column certificate — so anything that depends on it is
intermittent in the user's hands rather than broken in the suite.

Official images are never committed. Expectations use formats rather than
printing live lookup credentials. An official sample that cannot be downloaded,
rendered, or read to its declared minimum anchor count is reported as `SKIP`.

## On-device suite

`ApositifyDeviceTests` runs the same corpus through the app's own
`ApostilleRecognizer` on a physically attached iPhone. Apple Vision on the
device is not the Vision that runs on a Mac — different OS, different models —
so this suite cannot be replaced by the host-side one. It asserts the values
printed on certificates that were read and confirmed by eye, and logs a line
per specimen so a regression in one without expectations is still visible.

Several specimens have item 8 blacked out or filled with placeholder Xs, so a
blank field there proves nothing about the parser. `npm run
prepare:redaction-fixtures` renders a known value onto the item's own row,
positioned from the OCR geometry of its numbered label, and the tests assert
that exact value comes back.

Specimen photographs are private and are never committed. Both device suites
skip when they are absent.

```sh
npm run prepare:redaction-fixtures   # optional, needs the private specimens
npm run test:ios-device              # requires an unlocked device in developer mode
```

The Android equivalent is `AllSpecimensRecognitionTest`, which sweeps the same
corpus through ML Kit on a connected device.

## Run

```sh
npm run test:ios-samples
```

This always runs the artificial fixtures. Official samples run when present in
the local cache and otherwise skip.

To populate or refresh the official sample cache:

```sh
npm run fetch:ios-samples
npm run test:ios-samples
```

To run every web, data, iOS core, and OCR regression:

```sh
npm run test:all
```

Apple Vision can be unavailable inside a restricted CI sandbox. A
`CVPixelBuffer` service failure is reported as a skip; malformed required
fixtures and ordinary OCR/parser regressions still fail.
