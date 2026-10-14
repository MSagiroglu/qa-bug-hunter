# Load Scenarios

Durations and VU counts are starting points. The real ceilings come from the per-environment profile file and must stay under the throttle limits (see `safety-gates.md`, gate 4).

| Scenario | Purpose | Duration | VUs | Stop condition | Allowed on shared environments? |
|---|---|---|---|---|---|
| baseline | Establish p95 / error-rate reference | ~5 min | 1-5 | End of duration, or any threshold breach | Yes, with window + approval |
| ramp | Find where latency or errors degrade | ~10 min | 0 to N (N from profile) | Threshold breach, error rate >= 1% excluding 429, or ceiling reached | Yes, with window + approval, low N only |
| spike | Check recovery after a sudden burst | 5 to N to 5 VUs, ~60 s peak | up to N | Threshold breach or failure to recover to baseline | Only with explicit approval; prefer a private environment |
| soak | Detect leaks, drift, counter inconsistency | 60-120 min | low (baseline level) | Latency trend rising, error rate >= 1%, or data-count mismatch | Only off-hours with explicit approval |
| throttle-probe | Verify 429 behavior at the limit | 1 minute | 1 (one account, one action) | 2N+1 requests sent | Only where throttling is actually enabled. Confirm the flag per environment first; otherwise the probe is meaningless and must not run |
| UI-under-load | Verify UX invariants while load runs | Length of the k6 run | 1 browser | k6 stop, or observer failure | Same as the k6 scenario it accompanies |

## Notes

- Every scenario must be run with `DRY_RUN=1` first; the plan is printed and no HTTP is sent.
- Throttle-probe: `N` is the documented per-window limit for the action; send `2*N+1` requests from one account and expect 429 once the limit is crossed. Whether throttling is enabled is a per-environment fact the user must confirm (`THROTTLE_ENABLED=1`).
- One account is one throttle key. More VUs against one account do not test the limiter, they only tire the server.
