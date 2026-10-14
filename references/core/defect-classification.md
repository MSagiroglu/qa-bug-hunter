# Defect Classification

## Categories

- **CONFIRMED DEFECT** — observed behavior contradicts an oracle at level
  1-6 (see `references/core/oracle-hierarchy.md`), root cause investigated (not just an
  assertion failure).
- **POTENTIAL DEFECT** — suspicious behavior, oracle confidence at level 7
  or below, or investigation couldn't fully confirm root cause.
- **BEHAVIOR REQUIRING CLARIFICATION** — no confident oracle available
  either way; genuinely ambiguous whether this is intended.
- **TEST ENVIRONMENT ISSUE** — reproduction points to environment/data
  state, not application logic.
- **AUTOMATION ISSUE** — the test itself was wrong (bad selector, timing,
  stale assumption about the UI).
- **NOT A DEFECT** — investigated and behavior is correct per the oracle.

Never report a finding without picking one of these. "Something seemed off"
is not a category.

## Severity

Base severity on business impact, not on how surprising the behavior felt.

- **Critical** — data corruption/loss, security/authorization bypass,
  workflow completely blocked for a user class.
- **High** — incorrect data accepted/persisted, wrong calculation, broken
  core workflow with a workaround.
- **Medium** — validation gap with limited blast radius, incorrect
  non-critical message, recoverable inconsistent state.
- **Low** — cosmetic, edge case with negligible real-world likelihood.

## Required fields for a CONFIRMED or POTENTIAL defect

- Title
- Severity (+ one-line justification tied to the rubric above)
- Module / feature
- Preconditions
- Steps to reproduce (exact, minimal)
- Test data used
- Expected result + which oracle level it came from
- Actual result
- Evidence: **actual saved files** per `references/core/evidence-capture.md` — screenshot,
  video or trace recording when the execution tool supports it (see
  `SKILL.md` Phase 5 for what to do when it's supported but disabled —
  ask the user before proceeding, don't just note it at the end), console
  errors, network request/response (status + payload), all as files at a
  real path, not prose describing them — plus relevant source file/line
- Root cause hypothesis (if investigation reached one)
- Confidence (how sure are you this reproduces reliably)

## Rules

- Never classify from an assertion failure alone — `SKILL.md` Phase 4's
  investigation step must run first.
- Reproduce before classifying as CONFIRMED. A one-off flaky observation is
  POTENTIAL at most until reproduced.
- When investigation is inconclusive, say so and classify at the lower
  confidence category rather than rounding up to CONFIRMED.
