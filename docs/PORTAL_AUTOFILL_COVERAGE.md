# Does autofill actually populate each authority's portal?

Extraction accuracy — does the app read the right values off the certificate —
is covered thoroughly by the OCR suites and the on-device specimen tests. This
document is about the step *after* that: whether those reviewed values land in
the right boxes on the authority's own verification page.

That step had never been measured. The existing autofill tests
(`scripts/test-android-autofill.mjs`) run the shipping script against DOM
fixtures written by hand, and prove its *safety* properties — never fills a
CAPTCHA, never overwrites what the user typed, never touches password or file
controls, is idempotent across route changes. They prove nothing about whether
any real portal's markup is matched.

## How matching works

No authority shipped `browserSelectors`, so every match was heuristic: the
field's aliases are compared against a signal built from each control's
`name`, `id`, `placeholder`, `aria-label` and associated `<label>` text, and a
control matches when it *contains* one of the aliases. Most aliases are
English; most portals are not. When it fails it fails safe — nothing is filled
and the user types the value — but it fails silently.

## Measured coverage

`npm run audit:portals` fetches each authority's page and runs the shipping
autofill script against the real markup in jsdom. It is a survey, not a gate:
these are live third-party sites that change, rate-limit and geo-block, so it
is deliberately not part of `npm test`.

Static-HTML sweep of the 62 HTTPS portals, 30 August 2026:

| Outcome | Count |
| --- | --- |
| Every field filled | 14 |
| Some fields filled | 6 |
| Form present, nothing matched | 8 |
| Form not in static HTML (JS-rendered) | 17 |
| Unreachable, timeout or HTTP 403 | 17 |

So of the 28 portals whose form a static fetch can see, **half fill completely
and roughly a third fill nothing.** The 17 JS-rendered portals cannot be judged
this way at all — they need a real browser, which is what
`PortalAutofillTest` does on a connected Android device.

## What the failures are

Inspecting the non-matching portals shows they are not one problem:

- **Opaque control names.** Andorra's LANSA form labels nothing; its inputs are
  named `PONUMREG` and `PODTENTRS`. Alias matching had nothing to work with —
  while the names it needed were already in the catalogue as that authority's
  deep-link parameters. Those are now emitted as `browserSelectors` for all six
  deep-link authorities, which took Andorra from nothing matched to its number
  field filled.
- **Local-language labels.** Mongolia's control signal is Mongolian with only
  the bare word `number` in English; our aliases are longer phrases like
  "Reference number", and matching requires the alias to be contained in the
  signal, not the reverse.
- **Page-supplied defaults.** Andorra prefills its date box with today's date.
  The "never overwrite" guard then declines to correct it, so the user would
  submit today's date rather than the certificate's. The guard is right about
  user input and wrong about a page default, and it cannot currently tell them
  apart.

## Still to do

- Run `PortalAutofillTest` to completion on a connected device to cover the
  JS-rendered portals. The first attempt was cut short when the device dropped
  off USB after ten minutes; the test now logs each portal as it is measured
  rather than at the end, so a dropout leaves partial results.
- Decide what to do about page-supplied defaults.
- Consider matching a control when its signal is contained in an alias, not
  only the reverse, for portals whose labels are shorter than ours.
