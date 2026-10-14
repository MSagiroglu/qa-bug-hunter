# README.md Claim-by-Claim Audit (2026-10-14)

Reviewer: independent evaluator. Each substantive claim in `README.md` is marked
**TRUE** / **PARTIAL** / **OVERSTATED** / **FALSE** with evidence (a file path, a
line of code, or a command result). Commands were run locally (Node v22.20.0,
Windows) with `agent/node_modules`, `agent/dist`, and Playwright chromium present.

## Summary

The README is mostly accurate and unusually honest (it states its own score is old
and "not re-scored," and labels source-derived findings as candidates). The main
problems are: the `mklink` install command is wrong under PowerShell as labelled
(affects both the English and Turkish sections), the "active injection reduced to
detection-only" bullet overstates what the lens files still contain, and several
vivid anecdotes cannot be verified from the repository.

## Onboarding / "Start in 5 minutes"

| Claim | Verdict | Evidence |
|-------|---------|----------|
| "A set of instructions plus helper scripts that make an AI coding tool test like a careful exploratory tester" | TRUE | Matches `SKILL.md` + `references/**` + `templates/**`. |
| "Node 20+ only if you want the helper scripts, self-tests or the standalone agent" | PARTIAL | `agent/package.json` declares `"engines": {"node": ">=18.0.0"}`, not 20+. The README asks for a higher floor than the code requires — harmless but inconsistent. |
| "Playwright is always the browser engine for web work; the skill provisions it in `~/.qa-bug-hunter/playwright`" | PARTIAL | Intent matches `SKILL.md`/`blackbox-discovery.md`, but "always provisions" is aspirational for an AI agent; honest-scope section walks it back. See rescore over-claim #1. |

## Install / symlink commands

| Claim | Verdict | Evidence |
|-------|---------|----------|
| `git clone https://github.com/MSagiroglu/qa-bug-hunter.git` | UNVERIFIABLE | Remote not reachable in this review; local working dir is `Sn-QA-Bug-Hunter`, so the clone folder name also differs from the repo dir name. |
| Windows link: `mklink /J "%USERPROFILE%\.claude\skills\senior-qa-explorer" "<path-to-clone>"` under a `# Windows (PowerShell)` comment | OVERSTATED/FALSE | `mklink` is a `cmd.exe` builtin, not a PowerShell command; run verbatim in PowerShell it fails (`mklink : The term 'mklink' is not recognized`). Also `%USERPROFILE%` is cmd syntax, not PowerShell (`$env:USERPROFILE`). The same wrong command appears in "Using this in Claude Code" and in the Turkish section (Adım 1 / Adım 2). |
| macOS/Linux: `ln -s "<path-to-clone>" "$HOME/.claude/skills/senior-qa-explorer"` | TRUE | Correct POSIX symlink syntax. |
| "No symlink support … just copy the folder" | TRUE | Valid fallback. |

## Newcomer verification commands

| Claim | Verdict | Evidence |
|-------|---------|----------|
| `cd agent && npm install && npx playwright install chromium && cd ..` | TRUE | Standard; `agent/package.json` depends on `@playwright/test`. |
| `node tools/lint-references.mjs` ends with `0 finding(s)` | TRUE | Ran it: output `0 finding(s)`, exit 0. |
| `node tools/selftest/run-selftest.mjs` ends with `SELFTEST PASSED` | TRUE | Ran it: `SELFTEST PASSED`, exit 0. |
| `node tools/selftest/run-rapid-selftest.mjs` ends with `RAPID SELFTEST PASSED` | TRUE | Ran it: `RAPID SELFTEST PASSED`, exit 0. |
| "These prove the helpers on local demo pages; they do not test your product." | TRUE | `tools/selftest/README.md` "What it does NOT prove" matches exactly. |
| `npm run build` (agent) | TRUE | Ran `npm --prefix agent run build`: `tsc` clean, exit 0. |

## Modes, lenses, domain packs

| Claim | Verdict | Evidence |
|-------|---------|----------|
| Four modes (Session, Sweep default, API-only, Load) | TRUE | `SKILL.md` modes table. |
| Six-directions lens (Interrupt, Network, Screen/Shape, State, Data, Permission) | TRUE | `references/lenses/six-directions.md`. |
| Domain packs live outside the repo in `QA_DOMAIN_PACKS_DIR` or `%USERPROFILE%\.qa-bug-hunter\domains`, auto-detected by `Markers:` | TRUE | `references/domains/README.md`; `agent/src/lib/domain.ts` (`getPacksRoot`, `packMatches`, `resolveDomain`). |
| Self-test commands (overlay + rapid) | TRUE | Files exist and pass (above). |

## Safety statements

| Claim | Verdict | Evidence |
|-------|---------|----------|
| "Active injection/XSS material is out of default scope: it needs written authorization on an owned, non-shared target." | TRUE | Banners atop `xss-attack-patterns.md` and `backend-injection-testing.md`; `api-lens.md` Design row. |
| "Load tooling and the authorization-matrix runner require an allowlisted target, send nothing in dry-run mode" | TRUE | `references/load/safety-gates.md` (7 gates), `templates/k6/lib/gate.js` (`fail` on unlisted target), `templates/playwright/authz-matrix.ts` (`dryRun` default true, `checkGates`). |
| "Rapid-action bursts are capped and use only data created by the run." | TRUE | `templates/playwright/rapid-action.ts` (`maxTotalClicks` default 12); `agent/src/lib/rapid.ts` (`TEST_rapid_` prefix, run-created rows only). |
| "Never place credentials in the repo, in evidence files or in reports." | TRUE | Repeated in `authz-matrix.md`, `api-lens.md`, k6 `auth.js` (headers never logged). |

## "What changed in this release" bullets

| Claim | Verdict | Evidence |
|-------|---------|----------|
| "independent assessment … scored it 68/100 … This release closes most of the gaps … has not been re-scored … run the same rubric on a fresh reviewer" | TRUE (honest) | Matches `docs/evaluation/` existence; explicit "not re-scored / candidate" framing is accurate and commendable. |
| "Structure: one core engine, platform lenses, UI invariants, load method, optional private domain packs; SKILL.md is now a router" | TRUE | Directory layout + `SKILL.md`. |
| "Session mode: charter, 60-minute timebox, tagged notes, one-page summary with mandatory 'not covered' line" | TRUE | `session-mode.md`, `templates/session-summary.md`. |
| "New techniques: risk register … rapid-action … three-witness … authorization matrix … metamorphic/differential … second-opinion … overlay/modal invariants (WAI-ARIA dialog)" | TRUE | Each has a reference file and a template/helper. |
| "Safety: active injection and XSS material moved behind an authorization banner and reduced to detection-only" | PARTIAL | Verified: destructive SQL/XXE/path-traversal payloads are removed from the lenses (`grep -rniE "DROP TABLE\|xp_cmdshell\|pg_sleep\|etc/passwd\|UNION SELECT" references/lenses` → 0) and `backend-injection-testing.md` is genuinely detection-only behind a banner — TRUE for injection. But `xss-attack-patterns.md` still ships a full XSS payload catalog (script/event-handler/SVG/bypass) behind the banner, so "reduced to detection-only" overstates the XSS half (gated, not reduced). |
| "Fixes: assertion-alone CONFIRMED verdicts became candidate findings; corrupted characters and a duplicate checklist line removed" | TRUE | `defect-classification.md` ("Never classify from an assertion failure alone"); `node tools/lint-references.mjs` → `0 finding(s)` confirms no CJK/duplicate lines. |
| "Standalone agent: `--domain`/`--repo` pack detection, `overlay`, `api`, `rapid` suites, no hardcoded site selectors, reflection is not reported as XSS, unsafe browser flags are opt-in" | TRUE | `agent/src/cli.ts` (options), `executor.ts` `findSearchTarget` (generic, no site selectors), SEC-001 returns `warning` for reflection and `fail` only on dialog/exec flag, `browser.ts` `--insecure` opt-in with warning. |
| "Self-tests … found and fixed two real helper bugs" | UNVERIFIABLE | No in-repo artifact documents the two bugs; self-tests pass now but the historical claim can't be checked from the repo. |
| "Not changed on purpose: Playwright remains the engine; existing Turkish reference files were not translated." | TRUE | Turkish files remain (`session-mode.md`, `advanced-exploratory-attacks.md`, etc.). |

## "What it actually finds" anecdotes

| Claim | Verdict | Evidence |
|-------|---------|----------|
| "In one real run against a production SaaS app's goal-tracking feature … traced a boundary-value rule … backend had zero server-side check" | UNVERIFIABLE | No evidence artifact in repo; also a near product-specific reference. Treat as illustrative, not proof. |
| a11y pass "found by accident once … five broken images … all five had `alt=''`" | UNVERIFIABLE | Repeated in `web/accessibility-checks.md` as motivation; no saved evidence. |
| Bug *classes* listed (frontend-only validation, ghost successes, ripple-effect, boundary/EP, mobile-specific, responsive, cross-browser, a11y, i18n, security hygiene, empty-submit, collision/IDOR, double-submit, type confusion, race, API contract, copy-paste/Unicode) | TRUE | Each maps to a reference file; this is an accurate index of the methodology's scope. |

## "What it produces" / oracle honesty

| Claim | Verdict | Evidence |
|-------|---------|----------|
| Ticket format (TEST SET/CASE ID, Steps, Actual, Expected, Ekler) | TRUE | `references/core/jira-ticket-template.md` with worked example. |
| "every finding states which oracle it's based on … anything below a confident oracle gets filed as 'Behavior Requiring Clarification,' not asserted" | TRUE | `oracle-hierarchy.md` (level ≤7 rule), `defect-classification.md`. |
| Evidence files written to `docs/qa-reports/evidence/<date>-<module>/` | TRUE | `evidence-capture.md` storage convention. |
| Regression lock-in offer for each confirmed defect | TRUE | `SKILL.md` Phase 6, `PORTABLE.md` Phase 6. |

## Standalone agent section

| Claim | Verdict | Evidence |
|-------|---------|----------|
| "smoke-test harness, not a universal tester; discovers a search box by role/type/placeholder; `skipped: no target element` when none found" | TRUE | `executor.ts` `findSearchTarget` + `skipNoTarget`. |
| Suite table: Security 3, Input 5, Responsive 3, Accessibility 3, Navigation 2 | TRUE | `executor.ts`: SEC-001/002/003; INPUT-001..005; RESP-001/002/003; A11Y-001/002/003; NAV-001/002. |
| "XSS (10 payloads), SQL Injection (10 payloads), HTML Injection (8 payloads)" | TRUE | SEC-001 payloads = 10, SEC-002 = 10, SEC-003 = 8. |
| Input "Long strings (up to 50K)" | TRUE | INPUT-002 lengths `[1000,5000,10000,50000]`. |
| "XSS is a `fail` only when a dialog or execution flag is observed (reflection alone is a `warning`); SQL-error detection is keyword-based (low confidence); every ticket carries an oracle and confidence field" | TRUE | SEC-001 fail/warning logic; SEC-002 `confidence: 'low'`; `ticket.ts` emits `oracle`/`confidence`. |
| "Browser web security stays on unless you pass `--insecure`" | TRUE | `browser.ts` only adds `--disable-web-security` when `insecure`. |
| Headed by default; headless automatically when CI or QA_HEADLESS=1 | TRUE | `cli.ts`: `headless = options.headless \|\| apiOnly \|\| unattended`. |
| "Every test session is recorded" (video) | TRUE | `browser.ts` `recordVideo`. |
| Reports to `docs/qa-reports/<date>/` with `report.markdown`, `tickets/tickets.md`, `evidence/` | TRUE | `reporter.ts` (`report.${format}` under `<date>`), `ticket.ts` (`tickets.md`/`tickets.json`). Note: `ticket.ts` writes `tickets.md` into its configured `outputDir` (`<output>/tickets`), consistent with the README path. |
| Advantage table ("No AI cost", "Automated CI/CD", etc.) | TRUE | Consistent with a headless CLI; reasonable framing. |

## Files section

| Claim | Verdict | Evidence |
|-------|---------|----------|
| Every file named in "Files" exists | TRUE | Spot-checked all named `references/core/*`, lenses, invariants, load, domains, templates (incl. the seven Playwright helpers and k6 templates), `tools/`, `agent/`. All present in `git ls-files`. |
| "`references/invariants/overlay-dialog.md` — 14 modal/overlay checks" | TRUE | OV1–OV14 in that file. |
| "templates/ … gated k6 load templates" | TRUE | `templates/k6/{baseline,ramp,spike,soak,throttle-probe}.js` + `lib/gate.js` + `targets.allow.example`. |

## Install / Updating / Troubleshooting / Glossary

| Claim | Verdict | Evidence |
|-------|---------|----------|
| "Using this in Claude Code" — link clone to `~/.claude/skills/<name>/SKILL.md`, restart | TRUE (except the `mklink`-in-PowerShell issue above) | Mechanism is correct; command syntax is the problem. |
| AGENTS.md / GEMINI.md / .cursor rule pointer snippets | TRUE | Standard convention files; content is a pointer, matching the design intent in `references/core/DESIGN.md`. |
| Troubleshooting rows (skill ignored, slash commands, browser won't open, self-test, domain pack none, k6 refused, rapid 429, many "candidate" findings) | TRUE | Each maps to real behaviour: headless env vars (`cli.ts`), `playwright install chromium`, `resolveDomain` returns none on marker miss, k6 gate `fail`, rapid 429 stop (`rapid.ts` `rateLimited`), candidate framing throughout. |
| Glossary (Charter, SBTM, Oracle, Lens, Domain pack, Three witnesses, Rapid action, Candidate finding, Kapsanmayan) | TRUE | All terms match their reference files. |

## Turkish section vs English

| Check | Verdict | Evidence |
|-------|---------|----------|
| Turkish quick-start mirrors the English 5-minute start | TRUE | Same steps: install, verify helpers, first charter, read "Kapsanmayan", next charter. |
| Turkish rules paragraph matches English "Rules of the road" | TRUE | Allowed-env only, `TEST_` data + two own users, credentials via env, headed-when-watched, Playwright both modes. |
| Turkish install uses the same `mklink` command | OVERSTATED/FALSE (same bug) | Turkish Adım 1/Adım 2 repeat `mklink` under a PowerShell heading; same defect as English. |
| Extra Turkish-only sections ("OpenCode (Bu Araç) ile Kullanım", command tables) | PARTIAL | They have no English equivalent, so the two language sections are not strictly 1:1; content is consistent in spirit. The "OpenCode" heading is an artifact of another tool and reads oddly in a Claude-oriented README. |

## Does the README set the expectations an ISTQB/exploratory-literate practitioner would expect — and avoid over-promising?

Largely yes. It leads with the right mental model (hypothesis-driven, oracle-based,
candidate-vs-confirmed, "say what was not covered"), names standards correctly, and
is refreshingly explicit that its own 68/100 score is stale and unverified. The
honest-scope section ("what this does *not* do") is exactly what a senior reviewer
wants to see. It does not promise bug-finding guarantees.

Three corrections would close the remaining gaps between promise and contents:

### Suggested correction 1 — fix the `mklink` command (English + Turkish)

The current block is labelled PowerShell but uses a cmd.exe builtin and cmd-style
`%USERPROFILE%`. Replace, in both the "Start in 5 minutes" block and "Using this in
Claude Code" (and the mirrored Turkish Adım 1):

> **Windows (Command Prompt / cmd.exe — `mklink` is a cmd builtin, not PowerShell):**
>
> ```bat
> mklink /J "%USERPROFILE%\.claude\skills\senior-qa-explorer" "<path-to-clone>"
> ```
>
> **Windows (PowerShell):**
>
> ```powershell
> New-Item -ItemType Junction -Path "$env:USERPROFILE\.claude\skills\senior-qa-explorer" -Target "<path-to-clone>"
> ```

### Suggested correction 2 — make the "detection-only" safety bullet precise

The injection side is genuinely detection-only now (destructive payloads removed),
but the XSS lens still ships a full payload catalog behind the banner, so a blanket
"reduced to detection-only" is imprecise. Replace the "Safety:" bullet's clause:

> - **Safety:** active injection and XSS material moved behind an authorization
>   banner and reduced to detection-only; load and authorization-matrix tools
>   refuse targets that are not allowlisted and default to dry-run.

with:

> - **Safety:** active injection testing is reduced to a detection-only posture
>   (one benign metacharacter, observe error leakage) behind an authorization
>   banner; the XSS payload catalog is likewise gated behind that banner (owned,
>   non-shared targets, written authorization) and must never be run on shared
>   environments. Load and authorization-matrix tools refuse non-allowlisted
>   targets and default to dry-run.

### Suggested correction 3 — label the anecdotes as illustrative

The "production SaaS goal-tracking", "five broken images", and "self-test found and
fixed two real helper bugs" stories have no evidence artifacts in the repo. Add one
sentence where they first appear, e.g.:

> *(These examples are illustrative accounts from earlier development runs; no
> evidence artifacts are shipped in this repository.)*

### Minor

- Align the Node floor: README says "Node 20+", `agent/package.json` says
  `>=18.0.0`. Pick one (recommend stating "Node 18+").
- Consider dropping or relabelling the Turkish "OpenCode (Bu Araç)" section so the
  Turkish and English sections stay 1:1.
