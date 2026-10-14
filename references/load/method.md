# Load Testing Method

Generic method for controlled load and resilience checks. Product-specific numbers (throttle limits, ceilings, critical flows) live in a private per-environment profile, never in this repository.

## Tool decision

| Option | Verdict | Reason |
|---|---|---|
| k6 (API layer) | Chosen | Scripted stages, thresholds, custom counters, JSON summary, built-in dry-run discipline via our gate |
| Playwright (one observer user) | Chosen, complementary | Checks UX invariants (message shown, modal closes, list in sync) while k6 load runs |
| Artillery | Considered | Similar capability, weaker threshold support |
| JMeter | Considered | Heavy, GUI/XML driven, harder to review in git |
| Playwright alone | Rejected | Weak concurrency; browsers are expensive per virtual user |

## Roles

- **API load (k6):** generates traffic through the templates in `templates/k6/`, all guarded by the safety gates.
- **UI observer (Playwright):** exactly one real browser user running a critical flow while load is applied. It never generates load.

## Outputs

1. k6 summary JSON (`k6 run --summary-export=summary.json ...`)
2. Playwright trace of the observer session
3. Findings table: `ID | Check | Observed | Threshold | Severity | Evidence`

## Mandatory report fields

A load report is invalid without all of these:

- Environment (as stated by the user in chat)
- Time window
- Approver (name of the person or team who approved, for shared environments)
- VU / request ceiling used
- Number of accounts used
- Cleanup proof (count of `TEST_` records before, created, after cleanup)

Related: `scenarios.md`, `assertions.md`, `safety-gates.md`.
