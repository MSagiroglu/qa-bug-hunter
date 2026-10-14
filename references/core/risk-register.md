# Risk Register

Risk drives where effort goes. Build the register in Phase 2 (after discovery), update it as findings arrive. Template: `templates/risk-register.md`.

## Risk items

| id | area | failure mode | likelihood L/M/H | impact L/M/H | level | planned coverage | residual |
|----|------|--------------|------------------|--------------|-------|------------------|----------|
| R1 | checkout | double submit creates two orders | M | H | High | double-click, retry, offline resend | untested: gateway timeout |

- **id**: `R<n>`, stable for the whole run; findings, scenarios and report cite it.
- **failure mode**: one concrete way it can break, not a feature name.
- **likelihood**: how probable given change history, complexity, new code, past defects. L/M/H.
- **impact**: business harm per the severity rubric in `references/core/defect-classification.md`. L/M/H.
- **level** = likelihood x impact: L=1, M=2, H=3. 1-2 Low, 3-4 Medium, 6 High, 9 Critical.
- **planned coverage**: scenarios/techniques assigned. **residual**: what stays untested or unverified after the run, and why.

## Product vs project risk

- **Product risk**: the software fails the user (wrong data, security hole, data loss). Drives test depth.
- **Project risk**: the testing itself is endangered (no test users, unstable env, no spec, short time, no DB access). Drives plan, mitigation and report sections 6/7.
- Tag each row `P` (product) or `J` (project). Do not mix them in one level ranking.

## Assumptions register

Every assumption the run relies on. Unverified assumptions cap oracle strength (`references/core/oracle-hierarchy.md`).

| id | assumption | kind | status | oracle level | how to verify |
|----|-----------|------|--------|--------------|---------------|
| A1 | backend rejects names > 50 chars | which side enforces | unverified | 7 | direct API call |
| A2 | seed data has no duplicates | data shape | verified | 4 | DB query |

- Kinds: environment, data shape, which side enforces a constraint, role/permission model, clock/timezone, third-party stub.
- Status: **verified** (checked by an observation or source) or **unverified**.
- A finding that rests on an unverified assumption cannot be CONFIRMED; classify POTENTIAL until verified.
- Verify cheaply first (one request, one query). Carry the rest into report section 7.

## Heat-map

3x3 text grid, ids placed by likelihood (rows) and impact (columns):

```
              impact L   impact M   impact H
likelihood H  .          R4         R2
likelihood M  .          R3         R1
likelihood L  R5         .          R6
```

Top-right is worst. Re-place ids when evidence changes the estimate.

## Wiring

- **Phase 3 order**: execute Critical, then High, then Medium risks; Low only if time remains. Within a level, cheapest scenario first.
- A new finding raises the likelihood of neighbouring risks: re-score before continuing.
- **Report**: Coverage Summary lists risk ids covered and unverified assumption ids; section 7 (Risk Assessment) states residual risk per id.
