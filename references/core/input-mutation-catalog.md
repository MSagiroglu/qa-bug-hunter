# Input Mutation Catalog

Candidate mutations per semantic input type. **Gate every mutation on
something discovery actually found** (the field's real type, constraint, or
business rule) — this list is a menu, not a script to run unconditionally.
Applying every mutation to every field produces noise, not signal.

## Select / multi-select / autocomplete

See `references/lenses/web/select-controls.md`. Minimum set: 0, 1, 2, 6, many and
"select all" selections; clear one value; clear all; a long label; a search term
with partial/uppercase/diacritic/no-match variants; open near the bottom of the
viewport; open at 320 px and in landscape.

## String

- empty, whitespace-only
- exactly at minimum length (if any), one under
- exactly at maximum length (if any), one over
- Unicode / non-Latin script the UI is expected to support (e.g. Turkish
  characters in a Turkish-locale app)
- special characters (`<`, `>`, `&`, quotes, SQL-metacharacters) — relevant
  when the field feeds into rendering, storage, or a query without visible
  sanitization
- leading/trailing whitespace
- extremely long value, well beyond any stated max
- **XSS payloads**: `<script>alert('XSS')</script>`,
  `<img src=x onerror=alert('XSS')>`, `<svg onload=alert('XSS')>`,
  `javascript:alert('XSS')` — test if field escapes/renders HTML
- **HTML injection**: `<button>Click</button>`, `<a href="http://evil.com">link</a>`,
  `<iframe src="http://evil.com">` — test if arbitrary HTML renders
- **SQL fragments**: `' OR '1'='1`, `'; DROP TABLE users--`,
  `1; UPDATE users SET role='admin'` — test if field is SQL-injection safe

## Integer

- min, min − 1, min + 1 (if a range is known or inferable)
- max, max − 1, max + 1
- zero, negative
- decimal value in an integer field
- non-numeric string in a numeric field
- empty / null

## Decimal

- zero, negative
- min/max as with integers
- excessive decimal precision beyond what the field/DB column supports
- scientific notation, if the input could plausibly receive it (API-level
  testing, not typically a UI-typed value)

## Date

- empty, invalid date string
- past / today / future, relative to what the field semantically allows
- start date after end date, start date equal to end date (for range pairs)
- min/max date if the domain implies one (e.g. cycle boundaries)

## Enum / dropdown

- every valid option (at least once, not per-scenario)
- no selection, when the field is optional vs. required
- an invalid option value sent directly to the API, bypassing the UI's
  restriction to valid options — this is the actual test; iterating the
  UI's own dropdown options is usually low-yield since the UI already
  constrains it
- combinations where one dropdown's valid options depend on another
  field's value — see **Field Dependency / Cascading Fields** below for the
  general case beyond dropdowns

## Email

- valid email
- missing `@`, missing domain, multiple `@`
- leading/trailing spaces
- case sensitivity, if uniqueness/lookup is case-sensitive server-side

## Cross-Field & State Mutations

- **Field dependency / cascading fields** (mandatory whenever discovery finds
  one): any field whose value visibly changes another field — reveals/hides
  it, changes its required-ness or validation rule, repopulates its options,
  or changes its format (country → city list, phone format, tax-id pattern,
  currency symbol; plan type → available add-ons; date range → which fields
  become required). For each driver value: (1) re-run the dependent field's
  own mutations (empty, boundary, invalid) *after* the driver has changed, not
  only once with the default driver value; (2) change the driver a second
  time after the dependent field already has a value, and check that stale
  value is cleared, re-validated, or flagged, not silently kept; (3) submit
  with the driver changed back and forth rapidly (the cascade may be async
  and race). A field that passes every mutation in isolation can still break
  only once its dependency fires — do not consider a form covered until every
  driver → dependent relationship discovery found has been exercised at least
  once in this sequence.
- **Empty form submission**: submit with all fields empty/default — highest
  yield test for backend validation gaps
- **Data collision**: use ONLY `TEST_*` records created in this run to test
  uniqueness constraints, cascade behavior, and reference integrity
- **Type confusion in wrong field**: string in number field, number in
  date field, HTML in plain text, URL in email field
- **Copy-paste with rich formatting**: paste from Word/Excel/HTML — test
  if the field sanitizes or passes through HTML/RTF
- **Unicode edge cases**: emoji, RTL text, zero-width characters,
  combining characters, normalization variants (café vs café)
- **Null byte injection**: \u0000 in strings — can truncate at DB layer
- **Whitespace attacks**: leading/trailing tabs, newlines, carriage returns,
  multiple consecutive spaces
- **Concurrent modification**: same record edited in two tabs/windows,
  second save overwrites first (lost update)
- **Stale state mutation**: read a record, another user edits it, first
  user saves over it (stale read)
- **API field overposting**: send unknown/extra fields to API endpoint,
  test if they get persisted (mass assignment)
- **API field underposting**: omit required fields, test backend validation
- **Empty file upload**: 0-byte file, wrong extension, oversized file,
  symlink in filename

## Submission-Flow Mutations (per form, not per field)

A compact, per-form checklist to run once the field-level mutations above are
done — these live in detail in other files; this is the one place that lists
all of them together so none gets skipped when handing a form to an agent:

- **Double-click / rapid repeated submit**: fire the submit action 2x then 5x
  in quick succession. In-flight guard, loading state, duplicate requests,
  duplicate records — `references/core/rapid-action-testing.md`,
  `references/core/critical-defect-patterns.md` ("Double-submit").
- **Browser back button after submit**: submit successfully, press Back, then
  Forward. Does the form re-show stale/submitted data as if unsaved, resubmit
  on Forward, or correctly land on the post-submit state? —
  `references/lenses/six-directions.md` direction 3,
  `references/invariants/overlay-dialog.md` (OV14) for forms inside a dialog.
- **Session/token expiry mid-fill**: fill the form, leave the tab idle past
  the session or token lifetime, then submit. Clean re-auth with no lost
  input, or a clear message — not a silent save failure, a raw 401, or the
  action running as a different/stale user — `references/core/perturbation-dimensions.md`
  ("Token or session expiry while backgrounded").
- **Cross-device / cross-browser**: the same form at mobile width and on
  whatever additional browser engines are available (see "Cross-Browser
  Verification" in `references/core/test-design-techniques.md`); mobile also
  needs `references/lenses/mobile/mobile-exploratory-considerations.md`.

## Applying this catalog

1. From discovery, get the field's real type and constraint.
2. Pick only the mutations from this list that are meaningful for that
   constraint (a field with no stated max doesn't get a "max+1" test —
   it gets flagged as "no upper bound found, worth an oversized-value probe
   only if downstream storage/rendering could be affected").
3. **Always run empty form submission** — it's the fastest way to find
   backend validation gaps with zero effort.
4. **Always test data collision** using only `TEST_*` data created in this
   run — it catches cascade/unique/reference issues without touching
   existing data.
5. **Always exercise every field-dependency chain discovery found** (a field
   that reveals, requires, repopulates, or reformats another) — see "Field
   dependency / cascading fields" above. A form with no such relationship
   skips this step; most forms with 2+ related fields have at least one.
6. **Always run the Submission-Flow checklist once per form**: double-click
   submit, back button after submit, session expiry mid-fill, cross-device —
   see the section above.
7. Prioritize per `references/core/test-design-techniques.md` before executing.
8. For write-capable features, combine with
   `references/core/advanced-exploratory-attacks.md` race condition scenarios.
9. Generating mutations with an AI tool: hand it this catalog as the
   baseline, explicitly ask it to (a) propose risks not in the list and (b)
   find field-dependency chains by reading the form, then review the result
   critically before executing — drop what does not apply to this form,
   keep what you know the product needs that the catalog missed. A generated
   list is a draft, never a script to run unreviewed.
