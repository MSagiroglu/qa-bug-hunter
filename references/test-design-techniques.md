# Test Design Techniques

Use these to decide *what* to test, not to justify testing everything.
Prioritize by risk, business impact, complexity, number of dependencies, and
data-integrity/security implications — a small set of well-chosen scenarios
beats a large set of arbitrary ones.

## Equivalence Partitioning (EP)

Split each input's possible values into partitions that should behave the
same way (valid range, below-range, above-range, wrong-type, empty). Test
one representative value per partition rather than every value in it.

## Boundary Value Analysis (BVA)

For any range found in discovery (min/max from schema, UI constraint, API
contract, or domain semantics), test:

```
min - 1, min, min + 1, max - 1, max, max + 1
```

If no explicit range exists, infer one from the field's DB type, UI
constraint, or domain convention, and **label it as inferred**, not
confirmed — see `oracle-hierarchy.md`. Don't report an inferred boundary
violation as a confirmed defect.

## Decision Table Testing

Use when a feature's behavior depends on a combination of conditions (e.g.
role + status + date-range). Build a table of condition combinations and
expected actions; test combinations most likely to be under-handled
(usually the ones the implementation's conditional logic doesn't explicitly
branch on).

## State Transition Testing

Use for anything with a lifecycle (draft → submitted → approved → closed,
etc.). Test: valid transitions, invalid/skipped transitions, transitions
attempted twice, and transitions attempted from a stale/cached state
(e.g. after another tab or user changed the state).

## Pairwise / Combinatorial Testing

Use only when a feature has several independent fields that can combine
(e.g. goal type × measurement type × employee role) and testing every
combination is infeasible. Cover each pair of values at least once instead
of the full cross-product.

## Error Guessing

Apply domain experience and the "what could go wrong here" prompts below
after any significant action:

- What happens if this action is performed twice, rapidly, or out of order?
- What happens if the backend receives something the UI normally prevents?
- What happens if a valid value becomes invalid after another field
  changes?
- What happens if the operation partially succeeds (network drop
  mid-request, duplicate submit)?
- What happens on cancel-and-reopen, refresh mid-flow, or browser
  back/forward?

## Responsive / Viewport Testing (web)

For any screen with a viewport-dependent layout, resize/test at minimum:
narrow mobile width (~375px), tablet (~768px), and standard desktop
(~1280px+). At each size, confirm the critical actions for the feature
under test (submit button, validation/error messages, primary CTA) are
still reachable and visible — not clipped, not pushed below the fold, not
hidden behind a collapsed nav that never gets checked. Also check for
horizontal scroll/content overflow, which usually indicates a fixed-width
element that wasn't meant to be there. This is cheap to run (a viewport
resize, not a new device) and frequently uncovers layout defects nobody
uses a debugger to find because they never manually resize the window.

## Interrupted-Write / Persistence Verification

See `critical-defect-patterns.md` — for any feature that writes data, never
classify a write as successful based on the UI's own success signal alone.
Run the interrupted-write scenarios there (refresh mid-write, network drop
timed to the write, double-submit, throttled connection) and verify actual
persistence independently of what the UI displayed.

## Exploratory Testing

After scripted scenarios, spend a bounded amount of effort deviating from
the model: try the workflow in an order a user actually might but the
happy-path spec didn't anticipate. Time-box this — exploratory testing
without a stop condition doesn't converge into a report.

## Negative Testing (cross-cutting)

Apply across all of the above: required fields left empty, wrong data
type, values outside allowed range, values over/under length limits,
duplicate submissions, incomplete form submitted, dependent fields changed
out of order.

## Prioritization

Before executing, rank candidate scenarios by:

1. Business impact if broken (data integrity, money, permissions > cosmetic)
2. Complexity / number of dependencies (more moving parts → more likely to
   have an untested interaction)
3. Whether frontend and backend validation appear to diverge (see
   `discovery.md` §3 — this is the highest-yield signal)
4. Security implications (authorization, data leakage between users)

Execute the top of that ranking first. Stop generating more scenarios once
you're producing variations that don't change the risk profile.
