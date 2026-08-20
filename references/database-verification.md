# Database-Level Verification

`critical-defect-patterns.md`'s ghost-success check verifies persistence
by re-fetching through the UI/API. That's good evidence, but it's not the
strongest available: if the API layer itself has a caching bug, a
re-fetch can agree with a wrong UI state and both be wrong together —
you'd conclude "persisted correctly" when the actual database row never
changed. When a database connection is genuinely available, this file
covers using it as a stronger, independent oracle.

## When this applies

Only when DB access is already available to you — a connection string in
the target's own config/`.env` for a test/staging environment, a
migration tool, an ORM console, or credentials the user has explicitly
provided for this purpose. Never treat "I could figure out how to connect
to their database" as available access. If it's not sitting there ready
to use, this file doesn't apply — fall back to API/UI re-fetch and note
in the report that DB-level verification wasn't available for this run.

## Read-only, always

This skill verifies state; it does not set up or repair it. Only ever
issue read queries (`SELECT` or equivalent) directly against the
database. If a scenario needs data seeded or cleaned up, do that through
the application's own API/UI — the same business logic layer a real user
goes through — never via direct writes that bypass it. A direct DB write
"to save time" defeats the entire point of testing the app's actual write
path, and risks leaving the database in a state the application itself
would never produce.

## What it strengthens

- **Ghost-success verification** (`critical-defect-patterns.md`): after a
  write operation, query the relevant row(s) directly instead of only
  re-fetching through the API. This is the strongest oracle available for
  "did this actually persist" — stronger than API re-fetch because it
  doesn't share any code path with the thing that might be lying (a
  caching layer, a read-replica lag, a serialization bug that only
  affects the read side).
- **Impact analysis** (`impact-analysis.md`): when checking whether a
  deleted/deactivated entity's existing references were handled per the
  intended rule (cascade / orphan-safe / delete-blocked), querying the
  actual foreign-key state directly confirms it rather than inferring it
  from what a UI screen happens to show.
- **Oracle hierarchy** (`oracle-hierarchy.md`): a direct, read-only query
  against the actual current state of a relevant table sits at the same
  level as level 4 (database constraints) when used for confirming actual
  data state, not just schema — cite it explicitly as the oracle when
  used, the same as any other level.

## Evidence

Save the query and its result the same way as any other evidence
(`evidence-capture.md`): a `db-query-<n>-<label>.json` or `.txt` file in
the run's evidence folder, containing the query text and the returned
row(s) relevant to the finding — not a full table dump, just what's
needed to support the specific claim being made.
