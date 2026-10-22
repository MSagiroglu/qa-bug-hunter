---
description: Compare two implementations of the same product (legacy vs rewrite) and report differences (QABlindspot / senior-qa-explorer)
argument-hint: <module, feature or flow present in both implementations>
---

Use the `senior-qa-explorer` skill in **Parity mode** (see `references/core/parity-sweep.md`, on top of the Sweep phases).

Target: $ARGUMENTS

If the target above is empty or ambiguous, ask me which module or flow to compare, which side is the reference
(old) and which is under test (new), and which environment serves each. Do not start before that is clear.
Use one fresh `TEST_` fixture for both sides, classify every difference as NEW-ONLY / BOTH / INTENDED /
REFERENCE-ONLY, label comparison images by environment, and list already-tracked tickets before filing anything.
Build the coverage matrix from `references/core/parity-coverage-matrix.md` first (every tab/dialog x search, each filter, date range, pagination, export file diff, icon-only buttons, row actions, navigation, empty states per tab/filter/search, roles incl. direct URL, responsive) and end the report with it plus a "not tested" list. A second pass because the first skipped icons, buttons or empty states means the matrix was incomplete.
