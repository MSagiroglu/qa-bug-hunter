# Discovery Checklist

Run this before generating or executing any test. The goal is to replace
assumption with evidence — every constraint you test against in later
phases must trace back to something found here.

## 1. Repo / stack detection

Using your file-read tool, check the target repo root for:

- Test runner config: `playwright.config.*`, `cypress.config.*`,
  `jest.config.*`, `vitest.config.*`. Whichever exists is what you reuse in
  Phase 4 — do not introduce a second test runner for a one-off check.
- Frontend framework: `package.json` dependencies (Angular, React, Vue,
  etc.) and the component/template file layout.
- Backend/API layer: controller/route files, DTO/schema definitions, ORM
  models.
- Existing test structure: naming conventions, folder layout, fixtures/page
  objects already in use. Follow existing conventions rather than
  introducing new ones.
- How the app is started locally (`package.json` scripts, `docker-compose`,
  README).
- Auth/session handling: storage state files, login flow, token handling —
  you'll need this to reach the feature under test at all.

If no test tooling exists in the repo, don't scaffold a full framework to
answer one exploratory question — use direct HTTP calls or a single
one-off browser session, and say so in the report.

## 2. Feature trace

For the specific module/feature requested, trace the complete path:

```
UI → frontend validation → API request → backend validation
   → business logic → database → API response → UI state
```

Concretely, find and read:

- The component/page/modal rendering the feature and every interactive
  element on it (inputs, buttons, dropdowns, tables).
- Frontend validation: required/min/max/pattern attributes, validator
  functions, disabled-state logic.
- The API call(s) triggered: endpoint, request DTO, response DTO.
- Backend validation: schema/decorator validation, manual checks, business
  rule functions.
- Database constraints if the schema is visible (column types, nullability,
  unique constraints, foreign keys).
- Existing automated tests covering this feature, if any — read them before
  writing new ones; don't duplicate coverage, extend it.
- Feature flags or config toggling behavior relevant to this feature.

## 3. What you're building from this

By the end of discovery you should be able to state, for every input on the
feature: its semantic type, whether it's required, its constraints (and
where each constraint is enforced — frontend only? backend only? both?
consistently?), and what happens downstream when it's saved.

That last question — frontend-only vs. backend-enforced vs. both — is the
single highest-yield thing discovery produces. A constraint enforced only in
the frontend is a near-guaranteed exploratory finding once you bypass the
UI (Phase 4).

Do not proceed to Phase 3 test design on a feature you haven't traced this
way. If you truly can't find backend source (closed system, no access),
say so explicitly in the report and treat backend behavior as inferred from
API responses only, at reduced oracle confidence (see
`oracle-hierarchy.md`).
