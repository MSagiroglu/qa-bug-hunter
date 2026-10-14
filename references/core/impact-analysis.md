# Impact Analysis (Ripple-Effect Testing)

Most exploratory testing stops at the feature it was pointed at. Some of
the highest-value defects live one hop away: a change to a shared
record — a library entry, a config toggle, master data — that other
screens or services read but don't correctly reflect. Example: a "goal
library" entry gets deactivated; does the goal-creation screen's "pick
from library" dropdown correctly stop offering it, while goals already
created from it stay intact? Nothing in a feature-scoped test catches
this class of bug, because the defect isn't *in* the feature you changed
— it's in a consumer you never looked at.

## Trigger — automatic, not opt-in

During Phase 1 discovery, after identifying the target entity's backend
representation (DB table/model), classify it:

- **Shared** — referenced by other tables (FK), queried by other API
  controllers/services beyond its own CRUD endpoint, or fetched by more
  than one distinct frontend component. Library/reference/master-data
  entities are almost always shared.
- **Leaf** — nothing else reads it.

If shared, run the rest of this file as part of the same pass — don't
wait to be asked separately. If leaf, skip it; forcing this analysis on
every feature regardless of shape produces noise, not defects (same
YAGNI principle as everything else in test design).

## Consumer discovery (source available)

Find, for the target entity:

1. Other DB tables with a foreign key into its table.
2. Other API controllers/services that query it beyond its own CRUD
   endpoint.
3. Every distinct frontend component/directive that calls whatever
   data-service method(s) fetch it — grep for the method name across the
   whole frontend, not just the feature you started in. Each distinct
   caller is one consumer surface.

If source isn't available, use `references/core/blackbox-discovery.md`'s consumer-mapping
method instead — same output (a list of consumer surfaces), different
technique to get there.

## Verification matrix

For each consumer surface found, test the entity's state transitions
against what that surface should do:

| Entity state | Expected in each consumer surface |
|---|---|
| **Created** | Appears where it should, without requiring a manual refresh/cache-bust a real user wouldn't know to do |
| **Edited** | Updated fields reflect everywhere it's displayed — not just the canonical/owning screen. A consumer showing a stale copy of a since-edited name/value is a real, common bug class |
| **Deleted** | Removed from selectable/listing UI. Existing records that already reference it are handled per *some* defined rule (cascade delete / orphan-safe / delete blocked while in use) — figure out which rule the system actually implements and verify that's the one that happens, not just whatever happens to happen |
| **Deactivated** | Excluded from "available to add new" pickers, but records already created from it before deactivation remain intact and visible — deactivating shouldn't retroactively break history |

This table *is* the new content Phase 3 (test design) generates for a
shared entity — these become ordinary scenarios in the existing pipeline,
run through the same hypothesis→action→observation→investigation loop as
everything else, evidenced and classified the same way. A ripple-effect
miss is just a defect; it gets the same ticket format as any other.

## Reporting

State in the report which consumer surfaces were found and checked, and
name the technique honestly: source-based consumer discovery is a
heuristic, not exhaustive — a consumer reached through several layers of
indirection with no obvious naming link can be missed. Say so rather than
implying full coverage when the mapping felt incomplete.
