# API Lens

Use when the work is API-only (no UI) or when the API is the primary risk. The seven phases still apply; this page says what each becomes. Playwright and a headed browser are not required.

## Phases for API work
| Phase | In API-only mode |
|---|---|
| Discovery | Build the route list (controllers, router files, or the OpenAPI spec if present). For each route record method, auth requirement, roles, request schema, and whether it writes. Note the auth scheme (bearer, cookie, API key) and CSRF protection for cookie-authenticated routes. |
| Design | Use the API column of `references/lenses/six-directions.md`. Add boundary and equivalence design from `references/core/test-design-techniques.md`. Injection is ACTIVE security testing: out of the default QA scope, only with written authorization on an owned, non-shared target (see the banner in `references/lenses/api/backend-injection-testing.md`). By default only observe error leakage with a single benign character (`references/core/security-hygiene.md`). |
| Execution | Send requests, one hypothesis per request set. Vary one thing at a time. Verify state with a follow-up GET or a database check, not only the status code. |
| Evidence | Save raw request and raw response (status line, headers, body) as files per finding, for example `evidence/<id>/request.txt` and `response.txt`. Redact tokens. |
| Classification | Same as UI work: use `references/core/defect-classification.md` and `references/core/impact-analysis.md`. |
| Reporting | Same templates. Reproduction is a curl command or a short request script. |

## Tools
- Playwright `request` (APIRequestContext): good for scripted sequences and reuse of the test runner.
- curl or httpie: quick one-off probes and reproduction commands in reports.
- Schemathesis, only if an OpenAPI spec exists:
  ```
  schemathesis run <spec> --checks all --base-url <url>
  ```
  Treat its output as leads to triage, not as final findings.

## Credentials
Read credentials and tokens from environment variables (for example `API_TOKEN_USER_A`, `API_TOKEN_USER_B`). Never write them into the repository, into evidence files, or into reports. Use two or more users of different roles/tenants to test BOLA and role escalation.

## Safety
Run against a test or staging environment only. No load generation; keep request rates low.

## Minimal checklist
- [ ] Route list built with auth and write flags
- [ ] Each write route tried with: no token, other user's token, malformed body, missing fields
- [ ] Idempotency, ETag/`If-Match`, and pagination boundaries tried where supported
- [ ] Raw request/response saved for every finding
