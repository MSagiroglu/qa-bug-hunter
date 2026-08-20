---
name: senior-qa-explorer
description: Systematic exploratory QA testing for web and mobile apps — turns "test module X" into discovery, ISTQB-based test design, hypothesis-driven execution, evidence collection, and defect classification. Use for finding bugs beyond the happy path, not just confirming a flow works.
triggers: test this module, exploratory test, find bugs in, qa explore, bul bug, hata bul, test et (senior qa), /qa-explore
category: testing
---

# Senior QA Explorer

## Purpose

Default behavior for most coding agents, once a requested flow works, is to
stop. This skill exists to not stop there. Given a module/page/feature/
workflow, run it through a systematic pipeline whose explicit goal is
**defect discovery**, using standard QA test-design techniques instead of
ad-hoc guessing, and only reporting a finding as a confirmed defect when
there is actual evidence behind it.

**Tool neutrality:** this file and everything under `references/` is written
to be followed by any AI coding agent with generic file-read and
shell/browser execution capability — not just Claude Code. Wherever this
document says "your file-read tool" or "your execution tool," use whatever
your host environment actually provides (Read/Bash/Playwright MCP in Claude
Code; the native file/terminal/browser tools in Cursor, Codex CLI, Windsurf,
Gemini CLI, etc.). Do not assume any specific tool name.

## Core rule

A successful happy path is the *start* of testing, not the end. Every phase
below exists to answer one question: **how can this break?** Do not report a
finding as a defect on a failed assertion alone — investigate first (see
Phase 6).

## Capability boundaries (state these honestly, don't oversell)

This skill is a methodology, not an execution engine. It can only drive
whatever test/automation tooling is actually configured and reachable in
the current environment:

- **Web**: whatever E2E tool discovery finds (Playwright/Cypress/etc.), or
  direct HTTP calls / a manual browser session if none exists.
- **Mobile (iOS/Android, native or React Native/Flutter)**: whatever mobile
  E2E tool discovery finds already configured in the repo (Detox, Appium,
  Maestro, Patrol, XCUITest, Espresso) *and* actually runnable in this
  environment (a reachable simulator/emulator/device, or a device-farm
  connection). This skill does not itself provide simulator/emulator
  control — it cannot open an iOS Simulator or Android Emulator on its own
  unless the host tool exposes that capability.

If Phase 1 discovery finds no reachable execution tooling at all — no
repo, or a repo with no test framework, for a full testing engagement
(not a single narrow check) — **try to provision a minimal one first**:
see `references/blackbox-discovery.md`'s Self-Provisioned Execution
Tooling section (Playwright for web, Appium for mobile, set up in a
scratch location, never committed to the target repo without being
asked). Only if provisioning itself isn't possible — no install access,
target unreachable, no way to attach to a mobile app — fall back to
whatever manual/interactive checking is still possible and **say so
explicitly**, in the response and in the report's Environment/Automation
Issues section, rather than silently limiting yourself to a code-review-
only pass without flagging that the pass was incomplete. "I traced this
from source but could not execute against a running app/simulator" is a
valid, honest outcome; claiming full coverage when you only read source
is not.

## Phase 1 — Discovery (always first, never skip)

Read `references/discovery.md` and follow it before generating or running
any test. It covers: detecting the target repo's stack, test runner, and
existing test structure; tracing the feature's implementation (UI → frontend
validation → API → backend validation → business logic → DB → response →
UI state); and what to do when no test tooling exists yet.

**No source access at all** (just a URL/credentials, or a repo you can't
read the relevant parts of): read `references/blackbox-discovery.md`
instead — it covers black-box feature tracing via DOM/network observation,
and provisioning your own minimal Playwright/Appium tooling when nothing
reachable exists yet.

If a companion skill already exists in this environment specifically for
*how* to write/run tests in the target repo's own framework and
conventions (hooks, page objects, naming — the execution-detail layer,
distinct from this skill's what-and-why), load and follow it for the
mechanics once you've decided what to test.

**Shared/library entities:** while identifying the target entity's
backend representation, check whether it's referenced by other
tables/services/frontend components (a library, config, or master-data
record) rather than a leaf feature nothing else depends on. If shared,
also read `references/impact-analysis.md` — this triggers automatically,
it's part of the same discovery pass, not a separate ask.

Do not generate test scenarios before discovery is done. Guessing at
constraints you haven't verified in source produces noise, not defects.

**Mobile targets:** when the target is a mobile app (React Native, Flutter,
or native iOS/Android), also read `references/mobile-discovery.md` — it
covers stack/test-tool detection (Detox, Appium, Maestro, Patrol, XCUITest,
Espresso, etc.) and the mobile-specific parts of the feature trace (local
persistence, permissions, deep links, lifecycle hooks, platform divergence
between iOS and Android).

## Phase 2 — Test model

From discovery, enumerate for the target feature: inputs and their
semantic types, actions/buttons, states and transitions, dependencies
between fields, and the API contract. This is the map Phase 3 works from.

If Phase 1 found the entity is shared, also list every consumer surface
`impact-analysis.md` found — each one is a model entry the same way an
input field is.

## Phase 3 — Test design

Read `references/test-design-techniques.md` (which technique to use when,
and how to prioritize by risk/impact rather than maximize count) and
`references/input-mutation-catalog.md` (candidate mutations per semantic
input type). Generate positive, negative, boundary, and exploratory
scenarios. Every mutation must be gated by something discovery actually
found (a type, a min/max, a regex, a business rule) — do not apply a
mutation just because it's on the list.

**Mobile targets:** also read `references/mobile-exploratory-considerations.md`
for mobile-specific error-guessing (lifecycle interruptions, connectivity
loss, permission-state changes, deep links/push notifications, biometric
auth, device/OS fragmentation). Same gating rule applies — only scenarios
actually reachable by the feature under test.

**Every write-capable feature (create/update/delete/upload), web or
mobile:** also read `references/critical-defect-patterns.md` and include
its interrupted-write scenarios (refresh/kill mid-write, network drop
timed to the write, double-submit, throttled connection) — never classify
a write as successful based on the UI's own success signal alone.

**Web layout:** include the Responsive/Viewport Testing technique from
`references/test-design-techniques.md` for any screen with viewport-
dependent layout.

**Shared entities:** generate `impact-analysis.md`'s created/edited/
deleted/deactivated × consumer-surface matrix as ordinary scenarios in
this same list — they run through Phase 4 like everything else.

## Phase 4 — Execution loop

Per scenario, run this loop and don't skip steps:

```
HYPOTHESIS   → what specifically might be wrong, and why
ACTION       → minimum steps needed to test the hypothesis
OBSERVATION  → what actually happened
ANOMALY?     → does observation differ from the oracle (Phase 6)?
  no  → record as pass, move on
  yes → INVESTIGATION → reproduce, inspect source/API/network for root cause
        → CLASSIFICATION (Phase 6)
```

Example:
```
Hypothesis: Weight field may not enforce its stated maximum.
Action: submit weight = 101 where discovery found max=100 on the frontend.
Observation: save succeeds (HTTP 201).
Investigation: inspect request payload, response, and backend source —
  frontend has max=100, backend has no corresponding validation.
Classification: CONFIRMED DEFECT (see references/defect-classification.md).
```

Reuse whatever execution tooling Phase 1 found in the repo. Do not build new
test infrastructure to answer a single hypothesis — use the fastest tool
that gives a trustworthy answer (existing E2E framework, a direct API call,
a browser devtools check).

## Phase 5 — Evidence collection

For every suspicious or confirmed finding, produce actual evidence files
per `references/evidence-capture.md` — not a description of what you saw,
a saved screenshot/network dump/console log at a real path. Capture: repro
steps, exact input values, expected vs. actual result, screenshot, **video
or trace recording of the reproduction if the execution tool supports it**
(check during Phase 1 whether video/trace capture is enabled in the
target's test config — e.g. Playwright's `use.video`/`use.trace`), console
errors, the actual network request/response (status, payload), and the
source file/line responsible. Never report a defect from an assertion
failure alone — Phase 4's investigation step is mandatory first.

**If video/trace capture is supported by the execution tool but currently
disabled**, ask the user about it as soon as you find that out in Phase 1
— before running scenarios, not as a footnote in the final report. Tell
them what's off, what enabling it would cost (slower/heavier test runs,
extra disk use), and let them decide whether to enable it for this run. If
they say yes, enable it in the config yourself before proceeding. If they
say no or don't respond in time, proceed without it and still note the gap
in the report's Environment/Automation Issues section — asking doesn't
replace flagging, it comes first.

## Phase 6 — Defect classification

Read `references/oracle-hierarchy.md` to determine expected behavior with
the strongest evidence available, and `references/defect-classification.md`
for the classification taxonomy, severity rubric, and required fields per
confirmed defect. If no confident oracle can be established, classify as
"Potential Defect / Behavior Requiring Clarification" — never assert it as
confirmed.

## Phase 7 — Report

Write the report using `references/report-template.md`. Every CONFIRMED
DEFECT (and any POTENTIAL DEFECT worth filing early) gets formatted as a
paste-ready ticket per `references/jira-ticket-template.md` — TEST SET ID/
TEST CASE ID, Title, 📋 Steps to Reproduce, 🖼️ Actual Result,
🎯 Expected Result, 📎 Ekler/Attachments — not a plain prose paragraph.
This is the standard per-defect output format; use it every time, not
only when asked. The Ekler section lists exactly the files Phase 5
actually wrote — don't reference an evidence file that doesn't exist. Save the
report to the target repo at `docs/qa-reports/YYYY-MM-DD-<module>.md` so
it's git-trackable and linkable from a PR. Also give a short summary in
your response — don't make the user open the file to learn whether
anything critical was found.

## Invocation

- Natural language: "test the Create Goal modal," "X modülünü exploratory
  test et," "bul bug."
- Explicit: `/qa-explore <module or feature>`.

When the target module/scope is ambiguous, ask before starting Phase 1 — an
exploratory pass on the wrong feature wastes the whole pipeline.

## Completion checklist

- [ ] Phase 1 discovery done before any scenario was written.
- [ ] Every mutation traces back to something found in source/API/DB, not a
      generic list applied blindly.
- [ ] Every finding went through hypothesis → action → observation →
      investigation before classification.
- [ ] No defect reported on assertion failure alone — root cause
      investigated.
- [ ] Every confirmed defect has the evidence fields
      `references/defect-classification.md` requires.
- [ ] Every confirmed/filed defect is formatted per
      `references/jira-ticket-template.md`, not plain prose.
- [ ] Oracle used is stated for each finding; low-confidence findings are
      labeled "Behavior Requiring Clarification," not asserted as bugs.
- [ ] Every write-capable scenario checked persistence independently of the
      UI's own success signal (`references/critical-defect-patterns.md`).
- [ ] Execution-path gaps (no reachable simulator/emulator, video/trace
      disabled, etc.) are stated explicitly, not silently absorbed into a
      quieter pass.
- [ ] If no execution tooling existed at all, a minimal one was
      provisioned before falling back to manual-only checking (or the
      report says explicitly why that wasn't possible).
- [ ] Shared/library entities got their consumer surfaces mapped and the
      created/edited/deleted/deactivated matrix run
      (`references/impact-analysis.md`), or the entity was confirmed leaf.
- [ ] Every evidence reference in a ticket points to a file that was
      actually written (`references/evidence-capture.md`), not a
      described-but-not-saved artifact passed off as one.
- [ ] Report written to `docs/qa-reports/` and summarized in-conversation.
