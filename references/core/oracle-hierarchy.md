# Oracle Hierarchy

An "oracle" is how you decide what the *correct* behavior is, so you can
tell whether an observation is a bug. Without one, "unexpected behavior"
and "bug" get conflated — most unexpected behavior is actually just
undocumented, not wrong.

## Priority order (use the highest one available)

1. **Explicit acceptance criteria** for this feature (ticket, spec, PRD).
2. **Existing requirements/documentation.**
3. **Backend/API contract** (schema validation, documented request/response
   shape).
4. **Database constraints** (column type, nullable, unique, FK) if
   visible, *and* — when a connection is already available
   (`references/core/database-verification.md`) — the actual current row-level state,
   read directly rather than inferred through an API/UI re-fetch that
   could itself be wrong.
5. **Source-code validation / business rules** (what the code actually
   enforces, even if undocumented).
6. **Existing automated tests** — they encode a prior decision about
   correct behavior, even an implicit one.
7. **Consistent behavior elsewhere in the application** (how does an
   analogous field/flow behave elsewhere in this same app?).
8. **Domain convention** (how would this normally work in this kind of
   system?).
9. **QA inference** — your own judgment, lowest confidence.

## Rule

State which oracle level you used for every finding. When the strongest
available oracle is level 7 or below, the finding is not a confirmed
defect — classify it as **"Potential Defect / Behavior Requiring
Clarification"** (see `references/core/defect-classification.md`), and say explicitly what
oracle level you used and why you couldn't get higher.

Do not silently upgrade an inferred expectation into an asserted
requirement. "I expected X because that's the domain convention" and "the
spec requires X" are different claims — keep them distinguishable in the
report.

## Common trap

Frontend/backend validation mismatch is not automatically a defect by
itself — check which side is the actual source of truth for this system
(sometimes frontend-only validation is a deliberate UX choice and the
backend intentionally trusts the frontend for internal, low-risk tools).
Use discovery + oracle levels 3-5 to decide, don't assume mismatch = bug.
