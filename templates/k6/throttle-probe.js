// Throttle probe: ONE VU, 2*N+1 requests from one account to one action.
// Meaningful only where throttling is enabled; confirm the flag per environment
// and set THROTTLE_ENABLED=1. N is the documented limit (env THROTTLE_N).
// All paths are CONFIGURE-ME placeholders. Run with DRY_RUN=1 first.
import http from 'k6/http';
import { check, fail } from 'k6';
import { Counter } from 'k6/metrics';
import { gate, TARGET, DRY_RUN, requireConfigured, printPlan } from './lib/gate.js';
import { authHeaders, hasAuth } from './lib/auth.js';

const N = Number(__ENV.THROTTLE_N || 0);
const PROBE_PATH = __ENV.PROBE_PATH || 'CONFIGURE-ME/probe-path';
const CLEANUP_PATH = __ENV.CLEANUP_PATH || 'CONFIGURE-ME/cleanup-path';
export const status429 = new Counter('status_429');
export const status2xx = new Counter('status_2xx');

export const options = {
  scenarios: {
    probe: { executor: 'shared-iterations', vus: 1, iterations: 2 * N + 1, maxDuration: '2m' },
  },
  thresholds: {
    // k6 counts 429 inside http_req_failed; the probe expects 429s, so read
    // status_429 / status_2xx and the per-position check below instead.
    checks: ['rate==1'],
  },
};

export function setup() {
  const g = gate();
  if (__ENV.THROTTLE_ENABLED !== '1') fail('throttle-probe requires THROTTLE_ENABLED=1 (confirm the flag per environment)');
  if (!(N > 0)) fail('set THROTTLE_N to the documented limit (> 0)');
  const runId = 'TEST_' + Date.now();
  if (DRY_RUN) {
    printPlan('throttle-probe', options, 'would send ' + (2 * N + 1) + ' requests from one account');
  } else {
    requireConfigured('PROBE_PATH', PROBE_PATH);
    requireConfigured('CLEANUP_PATH', CLEANUP_PATH);
    if (!hasAuth()) fail('SESSION_COOKIE or BEARER_TOKEN env var required');
  }
  return { runId: runId, target: g.target };
}

export default function (data) {
  if (DRY_RUN) return; // zero HTTP in dry run
  const res = http.post(TARGET + '/' + PROBE_PATH, JSON.stringify({ name: data.runId + '-' + __ITER }), { headers: authHeaders() });
  if (res.status === 429) status429.add(1);
  else if (res.status >= 200 && res.status < 300) status2xx.add(1);
  // First 2N requests expected 2xx, everything after expected 429.
  const first = __ITER < 2 * N;
  check(res, { 'expected status for position': (r) => (first ? r.status >= 200 && r.status < 300 : r.status === 429) });
}

export function teardown(data) {
  if (DRY_RUN) return;
  http.post(TARGET + '/' + CLEANUP_PATH, JSON.stringify({ prefix: data.runId }), { headers: authHeaders() });
}
