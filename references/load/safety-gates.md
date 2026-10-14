# Load Safety Gates

All seven gates are mandatory, in order. Stop at the first gate that fails.

1. **Allowlist / denylist.** The target must appear in `targets.allow` and must not match `targets.deny`. Both files are supplied by the user. Never guess or hardcode a production hostname; ask the user to write the deny patterns.
2. **Explicit environment statement.** The user names the environment in chat. The script compares `LOAD_TARGET` with the allowlist and exits on mismatch.
3. **Shared environments.** A time window and team approval must be written in the report before any load (`LOAD_WINDOW_OK=1` is set only after that).
4. **Ceilings below throttle limits.** VU/request ceiling stays under the known throttle limits. One account is one throttle key, so more VUs require more accounts; the number of accounts caps the VUs.
5. **Own data only.** Only `TEST_`-prefixed data created by the run, with cleanup and verification afterwards (before/after counts in the report).
6. **Credentials from environment variables only.** Session values come from env vars and are never written to the repository, logs or reports.
7. **No load while planning.** Planning and dry-run (`DRY_RUN=1`) never generate load.

## File format

`targets.allow` / `targets.deny`: one entry per line, `#` comments allowed, entries are origins such as `https://app.example.test`. Deny entries are matched as substrings. See `templates/k6/targets.allow.example`.
