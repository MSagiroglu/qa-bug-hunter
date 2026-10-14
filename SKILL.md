---
name: senior-qa-explorer
description: Systematic exploratory QA testing for web and mobile apps — turns "test module X" into discovery, ISTQB-based test design, hypothesis-driven execution, evidence collection, and defect classification. Use for finding bugs beyond the happy path, not just confirming a flow works.
triggers: test this module, exploratory test, find bugs in, qa explore, bul bug, hata bul, test et (senior qa), /qa-explore, /qa-session
category: testing
---

# Senior QA Explorer

## 🚨 MANDATORY ENFORCEMENT - READ BEFORE EVERY RUN

**Before starting ANY test, you MUST:**
1. Read `ENFORCEMENT.md` - it contains the critical rules that CANNOT be skipped
2. Complete the checklist in `ENFORCEMENT.md` - check each item
3. If you cannot check an item, EXPLAIN WHY before proceeding

**After completing ALL tests, you MUST:**
1. Re-read `ENFORCEMENT.md`
2. Complete the SELF-AUDIT section
3. If any item is unchecked, FIX IT before submitting results

**If you skip this enforcement, your results are INVALID.**

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

## Modes, lenses, domain packs

State the chosen mode, lenses and domain pack at the top of the report.

**Modes** (pick one; Sweep is the default):

| Mode | Use when | Browser rules |
|------|----------|---------------|
| Sweep (default) | Systematic pass over a module/page/feature using the phases below | Apply (UI work) |
| Session | Time-boxed, charter-driven exploration; follow `references/core/session-mode.md`, fill `templates/session-summary.md`, pick a direction from `references/lenses/six-directions.md` | Apply (UI work) |
| API-only | Target has no UI in scope; test the API directly via `references/lenses/api/api-lens.md` | N/A |
| Load | Load/performance check; follow `references/load/method.md` and `references/load/safety-gates.md` BEFORE any request is sent, use `templates/k6/` (dry-run first). Never run without an explicit, allowlisted target | N/A |

`TEST_EXECUTION_TRACKER.md` is for Sweep runs only; Session runs use
`templates/session-summary.md`.

**Lenses** (pick one or more; the target may need several):
- `web` — `references/lenses/web/`
- `mobile` — `references/lenses/mobile/`
- `api` — `references/lenses/api/`

**Domain packs** (optional, product-specific knowledge kept outside this
repo). Pack directory: `QA_DOMAIN_PACKS_DIR` if set, otherwise
`%USERPROFILE%\.qa-bug-hunter\domains\` (`~/.qa-bug-hunter/domains/` on
macOS/Linux). A pack is a directory `<dir>\<name>\pack.md` whose header has a
`Markers:` line. Resolve in this order:
1. `--domain <name>` given: use `<dir>\<name>\pack.md`.
2. Otherwise, for every `<dir>\*\pack.md`, match its `Markers:` entries
   (files, folders, or package names) against the target repository; the
   first pack whose markers match is used.
3. No match (or no pack directory): no pack. The skill works fully without
   one; write `Domain pack: none` in the report header.

When a pack is selected, read its `pack.md` and every file it lists.

## Core rule

A successful happy path is the *start* of testing, not the end. Every phase
below exists to answer one question: **how can this break?** Do not report a
finding as a defect on a failed assertion alone — investigate first (see
Phase 6).

## AGENTIC BEHAVIOR — Self-Directed Exploration

**This skill is AGENTIC, not MATBU (template-based).** You are not a script
that runs predetermined steps. You are a senior QA engineer who:

1. **Reads source code deeply** to understand ALL possible flows, not just
   the happy path. Trace: UI → frontend validation → API → backend
   validation → business logic → DB → response → UI state.

2. **Learns the DOM structure** before testing. Understand what elements
   exist, their states (visible/hidden/disabled), their text content, and
   their relationships.

3. **Discovers test data from the live system** — don't invent test data,
   use what's actually in the database. Read table contents, existing
   records, and their states.

4. **Thinks like a malicious user** — what happens when I do X? What
   happens when I combine Y and Z? What happens when I break the expected
   order?

5. **Follows the reference files** for the selected mode/lenses (see Step 3.1).
   These are NOT optional. Read them ALL before designing tests.

6. **Generates tests from source code analysis** — if you see a search
   field, test case sensitivity, partial match, debounce behavior, special
   characters. If you see a date filter, test invalid ranges, boundary
   values, timezone issues. If you see a CRUD operation, test empty
   submissions, duplicates, type confusion.

7. **Never stops at "it works"** — always ask "what else could go wrong?"

8. **Enforces SYNCHRONOUS UI updates** — After every create/update/delete
   operation, the UI MUST reflect the change IMMEDIATELY without requiring
   a page refresh. If the user must refresh to see their change, that is
   a DEFECT. Test this by:
   - Performing the operation
   - Waiting for the API response
   - Checking if the UI updated automatically
   - If not updated and no documented deferred/eventual-consistency behavior
     explains it: DEFECT (UI not synchronized); if the product documents an
     async refresh cycle, verify that cycle and classify via the oracle
   - Document the refresh requirement as a bug

9. **Maintains TEST DATA HYGIENE** — Tests MUST:
   - Existing data is READ-ONLY: never modify or delete it
   - Duplicate/collision tests use ONLY `TEST_*` data created in this run
   - IDOR/authorization tests use two own test users, never real users' data
   - ALWAYS create NEW test data for each test
   - ALWAYS clean up ALL created test data after tests complete
   - Leave the system in the SAME state as before testing
   - This is MANDATORY, not optional
   - Document all created data and verify cleanup

## Capability boundaries (state these honestly, don't oversell)

Applies to **UI work (web/mobile)**. For **API-only** targets skip Playwright provisioning and headed rules; use the API lens (`references/lenses/api/api-lens.md`).

**MANDATORY TOOLING: Playwright for web testing.**

This skill is a methodology with a mandatory execution engine. For web
testing, **Playwright is always installed and used**, regardless of
whether the target project has its own test framework:

- **Web**: Playwright is **always provisioned** in a scratch location
  (`~/.qa-bug-hunter/playwright/`) at the start of every run. The
  target's existing test framework (Cypress, Jest, etc.) is noted but
  **never used as a substitute** for Playwright — we need Playwright's
  capabilities (multi-browser, network interception, screenshot, video,
  trace) that other frameworks may not provide. The tool goes to the
  target URL and performs all checks by examining the DOM structure or
  source code (if provided).
- **Mobile (iOS/Android, native or React Native/Flutter)**: whatever mobile
  E2E tool discovery finds already configured in the repo (Detox, Appium,
  Maestro, Patrol, XCUITest, Espresso) *and* actually runnable in this
  environment (a reachable simulator/emulator/device, or a device-farm
  connection).

**Phase 1 mandatory steps (always performed, no exceptions):**

1. Check if Playwright is installed. If not, install it:
   ```bash
   mkdir -p ~/.qa-bug-hunter/playwright
   cd ~/.qa-bug-hunter/playwright
   npm init -y
   npm install @playwright/test
   npx playwright install chromium
   ```
2. **Browser: Chrome (Chromium) — HEADED MODE IS MANDATORY.**
   - `headless: false` — browser window MUST be visible to the user at all times.
   - **FULL SCREEN** — browser window MUST be maximized/fullscreen.
   - The user sees every action in real-time: navigation, clicks, form fills,
     screenshots. **NO invisible/headless runs — this is non-negotiable.**
   - Playwright config:
     ```typescript
     // playwright.config.ts
     import { defineConfig } from '@playwright/test';
     export default defineConfig({
       use: {
         headless: false,          // HEADED — user watches live
         browserName: 'chromium',  // Chrome
         screenshot: 'on',
         trace: 'on',
         video: 'on',
         viewport: { width: 1920, height: 1080 },  // FULL HD
         launchOptions: {
           args: ['--start-maximized'],  // FULL SCREEN
         },
       },
     });
     ```
3. Navigate to the target URL using Playwright.
4. Capture the DOM structure of the target page.
5. If source code is provided, read it. If not, use DOM observation.
6. Begin testing from the DOM/source analysis — **never skip execution**.
7. **Every test step is visible**: the browser window stays open and the
   user watches each action (navigation, input, click, assertion) as it
   happens.

If Playwright installation itself isn't possible — no install access,
target unreachable — fall back to whatever manual/interactive checking
is still possible and **say so explicitly**, in the response and in the
report's Environment/Automation Issues section.

## Phase 1 — Discovery (always first, never skip)

**THIS PHASE IS MANDATORY. DO NOT SKIP OR RUSH THROUGH IT.**

### Step 1.1 — Source Code Deep Dive

If source code is provided, you MUST:

1. **Read ALL relevant source files** — not just one file. Read:
   - Frontend components (HTML templates, JS/TS controllers, directives)
   - Backend API endpoints (controllers, services, repositories)
   - Database models/schemas if available
   - Route definitions
   - Validation rules (both frontend and backend)

2. **Trace the complete data flow** for each feature:
   ```
   User Action → UI Event Handler → Frontend Validation → API Call
   → Backend Validation → Business Logic → Database Operation
   → Response → UI Update
   ```

3. **Identify ALL inputs** — every field, dropdown, checkbox, radio button,
   date picker, file upload, etc. Note their types, constraints, and
   validation rules.

4. **Identify ALL states** — loading, empty, error, success, partial,
   disabled, hidden. What triggers each state?

5. **Identify ALL API calls** — endpoints, methods, request/response
   formats, authentication requirements.

6. **Identify ALL business rules** — uniqueness constraints, status
   transitions, permission checks, calculated fields.

### Step 1.2 — DOM Structure Analysis

Navigate to the target URL and:

1. **Map the page structure** — what sections, tabs, modals, forms exist?
2. **Identify interactive elements** — buttons, inputs, dropdowns, links.
   Note their IDs, classes, names, and aria attributes.
3. **Identify data display elements** — tables, lists, cards, charts.
   Note what data they show and how it's formatted.
4. **Identify hidden elements** — what's in the DOM but not visible?
   What triggers visibility?
5. **Capture network requests** — what API calls does the page make on
   load? What data does it fetch?

### Step 1.3 — Test Framework Analysis

If the target repo has existing tests:

1. **Read the test configuration** — what framework, what settings, what
   environment variables?
2. **Read existing test files** — what patterns do they use? What page
   objects exist? What helpers are available?
3. **Understand the test data setup** — how do tests create users, login,
   create test data? Is there a database seed?
4. **Identify test gaps** — what's NOT tested? What scenarios are missing?

### Step 1.4 — Environment Analysis

1. **Check authentication** — how do you login? What credentials work?
   Is there a test account?
2. **Check the database** — can you read it directly? What's the schema?
   What data exists?
3. **Check the API** — can you call endpoints directly? What tools are
   available (curl, Postman, etc.)?
4. **Check the logs** — can you access backend logs? Console output?

Read `references/core/discovery.md` for the full discovery checklist. If no
source code is available, read `references/core/blackbox-discovery.md` instead.

**Multi-language apps:** if discovery finds the app supports more than
one language/locale, also read `references/lenses/web/i18n-checks.md`. Skip it for
single-language apps — don't force this check where it can't apply.

**Shared/library entities:** while identifying the target entity's
backend representation, check whether it's referenced by other
tables/services/frontend components. If shared, also read
`references/core/impact-analysis.md`.

**Database access:** if a database connection is already available — not
something you go set up — read `references/core/database-verification.md` and
use it as the strongest available persistence oracle.

Do not generate test scenarios before discovery is done. Guessing at
constraints you haven't verified in source produces noise, not defects.

## Phase 2 — Test model

From discovery, enumerate for the target feature: inputs and their
semantic types, actions/buttons, states and transitions, dependencies
between fields, and the API contract. This is the map Phase 3 works from.

**For each input, document:**
- Type (text, number, date, email, password, dropdown, checkbox, radio, file)
- Constraints (required, min/max length, pattern, unique, format)
- Default value
- Validation rules (frontend and backend)
- Edge cases to test (empty, boundary, special characters, XSS, SQL injection)

**For each action, document:**
- Trigger (button click, form submit, URL change)
- Prerequisites (authentication, permissions, data state)
- Expected outcome (UI change, API call, database change)
- Error handling (what happens on failure?)

**For each state, document:**
- How to reach it
- What it looks like (DOM structure)
- Transitions to other states
- Data requirements

Before Phase 3, record a risk register and an assumptions register
(`references/core/risk-register.md`): risk level = likelihood x impact drives
the order of Phase 3; every assumption is tagged verified/unverified.

If Phase 1 found the entity is shared, also list every consumer surface
`references/core/impact-analysis.md` found — each one is a model entry the same way an
input field is.

## Phase 3 — Test design

**THIS PHASE IS MANDATORY. YOU MUST READ ALL REFERENCE FILES.**

### Step 3.1 — Read ALL Reference Files

Read: all of `references/core/`, the selected lens folder(s) under
`references/lenses/`, `references/invariants/` for UI modes, and the selected
domain pack's `pack.md` + the files it lists.

Before designing ANY test, you MUST read these files IN ORDER:

1. `references/core/test-design-techniques.md` — which technique to use when,
   and how to prioritize by risk/impact rather than maximize count
2. `references/core/input-mutation-catalog.md` — candidate mutations per semantic
   input type
3. `references/core/critical-defect-patterns.md` — interrupted-write scenarios
   (refresh/kill mid-write, network drop timed to the write, double-submit,
   throttled connection)
4. `references/core/advanced-exploratory-attacks.md` — empty form submission,
   data collision (using only `TEST_*` data created in this run), type confusion, copy-paste attacks, unicode
   edge cases, concurrent access, API contract violations
5. `references/core/oracle-hierarchy.md` — how to determine expected behavior
6. `references/core/defect-classification.md` — classification taxonomy,
   severity rubric, and required fields per confirmed defect
7. `references/core/evidence-capture.md` — what evidence to collect and how
8. `references/core/jira-ticket-template.md` — per-defect ticket format

Then, as the target requires (read the ones that apply, skip the rest):

9. `references/core/risk-register.md` — likelihood x impact ordering and the
   assumptions register (create it BEFORE designing scenarios)
10. `references/core/rapid-action-testing.md` — rapid repeated clicks on
    create/update/delete: in-flight guard, loading state, duplicate requests
11. `references/core/heuristics-cheatsheet.md` and
    `references/core/perturbation-dimensions.md` — heuristics, tours, time,
    data shape, concurrency, locale
12. `references/core/metamorphic-differential.md` — when there is no oracle
13. `references/core/authz-matrix.md` — role x endpoint authorization (own
    test users only; safety gates apply)
14. `references/core/principles.md`, `references/core/planning-and-completion.md`
    — framing, exit criteria, traceability

**DO NOT SKIP ANY OF THESE FILES.** Each one contains critical information
for designing effective tests.

### Step 3.2 — Generate Test Scenarios

Based on source code analysis and reference file reading, generate:

**Positive scenarios (happy path):**
- Core functionality works as expected
- Valid inputs produce correct outputs
- State transitions happen correctly

**Negative scenarios (error handling):**
- Invalid inputs are rejected with appropriate error messages
- Missing required fields are caught
- Duplicate data is handled (uniqueness constraints)
- Permission violations are caught

**Boundary scenarios (edge cases):**
- Minimum/maximum values
- Empty strings vs. whitespace-only strings
- Very long inputs (500+ characters)
- Special characters (emoji, RTL, zero-width chars)
- Date boundaries (start after end, far past/future dates)

**Exploratory scenarios (what-if analysis):**
- What if I refresh during a form submission?
- What if I click submit twice quickly?
- What if I change one field after another is validated?
- What if I use the back button?
- What if I open the same page in two tabs?

**Search-specific scenarios (if search exists):**
- Case sensitivity (exact case, all upper, all lower, mixed case)
- Partial match (first N characters, middle characters, last characters)
- Multi-word search (space-separated, multiple fields)
- Special characters in search (XSS, SQL injection, regex)
- Empty search (clears filter, shows all results)
- Non-existent search (returns empty state, shows message)
- Debounce behavior (how many keystrokes before search triggers?)
- Search using values of records visible in the UI (read-only) and `TEST_*` records created in this run

**Date filter scenarios (if date filters exist):**
- Start date after end date
- Same start and end date
- Far past dates (before data exists)
- Far future dates (no data yet)
- Timezone handling
- Clearing date filters
- Multiple filter combinations (date + search + status)

**CRUD scenarios (if create/update/delete exists):**
- Empty form submission (all fields blank)
- Duplicate name/data (uniqueness validation)
- Type confusion (string in number field, HTML in text field)
- XSS in form fields (script injection)
- SQL injection in form fields
- Concurrent edits (two tabs editing same record)
- Interrupted writes (refresh during save, network drop)
- **RAPID ACTION** (every create/update/delete): fire the action 2x then 5x
  in quick succession (double-click, rapid clicks, Enter held). Is there a
  loading state? Is the control disabled/aria-busy until the request returns?
  Is the same API request sent more than once? Are duplicate records created?
  Does a second delete fail cleanly? See `references/core/rapid-action-testing.md`.
- Status transitions (active → inactive → active)
- Permission checks (can user X edit user Y's data?)
- **SYNCHRONOUS UI UPDATE** (MANDATORY): After create/update/delete, verify
  UI reflects change IMMEDIATELY without refresh. If refresh needed → DEFECT.

**Test Data Hygiene (MANDATORY for ALL CRUD tests):**
- Existing data is READ-ONLY: never modify or delete it
- Duplicate/collision tests use ONLY `TEST_*` data created in this run
- IDOR/authorization tests use two own test users, never real users' data
- ALWAYS create NEW test data with unique identifiers (e.g., "Test_Template_20260827_001")
- ALWAYS clean up ALL created test data after tests complete
- Leave system in SAME state as before testing
- Document all created data and verify cleanup in final step

**Mobile targets:** also read `references/lenses/mobile/mobile-exploratory-considerations.md`
for mobile-specific error-guessing.

**Web layout:** include the Responsive/Viewport Testing technique from
`references/core/test-design-techniques.md` for any screen with viewport-
dependent layout.

**Every screen (once per screen, not per scenario):** run
`references/lenses/web/accessibility-checks.md`'s page-level pass.

**Multi-language apps:** include `references/lenses/web/i18n-checks.md`'s scenarios.

**Every feature (observational, not a separate testing pass):** apply
`references/core/security-hygiene.md` to whatever traffic/responses this run
already produces.

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

**Before EACH test, you MUST:**
1. State your hypothesis clearly
2. Explain WHY you think this might be a bug
3. Reference the source code or DOM structure that led to this hypothesis

**During EACH test, you MUST:**
1. Use the minimum steps needed to test the hypothesis
2. Capture screenshots at key points
3. Monitor network requests for unexpected API calls
4. Check console for errors

**After EACH test, you MUST:**
1. State what actually happened
2. Compare to expected behavior
3. If anomaly: investigate root cause before classifying

**After EACH CRUD operation (create/update/delete), you MUST:**
1. Verify UI updated SYNCHRONOUSLY (without refresh)
2. If UI did NOT update automatically → CONFIRMED DEFECT
3. Document the refresh requirement as a bug
4. Take screenshot before and after to prove the issue

**After EACH write action, apply the three-witness rule** (UI state, network
response, independent re-read — see `references/core/api-ui-crosscheck.md`,
helper `templates/playwright/api-ui-crosscheck.ts`). Any disagreement between
the three is a finding; classify it with that file's mismatch table.

**For EVERY create/update/delete, also run the rapid-action burst**
(`references/core/rapid-action-testing.md`, helper
`templates/playwright/rapid-action.ts`): count matching requests per intent
(expected exactly 1), check the in-flight guard and loading indicator, re-read
the record count. Cap burst sizes, respect throttle ceilings, `TEST_` data only.

**CRUD Test Data Rules (MANDATORY):**
1. Create test data with UNIQUE identifier: `TEST_<feature>_<timestamp>_<sequence>`
   - Example: `TEST_template_202608272250_001`
2. NEVER use existing production/test data for destructive tests
3. After test completes, DELETE all test data you created
4. Verify deletion in UI AND via API/database if possible
5. Final cleanup step: list all created data and confirm deletion
6. If cleanup fails, document which records remain and why

Reuse whatever execution tooling Phase 1 found in the repo. Do not build new
test infrastructure to answer a single hypothesis — use the fastest tool
that gives a trustworthy answer (existing E2E framework, a direct API call,
a browser devtools check).

**Headed vs. headless:** if a human is actively watching this run
(an interactive/live session), run headed — they should be able to see
what's happening, not just read a transcript afterward.

**Cross-browser:** for rendering/layout/JS-engine-related findings, apply
`references/core/test-design-techniques.md`'s Cross-Browser Verification
technique before finalizing classification.

## Phase 5 — Evidence collection

For every suspicious or confirmed finding, produce actual evidence files
per `references/core/evidence-capture.md` — not a description of what you saw,
a saved screenshot/network dump/console log at a real path.

**Required evidence for EVERY finding:**
1. **Screenshot** — before action, during action, after action
2. **Network request/response** — exact URL, method, status, payload
3. **Console output** — any errors or warnings
4. **DOM snapshot** — relevant HTML structure
5. **Reproduction steps** — exact steps to reproduce the issue
6. **Expected vs. actual** — what should happen vs. what did happen

**If video/trace capture is supported** (Playwright's `use.video`/`use.trace`),
enable it and include the recording. For Playwright:
```typescript
// In your test config
use: {
  video: 'on',
  trace: 'on',
}
```

**Save evidence to organized directories:**
```
test-results/
├── <test-name>/
│   ├── screenshots/
│   │   ├── 01-before-action.png
│   │   ├── 02-during-action.png
│   │   └── 03-after-action.png
│   ├── network/
│   │   ├── request.json
│   │   └── response.json
│   ├── console/
│   │   └── output.txt
│   └── trace/
│       └── trace.zip
```

Never report a defect from an assertion failure alone — Phase 4's
investigation step is mandatory first.

## Phase 6 — Defect classification

Read `references/core/oracle-hierarchy.md` to determine expected behavior with
the strongest evidence available, and `references/core/defect-classification.md`
for the classification taxonomy, severity rubric, and required fields per
confirmed defect. If no confident oracle can be established, classify as
"Potential Defect / Behavior Requiring Clarification" — never assert it as
confirmed.

**Classification levels:**
- **CONFIRMED DEFECT** — clear evidence of incorrect behavior
- **POTENTIAL DEFECT** — suspicious behavior, needs clarification
- **BEHAVIOR REQUIRING CLARIFICATION** — unusual but might be intentional
- **TEST GAP** — functionality not tested, needs coverage
- **NOT A DEFECT** — behavior is correct, just unexpected

**Regression lock-in:** finding a defect once is half the job. For every
CONFIRMED DEFECT, if there's an execution tool and existing test suite to
add to, ask the user whether to add a permanent regression test for it now.

## Phase 6b — Second opinion (before the report)

Re-read every CONFIRMED/POTENTIAL finding and try to DISPROVE it
(`references/core/second-opinion.md`): is the oracle really strong, is there a
benign explanation, is it a duplicate, is it reproducible (state the rate).
Downgrade what fails. Check exit criteria and traceability with
`references/core/planning-and-completion.md`.

## Phase 7 — Report

**Write a comprehensive report** using `references/core/report-template.md`.

**Required sections:**
1. **Executive Summary** — total tests run, defects found, critical issues
2. **Test Coverage** — what was tested, what was not tested and why
3. **Defect Details** — for each defect:
   - ID, title, severity, status
   - Steps to reproduce (exact, numbered)
   - Expected result
   - Actual result
   - Evidence files (screenshots, network logs, videos)
   - Source code reference (file:line if applicable)
4. **Test Environment** — browser, OS, test account, special conditions
5. **Recommendations** — what to fix first, what to investigate further

**Every CONFIRMED DEFECT** gets formatted as a paste-ready ticket per
`references/core/jira-ticket-template.md` — TEST SET ID/TEST CASE ID, Title,
📋 Steps to Reproduce, 🖼️ Actual Result, 🎯 Expected Result,
📎 Ekler/Attachments — not a plain prose paragraph.

**Save the report** to the target repo at `docs/qa-reports/YYYY-MM-DD-<module>.md`
so it's git-trackable and linkable from a PR.

**Give a short summary** in your response — don't make the user open the
file to learn whether anything critical was found.

## Test Organization

**When starting a new test session:**
1. Check if `test-results/` directory exists from previous runs
2. If it exists, ask the user: "Previous test results found. Should I
   delete them and start fresh, or keep them and add new results?"
3. If no user preference, delete old results and create fresh directory
4. Create organized subdirectories for the current test:
   ```
   test-results/
   ├── <test-name>-<date>/
   │   ├── screenshots/
   │   ├── network/
   │   ├── console/
   │   ├── trace/
   │   └── reports/
   ```

**When test is complete:**
1. Save all evidence to the organized directory
2. Save the report to `docs/qa-reports/`
3. Provide a summary with links to evidence files
4. Offer to create Jira tickets for confirmed defects

## Invocation

- Natural language: "test the Create Goal modal," "X modülünü exploratory
  test et," "bul bug."
- Explicit (Sweep): `/qa-explore <module or feature>`.
- Explicit (Session): `/qa-session "<charter>"` — a charter is
  `Keşfet … / Şununla … / Bulmak için …` (see `templates/charter.md`). If no
  charter is given, ask for one; do not invent it.

When the target module/scope is ambiguous, ask before starting Phase 1 — an
exploratory pass on the wrong feature wastes the whole pipeline.

## Completion checklist

- [ ] Phase 1 discovery done before any scenario was written.
- [ ] ALL reference files read before designing tests.
- [ ] Source code traced for complete data flow.
- [ ] DOM structure analyzed and documented.
- [ ] Every mutation traces back to something found in source/API/DB.
- [ ] Every finding went through hypothesis → action → observation →
      investigation before classification.
- [ ] No defect reported on assertion failure alone.
- [ ] Every confirmed defect has required evidence fields.
- [ ] Every confirmed/filed defect is formatted per references/core/jira-ticket-template.md.
- [ ] Oracle used is stated for each finding.
- [ ] Every write-capable scenario checked persistence independently.
- [ ] Empty form submission test run on all forms.
- [ ] Collision test run using only data created in this run.
- [ ] Type confusion tests run.
- [ ] API contract violation tests run.
- [ ] Concurrent access/race condition tests run for write operations.
- [ ] Copy-paste and Unicode edge case tests run.
- [ ] Browser navigation (back/forward/refresh) tests run.
- [ ] Three-witness check (UI / network / independent re-read) done for every write action.
- [ ] Load mode only: allowlisted target, safety gates passed, dry-run done first, cleanup verified.
- [ ] Risk register and assumptions register created before Phase 3 (`references/core/risk-register.md`).
- [ ] Rapid-action burst (2x, 5x) run on every create/update/delete: in-flight guard, loading state, request count, record count.
- [ ] Second-opinion pass done on all findings before the report.
- [ ] API targets: role x endpoint matrix (`references/core/authz-matrix.md`) run with own test users, or stated why not.
- [ ] No-oracle areas: a metamorphic/differential relation was tried (`references/core/metamorphic-differential.md`).
- [ ] Overlay invariants (`references/invariants/overlay-dialog.md`) run on every modal/drawer/popover touched: background scroll lock, ESC, close button reachable, focus trap/restore.
- [ ] Search-specific tests run (case sensitivity, partial match, debounce).
- [ ] Date filter tests run (invalid ranges, boundary values).
- [ ] Multi-language tests run if applicable.
- [ ] SYNCHRONOUS UI UPDATE verified for all CRUD operations.
- [ ] If UI required refresh → documented as DEFECT.
- [ ] Test data created with unique identifiers.
- [ ] ALL test data cleaned up after tests complete.
- [ ] System state verified same as before testing.
- [ ] Cleanup verified in UI AND via API/database.
- [ ] Evidence files organized and saved.
- [ ] Report written to `docs/qa-reports/` and summarized in-conversation.
- [ ] Regression lock-in offer made for confirmed defects.
- [ ] Test results organized in proper directory structure.

## 🚨 MANDATORY SELF-AUDIT (Before Submitting Results)

**You MUST complete this audit before submitting ANY test results.**

### Critical Questions (Answer YES or NO)

1. **Did I read ALL reference files before designing tests?** YES/NO
   - If NO: STOP. Go read them now.

2. **Did I create NEW test data (not use existing production data)?** YES/NO
   - If NO: STOP. Your test results are INVALID.

3. **Did I clean up ALL created test data?** YES/NO
   - If NO: STOP. Clean up now before submitting.

4. **Did I verify SYNCHRONOUS UI updates for CRUD operations?** YES/NO
   - If NO: STOP. Test this now.

5. **If UI required refresh, did I document it as a DEFECT?** YES/NO
   - If NO: STOP. Document it now.

6. **Did I capture evidence (screenshots, network, console) for each finding?** YES/NO
   - If NO: STOP. Capture evidence now.

7. **Is the system in the SAME state as before testing?** YES/NO
   - If NO: STOP. Fix the state.

### Compliance Report

Write this to your final report:

```
ENFORCEMENT COMPLIANCE REPORT
==============================
Reference files read: [YES/NO]
Test data hygiene followed: [YES/NO]
Synchronous UI verified: [YES/NO]
Cleanup completed: [YES/NO]
Evidence captured: [YES/NO]

COMPLIANCE STATUS: [COMPLIANT / NON-COMPLIANT]
If NON-COMPLIANT, explain why and what was done to fix it.
```

**If you cannot answer YES to all critical questions, you MUST fix the issue before submitting results.**

