# Senior QA Explorer — Skill Assessment

Date: 2026-10-14
Evaluator role: expert test architect (exploratory-testing focus; web/mobile/API)
Method: full read of SKILL.md, ENFORCEMENT.md, README.md, PORTABLE.md, references/** (core, lenses, invariants, load, domains), templates/**, tools/lint-references.mjs, agent/src/**. Every score cites files actually read. The private product-specific domain pack was NOT read (out of scope) and is not referenced here.

---

## Executive summary

**Total weighted score: 68 / 100** — a strong, unusually self-aware methodology package that already encodes several senior-level habits most QA skills miss (independent persistence verification, an oracle hierarchy, evidence-as-files discipline, safety-gated load testing, a WAI-ARIA overlay-invariant library). It is held back from a higher score by (a) a cluster of absolute "MANDATORY" rules that contradict both its own calmer guidance and basic context/CI realities, (b) one reference file that crosses from QA into active attack tooling in direct conflict with the skill's stated passive-only security scope, (c) missing ISTQB breadth (white-box coverage concepts, collaboration-based testing, explicit risk-level and traceability), and (d) no "discovery amplifier" layer — the very thing an expert explorer wants to catch what they cannot think of (metamorphic/differential tests, automatic authz matrices, state-model extraction, time-travel, bug-class memory, adversarial second opinion).

### Top 5 strengths
1. **Independent-persistence / ghost-success discipline.** `references/core/critical-defect-patterns.md` and `references/core/api-ui-crosscheck.md` (three-witness: UI + network + independent re-read, `templates/playwright/api-ui-crosscheck.ts`) encode the single highest-yield senior habit: never trust the UI's own success signal. The 2×2 (ghost success / orphaned error) is exactly right.
2. **Oracle discipline.** `references/core/oracle-hierarchy.md` (9 levels) + the rule that anything at level ≤7 is "Behavior Requiring Clarification," never asserted, is a genuine anti-overclaim control, reinforced in `defect-classification.md`.
3. **Evidence-as-files rigor.** `references/core/evidence-capture.md` explicitly rejects `console.log` as evidence and requires real saved files with a manifest matched by the ticket's attachments — a real anti-hallucination control.
4. **Safety-gated load testing.** `references/load/safety-gates.md` (7 ordered gates), dry-run-first, allowlist/denylist, env-var-only credentials, `TEST_`-only data with cleanup proof (`templates/k6/*`, `lib/gate.js`). This is responsible by construction.
5. **Overlay/dialog invariant library.** `references/invariants/overlay-dialog.md` (OV1–OV14, sourced to WAI-ARIA APG) with a real measuring helper `templates/playwright/overlay-invariants.ts` — turns a vague "modals are buggy" into 14 measured checks.

### Top 8 weaknesses
1. **Self-contradicting "headed is MANDATORY/non-negotiable."** `SKILL.md:166-170` and `ENFORCEMENT.md:9-13` make visible/full-screen headed Chromium non-negotiable; `PORTABLE.md:316-323` and `SKILL.md` Phase 4 (`493-495`) correctly say headed-when-watching, headless for unattended. The absolute form is wrong for CI/the skill's own standalone agent and contradicts the nuanced rule.
2. **"Playwright ALWAYS, never use the target's framework."** `SKILL.md:136-154` and `references/core/blackbox-discovery.md:65-104` mandate always provisioning Playwright and explicitly *never* using the repo's own framework — contradicting `DESIGN.md` non-goals ("reuse whatever execution tooling already exists"), `discovery.md:9-14`, and Phase 4's "reuse whatever execution tooling discovery found." Counterproductive mandate.
3. **Active-attack content under the API lens contradicts the passive-only scope.** `references/lenses/api/backend-injection-testing.md` instructs sending destructive SQL (`DROP TABLE`, `xp_cmdshell`), time-based `SLEEP/pg_sleep`, XXE reading `/etc/passwd`, path traversal, and auth-bypass payloads. This directly contradicts `references/core/security-hygiene.md` ("passive only… never craft attack input… never attempt injection, auth bypass, fuzzing"). On shared/stage environments this is a real safety hazard, not just a doc inconsistency.
4. **Assertion-alone "CONFIRMED DEFECT" shortcuts.** Empty-submit guidance asserts "submit succeeds → CONFIRMED DEFECT" (`advanced-exploratory-attacks.md §1`, `test-design-techniques.md:148-149`) and the synchronous-UI rule declares "refresh needed → DEFECT" absolutely (`SKILL.md:112-119,410-411,468-472`). Both contradict the skill's own core rule "never report a defect on a failed assertion alone" and the oracle discipline.
5. **ISTQB breadth gaps.** No white-box/coverage concepts (statement/branch), no collaboration-based testing (ATDD/BDD), no explicit risk level = likelihood × impact, no product-vs-project risk, no requirement traceability, no explicit planning/monitoring/completion-criteria activities. (See conformance matrix.)
6. **No discovery-amplifier layer.** No metamorphic/differential/property-based testing, no automatic role×endpoint authz matrix from a spec, no state-model extraction/random-walk, no time-travel (timezone/DST/clock-skew) as a first-class technique, no bug-class memory, no adversarial "second opinion" pass, no assumptions register. For a tool whose purpose is "find what I cannot think of," this is the biggest missed opportunity.
7. **Usability / redundancy / language drift.** The methodology exists in triplicate (SKILL.md 31KB, PORTABLE.md 27KB, README.md 20KB) risking drift; several reference files are Turkish-only (`advanced-exploratory-attacks.md`, `backend-injection-testing.md`, `responsive-layout-attacks.md`, parts of `search-testing-patterns.md`, `session-mode.md`), so an English-only reader loses content; "read ALL reference files" (`SKILL.md:323-351`) fights the context budget and is applied even to API-only.
8. **Standalone agent over-claims genericity and emits false positives.** README markets "test any URL," but `agent/src/lib/executor.ts` hardcodes Amazon selectors (`#twotabsearchtextbox`, `#nav-search-submit-button`) in every suite, so it only works on Amazon; XSS/HTML detection uses `innerHTML.includes(payload)` (reflection ≠ execution) producing false positives/negatives; `--disable-web-security` is set in `browser.ts`. No oracle/confidence modeling reaches the agent's tickets.

---

## Scored rubric

| Dim | Area (weight) | Score /5 | Weighted | Justification (evidence) |
|---|---|---|---|---|
| A | Exploratory practice: SBTM/charters/timeboxes/notes/debrief/metrics/tours (15) | 4 | 12.0 | `session-mode.md` = SBTM done well: charter formula, 60-min 5/45/10 timebox, session-metric buckets Test/Bug-investigation/Setup, note tags DENEDIM/BUG/SORU/FIKIR, mandatory debrief with non-empty "Kapsanmayan"/"Sonraki görev" (`templates/session-summary.md`); `six-directions.md` + `perturbation.md` are tour/heuristic-like. Missing: named Whittaker tours, Hendrickson-style cheat-sheet mnemonics; Sweep mode lacks explicit session metrics/exit criteria. |
| B | ISTQB CTFL v4.0 alignment (20) | 3 | 12.0 | Black-box + experience-based techniques all present and well-prioritized (`test-design-techniques.md`). Absent: white-box/coverage concepts, collaboration-based testing, 7 principles, explicit risk level = likelihood×impact, product-vs-project risk, traceability, explicit planning/monitoring/completion activities. See conformance matrix. |
| C | Oracles & heuristics (10) | 3 | 6.0 | Oracle problem squarely addressed (`oracle-hierarchy.md`, 9 levels); three-witness is a de-facto differential oracle. Absent: FEW HICCUPPS, SFDIPOT, CRUSSPIC STMPL, RCRCRC named consistency heuristics; metamorphic/differential/parity/property-based testing not in the public skill. |
| D | Risk-based prioritization & coverage reporting (10) | 3 | 6.0 | Prioritization rankings exist (`test-design-techniques.md:209-226`, `advanced-exploratory-attacks.md:327-342`); report has coverage, "what was NOT tested," risk assessment, per-finding confidence (`report-template.md`, `defect-classification.md:50`). Absent: risk level = likelihood×impact, risk heat-map, explicit overall confidence statement. |
| E | Defect handling (10) | 4 | 8.0 | Strong: investigate-before-classify loop (`SKILL.md` Phase 4), reproduce-before-CONFIRMED and flaky→POTENTIAL (`defect-classification.md:56-59`), minimization, root-cause hypothesis as its own labeled bullet, false-positive trap (frontend/backend mismatch), INCOSE-style ticket (`jira-ticket-template.md`). Gaps: no duplicate/known-issue dedup step; severity-vs-priority separated only in the agent (`ticket.ts`), not in the methodology. |
| F | ISO/IEC 25010 + concrete standards (10) | 3 | 6.0 | Covers functional suitability, security (hygiene + injection), usability (a11y), compatibility (cross-browser), performance efficiency (load), reliability (interrupted writes). WCAG criteria not mapped to 2.2 AA clause names; OWASP WSTG/ASVS/API Top 10 and Nielsen heuristics not referenced by name; maintainability/portability/safety not treated as product-quality axes. |
| G | Web/Mobile/API depth & AI-vs-human realism (10) | 4 | 8.0 | Good web depth, real mobile coverage (`mobile-discovery.md`, `mobile-exploratory-considerations.md`), clean API lens (`api-lens.md`) + per-surface six-directions matrix. Honest capability boundaries (cannot open a simulator it isn't given; provisioning fallbacks). Loses a point to the "Playwright always / headed mandatory" over-claims that misstate what the agent can realistically do unattended. |
| H | Agent-specific rigor (10) | 4 | 8.0 | Evidence-first, hypothesis discipline, anti-hallucination (never cite an unsaved file), test-data hygiene, load safety gates, credentials from env only. Missing: state/resume/checkpointing for long runs; the "read ALL references" rule strains context budget. |
| I | Usability for a human tester (5) | 2 | 2.0 | Router model is good, but triple redundancy (SKILL/PORTABLE/README) invites drift; language inconsistency (several Turkish-only reference files); contradictions between absolute mandates and nuanced guidance raise cognitive load; `TEST_EXECUTION_TRACKER.md` fixed 20-row table is Sweep-only and ignores mode. |
| | **Total** | | **68.0** | |

*Weights unchanged from the brief.*

---

## ISTQB CTFL v4.0 conformance matrix

| ISTQB item | Status | Evidence | Gap id |
|---|---|---|---|
| 7 fundamental principles | Missing | Not stated anywhere | G9 |
| Test process — planning | Partial | Mode/lens/charter selection acts as lightweight planning (`SKILL.md:41-72`); no risk-based plan artifact | G5 |
| Test process — monitoring & control | Missing | No metrics-driven control; session has a timebox only | G5 |
| Test process — analysis | Covered | Phase 1 Discovery + Phase 2 Test model (`SKILL.md`, `discovery.md`) | — |
| Test process — design | Covered | Phase 3 + `test-design-techniques.md` | — |
| Test process — implementation | Covered | Templates + execution loop (`SKILL.md` Phase 4) | — |
| Test process — execution | Covered | Phase 4 hypothesis→action→observation loop | — |
| Test process — completion | Partial | Completion checklist exists (`SKILL.md:629-665`); no exit-criteria decision for Sweep | G5 |
| EP | Covered | `test-design-techniques.md:8-13` | — |
| BVA | Covered | `test-design-techniques.md:15-27` (incl. inferred-range labeling) | — |
| Decision table | Covered | `test-design-techniques.md:29-35` | — |
| State transition | Covered | `test-design-techniques.md:37-42`; `advanced-exploratory-attacks.md §13` | — |
| Use-case testing | Missing | Not present | G9 |
| White-box statement/branch coverage concepts | Missing | No coverage concept anywhere | G9 |
| Error guessing | Covered | `test-design-techniques.md:51-62` | — |
| Exploratory | Covered | `session-mode.md`, Phase-based skill | — |
| Checklist-based | Covered | Completion checklist, `TEST_EXECUTION_TRACKER.md`, a11y page pass | — |
| Collaboration-based (ATDD/BDD) | Missing | None | G9 |
| Risk-based testing (level = likelihood×impact; product vs project risk) | Partial | Impact-ordered prioritization only; no likelihood×impact, no risk register/heat-map | G1, G9 |
| Defect management & report quality | Covered | `defect-classification.md`, `jira-ticket-template.md`, `report-template.md` | — |
| Test independence | Partial | Oracle discipline aids it; no independent/adversarial review pass | G6 |
| Test metrics & exit/completion criteria | Partial | Session exit criteria only; no coverage/defect metrics | G5 |
| Traceability (requirements ↔ tests) | Missing | Ticket IDs are not linked to requirements | G5 |
| Tool support | Covered | Playwright/k6/Schemathesis/axe guidance | — |
| Advanced Test Analyst / Specialist (security, performance, usability, mobile, AI testing) | Partial | Security (hygiene), performance (load), usability (a11y), mobile (lens) present; AI-assisted-testing considerations absent; standards not mapped | G8 |

Clause numbers are intentionally omitted (unverified); items are cited by syllabus area name only.

---

## Literature coverage table

| Source / concept | Status | Evidence / note |
|---|---|---|
| Kaner (exploratory, oracles, "most unexpected ≠ bug") | Covered | Oracle-problem framing in `oracle-hierarchy.md`; defect-vs-undocumented distinction |
| J. Bach / SBTM (charters, session metrics, debrief) | Covered | `session-mode.md` closely mirrors SBTM (charter, timebox, Test/Bug/Setup buckets, debrief) |
| M. Bach / heuristics (FEW HICCUPPS, SFDIPOT, CRUSSPIC STMPL) | Missing | No named heuristic mnemonics; consistency oracle is level 7 only |
| Whittaker — tours (feature/money/landmark/etc.) | Partial | `six-directions.md` is tour-like but not the named tours |
| Hendrickson — *Explore It!* cheat sheets | Partial | Error-guessing prompts + six-directions overlap; no explicit nouns/verbs variation heuristics |
| Weinberg (perspectives on testing/quality) | Missing | Not referenced |
| Beizer — bug taxonomy | Missing | `defect-classification.md` has categories/severity but no bug taxonomy |
| Myers — *Art of Software Testing* (negative testing, EP/BVA roots) | Partial | Techniques present; not attributed, no systematic negative-test taxonomy |
| Crispin & Gregory — Agile Testing Quadrants | Missing | No quadrant framing |
| Test pyramid / test levels | Missing | No unit/integration/E2E level model; "reuse existing tests" only |
| Property-based testing | Missing | Not present (fast-check/Hypothesis not mentioned) |
| Metamorphic / differential / parity testing | Missing | Absent from the public skill |
| Chaos / resilience engineering | Partial | `perturbation.md` + interrupted-write + six-directions Interrupt/Network are fault-injection; not framed as chaos/resilience, no steady-state hypothesis |
| RCRCRC (regression heuristic) | Missing | Regression handled only as per-defect lock-in offer |

---

## Contradictions, redundancy & over-claims

1. **Headed browser: absolute vs conditional.** `SKILL.md:166-170` / `ENFORCEMENT.md:9-13` ("HEADLESS: FALSE… non-negotiable… full screen") vs `SKILL.md:493-495` and `PORTABLE.md:316-323` (headless for unattended). The absolute form breaks CI and the skill's own standalone agent (`agent/src/cli.ts` exposes `--headless`). **Fix: G-S (SKILL/ENFORCEMENT edit).**
2. **"Playwright always, never the repo's framework"** (`SKILL.md:136-154`, `blackbox-discovery.md:65-104`) contradicts reuse-existing-tooling (`DESIGN.md` non-goals, `discovery.md:9-14`, Phase 4). Over-claim and wasteful. **Fix: G-S.**
3. **Active-attack content vs passive-only scope.** `backend-injection-testing.md` (destructive SQL, time-based blind SQLi, XXE file reads, path traversal, auth-bypass) vs `security-hygiene.md`'s "passive only, never craft attack input." Safety hazard on shared stage. **Fix: G2.**
4. **Assertion-alone CONFIRMED.** Empty-submit "success → CONFIRMED DEFECT" (`advanced-exploratory-attacks.md §1`, `test-design-techniques.md:148-149`) and "refresh needed → DEFECT" (`SKILL.md:112-119,468-472`) contradict "never classify from an assertion failure alone" + oracle rule. **Fix: G3.**
5. **"Read ALL reference files"** (`SKILL.md:323-351`, `ENFORCEMENT.md:24`) vs mode/lens-scoped reading (`DESIGN.md §3`, the actual router). Also applied to API-only where most core files don't fit. Context-budget over-claim. **Fix: G-S.**
6. **`console.log` shown as evidence** in `xss-attack-patterns.md` and `shadow-dom-testing.md` examples, contradicting `evidence-capture.md:44-50`. **Fix: G2.**
7. **Redundancy / drift risk.** SKILL.md ⟷ PORTABLE.md ⟷ README.md carry the same methodology three times; the "Recently added"/wishlist prose in README is stale narrative. **Fix: G12.**
8. **Language inconsistency.** Turkish-only reference files (`advanced-exploratory-attacks.md`, `backend-injection-testing.md`, `responsive-layout-attacks.md`, parts of `search-testing-patterns.md`, `session-mode.md`, `charters-backlog.md`, templates) vs English core. An English-only agent/reader loses whole files. **Fix: G11.**
9. **Standalone agent over-claim.** README "test any URL" vs Amazon-hardcoded selectors in `executor.ts`; reflection-as-XSS false positives; `--disable-web-security` in `browser.ts`; tickets carry no oracle/confidence. Risks misleading the tester with confident false positives. **Fix: G13.**
10. **Synchronous-UI rule mislabels a legitimate pattern.** Some flows (async job, eventual consistency) correctly require a refresh; the blanket "refresh → DEFECT" would generate false CONFIRMED defects. **Fix: G3.**
11. **Repo hygiene.** Duplicated committed evidence trees (`agent/evidence/**` and `agent/docs/qa-reports/**`, hundreds of PNGs) bloat the skill and are not methodology. **Fix: G14.**

### Risk of misleading the tester (highest-impact)
- The injection lens can cause a professional to run destructive payloads on a shared environment believing it is in-scope QA (contradiction #3) — **highest real-world risk.**
- Assertion-alone CONFIRMED rules (#4, #10) will manufacture false defects, eroding the skill's own hard-won oracle credibility.
- The standalone agent's false positives (#9) can be reported as real findings by a trusting user.

---

## Honest limits of this evaluation

- **Not executed.** No scenario was run against a live target; the Playwright/k6 templates and the agent were read, not invoked. Claims about runtime behavior (e.g., PrimeVue scroll-lock, whether the three-witness helper matches a given app) are inferred from code, not observed.
- **Domain pack unread.** The private product-specific pack was deliberately not opened; coverage it might add (role matrices, modal deviations, settings-impact) is excluded from scoring by design.
- **ISTQB clause numbers unverified.** Mapping is by syllabus *area name* only; I did not cite v4.0 clause numbers to avoid inventing them. The area list reflects CTFL v4.0 as I know it (knowledge cutoff), not a line-by-line syllabus diff.
- **Standard-text coverage (WCAG 2.2 AA criteria, OWASP WSTG/ASVS IDs) was assessed by concept, not by verifying each criterion ID** — I checked whether the standard is referenced and whether its substance appears, not whether every sub-criterion is complete.
- **Turkish reference files** were read and understood, but nuance in idiomatic QA phrasing may be under-weighted in an English assessment.
- Scores are a senior architect's calibrated judgment, not an inter-rater-averaged measurement; another expert could reasonably move any single dimension ±1.
