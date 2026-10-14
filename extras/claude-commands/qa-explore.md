---
description: Run a systematic exploratory QA sweep of a module or URL (QABlindspot / senior-qa-explorer)
argument-hint: <module, feature or URL>
---

Use the `senior-qa-explorer` skill in **Sweep mode** (the default 7-phase pass).

Target: $ARGUMENTS

If the target above is empty or ambiguous, ask me which module, feature or URL to test before starting
Phase 1. Work only on environments I am allowed to test, use `TEST_` data created in this run, and write
the report and tickets as the skill describes.
