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

## Applying this catalog

1. From discovery, get the field's real type and constraint.
2. Pick only the mutations from this list that are meaningful for that
   constraint (a field with no stated max doesn't get a "max+1" test —
   it gets flagged as "no upper bound found, worth an oversized-value probe
   only if downstream storage/rendering could be affected").
3. Prioritize per `test-design-techniques.md` before executing.
