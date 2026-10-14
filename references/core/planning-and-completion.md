# Planning and Completion

Keep it to one page. Plan in Phase 2, monitor during Phase 3-6, close in Phase 7.

## Lightweight test plan

- **Scope**: in / out, one line each.
- **Risk ids**: top risks from `references/core/risk-register.md`, with planned coverage.
- **Oracles available**: which levels of `references/core/oracle-hierarchy.md` exist for this module.
- **Environment and users**: URL, test users/roles, data, DB access yes/no.
- **Time/budget**: Sweep = effort cap in scenarios or hours; Session = 60 min timebox.
- **Exit criteria**: as defined below, stated up front.

## Monitoring and control

Check at roughly each third of the budget: planned vs executed scenarios, defects found per risk id, blockers.

When time or budget shrinks, drop in this order:
1. Low-risk scenarios and cosmetic checks.
2. Breadth on Medium risks (keep one scenario each).
3. Optional lenses (a11y, i18n, responsive) unless they are the charter.
4. Never drop: Critical/High risks, evidence capture, the second-opinion pass (`references/core/second-opinion.md`), the report.

Re-prioritize when: a defect cluster appears (raise neighbouring risks), an env blocker stalls an area (log in report section 6, move on), an assumption is disproved (re-score).

## Completion / exit criteria

**Sweep** is done when all hold:
- Every Critical/High risk id has executed coverage; Medium covered or listed as residual.
- Every modeled scenario is executed or explicitly skipped with a reason.
- No open Critical/High finding is unexplained (each is CONFIRMED, POTENTIAL, or disproved per the second-opinion pass).
- Evidence saved for every finding.
- Report written with residual risk and unverified assumptions.

**Session** is done when any holds: timebox ended, charter question answered, or a blocker makes the charter unanswerable. Plus: notes classified, evidence complete, session summary filled (`templates/session-summary.md`).

If exit criteria are not met, say which and why in report section 7. Do not declare completion silently.

## Traceability

Link, when they exist:
- scenario -> risk id -> acceptance criterion / requirement / ticket id.
- finding -> scenario # -> risk id -> oracle level and source.
- tracker ticket id -> finding.

Minimum: each finding and scenario carries a risk id; each acceptance criterion known to the run maps to at least one scenario, or is listed as uncovered. When no criteria exist, write "none provided" rather than inventing them.

| criterion / ticket | risk id | scenario # | finding |
|--------------------|---------|-----------|---------|
| AC-3 | R1 | 4 | #1 |
