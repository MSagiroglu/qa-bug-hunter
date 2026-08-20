# Evidence Capture, Impact Analysis & Black-Box Discovery — Design

Date: 2026-08-20
Status: Approved (pending implementation plan)

## Problem

The skill currently *describes* evidence in prose ("screenshot", "network
request/response") rather than actually producing and attaching real
files. It also only tests the feature it was pointed at — it never checks
whether a change to a shared/reference entity (a "library" record, a
config toggle, master data) is correctly reflected everywhere else in the
app that consumes it. And it assumes source-code access is always
available, with no defined fallback when it isn't.

Three gaps, raised together by the user after reviewing the skill in
detail as if reviewing it as a senior QA/dev hybrid:

1. **Evidence is described, not produced.** A ticket says "network request
   returned 201" instead of shipping an actual saved request/response
   file next to it.
2. **No ripple-effect / impact analysis.** Example given: a Hedef
   Kütüphanesi (goal library) entry is created, edited, deleted, or
   deactivated — does the İş Hedefleri → Hedef Ekle → "kütüphaneden seç"
   dropdown correctly reflect each of those states? Nothing today checks
   this class of bug.
3. **No black-box fallback.** If there's no source-code repo available,
   the skill has no defined way to still do meaningful discovery by
   reading the live DOM and observing network traffic instead.

## Non-goals

- No Jira API/ticket-tracker integration — no MCP for it exists in this
  environment. Evidence files are produced and referenced by path; a human
  still attaches them to the actual tracker issue.
- No mobile black-box *consumer-mapping/discovery* (accessibility-tree-
  driven exploration of an already-running app to find ripple-effect
  consumers, mirroring web's DOM-based approach in section C) in this
  pass — still a known gap. This is separate from section D's
  self-provisioned Appium bootstrap, which *is* in scope: D covers
  driving actions against a mobile target with no source access; the
  excluded piece is specifically the "explore an unfamiliar mobile app's
  screens to map consumers" methodology.
- No automatic video capture turned on anywhere by default — Phase 5's
  existing "ask before enabling" rule (from the previous round) still
  governs whether video/trace gets turned on; this design only adds
  *where captured evidence goes* once it exists.

## Architecture

No new numbered phase. All three pieces extend the existing seven-phase
pipeline:

```
Phase 1 Discovery ──┬─ (repo available) source-aware discovery (existing)
                     │     + consumer-mapping for shared/library entities (NEW, B)
                     └─ (no repo) blackbox-discovery.md (NEW, C)
                           + live-DOM consumer-mapping (NEW, B via C)
Phase 2 Test model ── includes discovered consumer surfaces as extra
                       model entries (NEW, B)
Phase 3 Test design ── generates create/edit/delete/deactivate ×
                        consumer-surface scenarios (NEW, B)
Phase 4 Execution loop ── unchanged mechanics, now also captures evidence
                           to real files as it runs (NEW, A)
Phase 5 Evidence collection ── writes actual files to
                                docs/qa-reports/evidence/<date>-<module>/
                                instead of describing them (NEW, A)
Phase 6 Classification ── unchanged; a ripple-effect miss is classified
                           exactly like any other defect
Phase 7 Report ── ticket's Evidence/Ekler section lists real file paths
                   (NEW, A); ripple-effect findings use the same ticket
                   format, no new template needed
```

## A — Evidence capture (`references/evidence-capture.md`)

**Storage convention:** `docs/qa-reports/evidence/<date>-<module>/`, files
named `screenshot-<n>-<label>.png`, `network-<n>-<label>.json`,
`console-<n>-<label>.log`, and `video-<n>-<label>.<ext>` /
`trace-<n>.zip` when video/trace is enabled (see the existing ask-first
rule). Every evidence file's name appears in the ticket's Evidence
section as a plain relative path — since there's no tracker API, the
ticket instructs the reader to attach these files manually.

**Two capture paths, both documented:**

1. **Scripted (preferred, used whenever an execution tool — Playwright,
   Detox, etc. — is driving the test):** write to disk from inside the
   script itself. Screenshot via the tool's native screenshot call with
   an explicit `path` into the evidence folder. Network/console: don't
   just log to stdout (the mistake made earlier this session in
   TS_003_079, which only `console.log`'d captured data) — capture via
   the tool's listener APIs and `fs.writeFileSync` the JSON/text into the
   evidence folder.
2. **Interactive (fallback — ad-hoc investigation, or black-box mode
   with no test script to write evidence-saving code into):** use the
   host environment's own screenshot/console/network inspection
   capability. If it can write bytes to disk, save into the evidence
   folder using the same naming convention. If it can't (output is
   view-only), don't fabricate a file path — say in the ticket that the
   artifact was captured interactively during the session and is not a
   saved file, so the reader knows not to go looking for a path that
   doesn't exist.

## B — Impact analysis (`references/impact-analysis.md`)

**Trigger:** automatic. During Phase 1 discovery, after identifying the
target entity's backend representation (DB table/model), classify it as
*shared* (library/config/master-data — referenced by other
tables/services/frontend consumers) or *leaf* (nothing else reads it). If
shared, consumer-mapping and the state-matrix below run automatically as
part of the same pass — no separate invocation needed.

**Consumer discovery (source-aware):** find (a) other DB tables with FK
references to this entity's table, (b) other API controllers/services
that query it beyond its own CRUD endpoint, (c) every distinct frontend
component/directive that calls the data-service method(s) fetching it —
each is one consumer surface.

**Verification matrix:** for each consumer surface, test entity state ×
expected behavior:

| Entity state | Expected in each consumer surface |
|---|---|
| Created | Appears where it should, without requiring a manual refresh/cache-bust the real user wouldn't do |
| Edited | Updated fields reflect everywhere it's displayed, not just the canonical/owning screen (stale-copy bugs) |
| Deleted | Removed from selectable/listing UI; existing records that already reference it are handled per a defined rule (cascade / orphan-safe / delete-blocked-while-in-use) — whichever it is, verify it's the *intended* one, not just "whatever happens to happen" |
| Deactivated | Excluded from "available to add new" pickers, but records already created from it remain intact and visible |

This matrix *is* the new content Phase 3 generates for a shared entity —
it plugs into the existing test-design output, not a separate list.

## C — Black-box discovery (`references/blackbox-discovery.md`)

Used when Phase 1 finds no accessible source repo. Read via the host's
DOM/accessibility-tree tool and network inspector instead of grep:

1. Perform the target change (create/edit/delete/deactivate) on one
   screen; capture the resulting entity id/name from that screen's own
   API response.
2. Read the app's navigation DOM to enumerate its other major sections.
3. Visit each; watch network responses (and rendered text) for that same
   id/name appearing — this is the black-box replacement for grep-based
   consumer discovery in B.
4. Apply the same state-matrix verification once consumer surfaces are
   found this way.

Web only in this pass (per Non-goals).

## D — Self-provisioned execution tooling (revision, folded into `references/blackbox-discovery.md`)

Raised after initial approval: "no source-code access" should not mean
"no automated actions." A user may hand over nothing but a URL and
credentials ("go here, do this, find bugs") with no repo at all — the
original Phase 1 rule ("don't scaffold a framework for one question")
was written for a single quick hypothesis check, not this — the primary
engagement shape this skill exists for.

**Revised rule:** distinguish the two cases explicitly.

- **Single, narrow hypothesis check** (repo exists, this is one specific
  question) — unchanged: use the interactive/manual path, don't scaffold
  anything.
- **A full testing engagement with no reachable execution tooling at
  all** (no repo, or a repo with no test framework) — the skill
  provisions a minimal, throwaway automation project itself:
  **Playwright** for web (matches everything else already used, zero
  target-app integration needed — it drives any URL), **Appium** for
  mobile (chosen specifically because, unlike Detox/Espresso/XCUITest, it
  needs no build-time instrumentation of the target app — it drives a
  running app/APK/IPA over the standard WebDriver protocol, which fits
  "no source access" exactly). This becomes the execution tool the rest
  of the pipeline (Phase 4 onward) reuses for that session.

**Where it's provisioned:** a scratch/temporary location, never the
target repo (there may not even be a target repo, and this skill doesn't
commit new infrastructure into a project without being asked). Confirmed
with the user: scratch folder, not repo-committed, discarded/left as a
session artifact rather than becoming permanent project infrastructure.

**Capability-boundaries text update:** the existing honesty rule ("if no
reachable execution path exists, say so explicitly") now becomes "if no
reachable execution path exists, *try to provision a minimal one first*
(per the rule above); only fall back to a code-review/manual-only pass
and flag it as incomplete if provisioning itself isn't possible (e.g. no
package-manager access in this environment, or the target genuinely
can't be reached from here)."

## File changes

- New: `references/evidence-capture.md`, `references/impact-analysis.md`,
  `references/blackbox-discovery.md` (now covers both DOM/network-based
  discovery *and* the self-provisioned-tooling rule from section D).
- `SKILL.md`: Phase 1 branches to blackbox-discovery.md when no repo;
  Phase 1/2/3 note the shared-entity consumer-mapping trigger; Phase 5
  points to evidence-capture.md for real file output; Capability
  Boundaries section updated per D.
- `PORTABLE.md`: condensed self-contained versions of all three additions
  (it must stay a single paste-able file).
- `references/defect-classification.md`: evidence field says "actual
  file per evidence-capture.md," not "description."
- `references/jira-ticket-template.md`: add an Ekler/Attachments section
  listing evidence file paths.
- `README.md`: mention the three capabilities, including the
  self-provisioned-tooling case.

## Risks / limitations

- Consumer discovery (source-aware) can miss consumers reached through
  very indirect paths (e.g. a shared service called through several
  layers of indirection with no obvious naming link) — it's a heuristic,
  not exhaustive; state that in the report when a shared entity was found
  but consumer-mapping felt incomplete.
- Black-box consumer discovery depends entirely on the entity's id/name
  being visible in network payloads or rendered text elsewhere; a
  consumer surface that only shows a derived/computed value (no literal
  id/name match) will be missed.
- Interactive-path evidence (no saved file) is weaker evidence than a
  scripted-path file and should be labeled as such in the ticket.
