# Senior QA Explorer — Gap Backlog

Date: 2026-10-14
Companion to `2026-10-14-skill-assessment.md`. Each item is a self-contained task a Sonnet-level agent can execute without further context. Paths are relative to the repo root `C:\Users\musta\Desktop\Sn-QA-Bug-Hunter\`. No product names, no secrets. Do NOT implement these while evaluating — this is the backlog only.

**Ranking** is by value/effort for an expert exploratory tester who wants to catch what they cannot think of, and by what an AI agent can do reliably. Safety-critical corrections (G2, G3) are ranked first.

**Convention:** each new reference file is wired into the pipeline by a single SKILL.md edit; all SKILL.md edits are collected in **G-S at the end** and must be applied last, in one pass, to avoid merge churn. "Parallel-safe" = touches only its own new files (no shared-file edit) and can run concurrently with any other parallel-safe task.

Effort: S ≈ one file, <1h. M ≈ 2–3 files + a template. L ≈ multiple files + code + self-test.

---

## G2 — Split security into passive (QA) vs active (authorized-only), quarantine attack payloads
- **Gap closed:** Contradiction #3/#6 (assessment) — `backend-injection-testing.md` tells a tester to run destructive payloads (DROP TABLE, xp_cmdshell, time-based blind SQLi, XXE `/etc/passwd`, path traversal, auth bypass) while `security-hygiene.md` says passive-only. Safety hazard on shared envs; also removes `console.log`-as-evidence examples.
- **Files to edit/create:**
  - Edit `references/lenses/api/backend-injection-testing.md`: add a top banner — this file is **active security testing, out of scope for the default QA skill**, runs only with explicit written authorization on a non-shared, owned target, never on shared/stage. Replace destructive examples (DROP/UPDATE/xp_cmdshell/pg_sleep/SLEEP/XXE/path-traversal/auth-bypass) with a non-destructive **detection-only** posture: observe parameterization, send a single benign metacharacter and watch for error leakage (reuse `security-hygiene.md`), and reference OWASP WSTG/ASVS/API Top 10 by name for teams that do run a separate pentest engagement.
  - Edit `references/lenses/api/api-lens.md`: change the "Injection ideas" pointer to say injection is active-only and separately authorized.
  - Edit `references/lenses/web/xss-attack-patterns.md` and `references/lenses/web/shadow-dom-testing.md`: same banner; replace `console.log(...)` "evidence" with the saved-file pattern from `evidence-capture.md`; keep reflection-vs-execution distinction explicit (reflected in DOM ≠ executed).
- **Required content outline:** H2 "Scope and authorization" (passive default; active requires owned target + written approval + never shared env); H2 "Detection without exploitation"; H2 "Standards" (OWASP WSTG / ASVS / API Security Top 10 by name, no clause numbers unless verified).
- **Acceptance check:** `grep -rniE "DROP TABLE|xp_cmdshell|pg_sleep|SLEEP\(|etc/passwd|UNION SELECT" references/lenses` returns 0 outside an explicitly-labeled "illustrative, do not send" block; `grep -rn "console.log" references/lenses/web/*.md` returns 0.
- **Dependencies:** none. **Effort:** M. **Parallel-safe:** yes (no SKILL.md edit).

## G3 — Remove assertion-alone "CONFIRMED DEFECT" shortcuts; route through the oracle
- **Gap closed:** Contradiction #4/#10 — empty-submit "success → CONFIRMED DEFECT" and "refresh needed → DEFECT" contradict the core rule and oracle discipline; they manufacture false positives.
- **Files to edit:**
  - `references/core/advanced-exploratory-attacks.md §1`, `references/core/test-design-techniques.md:135-149`: reword "CONFIRMED DEFECT" to "**candidate finding** — investigate per Phase 4 and classify via `oracle-hierarchy.md`; it is CONFIRMED only when an oracle at level 1–6 says the empty/invalid value should have been rejected."
  - `SKILL.md:112-119,410-411,468-472` (list in G-S): reframe the synchronous-UI rule as "**if the UI requires a manual refresh a real user wouldn't know to perform, that is a candidate finding**; confirm against the oracle — async/eventual-consistency flows may legitimately defer; distinguish 'stale forever' from 'updates after the app's own normal refresh cycle'."
- **Required content outline:** keep the high-yield heuristics; change only the verdict step to candidate→investigate→classify.
- **Acceptance check:** `grep -rniE "→ *CONFIRMED DEFECT|CONFIRMED DEFECT\)" references/core/advanced-exploratory-attacks.md references/core/test-design-techniques.md` returns 0; both files reference `oracle-hierarchy.md`.
- **Dependencies:** the SKILL.md part is in G-S. **Effort:** S. **Parallel-safe:** yes for the two reference files (SKILL part deferred to G-S).

## G1 — Risk register + heat-map (likelihood × impact), with an assumptions register
- **Gap closed:** ISTQB risk-based testing (level = likelihood × impact, product vs project risk); Dim D; "assumptions register" discovery amplifier.
- **Files to create:** `references/core/risk-register.md`; template `templates/risk-register.md`.
- **Required content outline:** H2 "Risk items" (id | area | failure mode | likelihood L/M/H | impact L/M/H | risk level = product of the two | planned coverage | residual); H2 "Product vs project risk" (distinguish); H2 "Assumptions register" (every assumption the run relies on: environment, data shape, which side enforces a constraint — each tagged verified/unverified, feeding the oracle level); H2 "Heat-map" (a 3×3 text grid placing ids). Wire: risk level drives Phase 3 ordering; report §7 cites it.
- **Acceptance check:** `test -f references/core/risk-register.md && grep -qiE "likelihood|impact|assumption" references/core/risk-register.md`.
- **Dependencies:** referenced from SKILL Phase 2/3 and report-template (G-S + a one-line edit to `report-template.md`). **Effort:** M. **Parallel-safe:** yes.

## G4 — Discovery amplifier: automatic role × endpoint authorization matrix
- **Gap closed:** "find what I can't think of" (BOLA/BFLA systematically); Dim G/H; ISTQB test independence via mechanical coverage.
- **Files to create:** `references/core/authz-matrix.md`; `templates/playwright/authz-matrix.ts`.
- **Required content outline:** build the endpoint list from the repo router/controllers or an OpenAPI spec if present (reuse `api-lens.md` discovery); cross every endpoint×method with every available **own** test user/role (two-user rule from `api-ui-crosscheck.md`); for each cell record expected (allow/deny) vs observed status, flag "UI hides / API allows" and cross-tenant leaks. Template: given `{baseUrl, endpoints[], sessions{role:token}}`, iterate, never use real users' data, `TEST_`-only, return a matrix + mismatches, never throw. Code must read tokens from env vars only (reuse `api-lens.md` Credentials rule).
- **Acceptance check:** `npx tsc --noEmit templates/playwright/authz-matrix.ts` after adding `@playwright/test` types (or a `// @ts-nocheck` header consistent with other templates); `grep -qi "two .*own test user" references/core/authz-matrix.md`.
- **Dependencies:** complements `api-ui-crosscheck.md`. **Effort:** M. **Parallel-safe:** yes.

## G5 — Test-process completeness: planning, monitoring/control, completion criteria, traceability
- **Gap closed:** ISTQB process activities + exit criteria + traceability (conformance matrix: planning/monitoring/completion/traceability).
- **Files to create:** `references/core/planning-and-completion.md`.
- **Required content outline:** H2 "Lightweight test plan" (scope, risk ids from G1, oracles available, exit criteria); H2 "Monitoring & control" (what to re-prioritize when time/budget shrinks); H2 "Completion / exit criteria for Sweep" (coverage of modeled items + no open Critical/High unexplained + evidence saved); H2 "Traceability" (link ticket IDs and scenarios to risk ids / acceptance criteria / requirements when they exist). Wire into SKILL Phase 2 and Phase 7.
- **Acceptance check:** `grep -qiE "exit criteria|traceab" references/core/planning-and-completion.md`.
- **Dependencies:** G1 (risk ids). SKILL wiring in G-S. **Effort:** M. **Parallel-safe:** yes.

## G6 — Adversarial "second opinion" / independent-review pass
- **Gap closed:** ISTQB test independence; "second opinion adversarial reviewer" amplifier; counters confirmation bias (an agent handed a hypothesis tends to confirm it).
- **Files to create:** `references/core/second-opinion.md`.
- **Required content outline:** a final pass that re-reads each CONFIRMED/POTENTIAL finding and tries to **disprove** it: is the oracle really level 1–6? is there a benign explanation (env/data/automation issue)? is it a duplicate of another finding? would a frontend-only fix just move the bug one layer down? Downgrade any finding that fails. Explicitly a bias-control step, run before the report.
- **Acceptance check:** `grep -qiE "disprove|downgrade|confirmation bias|duplicate" references/core/second-opinion.md`.
- **Dependencies:** SKILL wiring (G-S) between Phase 6 and 7. **Effort:** S. **Parallel-safe:** yes.

## G7 — Metamorphic / differential / parity testing (true discovery amplifier)
- **Gap closed:** Dim C; literature (metamorphic/differential/property-based); finds bugs with no obvious oracle — the core "what I can't think of" case.
- **Files to create:** `references/core/metamorphic-differential.md`; optional `templates/playwright/metamorphic.ts`.
- **Required content outline:** H2 "When there is no oracle" (metamorphic relations: reorder inputs → same result; add-then-remove → invariant; search "AB" ⊆ search "A"); H2 "Differential/parity" (same request two roles/two clients/old-vs-new build → expected equivalence or defined difference); H2 "Property-based" (generate inputs within a discovered constraint, assert an invariant, shrink on failure — `fast-check` if a JS project, else describe). Each finding still classified via `oracle-hierarchy.md` (the metamorphic relation becomes the oracle).
- **Acceptance check:** `grep -qiE "metamorphic|differential|invariant" references/core/metamorphic-differential.md`.
- **Dependencies:** none. SKILL wiring G-S. **Effort:** M. **Parallel-safe:** yes.

## G8 — Named-heuristics + standards mapping sheet (FEW HICCUPPS, SFDIPOT, RCRCRC; WCAG/OWASP/Nielsen)
- **Gap closed:** Dim C/F; literature (M. Bach heuristics, RCRCRC); concrete standards by name.
- **Files to create:** `references/core/heuristics-cheatsheet.md`.
- **Required content outline:** compact tables for FEW HICCUPPS (consistency oracles), SFDIPOT (product-element coverage), CRUSSPIC STMPL (quality criteria → map to ISO 25010), RCRCRC (regression selection); a "standards index" naming WCAG 2.2 AA (map existing a11y checks to criteria by name — alt text, labels, keyboard, focus, headings, contrast), OWASP WSTG/ASVS/API Top 10, Nielsen's 10 heuristics (link to a11y/usability passes). No invented clause numbers.
- **Acceptance check:** `grep -qiE "HICCUPPS|SFDIPOT|RCRCRC|WCAG|Nielsen" references/core/heuristics-cheatsheet.md`.
- **Dependencies:** none. SKILL wiring G-S. **Effort:** S. **Parallel-safe:** yes.

## G9 — Fill remaining ISTQB technique gaps (use-case, white-box coverage concepts, collaboration-based, 7 principles)
- **Gap closed:** conformance-matrix "Missing" rows.
- **Files to edit:** `references/core/test-design-techniques.md` (add short sections: Use-case testing; White-box statement/branch coverage *as a review lens* — "when you can read code, ask which branches no test exercises"; Collaboration-based testing — ATDD/BDD example-mapping when working with a team); create `references/core/principles.md` (the 7 ISTQB principles, one line each, as framing).
- **Required content outline:** keep each addition brief and prioritized (the skill's YAGNI tone); white-box is a *reading lens*, not a mandate to instrument coverage.
- **Acceptance check:** `grep -qiE "use.case|statement/branch|branch coverage" references/core/test-design-techniques.md && test -f references/core/principles.md`.
- **Dependencies:** none. SKILL wiring G-S (optional). **Effort:** M. **Parallel-safe:** partially — `test-design-techniques.md` is also touched by G3; sequence G3 then G9 (or merge). **Not fully parallel-safe with G3.**

## G10 — Time-travel + data-shape/volume + concurrency + locale (Turkish casing) as first-class techniques
- **Gap closed:** amplifiers named in the brief (time travel timezone/DST/clock skew; data volume/shape generators; concurrency probes; Turkish I/ı İ/i). Currently scattered/partial (`six-directions.md:57` has Turkish casing; DST only appears once in a Turkish list).
- **Files to create:** `references/core/perturbation-dimensions.md` (consolidates into named techniques with oracles), referencing existing `perturbation.md`/`six-directions.md` rather than duplicating.
- **Required content outline:** H2 "Time travel" (set clock/timezone/DST boundary; expiry while backgrounded; clock skew between client/server); H2 "Data shape & volume" (0/1/many/huge; empty vs null; deeply nested; pagination extremes — link `six-directions.md` Screen/Shape API row); H2 "Concurrency probes" (double-submit, lost update, idempotency — link `assertions.md`); H2 "Locale/Turkish casing" (the `toLocaleLowerCase('tr')` trap from `six-directions.md:57`, applied to search/uniqueness/sort/login). Each with an oracle.
- **Acceptance check:** `grep -qiE "DST|timezone|clock skew|toLocaleLowerCase|idempotency" references/core/perturbation-dimensions.md`.
- **Dependencies:** none. SKILL wiring G-S. **Effort:** M. **Parallel-safe:** yes.

## G11 — Translate Turkish-only reference files to English (keep Turkish ticket phrasing where it is sample output)
- **Gap closed:** Weakness #8 — English-only readers/agents lose whole files.
- **Files to edit:** `references/core/advanced-exploratory-attacks.md`, `references/lenses/api/backend-injection-testing.md` (coordinate with G2), `references/lenses/web/responsive-layout-attacks.md`, `references/core/search-testing-patterns.md` (Turkish parts), `references/core/session-mode.md`, `references/core/charters-backlog.md`, `templates/session-summary.md`, `templates/charter.md`. Policy: core/lens guidance in English; **sample ticket text may stay Turkish** as realistic output examples, clearly labeled "example output."
- **Required content outline:** 1:1 meaning-preserving translation; keep all headings/anchors so cross-references survive.
- **Acceptance check:** `node tools/lint-references.mjs` passes (already checks CJK, extend per G-lint if desired); manual spot-check that no guidance sentence remains untranslated. Cross-reference integrity: `grep -rn "references/core/advanced-exploratory-attacks.md" .` targets still resolve.
- **Dependencies:** overlaps G2 on the injection file — do G2 first. **Effort:** L. **Parallel-safe:** no for the injection file (shared with G2); yes for the rest.

## G12 — De-duplicate methodology: make PORTABLE.md and README.md derive from a single source of truth
- **Gap closed:** Weakness #7 / contradiction #7 — triple maintenance causes drift (already visible: headed-mandatory appears in SKILL/ENFORCEMENT but not PORTABLE).
- **Files to edit:** `PORTABLE.md` (regenerate from SKILL.md + references, or add a header "generated snapshot of SKILL.md @<date> — do not edit by hand"), `README.md` (trim the stale "Recently added"/wishlist narrative to a short changelog; keep install/usage). Optionally add `tools/build-portable.mjs` that concatenates SKILL.md + references into PORTABLE.md.
- **Acceptance check:** PORTABLE.md contains no rule that contradicts SKILL.md after G-S (spot-check headed-browser wording matches); README has no "what I'd add next" wishlist.
- **Dependencies:** run **after** G-S and all content tasks so it snapshots the corrected text. **Effort:** M. **Parallel-safe:** no (must be last, depends on final text).

## G13 — Fix or honestly scope the standalone agent
- **Gap closed:** Weakness #9 / contradiction #9 — Amazon-hardcoded selectors, reflection-as-XSS false positives, `--disable-web-security`, no oracle/confidence in tickets, README over-claim.
- **Files to edit:** `agent/src/lib/executor.ts` (replace `#twotabsearchtextbox`/`#nav-search-submit-button` with generic input/submit discovery, or gate each suite on finding a real target element and mark "skipped: no target element" instead of silently testing Amazon's box); `agent/src/lib/browser.ts` (remove `--disable-web-security` or make it opt-in behind a flag with a logged warning); `agent/src/lib/ticket.ts` (add an oracle/confidence field and stop emitting reflection-only findings as `fail`/critical — downgrade to "warning: reflected, execution not proven"); `README.md` (state the agent is a smoke-test harness needing per-site selector config, not a universal tester).
- **Required content outline:** XSS detection must distinguish reflected-in-DOM from executed (dialog/`__xss_executed`); only the latter is `fail`.
- **Acceptance check:** `grep -rn "twotabsearchtextbox\|nav-search-submit-button" agent/src` returns 0; `npm --prefix agent run build` succeeds; README no longer claims generic any-URL testing without configuration.
- **Dependencies:** none. **Effort:** L. **Parallel-safe:** yes (agent dir only).

## G14 — Repo hygiene: stop committing generated evidence; add .gitignore
- **Gap closed:** Weakness/contradiction #11 — hundreds of committed PNGs under `agent/evidence/**` and `agent/docs/qa-reports/**` bloat the skill and are run artifacts, not methodology.
- **Files to edit/create:** `agent/.gitignore` (add `evidence/`, `docs/qa-reports/`, `test-results/`, `*.webm`); `git rm -r --cached agent/evidence agent/docs/qa-reports` (the task executor runs this; no commit in the evaluation).
- **Acceptance check:** `git status` shows the evidence trees untracked/ignored; `git ls-files agent | grep -c '\.png$'` trends to 0 after the cached removal.
- **Dependencies:** none. **Effort:** S. **Parallel-safe:** yes.

---

## G-S — SKILL.md / ENFORCEMENT.md edits (BATCH LAST, single pass)
All edits to the two router files are collected here so content tasks above stay parallel-safe. Apply after G1–G11 land their new files.

1. **Headed-browser rule (contradiction #1):** in `SKILL.md:156-200` and `ENFORCEMENT.md:8-13`, replace "MANDATORY / non-negotiable / headless:false always" with the nuanced rule already in Phase 4 / PORTABLE: headed when a human is watching, headless for unattended/CI; keep full-screen only as a when-headed preference.
2. **Playwright-always rule (contradiction #2):** in `SKILL.md:136-154`, change "always provision Playwright, never use the target's framework" to "reuse the repo's configured runner if present; provision a minimal Playwright only when none is reachable" (align with `discovery.md`, `DESIGN.md`). Mirror-fix `blackbox-discovery.md:65-104` (this is a reference-file edit, can go with G2's batch or here).
3. **"Read ALL reference files" (contradiction #5):** in `SKILL.md:323-351` and `ENFORCEMENT.md:24`, scope to "read the files for the selected mode + lens(es) + domain pack," not all.
4. **Synchronous-UI verdict (G3):** reword `SKILL.md:112-119,410-411,468-472` per G3.
5. **Wire new references into phases:** add to Phase 2/3 reading lists: `risk-register.md` (G1), `planning-and-completion.md` (G5), `metamorphic-differential.md` (G7), `heuristics-cheatsheet.md` (G8), `perturbation-dimensions.md` (G10), `authz-matrix.md` (G4); add `second-opinion.md` (G6) between Phase 6 and Phase 7; add the new techniques from G9. Add matching lines to the completion checklist.
6. **Mode-aware trackers:** note that `TEST_EXECUTION_TRACKER.md` is Sweep-only; Session uses `session-summary.md`.
- **Acceptance check:** `node tools/lint-references.mjs` passes; `grep -c "non-negotiable" SKILL.md ENFORCEMENT.md` == 0; every new reference filename from G1–G10 appears at least once in SKILL.md.
- **Dependencies:** all content tasks. **Effort:** M. **Parallel-safe:** NO (serialize; run last, then G12).

---

## Suggested execution order
1. Parallel wave A (safety + independent files): **G2, G3, G4, G6, G7, G8, G10, G14.**
2. Parallel wave B (depend on wave A files or shared files): **G1, G5** (after/with risk concept), **G9** (after G3 on the shared file), **G13.**
3. **G11** (translation; after G2 for the injection file).
4. **G-S** (SKILL/ENFORCEMENT batch).
5. **G12** (regenerate PORTABLE/README from final text) — strictly last.

---

## Do NOT build (YAGNI / out of scope / would mislead)
- **A full pentest/exploitation module.** Active injection stays quarantined (G2), authorization-gated, never a default — do not re-add DROP/xp_cmdshell/XXE payload libraries as runnable QA steps.
- **A custom MCP server / new tool runtime.** `DESIGN.md` already ruled this out for V1; the file/shell/browser tools suffice.
- **CI pipeline / scheduler for the skill itself.** The brief and the skill both avoid it; the standalone agent is the automation surface.
- **Rewriting the standalone agent into a full AI-reasoning engine.** Fix its honesty (G13), don't duplicate the skill's judgment in code.
- **Jira/tracker API integration.** Paste-ready tickets are deliberate; keep it.
- **A mobile black-box auto-mapper.** Known gap (`blackbox-discovery.md:9-12`); not worth building now.
- **Per-criterion automated WCAG 2.2 auditing engine.** Map to criteria names (G8) and keep axe-core as an opt-in dependency; don't build a scanner.
- **Exhaustive combinatorial generation.** Keep pairwise + risk-prioritized selection; do not add full cross-product generators (contradicts the skill's "stop when the risk profile stops changing").
- **Translating sample ticket output to English.** Keep Turkish example tickets as realistic samples (G11 scope note) — only guidance prose is translated.
