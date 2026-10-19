# Calculation Verification (computed values and cross-surface consistency)

Use when the product derives numbers: scores, averages, totals, percentages, weights, balances, counts, status roll-ups. A wrong figure looks plausible, so eyeballing finds nothing. The oracle is **the code's own formula plus a hand calculation on real data**.

## 1. Derive the formula from source, not from intuition

1. Find every place that computes or aggregates the value (service, repository, controller, store, SQL). List them.
2. Write the formula for each in one line: what is summed, what is divided, which records are included or excluded (status filters, nulls, soft-deleted, dates), rounding, null-as-zero or null-skipped, weighted or equal.
3. If two places compute "the same" value differently, record both formulas side by side. Different definitions (per goal vs per person, with vs without unrated items) are **not** defects until the product says one number is wrong; classify as BEHAVIOR REQUIRING CLARIFICATION with the two formulas quoted. Do not assume which definition is "expected".
4. State the oracle level for the formula (`references/core/oracle-hierarchy.md`). A formula read from the shipped code is level 3-4 evidence of intended behavior, not of correctness.

## 2. Hand-calculate on a real fixture

1. Build a fixture where inputs are distinct and easy to check (different weights, one unrated item, one excluded status, a boundary value on a band edge).
2. Use at least **four actors** (for example four employees under one manager, plus the manager's own record). One actor can pass by luck; mixed cases expose the formula.
3. Compute the expected value for every actor and every aggregate by hand, write the working in the report, then compare with every surface.
4. Include: zero items, one item, all unrated, partly rated, an item added with zero weight, an item removed, a value exactly on a band boundary, and a change of an input followed by a re-read.

## 3. Cross-surface consistency matrix

| Surface (employee, manager, admin, report, export, API) | Value shown | Expected | Match |
|---|---|---|---|

Fill one row per surface that displays the figure. A mismatch between surfaces that claim the same definition is a finding. Check visibility rules separately (who may see the figure, from which date); see the role chain probe in `references/core/parity-sweep.md`.

## 4. Do not assume the expected value

- A number that differs from your mental model is first a question about your model. Read the code path before writing "expected X" in a ticket.
- When the code shows the behavior is by design, say so and drop or reframe the finding (NOT A DEFECT, or CLARIFICATION with the question for the product owner). Filing it as a defect costs the team time and your credibility.
- When root cause is claimed, verify it with a controlled change (`references/core/second-opinion.md`, "Causal attribution").

## 5. Typical defect classes this finds

- Aggregate counts items that the per-person figure excludes (or the reverse).
- Null treated as zero in one place and skipped in another.
- Band or scale label missing or wrong at the upper boundary.
- Visibility date or window gate applied on one surface but not another.
- Stale figure after an input changes (no recompute) until a manual reload.
- Raw or unlocalized label in place of a band name (see `references/core/render-leak-scan.md`).
