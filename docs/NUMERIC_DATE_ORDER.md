# Reading a numeric date

`12/07/2019` is either 12 July or 7 December, and the certificate does not say
which. About two dates in five are ambiguous this way — any date whose day is 12
or lower — so this is a common case, not an edge one.

The two apps used to disagree about it. iOS refused to interpret an ambiguous
date and returned nothing, leaving the field blank with no sign of what had been
read. Android committed silently, using a table that assumed day-first
everywhere except the United States.

## What the app actually needs

Of the 54 date fields in the catalogue, **52 submit the date exactly as
printed.** For those, whether the value means July or December changes nothing
about what is typed into the verifier's form. The date needs to be *recognised*,
not *interpreted*, and iOS was blanking the field to settle a question the form
never asks.

Interpretation is genuinely required in only two places:

- a field with a declared output format — Costa Rica (`date-iso`) and Ukraine
  (`date-dotted`) are the only two;
- filling a browser `<input type="date">`, which needs an ISO value.

## Where an order comes from

When the date does have to be interpreted, the order is taken from the
strongest evidence available. Nationality is the last resort, not the first.

1. **A component above 12.** `25/12/2021` can only be day-first.
2. **The authority's declared format.** Four authorities print their own order
   inside the field label — `Date (DD.MM.YYYY)` (Azerbaijan), `Issue date
   (DDMMYYYY)` (China), `Fecha de Emisión (DD/MM/YYYY)` (Spain), `Date Printed
   (MM-DD-YYYY)` (Washington State) — and `date-dotted` declares day-first. This
   is the issuing authority stating the format of its own certificate, which
   beats any assumption made from the country it sits in.
3. **Another date on the same page.** One page is printed by one authority in
   one order, so an unambiguous date elsewhere on it settles the ambiguous one.
4. **The country.** Day-first almost everywhere; month-first for the United
   States; and *unknown* for the three jurisdictions that use both orders in
   everyday writing.

## The country table

Day-first is the convention in roughly 178 countries. Month-first is limited to
a handful. Three of the catalogue's 64 jurisdictions use both orders, so their
nationality decides nothing and the date must not be interpreted from it:

| Jurisdiction | Orders in use | Has a date field |
| --- | --- | --- |
| United States of America | MDY | yes — resolved month-first |
| Philippines | MDY and DMY | no |
| Saudi Arabia | MDY and DMY | yes — never resolved by country |
| Israel | MDY and DMY | yes — never resolved by country |

Sources: [List of date formats by country](https://en.wikipedia.org/wiki/List_of_date_formats_by_country),
[Date and time notation in the Philippines](https://en.wikipedia.org/wiki/Date_and_time_notation_in_the_Philippines).

Countries that use YMD alongside DMY — China, Japan, Korea, Mongolia, Canada,
the Baltics and others — need no special case: a four-digit year leading the
date is already unambiguous.

Saudi certificates may also carry a Hijri date. `15/03/1447` is a plausible
Gregorian date and no day/month order can rescue it; that remains unhandled.

## What is left

Where the date must be interpreted and nothing resolves the order, both
readings are offered and neither is confirmed. A better answer is to prefill
the likelier reading and keep the other one tap away, which needs a
"confirmed value *with* alternatives" shape that neither parser returns today.
