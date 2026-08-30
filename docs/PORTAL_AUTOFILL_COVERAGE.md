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
autofill script against the real markup in jsdom. `PortalAutofillTest`
(Android) and `PortalAutofillTests` (iOS) do the same thing in a real WebView
on a connected device, which is the only way to see the portals that render
their form in JavaScript. All three are surveys, not gates: these are live
third-party sites that change, rate-limit and geo-block, so failing the build
on their behaviour would make the suite lie about the app. Nothing is ever
submitted — the script fills controls and the harness reads them back.

Measured 30 August 2026, over the 62 authorities with an HTTPS portal.

| Outcome | Static (jsdom) | Android device |
| --- | --- | --- |
| Every field filled | 14 | 21 |
| Some fields filled | 6 | 12 |
| Form present, nothing matched | 8 | 16 |
| No controls seen | 17 not in static HTML | 13 |
| Unreachable / timeout / 403 | 17 | counted as no controls |

A real browser roughly doubles what can be judged, because it renders the
JavaScript portals a static fetch cannot see. On the device, **a third of
authorities fill completely and a fifth fill partially**; the remaining
quarter that match nothing are the work still to do.

### Treat per-portal numbers as coarse

The same page reports differently depending on the engine and how long it is
given to settle. Costa Rica's portal showed 13 controls under Android's
WebView, 4 in jsdom, and 3 under an early iOS harness. Aggregates are
informative; a single authority's row is not evidence on its own without
looking at the page.

### iOS is not yet measured

The first iOS device run reported 38 authorities as having no controls against
Android's 13. That was the harness, not the app: a `WKWebView` outside the view
hierarchy is throttled and may never lay out, so pages were measured before
they rendered. The harness now borrows the host app's window, but the corrected
run has not completed on a device, so no iOS figures are published here.

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
