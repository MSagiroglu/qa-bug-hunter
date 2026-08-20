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

## Phase 1 — Discovery (always first, never skip)

Read `references/discovery.md` and follow it before generating or running
any test. It covers: detecting the target repo's stack, test runner, and
existing test structure; tracing the feature's implementation (UI → frontend
validation → API → backend validation → business logic → DB → response →
UI state); and what to do when no test tooling exists yet.

For Claude Code specifically, when the discovered repo is
a Playwright hooks/page-object test repo (or any repo using the same
hooks/page-object/ReusableMethods pattern), also load
`~/.claude/skills/playwright/SKILL.md` for that repo's execution
conventions — this skill governs *what* to test and *why*; that skill
governs *how* to write/run the Playwright code once you've decided what to
test.

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

For every suspicious or confirmed finding, capture what's available and
relevant: repro steps, exact input values, expected vs. actual result,
screenshot, console errors, the actual network request/response
(status, payload), and the source file/line responsible. Never report a
defect from an assertion failure alone — Phase 4's investigation step is
mandatory first.

## Phase 6 — Defect classification

Read `references/oracle-hierarchy.md` to determine expected behavior with
the strongest evidence available, and `references/defect-classification.md`
for the classification taxonomy, severity rubric, and required fields per
confirmed defect. If no confident oracle can be established, classify as
"Potential Defect / Behavior Requiring Clarification" — never assert it as
confirmed.

## Phase 7 — Report

Write the report using `references/report-template.md`. Save it to the
target repo at `docs/qa-reports/YYYY-MM-DD-<module>.md` so it's
git-trackable and linkable from a PR. Also give a short summary in your
response — don't make the user open the file to learn whether anything
critical was found.

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
- [ ] Oracle used is stated for each finding; low-confidence findings are
      labeled "Behavior Requiring Clarification," not asserted as bugs.
- [ ] Report written to `docs/qa-reports/` and summarized in-conversation.
