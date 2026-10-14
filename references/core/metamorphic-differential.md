# Metamorphic, Differential and Property-Based Testing

Use when there is **no oracle**: nobody can tell you the exact correct
output, but you can say how two outputs must relate. The relation itself
becomes the oracle.

## When there is no oracle (metamorphic relations)

Change the input in a way whose effect on the output is known, then check
the relation. A violation means at least one of the two runs is wrong.

| Relation | Check |
|---|---|
| Reorder inputs | Same result (filters applied in another order, fields filled in another order, items added in another order) |
| Add then remove | State returns to the original (invariant: count, totals, list contents) |
| Search "AB" is a subset of search "A" | Every result of the narrower query appears in the broader one |
| Filter, then clear filter | Original list, same order, same count |
| Sort ascending vs descending | Reverse of each other (ties aside) |
| Page 1 + page 2 vs page size doubled | Same items, no duplicates, no gaps |
| Case/whitespace variants of a query | Same results where the product claims to be case-insensitive |
| Create, delete, re-read | Record absent, aggregates restored |
| Export vs on-screen data | Same rows and totals |

Procedure: pick the relation, capture both runs (UI or API), compare,
attach both raw results. Verify with a re-read before reporting
(`api-ui-crosscheck.md`).

## Differential / parity

Run the same request through two paths and expect equivalence, or a
**defined** difference.

- Two roles: same read, different sessions. Expect equal bodies or a
  documented difference (see `authz-matrix.md`).
- Two clients: web vs mobile vs API for the same data. Same totals, same
  rounding, same status labels.
- Old vs new build: same inputs against two deployments you own. Every
  unexplained difference is a lead (regression or intended change).
- Two locales or timezones: the data is the same, only the format differs.

Undefined differences are leads, not defects. Ask what the intended
difference is before escalating.

## Property-based

Generate many inputs **inside the constraints you discovered** (min/max,
formats, enums; see `test-design-techniques.md`), assert an **invariant**
for each, and **shrink** a failing input to the smallest one that still
fails, so the report holds a minimal reproduction.

- JS or TS project: `fast-check`. Example: `fc.assert(fc.property(fc.array(fc.string()), (xs) => sameResult(xs, [...xs].reverse())))`. fast-check shrinks automatically and prints the seed; record the seed.
- Other stacks: describe the property and the generator, and use the library already in the project (Hypothesis, jqwik, and similar). Otherwise do it by hand: 20-50 inputs, then bisect the failing one by removing parts.
- Keep generators inside valid ranges first; stepping outside them is boundary testing, a separate design step.
- Own `TEST_` data only; low volume against shared environments.

## Classify every finding

State the oracle per `references/core/oracle-hierarchy.md`. A metamorphic
or differential violation with no requirement behind it is level 7-9 at
best, so classify it as **Potential Defect / Behavior Requiring
Clarification** until a requirement, contract or rule (level 1-5) confirms
which side is wrong. Write the relation as the expected result, quote both
observations, and say which side you believe is wrong and why.

Template: `templates/playwright/metamorphic.ts` (`checkRelation`).
