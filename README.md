# QABlindspot

*Finds the blind spots you did not think to test.* (Türkçe: *aklınıza gelmeyen
kör noktaları bulur.*)

> Repository: `Sn-QA-Bug-Hunter` · skill id (used by tools and commands):
> `senior-qa-explorer` · slash command: `/senior-qa-explorer` (optional
> shortcuts `/qa-session` and `/qa-explore`, see Installation). The id stays
> stable so existing links and installs keep working.

A skill for AI coding agents that turns "test module X" into what a
senior QA engineer would actually do: find out where it breaks, prove it,
and hand you a ticket you can file — not just confirm the happy path
works.

Most agents, told to test something, click through it once and say "looks
good." This skill exists to not stop there. Point it at a feature — a
form, a modal, a whole module, a live URL — and it runs a systematic
pipeline: read the code (or observe the running app if there's no code),
design test scenarios the way ISTQB test-design techniques would, execute
each one as a hypothesis to disprove, collect real evidence when
something looks wrong, and write up every confirmed defect as a
paste-ready ticket with the files to attach already sitting next to it.

## New here? Start in 5 minutes

You do not need to know anything about this skill beforehand.

**What it is.** A set of instructions plus helper scripts that make an AI
coding tool (Claude Code, Cursor, Codex CLI, Windsurf, Gemini CLI, ...) test
like a careful exploratory tester: form a hypothesis, try to break the app,
prove what you saw with saved files, and say honestly what was *not* covered.

**What you need.** An AI coding tool that can read files and run commands.
Node 18+ only if you want the helper scripts, self-tests or the standalone
agent. Playwright is always the browser engine for web work; the skill
provisions it in a scratch folder (`~/.qa-bug-hunter/playwright`), so your
project needs no changes.

**1. Install (once).**

    git clone https://github.com/MSagiroglu/qa-bug-hunter.git

Link the clone as a skill so your tool reads straight from it (full steps for every tool in
"Installation and usage by tool" below), then restart the tool:

    # Windows (cmd.exe)      mklink /J "%USERPROFILE%\.claude\skills\senior-qa-explorer" "<path-to-clone>"
    # Windows (PowerShell)   New-Item -ItemType Junction -Path "$env:USERPROFILE\.claude\skills\senior-qa-explorer" -Target "<path-to-clone>"
    # macOS / Linux          ln -s "<path-to-clone>" "$HOME/.claude/skills/senior-qa-explorer"

**2. Check that the helpers work (optional, 1 minute).** From the clone:

    cd agent && npm install && npx playwright install chromium && cd ..
    node tools/lint-references.mjs
    node tools/selftest/run-selftest.mjs
    node tools/selftest/run-rapid-selftest.mjs

Each should end with `0 finding(s)` / `SELFTEST PASSED` / `RAPID SELFTEST PASSED`.
These prove the helpers on local demo pages; they do not test your product.

**3. Run your first session.** Pick ONE small, risky screen and give a charter,
a one-sentence mission with three parts: *what to explore / with what / to find
what*. In your AI tool:

    /senior-qa-explorer session "Explore the Create form / with empty, very long and rapid repeated submits / to find duplicate records and missing loading states"

(The templates use the Turkish labels "Keşfet … / Şununla … / Bulmak için …";
either language works.) Not sure what to type? Use natural language:
`test the login page for bugs`, or `/senior-qa-explorer sweep <module>` for a full sweep.

**4. Read what you get.** The agent writes a one-page summary and, for each
finding, a ticket-ready write-up with its evidence files (screenshots, network
logs, video/trace). Read the **"Kapsanmayan"** (not covered) line first: it
tells you what was *not* checked. Findings are labelled:

| Label | Meaning | What you do |
|---|---|---|
| CONFIRMED DEFECT | an oracle establishes the expected behavior | file it, add a regression test |
| POTENTIAL DEFECT | suspicious, oracle is weak | ask the owner or find a stronger oracle |
| BEHAVIOR REQUIRING CLARIFICATION | might be intentional | ask, do not assert |
| candidate finding | a heuristic fired (e.g. empty submit accepted) | investigate; it is not a verdict |
| TEST GAP | not covered | schedule it |

**5. Repeat with a new charter.** Ideas noticed during a session go to the
charters backlog; each becomes the next session.

**Rules of the road (read these once).**
- Test only environments you are allowed to test. Never run load, injection or
  rapid-click bursts on production or on a shared environment without approval.
- Use data the run creates (`TEST_...`) and two test users of your own for
  permission checks. Existing data is read-only.
- Credentials: you log in yourself or supply them through environment
  variables. The skill never writes secrets into the repo or reports.
- A human watching the run means headed browser; unattended or CI means
  headless (`CI` or `QA_HEADLESS=1`). Playwright is used in both.
- Everything the skill derives from reading source code is a candidate until
  it is reproduced and confirmed with evidence.

### Prompts that work

| You want | Say |
|---|---|
| A modal that will not close, background scrolls | `/senior-qa-explorer session "Explore the <name> modal / with keyboard, small viewport and scroll / to find close, focus and scroll-lock failures"` |
| Double-click / loading-state bugs | `Run the rapid-action burst on every create, update and delete in <module>` |
| Who can do what | `Build a role x endpoint authorization matrix for <module> using my two test users` |
| Something with no spec | `Use metamorphic or differential checks on <feature>` |
| API only | `Test <endpoint list> as API-only` |
| Under load | `Plan a load check for <module>; dry-run first` (needs an allowlisted target) |
| What did we miss | `Run the second-opinion pass on the findings and list what was not covered` |
| Layout and visual consistency | `Run the layout scan on <screen> at phone, tablet and desktop, portrait and landscape, and list drift, overflow, misalignment and near-miss colors` |
| Old UI against new UI | `/qa-parity <module>` |
| Duplicate or failing requests | `Attach the screen health gate while you walk through <module>` |

## What it actually finds

Not "the button is misaligned." The classes of bug this is built to catch
are the ones that survive normal manual testing because they don't show
up on the happy path:

- **Frontend-only validation gaps.** A rule the UI enforces that the
  backend never checks — meaning anyone bypassing the UI (a direct API
  call, a different client) can violate it. In one real run against a
  production SaaS app's goal-tracking feature, this skill traced a
  boundary-value rule through the frontend source, found the backend
  endpoint had zero corresponding server-side check, and flagged it
  before writing a single line of test code — because it read where the
  constraint actually lived, not just whether the form looked right.
  *(Illustrative account from earlier development runs; no evidence
  artifacts from it are shipped in this repository.)*
- **Ghost successes.** The UI shows a success toast, but the write never
  actually persisted — or the reverse: it shows an error, but the data
  went in anyway. Neither is visible unless you deliberately verify
  persistence independently of what the screen claims, which this skill
  does for every write-capable feature (refresh mid-save, drop the
  connection mid-request, double-submit, throttle the connection — then
  check what's actually in the database). When a database connection is
  already available, it queries it directly instead of trusting an API
  re-fetch that could share the same bug as the thing it's checking.
- **Ripple-effect defects.** A shared/library record gets created,
  edited, deleted, or deactivated — does every other screen that consumes
  it reflect that correctly? This is the class of bug that only shows up
  when you think past the screen you're looking at.
- **Boundary, equivalence-partition, and negative-input defects** the
  standard way — but only where the actual constraint (type, min/max,
  regex, business rule) was found in source or observed live, never
  guessed.
- **Mobile-specific classes**: state lost on backgrounding, permission
  states other than the one path someone tested, deep links opened into
  the wrong app state, connectivity loss mid-write.
- **Responsive/layout defects** at mobile/tablet/desktop widths nobody
  manually resizes a window to check.
- **Cross-browser rendering/engine defects** — a finding that looks
  rendering- or JS-engine-related gets verified across whatever browser
  engines are available (Chromium, Firefox/Gecko, WebKit/Safari — Edge
  too, though it shares Chromium's engine so it's checked for its own
  quirks, not counted as independent diversity) before being finalized.
  Runs headed when you're watching live, headless for unattended batches.
- **Accessibility gaps** — missing alt text, unlabeled form inputs,
  keyboard traps, broken focus management in modals. Found by accident
  once (see below) and now checked on purpose, once per screen.
- **i18n/localization defects** in multi-language apps — text overflow in
  longer translations, locale-wrong date/number/currency formatting,
  half-done RTL layouts, pluralization edge cases.
- **Observational security hygiene issues** — API responses exposing
  fields a role shouldn't see, error responses leaking stack traces, a
  missing HTTP→HTTPS redirect. Passive only: this reads traffic the run
  already produces, it never crafts attack input — that's a different,
  separately-authorized kind of engagement, not this skill.
- **Empty submission defects** — forms that accept all-empty input and
  persist to database, missing backend validation entirely. The fastest
  way to find backend validation gaps with zero effort.
- **Data collision and authorization defects** — duplicates accepted despite
  uniqueness constraints and access across authorization boundaries (IDOR),
  tested only with data the run created and two test users of your own;
  existing data is treated as read-only.
- **Double-submit and missing in-flight guards** — fast repeated clicks on
  create/update/delete: is there a loading state, is the control blocked
  until the request returns, does the same API request go out twice, are
  duplicate records created, does a second delete fail cleanly.
- **Type confusion defects** — non-numeric values in numeric fields, HTML
  in plain text fields, script tags in input fields, wrong data types
  causing crashes or data corruption.
- **Race condition defects** — lost updates from concurrent editing,
  duplicate records from parallel creation, inconsistent state from
  simultaneous operations.
- **API contract violations** — mass assignment via unknown fields, missing
  required field validation, wrong Content-Type handling, null vs empty
  distinction failures.
- **Copy-paste and Unicode defects** — HTML injection via rich-format
  pasting, layout breaks from emoji/RTL text, truncation from null bytes,
  normalization issues creating duplicate representations.

## What it produces

A markdown report per run (coverage summary, what was tested, what
passed) plus one ticket per confirmed defect in this format:

```
TEST SET ID / TEST CASE ID
Title
📋 Steps to Reproduce
🖼️ Actual Result
🎯 Expected Result
📎 Ekler / Attachments
```

Steps to Reproduce include the verification steps that actually surfaced
the bug (Network tab checks, console errors, cross-account comparisons),
not just the click path. Actual/Expected separate observed fact from
root-cause assessment. Ekler/Attachments lists real files — screenshots,
saved network request/response JSON, console logs, video/trace when
enabled — written to `docs/qa-reports/evidence/<date>-<module>/`, ready
to drag into Jira or any tracker (no ticket-tracker API is assumed).

It never rounds a maybe up to a confirmed bug: every finding states which
oracle it's based on (an explicit spec beats a backend contract beats a
source-code business rule beats "consistent with the rest of the app"
beats a QA guess), and anything below a confident oracle gets filed as
"Behavior Requiring Clarification," not asserted as a defect.

For every confirmed defect, it also asks whether to lock it in as a
permanent regression test in your existing suite — finding a bug once and
writing it up is half the job; making sure it can't come back silently is
the other half.

## What it needs from you

As little as possible. It works with:

- **A full source repo**, any stack — it detects what's there (Playwright/
  Cypress/Jest for web; Detox/Appium/Maestro/Patrol/XCUITest/Espresso for
  mobile) and reuses it.
- **Just a URL and credentials**, no source at all — it reads the live
  DOM and network traffic instead of code, and if there's no execution
  tooling reachable, it provisions a minimal throwaway one itself
  (Playwright for web, Appium for mobile) in a scratch location, never
  touching your repo.
- **Anything in between.**

## Honest scope — what this does *not* do

This is a methodology an AI agent follows, not a device lab. It drives
whatever tooling already exists or that it can provision — it does not
open a physical device or a simulator/emulator that isn't already
reachable from wherever it's running. If it can't reach a working
execution path for the target platform, it's required to say so
explicitly rather than quietly downgrading to a source-only pass without
flagging it as incomplete.

## What changed in this release (October 2026)

An independent assessment of the previous version scored it **68/100** against
ISTQB CTFL 4.0 and the exploratory-testing literature (see `docs/evaluation/`).
This release closes most of the gaps it found. A fresh, independent reviewer
(a separate model instance, same rubric, previous scores hidden until after it
scored) re-scored it at **92/100**; see `docs/evaluation/2026-10-14-rescore.md`,
and `docs/evaluation/2026-10-14-readme-audit.md` for a claim-by-claim audit of
this README. Read the +24 as indicative, not precise: the two scores come from
different reviewers without calibration, and nothing was run against a
production-like application (see "How it maps to the literature" below).

- **Structure:** one core engine, platform lenses (web, mobile, API), UI
  invariants, load method, and optional private domain packs.
  `SKILL.md` is now a router that picks mode, lenses and pack.
- **Session mode:** charter, 60-minute timebox, tagged notes, one-page summary
  with a mandatory "not covered" line, charters backlog.
- **New techniques:** risk register and assumptions register, rapid-action
  (double-submit / in-flight guard) testing, three-witness API+UI check,
  role x endpoint authorization matrix, metamorphic/differential testing,
  second-opinion pass, heuristics and tours, time/data/concurrency/locale
  dimensions, planning and exit criteria, ISTQB technique mapping and
  principles, overlay/modal invariants (WAI-ARIA dialog).
- **Safety:** active injection testing is reduced to a detection-only posture
  (one benign metacharacter, observe error leakage) behind an authorization
  banner; the XSS payload catalog is gated behind that banner (owned,
  non-shared targets, written authorization) and must never be run on shared
  environments. Load and authorization-matrix tools refuse non-allowlisted
  targets and default to dry-run.
- **Fixes:** assertion-alone "CONFIRMED DEFECT" verdicts became candidate
  findings routed through the oracle; the hygiene-vs-collision contradiction
  was resolved; corrupted characters and a duplicate checklist line removed;
  headed/headless is now "headed when watched, headless when unattended".
- **Standalone agent:** `--domain`/`--repo` pack detection, `overlay`, `api`
  and `rapid` suites, no hardcoded site selectors, reflection is not reported
  as XSS, unsafe browser flags are opt-in.
- **Self-tests:** the overlay and rapid-action helpers are proven on local
  good/bad demo pages; the self-test found and fixed two real helper bugs.
- **Not changed on purpose:** Playwright remains the engine for web work;
  existing Turkish reference files were not translated.

## What changed in the 19 October 2026 update (lessons from a real parity run)

Learned from a multi-day comparison of a legacy UI and its rewrite over one backend:

- **Parity mode** (`references/core/parity-sweep.md`): reference vs under-test,
  findings classed NEW-ONLY / BOTH / INTENDED / REFERENCE-ONLY, round-trip save
  probe, role chain, wire-format comparison.
- **Calculation verification** (`references/core/calculation-verification.md`):
  derive the formula from source, hand-calculate on four or more actors,
  cross-surface consistency matrix; never assume the "expected" number.
- **Render leak scan** (`references/core/render-leak-scan.md`,
  `templates/playwright/render-leak-scan.ts`): raw JSON, `[object Object]`,
  unresolved templates and visible markup, on every screen visited.
- **Automation reliability** (`references/core/automation-reliability.md`):
  attach to the user's logged-in browser, wait on conditions, fresh data per
  scenario, flake vs defect, one cleanup list.
- **Causal attribution** in the second-opinion pass: a cause is stated only
  after a controlled change on fresh data; wrong causes in filed tickets are
  edited, not duplicated.
- **Round-trip / idempotent save** and **date vs datetime on the boundary day**
  added to the metamorphic and perturbation references.
- **Annotated comparison images** rule (label by environment, one color per
  environment) in `evidence-capture.md`; **filing workflow** (de-duplicate,
  one ticket at a time, evidence delivered with each) in `jira-ticket-template.md`.
- **Fixed contradictions:** "Playwright always provisioned" is now "reuse or
  attach, provision only if none"; "refresh needed = DEFECT" is now a candidate
  finding routed through the oracle; "read ALL references" is now scoped to
  the selected mode, lenses and triggers.

## What changed in the 22 October 2026 update (lessons from ten days of daily use)

Ten days of daily use on a multi-module legacy-vs-rewrite effort produced about
two hundred findings. Roughly 44% were visual, layout, responsive or text
differences, and about one finding in five was only found after the owner pushed
back. Most of those misses could have been caught mechanically. This update
turns that into tooling and rules (details: `docs/analysis/2026-10-22-usage-analysis-and-roadmap.md`).

- **Layout and visual consistency scan** (`references/core/layout-consistency.md`,
  `references/lenses/mobile/mobile-layout.md`, `templates/playwright/layout-scan.ts`):
  measures instead of eyeballing: horizontal scroll, elements beyond the viewport or
  their container, clipped text, overlaps, centering and alignment near-misses (1 to 4 px),
  uneven gaps, same-role controls of different size, near-miss colors, contrast, tap targets.
  Runs over a viewport x orientation x zoom matrix, annotates screenshots, and produces a
  style signature you can diff between two sides in Parity mode. Proven by a self-test that
  seeds defects and checks a page of legitimate patterns stays clean.
- **Screen health gate, settle detection and export diff** (`templates/playwright/screen-health-gate.ts`,
  `templates/playwright/settle.ts`, `tools/export-diff.mjs`): console and network health per screen
  (errors, 4xx/5xx, slow and duplicate requests), "wait until the page is stable before measuring",
  and a CSV/TSV cell-level diff for exported files.
- **Select and multi-select controls** (`references/lenses/web/select-controls.md`): 0/1/2/6/many/all
  selections, option content versus the reference, search inside the list, panel placement.
- **Screen element and state inventory** (`references/lenses/web/ui-state-parity-checklist.md`) and a
  mandatory **parity coverage matrix** (`references/core/parity-coverage-matrix.md`): empty, loading and
  error states, tooltips, icons, scrollbars, landscape, "not tested" is a to-do and not an excuse.
- **ENFORCEMENT** gained anti-patterns for the exact shortcuts that were caught ("looked fine at one width",
  "colors look the same", "the whole exploration is done").
- **Private product commands** are documented as a local convention (see "Private product commands"
  below); nothing product-specific belongs in this repository.

## Four ways to call it, and what you can do with them

All four run the **same skill** with the same rules. They differ only in the mode
they select. Each one asks you for missing input instead of inventing it.

| Call | Mode it selects | Input | What happens |
|---|---|---|---|
| `/qa-explore <module>` | **Sweep**: all 7 phases over one module, screen or URL | A module, feature or URL | Discovery, test model, ISTQB-based design, execution, evidence, classification, full report and tickets. Ask-back: which module if the target is empty or ambiguous |
| `/qa-session "<charter>"` | **Session**: time-boxed (about 60 min), one direction | A charter: `Keşfet ... / Şununla ... / Bulmak için ...` | Tagged notes while you explore, a one-page summary with a mandatory "not covered" line and a next-charter line. Ask-back: asks for a charter, never invents one |
| `/qa-parity <module>` | **Parity**: Sweep plus old-versus-new comparison | A module present in both implementations | Asks which side is the reference, which is under test, which environment serves each; builds the coverage matrix; both sides at the same window size; every difference classed NEW-ONLY / BOTH / INTENDED / REFERENCE-ONLY; annotated images; tracker de-duplication before filing |
| `/senior-qa-explorer [mode] <target>` | The skill itself: first word picks `session`, `sweep`, `parity`, `api` or `load` (default Sweep) | Mode word + target or charter | The only form that also reaches **API-only** and **Load**, and the only one that needs no extra file |

The three `qa-*` commands are optional presets: copy them from `extras/claude-commands/`
into `~/.claude/commands/`. `/senior-qa-explorer` always works. Besides these four there are
three more entry points: plain words ("test the login page for bugs", the skill picks the mode),
the standalone agent (`agent/`, no AI tool needed, good for CI), and pointer files for other
AI tools (Cursor, Codex CLI, Windsurf, Gemini CLI, Copilot) described in "Installation and usage by tool".

### What people can do with it

| I want to ... | Call | What the skill does | You get |
|---|---|---|---|
| Take a first look at a new feature and find what I would not think of | `/qa-session` | One charter, one direction (interrupt, network, screen, state, data, permission), tagged notes | One-page summary, tickets, "not covered", next charters |
| Run a systematic pre-release pass over a module | `/qa-explore` | 7 phases, risk register, oracle per finding, second-opinion pass | Full report, paste-ready tickets, evidence files |
| Verify a rewrite or migration against the old behavior | `/qa-parity` | Same steps on both sides, coverage matrix, scope classes, round-trip save, calculation checks | NEW-ONLY / BOTH lists, annotated comparison images, "not tested" list |
| Find drifting, overflowing, off-center or misaligned elements, uneven spacing, near-identical colors, bad responsive behavior | any mode, say "run the layout scan" | Measures every screen at a viewport x orientation x zoom matrix and in each state; flags 1 to 4 px misalignment, near-miss colors, contrast, tap targets; diffs the style signature of two sides | Numbered findings with measured values and annotated screenshots |
| Catch duplicate, slow or failing requests and console errors | any mode, say "attach the screen health gate" | Records errors, 4xx/5xx, slow and duplicate requests per screen or step | Counts per action, lead list to classify |
| Check that numbers (scores, totals, averages) are right | any mode | Derives the formula from source, hand-calculates on 4+ actors, compares every surface | Cross-surface consistency matrix |
| Find double-click and missing-loading-state bugs | any mode | Bursts of 2x and 5x on create/update/delete, request count, in-flight guard | Per-action table |
| Compare exported files between two sides | any mode, say "diff the exports" | Same filter on both sides, download, cell-level diff | Row/column coordinates of every difference |
| Test an API without a UI | `/senior-qa-explorer api` | Role x endpoint matrix with your own users, contract violations, three-witness check | Mismatch list, curl-ready reproductions |
| Plan a load or capacity check | `/senior-qa-explorer load` | Safety gates and dry-run first; refuses targets that are not allowlisted | Plan, assertions, dry-run output |
| Test a mobile app or a mobile web view | any mode, say "use the mobile layout lens" | Device matrix, safe areas, dynamic type, orientation, tap targets, bounds read without eyeballing | Findings per device/orientation, honest "cannot verify without a device" list |

### Private product commands (never in this repository)

This repository is generic and public. Everything that belongs to **your** product stays on
your machine: environment URLs, role-chain tricks, ticket naming rules, module names, test
accounts, lessons learned.

1. Keep a private domain pack outside the repository (`<packs-dir>/<your-product>/`, see
   "Create your own domain pack").
2. Put product presets in `<packs-dir>/<your-product>/commands/<preset>.md`. A preset is just a
   command file that tells the skill which mode, which pack and which fixed setup to use, for example:

       ---
       description: [MY PRODUCT] parity of the new UI against the old UI
       argument-hint: <module>
       ---
       Use the `senior-qa-explorer` skill in Parity mode with the `<your-product>` domain pack.
       Target: $ARGUMENTS
       Under test: <new UI environment>. Reference: <old UI environment>. Same window size on both.
       Fresh `TEST_` data only; never type passwords; list existing tickets before filing.

3. Copy the preset to `~/.claude/commands/` (or `<project>/.claude/commands/`). It now appears as
   its own slash command. Nothing is committed anywhere.
4. Optional but recommended: install the guard in `extras/git-hooks/` as `.git/hooks/pre-commit` and list
   your product's terms (names, hostnames, module names, ticket prefixes), one regular expression per line,
   in `.git/private-patterns`. It blocks a commit whose added lines contain any of them, and it fails
   closed if the check itself errors. Neither the hook nor the pattern file is versioned.

## Modes, lenses and domain packs

**Which mode when**

| Situation | Mode | How to start |
|---|---|---|
| New feature, first look, "what could break?" | Session | `/senior-qa-explorer session "<charter>"` |
| Systematic pass over a module before release | Sweep (default) | `/senior-qa-explorer sweep <module>` |
| Legacy UI and its rewrite over one backend | Parity | `/senior-qa-explorer parity <module>` |
| No UI in scope, or API is the main risk | API-only | "test <endpoints> as API-only" (no browser needed) |
| Capacity, throttling, behavior under load | Load | dry-run first; needs an allowlisted target and approval |

- **Lenses:** `references/lenses/` for web, mobile and API, plus
  `six-directions.md` (Interrupt, Network, Screen/Shape, State, Data,
  Permission). When stuck, pick one direction and go deep instead of running
  every check.
- **Core techniques:** see the file list below; each is a short reference the
  agent reads only when the target needs it.
- **Domain packs (optional, private):** product-specific knowledge (modules,
  roles, safety rules, generated inventories) lives OUTSIDE this repo in
  `QA_DOMAIN_PACKS_DIR` or `%USERPROFILE%\.qa-bug-hunter\domains\`
  (`~/.qa-bug-hunter/domains/` on macOS/Linux). A pack is detected
  automatically when the `Markers:` listed in its `pack.md` exist in the repo
  being tested. No pack means the skill still works. Never commit a pack.
- **Self-tests:** `node tools/selftest/run-selftest.mjs` (overlay helper) and
  `node tools/selftest/run-rapid-selftest.mjs` (rapid-action helper).
- **Evaluation:** `docs/evaluation/` holds the scored assessment and gap backlog.

**Create your own domain pack** (for the product you test every day):

1. Copy `references/domains/_template/` to
   `<packs-dir>/<your-product>/`.
2. In `pack.md`, set `Markers:` (paths that exist at the product repo root,
   e.g. a solution file and a test-id folder) and the reading order.
3. Fill `roles.md` (roles and contextual authorities), `modules.md` (modules to
   routes/controllers/test ids), `env-safety.md` (shared environments,
   throttling, what must be mocked).
4. Optionally add a role x module x action matrix, a settings impact map and a
   charters backlog. Mark every claim you did not verify as `?` or
   `unverified`; a static reading of code gives candidates, not defects.
5. Keep it out of version control. Re-verify evidence references when the
   product changes.

**Safety in one place**
- Active injection/XSS material is out of default scope: it needs written
  authorization on an owned, non-shared target.
- Load tooling and the authorization-matrix runner require an allowlisted
  target, send nothing in dry-run mode and respect request budgets.
- Rapid-action bursts are capped and use only data created by the run.
- Never place credentials in the repo, in evidence files or in reports.

## How it maps to the literature

Taken from the independent re-score (`docs/evaluation/2026-10-14-rescore.md`).
"Covered" means a reference file or phase implements it; it does not mean it was
validated on a production system.

**ISTQB CTFL 4.0 areas**

| Area | Status | Where |
|---|---|---|
| 7 principles | Covered | `references/core/principles.md` |
| Planning, monitoring and control, completion/exit criteria, traceability | Covered | `references/core/planning-and-completion.md` |
| Analysis, design, execution | Covered | `SKILL.md` phases 1-4, `test-design-techniques.md` |
| Test implementation (environment/suite build) | Partial | implied in phase 4 and templates, not a named activity |
| Equivalence partitioning, boundary values, decision table, state transition, use case, pairwise | Covered | `test-design-techniques.md` (with an ISTQB cross-reference table) |
| White-box concepts | Partial | offered as a code-reading lens (which branches does no test exercise), not measured coverage, by design |
| Experience-based (error guessing, exploratory, checklist), collaboration-based | Covered | `test-design-techniques.md`, session mode |
| Risk-based (likelihood x impact, product vs project risk) | Covered | `references/core/risk-register.md` |
| Defect management and independence | Covered | `defect-classification.md`, `second-opinion.md` |
| Tool support | Covered | Playwright, k6, standalone agent, helper self-tests |

**Exploratory-testing literature**

| Source | Status |
|---|---|
| Kaner (oracles), J. Bach (session-based test management), Whittaker (tours), Hendrickson (heuristics), property-based testing | Covered |
| Weinberg, Myers, chaos/resilience framing | Partial (spirit present, not cited or not framed that way) |
| Beizer bug taxonomy, Crispin-Gregory agile testing quadrants, test pyramid | Not covered |

**Known limits (stated plainly)**
- Nothing here was exercised against a production-like application; helpers are
  proven only on local good/bad demo pages. Findings derived from reading code
  are candidates until reproduced.
- Some reference files are in Turkish on purpose (this repository is also used
  by a Turkish-speaking team): session mode, charters, parts of the test-design
  and attack catalogs. A reader or agent that does not read Turkish loses that
  content.
- `PORTABLE.md` is a hand-maintained snapshot and is stale; `SKILL.md` is
  authoritative.
- Mobile has guidance but no runnable harness like the web helpers; mobile
  black-box exploration is a known gap.
- "Playwright is always provisioned" is the intent; an AI agent cannot
  guarantee it, so the skill requires it to say so when provisioning fails.

## Standalone Agent (NEW)

The QA Bug Hunter is now also a **standalone CLI agent** that can run
independently without any AI coding tool. It is a **smoke-test harness**,
not a universal tester: the input/security suites discover a search box by
role/type/placeholder, and when none is found the test is reported as
`skipped: no target element` (some sites need per-site selector
configuration in `agent/src/lib/executor.ts`). Findings are heuristic: XSS is a
`fail` only when a dialog or execution flag is observed (reflection alone is a
`warning`), SQL-error detection is keyword-based (low confidence), and every
ticket carries an oracle and confidence field. Browser web security stays on
unless you pass the opt-in `--insecure` flag. Use the skill for judgment-heavy
testing.

### Advantage

| Feature | Skill (AI Agent) | Standalone Agent |
|---------|------------------|------------------|
| Requires AI tool | Yes (Claude, Cursor, etc.) | No |
| Runs independently | No | Yes |
| Automated CI/CD | No | Yes |
| Scheduled runs | No | Yes |
| No AI cost | No | Yes |
| Full AI reasoning | Yes | No |

**Use the Skill when:** You need AI to understand context, reason about
business logic, and make judgment calls.

**Use the Agent when:** You need fast, repeatable, automated testing
without AI costs — CI/CD pipelines, nightly regression runs, quick
smoke tests.

### Installation

```bash
# Clone the repository
git clone https://github.com/MSagiroglu/qa-bug-hunter.git
cd qa-bug-hunter/agent

# Install dependencies
npm install

# Build
npm run build
```

### Usage

```bash
# Basic test
node dist/cli.js test --url https://example.com

# Headless mode (for CI/CD)
node dist/cli.js test --url https://example.com --headless

# Custom timeout
node dist/cli.js test --url https://example.com --timeout 120000

# DOM analysis only
node dist/cli.js analyze --url https://example.com

# Overlay and API suites, domain pack (optional)
node dist/cli.js test --url http://localhost:3000 --suites overlay,api --domain <name> --repo <path>
```

### Test Suites

| Suite | Tests | What it checks |
|-------|-------|----------------|
| Security | 3 | XSS (10 payloads), SQL Injection (10 payloads), HTML Injection (8 payloads) |
| Input | 5 | Empty submit, Long strings (up to 50K), Special chars, Unicode, Type confusion |
| Responsive | 3 | Mobile (375px), Tablet (768px), Desktop (1920px) |
| Accessibility | 3 | Alt text, Form labels, Heading hierarchy |
| Navigation | 2 | Broken links (internal only), Console errors |
| Layout (`-s layout`) | measured | Layout and visual consistency at 375x812, 812x375, 768x1024, 1280x800, 1920x1080: horizontal scroll, overflow, clipping, overlap, centering and alignment near-misses, uneven gaps, same-role size variance, near-miss colors, contrast, tap targets. Read-only; reuses `templates/playwright/layout-scan.ts` |
| Health (`-s health`) | measured | Console errors, uncaught exceptions, 4xx/5xx, slow and duplicate requests while the page loads and settles. Read-only; reuses `templates/playwright/screen-health-gate.ts` |
| Overlay / API / Rapid | measured | `overlay` (14 modal checks), `api` (replay of the run's own writes without credentials), `rapid` (bursts on create/update/delete, opt-in) |

### Features

- **Video Recording:** Every test session is recorded
- **Headed Mode:** Tests run in full-screen headed mode by default; headless automatically when `CI` or `QA_HEADLESS=1` is set
- **Evidence Collection:** Screenshots and video for every test
- **Jira-Ready Tickets:** Formatted tickets with steps, actual/expected, evidence
- **Technical Details:** JSON details for each test result

### Output

Reports are saved to `docs/qa-reports/<date>/`:
- `report.markdown` — Full test report with video link
- `tickets/tickets.md` — Jira-format tickets for failures
- `evidence/` — Screenshots and evidence files

## 🇹🇷 Türkçe Kullanım Rehberi

### Hızlı Başlangıç (Skill'i Hiç Bilmeyenler İçin)

1. **Kur:** depoyu klonla, `~/.claude/skills/senior-qa-explorer` yoluna bağla
   (aşağıdaki "Claude Code ile Kullanım"), aracı yeniden başlat.
2. **Yardımcıları doğrula (isteğe bağlı):**
   `cd agent && npm install && npx playwright install chromium && cd ..`, sonra
   `node tools/lint-references.mjs`, `node tools/selftest/run-selftest.mjs`,
   `node tools/selftest/run-rapid-selftest.mjs`. Çıktılar `0 finding(s)`,
   `SELFTEST PASSED`, `RAPID SELFTEST PASSED` olmalı.
3. **İlk oturum:** küçük ve riskli tek bir ekran seç, üç parçalı bir görev yaz:
   *Keşfet ne / Şununla ne / Bulmak için ne.*

       /senior-qa-explorer session "Keşfet: Kayıt oluştur formu / Şununla: boş, çok uzun girdi ve hızlı art arda tıklama / Bulmak için: çift kayıt ve eksik loading durumu"

   Ne yazacağını bilmiyorsan: `login sayfasını test et` ya da tam tarama için
   `/senior-qa-explorer sweep <modül>`.
4. **Çıktıyı oku:** önce **"Kapsanmayan"** satırına bak (neye bakılmadığı).
   Bulgular `CONFIRMED DEFECT`, `POTENTIAL DEFECT`, `BEHAVIOR REQUIRING
   CLARIFICATION`, aday bulgu (sezgisel, hüküm değil) ve `TEST GAP` olarak
   etiketlenir. Aday bulguyu yeniden üret ve kanıtla, sonra raporla.
5. **Yeni görev:** oturumda fark edilen fikirler charter backlog'una gider,
   her biri bir sonraki oturum olur.

**Kurallar:** yalnızca test etmeye yetkili olduğun ortamlarda çalış; prod ve
paylaşımlı ortamda onaysız yük, enjeksiyon veya hızlı tıklama yapma; yalnızca
oturumun kendi oluşturduğu `TEST_` verisini ve kendi iki test kullanıcını
kullan; mevcut veri salt okunurdur; giriş bilgilerini sen girersin veya ortam
değişkeniyle verirsin; kimse izliyorsa headed, gözetimsiz/CI ise headless
(`CI` veya `QA_HEADLESS=1`), Playwright ikisinde de kullanılır.

**Hızlı tıklama / çift gönderim testi:** her ekleme, güncelleme ve silmede
eylemi önce 2, sonra 5 kez hızlı tekrarla. Loading göstergesi var mı, istek
dönene kadar buton kilitleniyor mu, aynı API isteği birden fazla gidiyor mu,
çift kayıt oluşuyor mu, ikinci silme temiz hata veriyor mu? Ayrıntı:
`references/core/rapid-action-testing.md`.

### Kurulum

```bash
# 1. Depoyu klonla
git clone https://github.com/MSagiroglu/qa-bug-hunter.git
cd qa-bug-hunter

# 2. Agent'ı kur (terminalde test etmek için)
cd agent
npm install
npm run build
cd ..
```

### Skill Nedir?

Skill, AI araçlarına test metodolojisini öğretir. Siz natural language ile "test et" dersiniz, AI aracınız SKILL.md'yi okuyarak:
1. Keşif yapar (Discovery)
2. Test senaryoları tasarlar
3. Testleri çalıştırır
4. Kanıtları toplar
5. Rapor ve ticket oluşturur

### Claude Code ile Kullanım

**Adım 1: Skill'i kur**
```bat
:: Windows (cmd.exe) — mklink bir cmd komutudur, PowerShell'de çalışmaz
mklink /J "%USERPROFILE%\.claude\skills\senior-qa-explorer" "<klon-yolu>"
```

```powershell
# Windows (PowerShell)
New-Item -ItemType Junction -Path "$env:USERPROFILE\.claude\skills\senior-qa-explorer" -Target "<klon-yolu>"
```

```bash
# macOS / Linux
ln -s "/path/to/qa-bug-hunter" "$HOME/.claude/skills/senior-qa-explorer"
```

**Adım 2: Claude Code'u yeniden başlat**

**Adım 3: Test ettir**

Doğal dil ile:
```
test the login page for bugs
example.test'yi exploratory test et
login modülünü test et, hataları bul
```

Veya explicit komut ile:
```
/senior-qa-explorer sweep example.test
/senior-qa-explorer sweep login-page
```

### Doğal Dil ile Kullanım (hangi AI aracı olursa olsun)

AI aracına doğrudan söyle:
```
app.example.test'i test et
```

Veya:
```
app.example.test'i exploratory test et, bulgu raporu çıkar
Login sayfasını test et, XSS açığı bul
Responsive test et, mobil uyumluluğu kontrol et
```

### Cursor / Windsurf / Codex CLI ile Kullanım

Proje kökünde `AGENTS.md` oluştur:
```markdown
## Exploratory QA testing

For exploratory / bug-hunting test requests on this repo, read and follow:

    <klon-yolu>/SKILL.md
```

Sonra doğal dilde:
```
test the login page for bugs
login modülünü test et
```

### Terminal'den (AI Gerektirmez)

```bash
cd <klon-yolu>/agent

# Tam test
node dist/cli.js test --url https://app.example.test

# Headless (CI/CD için)
node dist/cli.js test --url https://app.example.test --headless

# Sadece DOM analizi
node dist/cli.js analyze --url https://app.example.test
```

### Hangi Araçta Nasıl Kurulur (Özet)

| Araç | Ne yapılır |
|---|---|
| Claude Code | `~/.claude/skills/senior-qa-explorer` yoluna bağla (Windows cmd: `mklink /J`, PowerShell: `New-Item -ItemType Junction`, macOS/Linux: `ln -s`), yeni oturum aç. Tek proje için `<proje>/.claude/skills/senior-qa-explorer`. |
| Cursor | Projede `.cursor/rules/qa-explorer.mdc` içine `SKILL.md` yolunu yaz |
| Codex CLI, Windsurf | Proje kökünde `AGENTS.md` içine `SKILL.md` yolunu yaz |
| Gemini CLI | `GEMINI.md` içine aynı metin |
| GitHub Copilot | `.github/copilot-instructions.md` içine aynı metin (klon klasörü çalışma alanında olmalı) |
| Dosya okuyamayan sohbet araçları | `PORTABLE.md` içeriğini özel talimat olarak yapıştır (test çalıştıramaz, yalnız tasarım/gözden geçirme) |

Ayrıntılar ve doğrulama adımları için yukarıdaki İngilizce "Installation and
usage by tool" bölümüne bak. Kaldırırken yalnızca bağlantıyı sil:
Windows'ta `rmdir "%USERPROFILE%\.claude\skills\senior-qa-explorer"`,
macOS/Linux'ta `rm "$HOME/.claude/skills/senior-qa-explorer"` (`-r` kullanma).

### Örnek Kullanım Komutları

| Komut (Doğal Dil) | Ne Olur |
|-------------------|---------|
| `app.example.test'i test et` | Tam exploratory test |
| `XSS açığı bul` | Güvenlik testleri odaklı |
| `Responsive test et` | Mobil/tablet uyumluluk |
| `Accessibility kontrol et` | Erişilebilirlik testleri |
| `Login sayfasını test et` | Modül bazlı test |
| `Hata bul, ticket çıkar` | Bulgu + Jira ticket |

| Komut (Claude Code) | Ne Olur |
|---------------------|---------|
| `/senior-qa-explorer sweep example.test` | URL bazlı test |
| `/senior-qa-explorer sweep login` | Modül bazlı test |

| Komut (Terminal) | Ne Olur |
|------------------|---------|
| `node dist/cli.js test --url URL` | Hızlı otomatik test |
| `node dist/cli.js test --url URL --headless` | Arka plan testi |

### Dört çağırma şekli ve neler yapılabilir

Dördü de **aynı skill'i** çalıştırır; fark yalnızca hangi modu hazır seçtiklerindedir. Eksik girdide hiçbiri uydurmaz, sorar.

| Komut | Mod | Ne verirsin | Ne olur |
|---|---|---|---|
| `/qa-explore <modül>` | **Sweep**: 7 aşamalı sistematik tam tarama | Modül, özellik veya URL | Keşif, test modeli, ISTQB tasarımı, yürütme, kanıt, sınıflandırma, tam rapor ve biletler |
| `/qa-session "<charter>"` | **Session**: ~60 dk, tek yön | `Keşfet … / Şununla … / Bulmak için …` | Etiketli notlar, "Kapsanmayan" ve "Sonraki görev" satırlı tek sayfa özet |
| `/qa-parity <modül>` | **Parity**: Sweep + eski/yeni karşılaştırma | İki arayüzde de bulunan modül | Referans/test edilen/ortam sorulur; kapsam matrisi; iki taraf aynı pencere boyutunda; her fark sınıflanır (sadece yeni / ikisinde de / kasıtlı / sadece referans) |
| `/senior-qa-explorer [mod] <hedef>` | Skill'in kendisi; ilk kelime `session`, `sweep`, `parity`, `api`, `load` | Mod kelimesi + hedef | **API-only ve Load'a ulaşmanın tek yolu**, ek dosya gerektirmez |

`qa-*` komutları isteğe bağlı kısayollardır (`extras/claude-commands/` içinden `~/.claude/commands/` altına kopyalanır). Ayrıca düz cümle, bağımsız ajan (`agent/`, CI için) ve diğer araçlardaki işaretçi dosyalar da giriş noktalarıdır.

**Neler yapılabilir:** yeni özelliğe ilk bakış (`/qa-session`), sürüm öncesi tam tarama (`/qa-explore`), yeniden yazım doğrulaması (`/qa-parity`), **düzen ve görsel tutarlılık taraması** (kayma, taşma, ortalama, hizalama, aralık, neredeyse aynı renkler, responsive; viewport × yön × zoom matrisinde ölçerek), ekran sağlık kapısı (hata, yavaş ve çift istek), sayı/hesap doğrulama, çift tıklama ve yükleniyor durumu, dışa aktarılan dosya karşılaştırması, API testi (`api`), yük planı (`load`), mobil düzen.

**Ürününüze özel komutlar depoya girmez:** URL'ler, rol zinciri, bilet kuralları, modül adları, test hesapları özel domain paketinizde (`<paket>/commands/`) durur; oradan `~/.claude/commands/` altına kopyalarsınız. Sızıntıya karşı `extras/git-hooks/` içindeki isteğe bağlı koruma betiğini ve `.git/private-patterns` dosyasını kullanın (ikisi de sürümlenmez).

### Ne Zaman Ne Kullanılır?

| Durum | Kullanım |
|-------|----------|
| Hızlı test istiyorsan | Bana söyle (SKILL.md) |
| CI/CD'de otomatik istiyorsan | Agent (`node dist/cli.js`) |
| Gece test etsin istiyorsan | Agent + cron |
| AI maliyeti olmasın istiyorsan | Agent |
| Akıllı kararlar versin istiyorsan | Bana söyle (SKILL.md) |

---

## Files

Router and rules
- `SKILL.md` — router and the phases: picks mode, lenses and domain pack.
- `ENFORCEMENT.md` — checklist that must be completed before and after a run.
- `PORTABLE.md` — frozen snapshot of the methodology for tools that cannot
  read files (`SKILL.md` is authoritative where they differ).

`references/core/` — platform-neutral engine
- Discovery and design: `discovery.md`, `blackbox-discovery.md`,
  `impact-analysis.md`, `test-design-techniques.md` (ISTQB techniques and
  mapping), `input-mutation-catalog.md`, `search-testing-patterns.md`,
  `advanced-exploratory-attacks.md`, `critical-defect-patterns.md`,
  `database-verification.md`, `security-hygiene.md`, `principles.md`.
- Oracles and judgment: `oracle-hierarchy.md`, `metamorphic-differential.md`,
  `heuristics-cheatsheet.md`, `second-opinion.md`.
- Risk and process: `risk-register.md`, `planning-and-completion.md`,
  `session-mode.md`, `charters-backlog.md`, `diff-to-charter.md`.
- Newer techniques: `rapid-action-testing.md`, `perturbation.md`,
  `perturbation-dimensions.md`, `api-ui-crosscheck.md`, `authz-matrix.md`,
  `parity-sweep.md`, `parity-coverage-matrix.md`, `calculation-verification.md`,
  `render-leak-scan.md`, `automation-reliability.md`, `layout-consistency.md`,
  `screen-health-and-export.md`.
- Evidence and reporting: `evidence-capture.md`, `defect-classification.md`,
  `jira-ticket-template.md`, `report-template.md`.

`references/lenses/` — platform specifics
- `web/` (accessibility, i18n, responsive, shadow DOM, XSS patterns, select controls,
  UI element and state inventory),
  `mobile/` (discovery, exploratory considerations, mobile layout), `api/` (API lens,
  backend manipulation tests, active ones behind an authorization banner),
  `six-directions.md`.

Other
- `references/invariants/overlay-dialog.md` — 14 modal/overlay checks.
- `references/load/` — load method, scenarios, assertions, safety gates.
- `references/domains/` — domain pack contract and an empty template.
- `templates/` — report/session/charter/risk templates, Playwright helpers
  (`overlay-invariants`, `rapid-action`, `api-ui-crosscheck`, `authz-matrix`,
  `metamorphic`, `perturb`, `ui-under-load`, `render-leak-scan`, `layout-scan`,
  `screen-health-gate`, `settle`) and gated k6 load templates.
- `tools/` — `lint-references.mjs`, `export-diff.mjs` (CSV/TSV cell diff) and `selftest/`
  (self-tests for the overlay, rapid-action, layout and health helpers).
- `extras/claude-commands/` — optional `/qa-session`, `/qa-explore` and `/qa-parity` shortcut commands.
- `extras/git-hooks/` — optional pre-commit guard against leaking product-specific strings.
- `docs/evaluation/` — scored assessment and gap backlog.
- `docs/analysis/` — usage analysis and prioritized roadmap.
- `agent/` — standalone CLI agent (Node.js + Playwright).

## Installation and usage by tool

This section is the complete setup guide. Pick the part for the tool you use.

### What you need

| Need | Required? | Notes |
|---|---|---|
| An AI coding tool that can read files and run commands | Yes | Claude Code, Cursor, Codex CLI, Windsurf, Gemini CLI, GitHub Copilot agent mode, ... |
| `git` | Yes | to clone and update |
| Node 18+ | For helpers | self-tests, the standalone agent, Playwright scripts (Node 20 recommended) |
| Playwright browsers | For web work | `npx playwright install chromium`; the skill can also provision them in `~/.qa-bug-hunter/playwright` |
| k6 | Load mode only | not needed otherwise; always start with `DRY_RUN=1` |
| A test environment you are allowed to test | Yes | never production, never a shared environment without approval |

Works on Windows, macOS and Linux.

### Step 1 — get the skill

Clone it once into a permanent folder that is **not** inside a project you test
(for example `~/tools/qa-bug-hunter`):

    git clone https://github.com/MSagiroglu/qa-bug-hunter.git

### Step 2 — connect it to your tool

#### Claude Code (native skill, recommended)

Claude Code loads skills from a `skills` folder and invokes this one as
`senior-qa-explorer`. Link the clone so `git pull` updates it everywhere.

*All your projects (user level):*

    # Windows, Command Prompt (cmd.exe) — mklink is a cmd builtin
    mklink /J "%USERPROFILE%\.claude\skills\senior-qa-explorer" "<path-to-clone>"

    # Windows, PowerShell
    New-Item -ItemType Junction -Path "$env:USERPROFILE\.claude\skills\senior-qa-explorer" -Target "<path-to-clone>"

    # macOS / Linux
    ln -s "<path-to-clone>" "$HOME/.claude/skills/senior-qa-explorer"

*One project only (project level):* put the same link or a copy at
`<your-project>/.claude/skills/senior-qa-explorer`. Use this when only that team
should get the skill; commit a copy, not a link, if you want teammates to receive it.

*No link support:* copy the folder to the same path; re-copy after each update.

Then **start a new session** (restart Claude Code). Verify: ask
`Do you have the senior-qa-explorer skill? Summarize its modes.` The answer
should list Sweep, Session, API-only and Load. Then run your first charter
(Step 3). The slash command is the skill name: `/senior-qa-explorer`. Type
`/senior-qa-explorer session "<charter>"` or `/senior-qa-explorer sweep <module>`,
or just describe the task in plain words; both work the same way.

*Optional shortcuts.* `/qa-session` and `/qa-explore` are NOT built in. To get
them, copy the two files in `extras/claude-commands/` into
`~/.claude/commands/` (instructions in that folder's README) and start a new
session.

*If you do not see the skill:* confirm the link resolves
(`~/.claude/skills/senior-qa-explorer/SKILL.md` must open), start a **new**
session (the list is read at session start), then type `/` and look for
`senior-qa-explorer`. If it is still missing, ask `Which skills do you have?`
and see Troubleshooting.

#### Cursor

Add `.cursor/rules/qa-explorer.mdc` to the project you test:

    ---
    description: Senior QA exploratory testing methodology — apply when asked to test a module for bugs
    globs:
    alwaysApply: false
    ---
    For exploratory / bug-hunting test requests, read and follow:
    <path-to-clone>/SKILL.md

#### Codex CLI, Windsurf and other tools that read `AGENTS.md`

Add to `AGENTS.md` in the project root:

    ## Exploratory QA testing
    For exploratory / bug-hunting test requests, read and follow:
    <path-to-clone>/SKILL.md
    It is stack-agnostic and lives outside this repo; read it from that path.
    For how to write/run tests in this repo, use this repo's own conventions.

#### Gemini CLI

Same text in `GEMINI.md` at the project root.

#### GitHub Copilot (agent mode in an IDE)

Same text in `.github/copilot-instructions.md`. Copilot must be able to read the
clone path: add the clone folder to the workspace, or use the paste option below.

> Pointer-file names and locations are tool conventions and can change; check
> your tool's current documentation. The pointer text itself stays the same.
> For every pointer-file tool, the assistant must be allowed to read
> `<path-to-clone>` (add it to the workspace or allow-list if asked).

#### Tools that cannot read local files (plain chat UIs)

Paste `PORTABLE.md` as a custom instruction. Limits: no files, no commands, so
it can help you design and review tests but cannot run them, and it is a frozen
snapshot (`SKILL.md` is authoritative where they differ).

### Step 3 — run your first session

In any of the tools above, pick one small, risky screen:

    /senior-qa-explorer session "Explore the Create form / with empty, very long and rapid repeated submits / to find duplicate records and missing loading states"

or in plain words: `test the login page for bugs`, `run a QA session on the
checkout modal`, `test <endpoint list> as API-only`. Read the "Kapsanmayan" (not
covered) line of the summary first. Details and result labels are in
"New here? Start in 5 minutes" above.

What to expect: a session is time-boxed (60 minutes by default); web runs open a
visible browser window when you are watching and run headless when
unattended; evidence files and a report are written under `docs/qa-reports/` of
the project you test (add that folder to your project's `.gitignore` if you do
not want them committed).

### Step 4 (optional) — a domain pack for your own product

Put product knowledge (roles, modules, safety rules) in a private pack outside
the repo; see "Create your own domain pack" above. It is detected automatically
when you start the tool inside that product's repo.

### Step 5 (optional) — no AI tool, CI and scheduled runs

The standalone agent needs no AI tool:

    cd agent && npm install && npm run build
    node dist/cli.js test --url https://app.example.test --suites overlay,api

It runs headless automatically when `CI` or `QA_HEADLESS=1` is set. The `rapid`
suite fires mutating clicks, so it is opt-in (`--suites rapid`) and belongs only
on environments you own. Load templates under `templates/k6/` refuse targets
that are not allowlisted and support `DRY_RUN=1`. Provide credentials through
environment variables, never in files.

### Using it as a team

- Everyone clones the same repository; pin a version with
  `git checkout <commit-or-tag>` if you need reproducible runs.
- Each person keeps their own domain pack outside the repo; share packs through a
  private channel, never by committing them here.
- Agree on one environment for exploratory runs and who may run rapid-action,
  load and authorization-matrix tools there.
- File findings from the generated tickets; keep candidates labelled as
  candidates until reproduced.

### Updating and removing

Update: `git pull` in the clone. Linked installs update instantly; copied
installs must be re-copied.

Remove the link only (never delete recursively through it, that can delete the
clone's contents):

    # Windows junction (cmd.exe)
    rmdir "%USERPROFILE%\.claude\skills\senior-qa-explorer"

    # macOS / Linux symlink (no -r flag)
    rm "$HOME/.claude/skills/senior-qa-explorer"

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| The tool ignores the skill | The link is missing or the tool was not restarted. Check that `~/.claude/skills/senior-qa-explorer/SKILL.md` resolves, then start a new session. |
| `/qa-session` or `/qa-explore` is not offered | They are optional shortcuts, not built in. Use `/senior-qa-explorer session "<charter>"` (the real slash command), say it in plain words, or install the shortcuts from `extras/claude-commands/`. |
| `/senior-qa-explorer` is not in the `/` menu | The skill list is read when a session starts: open a new session. Then check that `~/.claude/skills/senior-qa-explorer/SKILL.md` opens (a broken junction/symlink is the usual cause) and that `name: senior-qa-explorer` is in its frontmatter. |
| Browser does not open | Unattended mode is active (`CI` or `QA_HEADLESS=1` set) or Playwright browsers are not installed: `npx playwright install chromium`. |
| Self-test fails to start | Run `cd agent && npm install && npx playwright install chromium` first. |
| `Domain pack: none` but you have a pack | The pack folder is not in the packs directory, or its `Markers:` paths do not all exist at the repo root. Use `--domain <name>` to force it. |
| k6 run is refused | The target is not in the allow file, `LOAD_WINDOW_OK` is not `1`, or credentials are missing. That is the safety gate working. Start with `DRY_RUN=1`. |
| Rapid-action test hit HTTP 429 | The burst consumed the throttle budget. Lower the burst size; a 429 is itself an observation. |
| Many findings marked "candidate" | Intended: a heuristic fired. Reproduce each one and state the oracle before filing. |

## Where it can improve next

A detailed, evidence-based roadmap (16 items with value, effort, dependencies and how each
would be verified) is in `docs/analysis/2026-10-22-usage-analysis-and-roadmap.md`. Already
built from it: the layout and visual consistency scan with viewport/orientation/zoom matrix and
style-signature diff, the screen health gate, settle detection, and the export diff. Still open
from it, roughly in order of value: per-state screenshot and style harvest, design-token
conformance audit, keyboard-only walkthrough, i18n long-text stress, dark-mode sweep, HTML report
generator, flaky-run detection, a mobile device-farm recipe and a seeded-defect layout benchmark.

Other honest next steps, roughly in order of value:

1. **Measure on real applications.** Run pilot sessions on a few real apps and
   record bugs found, false positives, time and tokens. Nothing has been
   calibrated on production-like systems yet.
2. **A seeded-bug benchmark.** A small demo app with known planted defects, so
   each release can be scored on recall and false positives. Today only the
   helper scripts have self-tests, not the whole skill.
3. **More than one reviewer.** Re-score with several independent reviewers,
   including a human test lead, to get an inter-rater range.
4. **Close the literature gaps.** A named test-implementation activity, a Beizer-
   style fault taxonomy for classification, the agile testing quadrants and test
   pyramid, Weinberg-style bias notes.
5. **Cut context cost.** A short "lite" session profile, and generate
   `PORTABLE.md` from `SKILL.md` instead of maintaining it by hand.
6. **Mobile harness.** Runnable templates (for example `adb`-driven interruption
   scripts and a device-farm recipe) comparable to the web helpers.
7. **Bug-class memory.** Persist recurring bug classes per project and turn
   them into permanent checks; generate a regression test from each confirmed
   defect.
8. **Pack scaffolding.** A generic `pack-init` tool that scans a repo for
   routes, roles and test ids and drafts a domain pack.
9. **Language policy.** Decide on English-only core with Turkish translations, or
   two parallel folders, so non-Turkish readers lose nothing.
10. **Releases.** Tagged versions and a changelog so teams can pin a version.

## Glossary

- **Charter:** one-sentence mission: explore what, with what, to find what.
- **Session (SBTM):** time-boxed exploratory run with notes and a debrief.
- **Oracle:** the source that says what "correct" is (spec, contract, source,
  consistency with the rest of the app, or a guess). Weak oracle = lower
  confidence.
- **Lens:** platform-specific guidance (web, mobile, API).
- **Domain pack:** private, product-specific knowledge outside the repo.
- **Three witnesses:** UI state, network response and an independent re-read
  must agree after every write.
- **Rapid action:** repeating a create/update/delete quickly to check the
  in-flight guard, loading state and duplicate requests.
- **Candidate finding:** a heuristic fired; not yet a verdict.
- **Kapsanmayan:** "not covered", the mandatory line in every session summary.

## License

MIT — see `LICENSE`. Use it, fork it, adapt it.
