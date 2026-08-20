# Senior QA Exploratory Testing Capability — Design

Date: 2026-08-19
Status: Approved (pending implementation plan)

## Problem

Manual exploratory QA testing (finding bugs beyond the happy path — boundary
values, invalid input, state-transition edge cases, UI/API validation
mismatches) is slow and inconsistent. AI coding agents (Claude Code, and
others the user runs — Cursor, Codex CLI, Windsurf, Gemini CLI, plus
copy-paste-only chat tools) already have source-code access, browser/CLI
execution, and API visibility, but by default only verify that a requested
flow works — they don't systematically try to break it.

The user wants a reusable "Senior QA Exploratory Testing" reasoning
capability that:
- Is not tied to one project — must work across any repo, any stack.
- Is not tied to one AI tool — must work in Claude Code and other AI coding
  tools the user uses.
- Turns "test module X" into a systematic discovery → test-design →
  execution → evidence → defect-classification → report pipeline, using
  standard QA techniques (equivalence partitioning, boundary value analysis,
  decision tables, state transition, error guessing, exploratory testing),
  not ad-hoc guessing.
- Explicitly optimizes for defect discovery, not "happy path passed."

## Non-goals (V1)

- No new MCP server / custom tools. V1 reuses whatever execution tooling
  already exists in the target repo (Playwright CLI, Cypress, curl, etc.).
  MCP tooling (`inspect_api`, `run_playwright`, `capture_trace`, ...) is an
  explicit future V2, only if V1 proves the methodology adds value and
  something concrete needs an MCP boundary (e.g. structured evidence
  storage) that plain file/shell tools can't do.
- No changes to the existing `~/.claude/skills/playwright/SKILL.md`. That
  skill remains as-is — it is the execution-detail reference for this
  specific repo's Playwright framework (hooks, page objects, ReusableMethods
  conventions) and gets invoked as a sub-step when the target repo happens
  to be a Playwright hooks/page-object test repo.
- No sync tooling / no automatic multi-file generation. Adapter files are
  hand-written pointers, edited manually if the canonical path changes.
  Single user, single machine — sync automation is unneeded complexity.

## Architecture

```
                    Any AI coding agent
                (Claude Code / Cursor / Codex CLI /
                 Windsurf / Gemini CLI / copy-paste)
                            │
                            ▼
              senior-qa-explorer methodology
           (canonical, tool-neutral instructions)
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
          discovery    test design    execution loop
         (repo/stack    (ISTQB          (hypothesis →
          detection)     techniques)     action →
                                          observation →
                                          investigation →
                                          classification)
              │             │             │
              └─────────────┼─────────────┘
                            ▼
                    evidence collection
                            │
                            ▼
                    defect classification
                            │
                            ▼
                       QA report (.md)
```

### Canonical source (single source of truth)

`~/.claude/skills/senior-qa-explorer/`
- `SKILL.md` — orchestration: phase order, when to read which reference
  file, the hypothesis→action→observation→investigation→classification
  loop, completion checklist. Written in tool-neutral language — never
  references Claude-specific mechanisms ("Skill tool", "Task tool", "Agent
  tool"). Instead: "use your available file-read tool", "use your
  available shell/browser/test-execution tool". This is what makes the body
  portable to non-Claude agents.
- `references/discovery.md` — repo/stack discovery checklist: how to detect
  test runner (Playwright/Cypress/Jest/none), frontend framework, API
  layer, existing test structure, auth/storage state, how the app is
  started. Mirrors the "FIRST TASK" analysis-before-action step from the
  user's original spec — always analyze and (for Claude Code) propose
  before touching anything.
- `references/test-design-techniques.md` — Equivalence Partitioning,
  Boundary Value Analysis, Decision Table Testing, State Transition
  Testing, Pairwise/Combinatorial Testing, Error Guessing, Exploratory
  Testing — how to select and prioritize by risk/business impact/
  complexity/dependency count, not blindly maximize test count.
- `references/input-mutation-catalog.md` — per semantic input type
  (string, integer, decimal, date, enum/dropdown, email) the mutation set
  to consider, gated by "is this mutation meaningful for this field's
  actual constraint" — sourced from the type/min/max/nullable/regex found
  during discovery, not applied blindly.
- `references/oracle-hierarchy.md` — expected-behavior priority order:
  explicit acceptance criteria → requirements/docs → backend/API contract →
  DB constraints → source validation/business rules → existing automated
  tests → consistent behavior elsewhere in the app → domain convention →
  QA inference. Findings without a confident oracle are classified as
  "Potential Defect / Behavior Requiring Clarification," never asserted as
  confirmed.
- `references/defect-classification.md` — classification taxonomy
  (CONFIRMED DEFECT / POTENTIAL DEFECT / BEHAVIOR REQUIRING CLARIFICATION /
  TEST ENVIRONMENT ISSUE / AUTOMATION ISSUE / NOT A DEFECT), severity
  rubric (Critical/High/Medium/Low tied to business impact, data integrity,
  security, workflow blocking, recoverability, scope), and the required
  evidence fields per confirmed defect (repro steps, input, expected vs.
  actual, screenshot, console/network evidence, source-code location,
  confidence).
- `references/report-template.md` — the QA report structure (coverage
  summary, scenarios executed, confirmed/potential/clarification-needed
  findings, evidence, risk assessment, recommended additional tests).
- `PORTABLE.md` — the same body as `SKILL.md` minus YAML frontmatter, for
  copy-paste-only tools (ChatGPT, etc.) with no file-convention support.

This directory is user-global already (`~/.claude/skills` applies to every
repo automatically in Claude Code, no per-repo setup needed there).

### Cross-tool adapters (per target repo)

For repos where the user also drives Cursor / Codex CLI / Windsurf / Gemini
CLI, add a short pointer (not a content copy) in that repo's convention
file:
- `AGENTS.md` (Codex CLI, Windsurf, and other tools converging on this
  standard) — short paragraph: for exploratory QA tasks, read and follow
  `<absolute-path-to>\senior-qa-explorer\SKILL.md`.
- `GEMINI.md` (Gemini CLI) — same pointer.
- `.cursor/rules/qa-explorer.mdc` (Cursor) — same pointer, not
  always-applied, scoped to QA/testing requests.

Rationale for pointers over duplication: single source of truth, no sync
script, no drift. Trade-off accepted: the absolute path is machine-specific
(fine — personal tooling on the user's own machine, not a team-shared repo
convention), and effectiveness depends on the target agent actually having
a generic file-read tool and following the written instruction (true for
every agentic coding tool considered here; not guaranteed for a pure
chat-only tool, which is why `PORTABLE.md` exists as a manual-paste
fallback).

## Phase flow (what the methodology actually does)

1. **Discovery** — given "test module X," read `references/discovery.md`,
   inspect the target repo: source code for the feature, frontend
   components/inputs, API request/response shapes, validation
   (frontend + backend), business rules, DB constraints if visible, existing
   tests. Detect available execution tooling (Playwright config present? →
   use it, and for this repo specifically also load
   `~/.claude/skills/playwright/SKILL.md` for execution conventions.
   Cypress/Jest present? → use that. Nothing? → fall back to direct
   HTTP/curl or manual browser tool).
2. **Test model** — enumerate fields/actions/states/dependencies for the
   target feature from what discovery found.
3. **Test design** — apply `references/test-design-techniques.md` +
   `references/input-mutation-catalog.md` to generate positive, negative,
   boundary, and exploratory scenarios, filtered by relevance to the actual
   constraints found (not generic worst-case lists) and prioritized by
   risk/impact.
4. **Execution loop** — per scenario: state the hypothesis being tested,
   execute the minimum steps needed, observe actual behavior, and if
   suspicious, reproduce and investigate root cause using source/API/network
   evidence before concluding anything.
5. **Evidence collection** — for suspicious/confirmed findings, capture
   repro steps, input values, expected vs. actual, screenshots, console
   errors, network request/response, relevant source location.
6. **Defect classification** — apply `references/oracle-hierarchy.md` and
   `references/defect-classification.md` to classify and assign severity.
7. **Report** — write using `references/report-template.md`.

## Invocation

- Natural language: "test the Create Goal modal," "bul bug," "exploratory
  test yap," etc.
- Explicit command: `/qa-explore <module/feature>`.

## Output

Markdown report written to the target repo at
`docs/qa-reports/YYYY-MM-DD-<module>.md` (git-trackable, linkable from a PR),
plus a terminal summary. Not an Artifact — this needs to live with the repo
history, not a private web page.

## Risks / limitations

- Absolute path in adapter pointer files is single-machine; breaks if the
  user changes machines without updating adapters (acceptable, personal
  tooling).
- Non-Claude agents following the pointer is a matter of that agent's
  discipline, not enforced — no guaranteed compliance outside Claude Code.
- V1 has no MCP-backed structured evidence store; evidence lives in the
  markdown report only.
- Methodology quality depends entirely on how well `references/*.md` are
  written during implementation — this spec defines their required content,
  not their final text.
