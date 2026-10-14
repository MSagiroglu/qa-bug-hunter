# Second Opinion (Adversarial Pass)

Run after execution and before the report. Purpose: independence and bias control. An agent that holds a hypothesis tends to confirm it (confirmation bias). Re-read every CONFIRMED and POTENTIAL finding as a skeptic whose job is to **disprove** it.

## Per-finding checks

1. **Oracle**: is it really level 1-6 (`references/core/oracle-hierarchy.md`)? Quote the source. Does it rest on an unverified assumption from the register (`references/core/risk-register.md`)? If so, downgrade.
2. **Benign explanation**: environment, stale or seeded data, permissions of the test user, timing, or the automation itself (selector, wait, state leaked from an earlier scenario). Re-run from clean state to rule out.
3. **Duplicate**: same root cause as another finding? Merge; keep one ticket with all symptoms.
4. **Fix layer**: would a frontend-only fix just move the bug one layer down? Check whether API/DB still accepts the bad state; state the real fix layer.
5. **Severity**: re-apply the rubric in `references/core/defect-classification.md` from impact, not surprise.
6. **Reproduction**: re-run the steps at least 3 times (more if intermittent).

## Outcomes

- Survives all checks: keep category.
- Fails oracle or assumption check: **downgrade** CONFIRMED -> POTENTIAL or CLARIFICATION.
- Benign explanation holds: reclassify TEST ENVIRONMENT ISSUE, AUTOMATION ISSUE or NOT A DEFECT.
- Duplicate: merge.
- Record the reason for every change in one line (report section 5/6 or the ticket).

## Reproduction rate and flaky findings

- Any finding with reproduction rate below 100% must state the rate and attempts, e.g. "reproduced 2 of 5 attempts".
- Flaky findings are labeled `FLAKY` and kept in the report. Never silently drop a non-repro finding; list conditions tried and what differed between runs.
- A flaky finding cannot be CONFIRMED unless the root cause is identified; otherwise POTENTIAL.

## Bias control

- Write the disproof attempt before re-reading your own notes of success.
- Prefer a different method than the original (API instead of UI, DB read instead of re-fetch).
- Count downgrades in the report; zero downgrades on a large run is a signal the pass was not adversarial.
- Do not upgrade anything in this pass.
