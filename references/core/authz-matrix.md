# Authorization Matrix (role x endpoint)

A mechanical way to cover broken access control (BOLA/BFLA) without
guessing which endpoint to try. Every endpoint and method is crossed with
every session you own, and the results are laid out as one matrix. It
complements `references/core/api-ui-crosscheck.md` (single-flow BOLA
method) and `references/lenses/api/api-lens.md` (route discovery).

Template: `templates/playwright/authz-matrix.ts` (`runAuthzMatrix`).

## Rules that never bend

- **Two-user rule.** Use at least two of your own test users (A and B,
  ideally different roles). Never use real users' data or sessions.
- **Cross-tenant** needs a second-tenant account that you own. Without one,
  mark the cross-tenant cells `not testable` in the report. Do not borrow
  an account.
- **Sessions come from environment variables only** (for example
  `AUTHZ_TOKEN_ADMIN`, `AUTHZ_TOKEN_USER`). Values are never logged,
  written to evidence, or put in the report. Only the variable name appears.
- **Safe by default.** Only GET, HEAD and OPTIONS are sent. Write methods
  are sent only when the caller passes (a) an allowlist of write endpoints
  and (b) a payload factory whose output carries the `TEST_` marker.
- **Because it sends many requests**, it passes `references/load/safety-gates.md`
  first: allowlisted origin, deny patterns, `LOAD_TARGET` equal to the
  target, a hard request budget under the throttle limit, a delay between
  requests, and a dry-run that sends nothing. Stop at the first gate that fails.

## Method

1. **Build the endpoint list.** From an OpenAPI/Swagger spec if present
   (`endpointsFromOpenApi`), otherwise from the router or controller files
   (see the Discovery row of `api-lens.md`). Record method, path, auth
   requirement, whether it writes, tenant (if known).
2. **Collect sessions.** One per own test user, plus an optional anonymous
   cell (no credentials). Record role and tenant per session.
3. **Plan.** Cross endpoint x session. Run with `dryRun: true` first and
   read the plan; check the planned count against the budget.
4. **Execute** within the budget, with a delay between requests. Prefer
   ids of records you created yourself (`TEST_` prefix) for `{id}` paths.
5. **Read the matrix.** Cells are `allow` (2xx/3xx), `deny` (401/403),
   `other` (404, other 4xx, 5xx: ambiguous, inspect), or `skipped` with a reason.

## Expectations and oracles

Expected allow/deny comes from a **user-supplied expectation map**
(`"GET /admin/users": { admin: 'allow', user: 'deny' }`) built from the
requirements or the role documentation.

| Situation | What may be reported | Oracle (see `oracle-hierarchy.md`) |
|---|---|---|
| Expectation map comes from acceptance criteria or documentation, observed differs | Defect (confirmed once reproduced) | Level 1-2 |
| Expectation map derived from the code's guards (decorators, middleware) | Defect | Level 5 |
| Expectation `unknown` | **Only the difference between roles** is listed as a `ROLE_DIFFERENCE` lead. It is never asserted as a defect. | None yet: ask which behavior is intended |
| Cross-tenant session gets 2xx on another tenant's resource | `CROSS_TENANT_ALLOW`, Critical lead; confirm with a data read | Level 7-8 until a rule says otherwise, then raise |

Do not silently upgrade a lead into a requirement. If the strongest oracle
is level 7 or below, classify as "Potential Defect / Behavior Requiring
Clarification" per `defect-classification.md`.

## UI hides / API allows

Optional input: a UI visibility map built from your exploration
(`uiVisible: { user: false }` on an endpoint: that role's UI does not offer
the action). If a role's UI hides the action and the API returns 2xx, the
mismatch is `UI_HIDES_API_ALLOWS` (Critical; see the class table in
`api-ui-crosscheck.md`). Without the map this class is simply not reported.

## Output

`runAuthzMatrix` returns `{ gate, plan, cells, matrix, mismatches,
notTestable, requestsSent, errors }` and never throws. Put the matrix text
and the raw request/response of each mismatch in the finding evidence,
tokens redacted.

## Checklist

- [ ] Safety gates passed; target allowlisted; dry-run reviewed
- [ ] At least two own test users (plus second-tenant account, or `not testable` noted)
- [ ] Sessions from env vars, nothing logged
- [ ] Write endpoints only via allowlist and `TEST_` payload; cleanup done afterwards
- [ ] Each mismatch reproduced with a single request before it is reported
