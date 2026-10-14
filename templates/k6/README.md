# k6 load templates

Generic, gated, dry-run-first templates. Read `references/load/safety-gates.md` before use. All hosts and paths are `CONFIGURE-ME` placeholders.

## Files
- `lib/gate.js`: allow/deny check, window confirmation, DRY_RUN plan printing
- `lib/auth.js`: headers from `SESSION_COOKIE` or `BEARER_TOKEN` (never logged)
- `baseline.js`, `ramp.js`, `spike.js`, `soak.js`, `throttle-probe.js`
- `targets.allow.example`: copy to `targets.allow` and edit

## Environment variables
| Var | Meaning |
|---|---|
| `LOAD_TARGET` | origin under test (must be in allow file) |
| `TARGETS_ALLOW` / `TARGETS_DENY` | ABSOLUTE paths to the allow / deny files (read with `open()` in init context) |
| `LOAD_WINDOW_OK` | `1` only after window + approval are in the report |
| `DRY_RUN` | `1` sends zero HTTP and prints the plan |
| `SESSION_COOKIE` / `BEARER_TOKEN` | credentials, env only |
| `WRITE_PATH`, `CLEANUP_PATH`, `PROBE_PATH` | request paths (replace CONFIGURE-ME) |
| `MAX_VUS`, `SOAK_DURATION` | ceilings from the per-environment profile |
| `THROTTLE_ENABLED`, `THROTTLE_N` | throttle-probe only |

## Dry run (no HTTP)
```
DRY_RUN=1 LOAD_TARGET=https://app.example.test LOAD_WINDOW_OK=1 TARGETS_ALLOW=/abs/path/targets.allow k6 run templates/k6/baseline.js
```
A target that is not in the allow file must be rejected by the gate. The 429 counter is `status_429`; k6 counts 429 inside `http_req_failed`, so read both.
