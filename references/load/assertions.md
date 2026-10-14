# Load Assertions

Threshold sources: `profile` = the per-environment profile file (supplied by the user/private pack); `spec` = a fixed rule stated here.

| Check | How measured (k6 metric / Playwright) | Threshold source | Severity |
|---|---|---|---|
| Correct 429 behavior: no 429 below the limit; 429 above it, with a clear body and, where applicable, a Retry-After header | k6 `status_429` Counter and `check()` on status/headers in throttle-probe; Playwright checks the user sees an understandable message | profile (limit N) | High if 429 below limit or missing above; Medium if body/headers unclear (report; product decides) |
| No duplicate writes: double submit gives exactly one record | Playwright double-click on submit then count `TEST_` rows; k6 two parallel identical requests then count records | spec: exactly 1 | Critical |
| Idempotency / retry safety: retrying a write does not create a second record. Expected: server-side dedupe or 409. Do not assume an idempotency key exists; if neither dedupe nor 409 occurs, report as a finding | k6 repeat identical POST, compare record count and status codes | spec: 1 record, or 409 | High |
| Lost update: concurrent edits of one record. If no ETag/version exists, last-write-wins is a finding | k6 two parallel PUT/PATCH with different values, then read back; check for ETag / If-Match support | spec: conflict detected (409/412) or documented | High |
| Latency | k6 `http_req_duration` p(95) | profile (per environment) | Medium to High by overshoot |
| Error rate | k6 `http_req_failed` rate, with 429 counted separately in `status_429` | spec: < 1% | High |
| Zero data loss: count of `TEST_` records equals count of 2xx writes | k6 counter of 2xx writes vs. a post-run list/count call (or DB count if approved) | spec: equal | Critical |
| Read-after-write consistency: a created or edited record is visible on the next read | k6 write then immediate GET with a `check()`; Playwright list refresh shows the record | spec: visible on first read, or documented eventual-consistency window | Medium to High |
