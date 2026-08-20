# Sn-QA-Bug-Hunter (senior-qa-explorer)

Systematic exploratory QA testing methodology for AI coding agents — web
and mobile. Given "test module X for bugs," it drives discovery → ISTQB-
based test design → hypothesis-driven execution → evidence collection →
defect classification → report, instead of just confirming the happy path
works.

This repo *is* the skill package. It's stack-agnostic: it never assumes
Playwright, React, or any specific framework — every run starts by
detecting what the target repo actually uses.

## What's in a finding

Every reported defect ships with evidence, not just a description:
reproduction steps, exact input values, the source file/line responsible,
screenshot, and — when the execution tool supports it (e.g. Playwright's
video/trace) — a video or trace of the reproduction. It also runs an
explicit "never trust the UI's success toast" check on every write-capable
feature: refresh mid-save, drop the connection mid-request, double-submit,
throttle the connection — then verify what actually persisted, independent
of what the screen claimed. See `references/critical-defect-patterns.md`.

## Honest scope — what this does *not* do

This is a methodology an AI agent follows, not a device lab. It drives
whatever test tooling is already configured and reachable: Playwright/
Cypress for web, or Detox/Appium/Maestro/Patrol/XCUITest/Espresso for
mobile — *if* that tooling exists in the target repo and there's a reachable
simulator/emulator/device to run it against. It does not open a simulator
or emulator by itself. If no reachable execution path exists, the skill is
required to say so explicitly (in the report's Environment/Automation
Issues section) instead of quietly downgrading to a source-only pass
without flagging it.

## Files

- `SKILL.md` — orchestration (the phases, in what order, what to read when).
- `references/discovery.md` — repo/stack discovery checklist (web).
- `references/mobile-discovery.md` — same, for React Native/Flutter/native
  iOS/Android.
- `references/test-design-techniques.md` — ISTQB techniques and how to
  prioritize scenarios.
- `references/input-mutation-catalog.md` — mutation menu per semantic input
  type (web forms).
- `references/mobile-exploratory-considerations.md` — mobile-specific
  error-guessing (lifecycle, connectivity, permissions, deep links,
  biometrics, device fragmentation).
- `references/oracle-hierarchy.md` — how to decide what "correct behavior"
  means when there's no spec.
- `references/defect-classification.md` — taxonomy, severity rubric,
  required evidence fields.
- `references/critical-defect-patterns.md` — ghost-success/persistence
  verification and the interrupted-write scenarios to run it against.
- `references/report-template.md` — the QA report structure.
- `references/jira-ticket-template.md` — per-defect ticket format (TEST SET
  ID/TEST CASE ID/Title/Steps to Reproduce/Actual/Expected Result),
  paste-ready for Jira or any tracker.
- `PORTABLE.md` — the same methodology, self-contained (no file
  references), for tools that can't read local files — paste it as a
  system/custom instruction.

## Using this in Claude Code

Claude Code loads skills from `~/.claude/skills/<name>/SKILL.md`. This repo
is meant to sit at a stable path with a **directory junction** at
`~/.claude/skills/senior-qa-explorer` pointing here, so Claude Code reads
straight from this repo — one source of truth, no copy to keep in sync.

```powershell
mklink /J "%USERPROFILE%\.claude\skills\senior-qa-explorer" "C:\Users\musta\Desktop\Sn-QA-Bug-Hunter"
```

Invoke with natural language ("test the Create Goal modal for bugs") or
`/qa-explore <module>`.

## Using this in other AI coding tools

Most agentic coding tools (Cursor, Codex CLI, Windsurf, Gemini CLI) read a
convention file from the *target* repo you're working in, not a global
skills folder. Drop a short pointer file into each project where you want
this available:

- `AGENTS.md` (Codex CLI, Windsurf, and others converging on this standard)
- `GEMINI.md` (Gemini CLI)
- `.cursor/rules/qa-explorer.mdc` (Cursor, `alwaysApply: false`)

Each just needs a couple of sentences: for exploratory/bug-hunting test
requests, read and follow `SKILL.md` at this repo's path (adjust for
wherever you clone it), then use the target repo's own conventions for how
to write/run tests once you know what to test. See
an AGENTS.md in the target project for a
working example of this pattern.

For tools with no file-convention support at all (a plain chat UI), paste
`PORTABLE.md` as a custom instruction.

## Updating

Edit files directly in this repo and commit. Claude Code picks up changes
immediately (junction, not a copy). Other tools' pointer files don't need
to change unless this repo's path changes — update the path in each
pointer file if you move the repo.
