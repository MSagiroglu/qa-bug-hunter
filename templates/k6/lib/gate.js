// Safety gate for all k6 templates. See references/load/safety-gates.md.
//
// Env vars:
//   LOAD_TARGET      origin to test, e.g. https://app.example.test (required)
//   TARGETS_ALLOW    ABSOLUTE path to the allow file (required)
//   TARGETS_DENY     ABSOLUTE path to the deny file (optional)
//   LOAD_WINDOW_OK   must be '1' (window + approval written in the report)
//   DRY_RUN          '1' => scenarios skip ALL HTTP and only print the plan
//
// k6 can read files only in the init context (top level of a module) via open().
// This module is imported by the scenario, so the open() calls below run in init
// context. Use absolute paths; relative paths resolve against the importing
// script and are easy to get wrong.
import { fail } from 'k6';

function readList(path) {
  if (!path) return null;
  return open(path)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

const ALLOW = readList(__ENV.TARGETS_ALLOW);
const DENY = readList(__ENV.TARGETS_DENY) || [];

export const TARGET = (__ENV.LOAD_TARGET || '').replace(/\/+$/, '');
export const DRY_RUN = __ENV.DRY_RUN === '1';

// Aborts the run unless every gate passes. Call from setup().
export function gate() {
  if (!TARGET) fail('gate: LOAD_TARGET is not set');
  if (!ALLOW) fail('gate: no allow file; set TARGETS_ALLOW to an absolute path');
  if (!ALLOW.includes(TARGET)) fail('gate: target not in allowlist: ' + TARGET);
  if (DENY.some((d) => TARGET.includes(d))) fail('gate: target matches denylist: ' + TARGET);
  if (__ENV.LOAD_WINDOW_OK !== '1') fail('gate: shared env window not confirmed (LOAD_WINDOW_OK=1)');
  return { target: TARGET, dryRun: DRY_RUN };
}

export function requireConfigured(name, value) {
  if (!value || value.indexOf('CONFIGURE-ME') !== -1) {
    fail('configure ' + name + ' before running without DRY_RUN');
  }
  return value;
}

export function printPlan(name, options, extra) {
  console.log('[DRY_RUN] scenario=' + name + ' target=' + TARGET + ' (no HTTP will be sent)');
  console.log('[DRY_RUN] options=' + JSON.stringify(options));
  if (extra) console.log('[DRY_RUN] ' + extra);
}
