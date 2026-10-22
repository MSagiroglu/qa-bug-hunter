# Domain packs

A domain pack is optional, product-specific knowledge (modules, roles, safety
rules, generated inventories) that the skill reads in addition to the generic
core. Packs are PRIVATE to their owner and live OUTSIDE this repository. This
directory only holds the contract and an empty template.

## Pack directory

- `QA_DOMAIN_PACKS_DIR` if set, otherwise
  - Windows: `%USERPROFILE%\.qa-bug-hunter\domains\`
  - macOS/Linux: `~/.qa-bug-hunter/domains/`
- One sub-directory per pack: `<dir>/<name>/pack.md` is the entry point.
- Never place a pack inside the skill repository and never commit one.

## Resolution order

1. `--domain <name>` given: use `<dir>\<name>\pack.md`.
2. Otherwise, for every `<dir>\*\pack.md`, match its `Markers:` entries (files,
   folders, or package names) against the target repository; the first pack
   whose markers match is used.
3. No match (or no pack directory): no pack. The skill works fully without
   one; write `Domain pack: none` in the report header.

When a pack is selected, read its `pack.md` and every file it lists.

## Files in a pack

| File | Status | Purpose |
|------|--------|---------|
| `pack.md` | required | Header fields, product summary, reading order, safety summary |
| `modules.md` | required | Module inventory: routes, stores, legacy areas, backend controllers, test-id files |
| `roles.md` | required | Verified role dictionary and contextual (relationship-based) permissions, each with evidence |
| `env-safety.md` | required | Shared-environment rules, mocked destructive endpoints, throttling, account handling |
| `role-module-action-matrix.md` | optional | Role x module x action table, with an evidence column and UI-hides/API-allows mismatches |
| `settings-impact-map.md` | optional | Tenant/feature flags: where changed, downstream effect, whether the backend enforces it |
| `modals.md` | optional | Overlay/modal mechanisms and known invariant-violation candidates |
| `api-surface.md` | optional | Controllers, throttle limits, auth/CSRF notes |
| `charters-backlog.md` | optional | Ready-to-run exploratory charters |
| `load-profile.md` | optional | Realistic load shape and safe targets for Load mode |
| `generated/` | optional | Machine-written inventories; never edited by hand |
| `tools/` | optional | Generator scripts that (re)write `generated/` |
| `lessons-*.md` | optional | Product-specific lessons from real runs: formulas, traps, automation notes, environment quirks |
| `commands/` | optional | Product-specific slash-command presets (mode + fixed setup). The user copies them to `~/.claude/commands/`; they are never committed to the skill repository |
| `usage-analysis-*.md` | optional | Private analysis of how the skill was used on this product (misses, patterns) |

## `pack.md` header

The first lines of `pack.md` are `Key: value` fields:

```
Markers: <path>, <path>, ...     # ALL must exist under the target repo root
Alt-Markers: <path> containing "<text>"   # optional alternative when Markers cannot all match
Last refresh: <ISO date>
Source commit: <short git rev of the product repo used for the last refresh>
Reading order: <file>, <file>, ...
```

- `Markers:` entries are paths relative to the target repository root. A pack
  matches only when every entry exists. A trailing `/` means a directory.
- `Alt-Markers:` is an optional second way to match (for example a package
  manifest whose `name` field identifies the product). Matching either
  `Markers:` (all entries) or `Alt-Markers:` selects the pack.
- `Last refresh:` and `Source commit:` are filled by the generator or by hand
  after a refresh; a stale pack must be treated as a hypothesis source, not as
  an oracle.
- `Reading order:` lists the files the skill reads, in order.

## Rules

- Generated content lives only under `generated/` and starts with a
  `<!-- GENERATED <ISO> from <git rev> - do not edit -->` line.
- Hand-written files link to generated tables instead of copying them.
- A pack never contains credentials, tokens, session files or customer data.
  Roles are recorded by name only.
- A pack is read-only knowledge: it never authorizes actions the generic safety
  rules forbid.
- Every non-obvious claim carries evidence (`file:line` or "UI observation
  <date>"); unverified claims are tagged `[unverified]`.
- To start a pack, copy `_template/` to `<dir>/<name>/` and fill the placeholders.
