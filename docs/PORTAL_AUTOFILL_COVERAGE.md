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

| Outcome | Static (jsdom) | Android device | iOS device |
| --- | --- | --- | --- |
| Every field filled | 14 | 21 | 12 |
| Some fields filled | 6 | 12 | 6 |
| Form present, nothing matched | 8 | 16 | 9 |
| No controls seen | 17 not in static HTML | 13 | 35 |

The two devices disagree wildly on the last row and agree almost exactly on the
rest. The iOS run was made over a phone connection that timed out or failed to
resolve a great many hosts — the log is full of `NSURLErrorTimedOut` (-1001)
and `cannot find host` (-1003) — so most of that 35 is the network, not the
app. Comparing only the portals each run could actually reach:

| Share of reachable portals | Android (49) | iOS (27) |
| --- | --- | --- |
| Every field filled | 43% | 44% |
| Some fields filled | 24% | 22% |
| Nothing matched | 33% | 33% |

**Two independent engines, over different networks, agree that about two in
five authorities fill completely and a third fill nothing.** That is the
finding: the remaining third is real work, not measurement noise.

### The audit under-reports

The app re-runs its script on every DOM mutation for ten seconds, so a form
that mounts after the page settles is still filled. The audit injected once,
and so reported those pages as partial or unmatched. Ontario is the clearest
case: the audit calls it 1/2, while driving the real app to the live portal
fills both fields. The audit now injects twice, but every figure here predates
that and should be read as a floor.

### Treat per-portal numbers as coarse

The same page reports differently depending on the engine and how long it is
given to settle. Costa Rica's portal showed 13 controls under Android's
WebView, 4 in jsdom, and 3 under an early iOS harness. Aggregates are
informative; a single authority's row is not evidence on its own without
looking at the page.

### One authority the platforms genuinely disagree on

Costa Rica fills 2/2 in jsdom, 1/2 on Android — which saw 13 controls — and
0/2 on iOS, which saw 3. Both device runs reached the page, so this is not
reachability: the two platforms ship separate matcher implementations, and this
is the clearest evidence yet that they do not behave the same on the same page.
It is the next thing to look at.

## What the failures are

Reading the markup of every portal that matched nothing shows they are not one
problem, and only some of them are the app's to solve.

**The page has no verification form on it.** The United Kingdom's
`gov.uk/verify-apostille` carries a site search, two feedback boxes and a
honeypot input labelled "this field is for robots only" — the service itself is
behind a start button. Saint Kitts and the Dominican Republic offer only a
WordPress search box. No matcher can fix a URL that does not point at the form;
these need better `registerUrl` data.

**The control is named after the field, without the spaces.** New York's input
is `txtDocumentNumber`; Colombia's date is `ctl00_contenido_tbFechaExpedicion`.
The words are all there. Comparing without spaces, connecting words, or the
parenthetical notes our labels carry — "Fecha de Expedición (Issue date)" — now
matches these. It is stricter than word matching rather than looser: the
control's own name has to spell the alias out.

**The control name says nothing.** Kentucky's inputs are `tReqID` and `tOrder`;
Andorra's were `PONUMREG` and `PODTENTRS`. Andorra was recoverable because those
names were already in the catalogue as its deep-link parameters. Kentucky's are
not recoverable from anything we hold.

**The portal's language is not ours, and its words are shorter.** Mongolia's
input is named `number` with a Mongolian label; our alias is "Reference number".
Matching the other way round — accepting a control whose signal is contained in
an alias — would match a phone number or an ID box just as readily, so this is
left alone.

### A hazard the audit found on the way

The matcher tested whether a control's signal *contained* an alias, as a plain
substring. "date" is inside "validate", and "validate" appears on a great many
verification forms. A page with a control named `validateCertificate` could
therefore receive the certificate's date. Both platforms now require the alias
to appear delimited.

Tightening that cost about three fills across the corpus, which is the point:
those were matches by accident, as likely to have been the wrong box as the
right one. Aggregate coverage is roughly flat as a result — the gains from
deep-link selectors, page-default correction and run-together matching paid for
the accidental matches that were removed.

### Copying is the answer for the rest

Autofill can only match an authority's form by what that authority calls its own
controls, and a third of the corpus names them something the reviewed values
cannot be matched against. Those pages are still the official verifier, so the
Android verifier now shows the reviewed values as a row of chips above the page:
one tap copies a value, ready to paste. It needs no agreement with the portal's
markup, so it works on the third that will never match — and on a portal that
reloads its form after a CAPTCHA.

## Still to do

- Point `registerUrl` at the actual form for the authorities whose landing page
  carries no verification controls at all.
- Work out why Costa Rica fills on Android and in jsdom but not on iOS.
- Consider authored selectors for the handful whose control names carry no
  signal, in the way Andorra's came from its deep link.
