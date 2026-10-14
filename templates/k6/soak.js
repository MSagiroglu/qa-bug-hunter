// Soak: low VUs for 60-120 min (SOAK_DURATION) to detect leaks and counter drift.
// All paths are CONFIGURE-ME placeholders. Run with DRY_RUN=1 first.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { gate, TARGET, DRY_RUN, requireConfigured, printPlan } from './lib/gate.js';
import { authHeaders, hasAuth } from './lib/auth.js';

const WRITE_PATH = __ENV.WRITE_PATH || 'CONFIGURE-ME/write-path';
const CLEANUP_PATH = __ENV.CLEANUP_PATH || 'CONFIGURE-ME/cleanup-path';
export const status429 = new Counter('status_429');

// DRY_RUN collapses the run to 1 VU / 1 iteration (the default function sends no HTTP).
const realOptions = {
  stages: [{ duration: '5m', target: 2 }, { duration: __ENV.SOAK_DURATION || '90m', target: 2 }, { duration: '1m', target: 0 }],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // replace with the per-environment profile value
    http_req_failed: ['rate<0.01'], // k6 counts 429 here too; also read status_429
  },
};
export const options = DRY_RUN ? { vus: 1, iterations: 1 } : realOptions;

export function setup() {
  const g = gate();
  const runId = 'TEST_' + Date.now();
  if (DRY_RUN) {
    printPlan('soak', realOptions, 'would POST {name: ' + runId + '-<vu>-<iter>} to WRITE_PATH');
  } else {
    requireConfigured('WRITE_PATH', WRITE_PATH);
    requireConfigured('CLEANUP_PATH', CLEANUP_PATH);
    if (!hasAuth()) throw new Error('SESSION_COOKIE or BEARER_TOKEN env var required');
  }
  return { runId: runId, target: g.target };
}

export default function (data) {
  if (DRY_RUN) return; // zero HTTP in dry run
  const payload = JSON.stringify({ name: data.runId + '-' + __VU + '-' + __ITER });
  const res = http.post(TARGET + '/' + WRITE_PATH, payload, { headers: authHeaders() });
  if (res.status === 429) status429.add(1);
  check(res, { 'write 2xx or 429': (r) => (r.status >= 200 && r.status < 300) || r.status === 429 });
  sleep(1);
}

export function teardown(data) {
  if (DRY_RUN) return;
  // Delete only records whose name starts with data.runId, then verify the count is 0.
  http.post(TARGET + '/' + CLEANUP_PATH, JSON.stringify({ prefix: data.runId }), { headers: authHeaders() });
}
