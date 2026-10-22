import type { Page, Request } from 'playwright';
import type { TestResult, TestSuite } from './executor.js';
import { attachHealthGate, type HealthGate, type HealthSnapshot } from './vendor/screen-health-gate.js';
import { waitForSettled } from './vendor/settle.js';

type Sev = 'high' | 'medium' | 'low';

export interface HealthDetails {
  kind: 'health';
  candidates: true;
  settled: boolean;
  settleReason: string;
  segments: HealthSnapshot[];
}

/** Attach the passive gate for the whole run. Read-only: only page.on listeners. */
export function attachRunHealth(page: Page): HealthGate {
  const gate = attachHealthGate(page as never, { ignoreUrl: [/\/favicon\.ico$/] });
  gate.start();
  return gate;
}

/** Worst severity of what the snapshots saw, plus a one-line text. Leads, not verdicts. */
export function classify(snaps: HealthSnapshot[]): { sev: Sev | null; text: string; confidence: 'high' | 'medium' | 'low' } {
  const sum = (f: (s: HealthSnapshot) => number): number => snaps.reduce((n, s) => n + f(s), 0);
  const c5xx = sum((s) => s.summary.counts.http5xx);
  const c4xx = sum((s) => s.summary.counts.http4xx);
  const pageErr = sum((s) => s.summary.counts.pageErrors);
  const consoleErr = sum((s) => s.summary.counts.consoleErrors);
  const failed = sum((s) => s.summary.counts.failedRequests);
  const slow = sum((s) => s.summary.slow);
  const dup = sum((s) => s.summary.duplicates);
  const unfinished = sum((s) => s.summary.counts.unfinished);
  const parts: string[] = [];
  if (pageErr) parts.push(`${pageErr} uncaught exception(s)`);
  if (consoleErr) parts.push(`${consoleErr} console error(s)`);
  if (c5xx) parts.push(`${c5xx} HTTP 5xx`);
  if (c4xx) parts.push(`${c4xx} HTTP 4xx`);
  if (failed) parts.push(`${failed} failed request(s)`);
  if (slow) parts.push(`${slow} slow response(s)`);
  if (dup) parts.push(`${dup} duplicate request group(s)`);
  if (unfinished) parts.push(`${unfinished} request(s) never finished`);
  const text = parts.join(', ');
  if (c5xx || pageErr) return { sev: 'high', text, confidence: c5xx ? 'high' : 'medium' };
  if (c4xx || consoleErr || failed) return { sev: 'medium', text, confidence: 'medium' };
  if (slow || dup || unfinished) return { sev: 'low', text, confidence: 'low' };
  return { sev: null, text, confidence: 'medium' };
}

function toResult(id: string, scope: string, snaps: HealthSnapshot[], extra: { settled: boolean; settleReason: string }): TestResult {
  const details: HealthDetails = { kind: 'health', candidates: true, settled: extra.settled, settleReason: extra.settleReason, segments: snaps };
  const requests = snaps.reduce((n, s) => n + s.summary.counts.requests, 0);
  const verdict = classify(snaps);
  const settleNote = extra.settled ? '' : ` (page unsettled: ${extra.settleReason}; observations may be incomplete)`;
  if (!verdict.sev) {
    return {
      testCaseId: id,
      status: 'pass',
      message: `${scope}: no console errors, uncaught exceptions, HTTP 4xx/5xx, slow or duplicate requests observed (${requests} requests)${settleNote}`,
      evidence: [],
      oracle: 'screen health gate (observed console/network events)',
      confidence: 'medium',
      details,
    };
  }
  return {
    testCaseId: id,
    status: verdict.sev === 'low' ? 'warning' : 'fail',
    severity: verdict.sev,
    message: `Candidates (observed events, classify before filing) ${scope}: ${verdict.text}${settleNote}`,
    evidence: [],
    oracle: 'screen health gate (observed console/network events)',
    confidence: verdict.confidence,
    details,
  };
}

/** Dedicated suite: reload the URL, settle, snapshot. Uses the run-wide gate. */
export function createHealthSuite(gate: HealthGate, url: string): TestSuite {
  return {
    name: 'Screen Health',
    testCases: [
      {
        id: 'HLT-001',
        name: 'Page load health (console errors, exceptions, 4xx/5xx, slow and duplicate requests)',
        category: 'navigation',
        description: 'Reload the target, wait for the page to settle, snapshot what the passive gate observed',
        execute: async (page: Page): Promise<TestResult> => {
          gate.stop();
          gate.start(); // fresh segment: only this load is judged
          // Requests that started during navigation are invisible to waitForSettled (it listens
          // from its own start), so count in-flight xhr/fetch here and let slow calls finish.
          const open = new Set<Request>();
          const track = (r: Request): boolean => ['xhr', 'fetch', 'document'].includes(r.resourceType());
          const onReq = (r: Request): void => { if (track(r)) open.add(r); };
          const onEnd = (r: Request): void => { open.delete(r); };
          page.on('request', onReq);
          page.on('requestfinished', onEnd);
          page.on('requestfailed', onEnd);
          let settle: Awaited<ReturnType<typeof waitForSettled>>;
          try {
            await page.goto(url, { waitUntil: 'load' }).catch(() => undefined);
            const deadline = Date.now() + 10000;
            while (open.size > 0 && Date.now() < deadline) await page.waitForTimeout(100);
            settle = await waitForSettled(page, { timeoutMs: 12000 });
          } finally {
            page.off('request', onReq);
            page.off('requestfinished', onEnd);
            page.off('requestfailed', onEnd);
          }
          await page.waitForTimeout(150);
          const snap = gate.snapshot('page load');
          return toResult('HLT-001', 'on page load', [snap], { settled: settle.settled, settleReason: settle.reason });
        },
      },
    ],
  };
}

/** Run-wide summary of every segment the gate recorded while the other suites ran. */
export function runHealthResult(segments: HealthSnapshot[]): TestResult {
  return toResult('HLT-RUN', `during the other suites (${segments.length} segment(s))`, segments, { settled: true, settleReason: 'n/a' });
}
