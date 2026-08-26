# Input Mutation Catalog

Candidate mutations per semantic input type. **Gate every mutation on
something discovery actually found** (the field's real type, constraint, or
business rule) — this list is a menu, not a script to run unconditionally.
Applying every mutation to every field produces noise, not signal.

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
  field's value (test the dependency, not just each dropdown alone)

## Email

- valid email
- missing `@`, missing domain, multiple `@`
- leading/trailing spaces
- case sensitivity, if uniqueness/lookup is case-sensitive server-side

## Cross-Field & State Mutations

- **Empty form submission**: submit with all fields empty/default — highest
  yield test for backend validation gaps
- **Existing data collision**: use data already in the system to test
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

## Applying this catalog

1. From discovery, get the field's real type and constraint.
2. Pick only the mutations from this list that are meaningful for that
   constraint (a field with no stated max doesn't get a "max+1" test —
   it gets flagged as "no upper bound found, worth an oversized-value probe
   only if downstream storage/rendering could be affected").
3. **Always run empty form submission** — it's the fastest way to find
   backend validation gaps with zero effort.
4. **Always test existing data collision** if DB access is available —
   it catches cascade/unique/reference issues without data generation.
5. Prioritize per `test-design-techniques.md` before executing.
6. For write-capable features, combine with
   `advanced-exploratory-attacks.md` race condition scenarios.
