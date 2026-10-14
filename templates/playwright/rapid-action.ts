/**
 * Rapid-action / double-submit / in-flight guard helper
 * (see references/core/rapid-action-testing.md).
 *
 * For each burst the helper fires N rapid activations of one trigger, then
 * records: how many matching requests were sent (network witness), whether
 * the UI showed an in-flight guard within the first 150 ms (disabled /
 * aria-disabled / aria-busy / loading indicator), whether the guard was
 * released after settle, and the record-count delta from `verify`.
 *
 * SAFETY: use only on TEST_-marked data, never on production. Burst sizes are
 * the caller's choice (default 2 then 5); `maxTotalClicks` is a hard cap over
 * ALL bursts (default 12). Duplicate requests consume throttle budget; a 429
 * is reported as an observation (THROTTLED_429), not retried.
 *
 * The helper NEVER throws. Every problem lands in `errors`; verdict hints are
 * hints for the tester, not a final verdict.
 */
import type { Page, Locator } from '@playwright/test';

export type RapidMode = 'rapidClicks' | 'doubleClick' | 'enterRepeat';
export type RapidIntent = 'create' | 'update' | 'delete';

export type RapidActionOptions = {
  /** The control that fires the action (button, submit, delete icon). */
  trigger: Locator;
  /** The write request to count. Matched by method AND url (substring or RegExp). */
  request: { method: string; urlPattern: string | RegExp };
  /** Burst sizes, one burst per user intent. Default [2, 5]. */
  bursts?: number[];
  /** Delay between activations inside a burst in ms. Default 0. */
  intervalMs?: number;
  /** Optional spinner / progress / skeleton locator expected while in flight. */
  loadingIndicator?: Locator;
  /** Hard cap on activations across all bursts. Default 12. */
  maxTotalClicks?: number;
  /** Quiet time (no request start/finish) that counts as settled. Default 500. */
  settleMs?: number;
  /** Independent re-read of the record count (API list or DB). Called before the first burst and after each burst. */
  verify?: () => Promise<{ recordCount: number }>;
  /** Default 'rapidClicks'. doubleClick: dblclick per 2 clicks. enterRepeat: keyboard Enter pressed N times while focused. */
  mode?: RapidMode;
  /** Defaults from method: POST=create, PUT/PATCH=update, DELETE=delete. */
  intent?: RapidIntent;
};

export type GuardSample = { disabled: boolean; ariaBusy: boolean; ariaDisabled: boolean };

export type RapidBurstResult = {
  burst: number;
  mode: RapidMode;
  clicksPlanned: number;
  /** Activations actually attempted (a click on a disabled control still counts as an attempt). */
  clicksFired: number;
  requestsSent: number;
  statuses: number[];
  failedRequests: number;
  recordsBefore: number | null;
  recordsAfter: number | null;
  /** recordsAfter - recordsBefore, or null when verify is missing or failed. */
  recordDelta: number | null;
  guardObserved: boolean;
  guardFirstAtMs: number | null;
  loadingChecked: boolean;
  loadingSeen: boolean;
  loadingFirstAtMs: number | null;
  /** true = trigger usable again after settle, false = still disabled/aria-busy, null = trigger gone or unreadable. */
  guardReleased: boolean | null;
  hints: string[];
  severityHint: 'High' | 'Medium' | 'Low' | null;
  errors: string[];
  skipped?: string;
};

export type RapidActionReport = {
  bursts: RapidBurstResult[];
  totalClicks: number;
  capped: boolean;
  errors: string[];
};

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const GUARD_WINDOW_MS = 150;
const MAX_SETTLE_WAIT_MS = 10000;

async function readGuard(trigger: Locator): Promise<GuardSample | null> {
  try {
    return await trigger.evaluate(
      (el) => ({
        disabled: (el as HTMLButtonElement).disabled === true || el.hasAttribute('disabled'),
        ariaBusy: el.getAttribute('aria-busy') === 'true',
        ariaDisabled: el.getAttribute('aria-disabled') === 'true',
      }),
      undefined,
      { timeout: 300 },
    );
  } catch {
    return null;
  }
}

const guarded = (g: GuardSample | null): boolean => !!g && (g.disabled || g.ariaBusy || g.ariaDisabled);

export async function rapidAction(page: Page, o: RapidActionOptions): Promise<RapidActionReport> {
  const report: RapidActionReport = { bursts: [], totalClicks: 0, capped: false, errors: [] };
  const mode: RapidMode = o.mode ?? 'rapidClicks';
  const method = o.request.method.toUpperCase();
  const intent: RapidIntent =
    o.intent ?? (method === 'DELETE' ? 'delete' : method === 'PUT' || method === 'PATCH' ? 'update' : 'create');
  const cap = Math.max(0, o.maxTotalClicks ?? 12);
  const interval = Math.max(0, o.intervalMs ?? 0);
  const settleMs = Math.max(0, o.settleMs ?? 500);
  const urlOk = (u: string): boolean =>
    typeof o.request.urlPattern === 'string' ? u.includes(o.request.urlPattern) : o.request.urlPattern.test(u);

  // Network witness: counts only requests matching method + URL.
  let started = 0;
  let pending = 0;
  let failed = 0;
  let lastActivity = Date.now();
  let statuses: number[] = [];
  const mine = new WeakSet<object>();
  const onRequest = (r: { method(): string; url(): string }): void => {
    if (r.method() !== method || !urlOk(r.url())) return;
    mine.add(r);
    started++;
    pending++;
    lastActivity = Date.now();
  };
  const onDone = (r: object): void => {
    if (!mine.has(r)) return;
    mine.delete(r);
    pending = Math.max(0, pending - 1);
    lastActivity = Date.now();
  };
  const onFailed = (r: object): void => {
    if (!mine.has(r)) return;
    failed++;
    onDone(r);
  };
  const onResponse = (r: { request(): { method(): string }; url(): string; status(): number }): void => {
    if (r.request().method() === method && urlOk(r.url())) statuses.push(r.status());
  };
  page.on('request', onRequest);
  page.on('requestfinished', onDone);
  page.on('requestfailed', onFailed);
  page.on('response', onResponse);

  const countRecords = async (errs: string[], label: string): Promise<number | null> => {
    if (!o.verify) return null;
    try {
      return (await o.verify()).recordCount;
    } catch (e) {
      errs.push(`verify(${label}): ${msg(e)}`);
      return null;
    }
  };

  try {
    const sizes = o.bursts && o.bursts.length ? o.bursts : [2, 5];
    let recordsBefore: number | null = null;
    {
      const e0: string[] = [];
      recordsBefore = await countRecords(e0, 'baseline');
      report.errors.push(...e0);
    }

    for (let b = 0; b < sizes.length; b++) {
      const errs: string[] = [];
      const remaining = cap - report.totalClicks;
      const planned = Math.max(0, Math.floor(sizes[b] ?? 0));
      const n = Math.min(planned, remaining);
      const res: RapidBurstResult = {
        burst: b + 1, mode, clicksPlanned: planned, clicksFired: 0, requestsSent: 0, statuses: [],
        failedRequests: 0, recordsBefore, recordsAfter: null, recordDelta: null, guardObserved: false,
        guardFirstAtMs: null, loadingChecked: !!o.loadingIndicator, loadingSeen: false,
        loadingFirstAtMs: null, guardReleased: null, hints: [], severityHint: null, errors: errs,
      };
      report.bursts.push(res);
      if (n <= 0) {
        res.skipped = 'maxTotalClicks reached';
        report.capped = true;
        continue;
      }
      if (n < planned) report.capped = true;

      started = 0; failed = 0; statuses = [];
      const t0 = Date.now();
      let samplingDone = false;

      // Sampler runs in parallel with the clicks and stops 150 ms after the burst starts.
      const sampler = (async (): Promise<void> => {
        while (Date.now() - t0 <= GUARD_WINDOW_MS) {
          const at = Date.now() - t0;
          const g = await readGuard(o.trigger);
          if (guarded(g) && res.guardFirstAtMs === null) { res.guardObserved = true; res.guardFirstAtMs = at; }
          if (o.loadingIndicator && res.loadingFirstAtMs === null) {
            try {
              if (await o.loadingIndicator.first().isVisible()) { res.loadingSeen = true; res.loadingFirstAtMs = at; }
            } catch (e) { errs.push(`loadingIndicator: ${msg(e)}`); }
          }
          if (samplingDone) break;
          await sleep(10);
        }
      })();

      // Fire the activations.
      try {
        if (mode === 'enterRepeat') {
          await o.trigger.focus({ timeout: 2000 });
          for (let i = 0; i < n; i++) {
            res.clicksFired++;
            await page.keyboard.press('Enter');
            if (interval) await sleep(interval);
          }
        } else {
          let box: { x: number; y: number; width: number; height: number } | null = null;
          try {
            await o.trigger.scrollIntoViewIfNeeded({ timeout: 2000 });
            box = await o.trigger.boundingBox({ timeout: 2000 });
          } catch (e) { errs.push(`trigger box: ${msg(e)}`); }
          const cx = box ? box.x + box.width / 2 : 0;
          const cy = box ? box.y + box.height / 2 : 0;
          const once = async (clickCount: 1 | 2): Promise<void> => {
            if (box) await page.mouse.click(cx, cy, { clickCount: 1, delay: 0 });
            else if (clickCount === 2) await o.trigger.dblclick({ force: true, timeout: 1000, noWaitAfter: true });
            else await o.trigger.click({ force: true, timeout: 1000, noWaitAfter: true });
          };
          if (mode === 'doubleClick') {
            for (let i = 0; i < Math.ceil(n / 2); i++) {
              if (box) await page.mouse.dblclick(cx, cy); else await once(2);
              res.clicksFired += 2;
              if (interval) await sleep(interval);
            }
          } else {
            for (let i = 0; i < n; i++) {
              res.clicksFired++;
              await once(1);
              if (interval) await sleep(interval);
            }
          }
        }
      } catch (e) {
        errs.push(`fire: ${msg(e)}`);
      }
      report.totalClicks += res.clicksFired;
      samplingDone = true;
      await sampler;
      lastActivity = Math.max(lastActivity, Date.now());

      // Settle: no pending matching request and quiet for settleMs.
      const settleStart = Date.now();
      while (Date.now() - settleStart < MAX_SETTLE_WAIT_MS) {
        if (pending === 0 && Date.now() - lastActivity >= settleMs) break;
        await sleep(25);
      }
      if (pending > 0) errs.push('settle: request still pending after 10s');

      res.requestsSent = started;
      res.statuses = [...statuses];
      res.failedRequests = failed;

      const after = await readGuard(o.trigger);
      res.guardReleased = after === null ? null : !guarded(after);

      res.recordsAfter = await countRecords(errs, `burst ${b + 1}`);
      if (res.recordsBefore !== null && res.recordsAfter !== null) res.recordDelta = res.recordsAfter - res.recordsBefore;
      recordsBefore = res.recordsAfter ?? recordsBefore;

      // Verdict hints.
      const h = res.hints;
      const errorSeen = res.statuses.some((s) => s >= 400) || res.failedRequests > 0;
      if (res.requestsSent === 0) h.push('NO_REQUEST');
      if (res.requestsSent > 1) h.push('MULTI_REQUEST');
      if (res.requestsSent > 0 && !res.guardObserved) h.push('NO_UI_GUARD');
      if (o.loadingIndicator && res.requestsSent > 0 && !res.loadingSeen) h.push('NO_LOADING_INDICATOR');
      if (res.guardReleased === false) h.push(errorSeen ? 'GUARD_STUCK_AFTER_ERROR' : 'GUARD_NOT_RELEASED');
      if (res.statuses.some((s) => s >= 500)) h.push('SERVER_ERROR_5XX');
      if (res.statuses.includes(429)) h.push('THROTTLED_429');
      if (intent === 'create' && res.recordDelta !== null && res.recordDelta > 1) h.push('DUPLICATE_RECORDS');
      if (intent === 'delete' && res.recordDelta !== null && res.recordDelta < -1) h.push('OVER_DELETE');
      if (res.requestsSent > 1 && res.recordDelta !== null && res.recordDelta <= 1 && intent === 'create' && !res.statuses.some((s) => s >= 400)) {
        h.push('UI_GUARD_MISSING_BACKEND_DEDUPES');
      }
      res.severityHint = h.includes('DUPLICATE_RECORDS') || h.includes('OVER_DELETE') ||
        h.includes('GUARD_STUCK_AFTER_ERROR') || h.includes('SERVER_ERROR_5XX')
        ? 'High'
        : h.includes('MULTI_REQUEST') || h.includes('GUARD_NOT_RELEASED')
          ? 'Medium'
          : h.includes('NO_UI_GUARD') || h.includes('NO_LOADING_INDICATOR')
            ? 'Low'
            : null;
    }
  } catch (e) {
    report.errors.push(`rapidAction: ${msg(e)}`);
  } finally {
    page.off('request', onRequest);
    page.off('requestfinished', onDone);
    page.off('requestfailed', onFailed);
    page.off('response', onResponse);
  }
  return report;
}

/** One report row: `action | clicks | requests sent | records created | UI state during flight | verdict`. */
export function rapidActionRow(action: string, r: RapidBurstResult): string {
  const ui = [
    r.guardObserved ? `guard@${r.guardFirstAtMs}ms` : 'no guard',
    r.loadingChecked ? (r.loadingSeen ? `loading@${r.loadingFirstAtMs}ms` : 'no loading') : 'loading n/a',
  ].join(', ');
  const rec = r.recordDelta === null ? 'n/a' : String(r.recordDelta);
  const verdict = r.skipped ? `skipped (${r.skipped})` : r.hints.length ? r.hints.join('+') : 'OK';
  return `${action} | ${r.clicksFired} | ${r.requestsSent} | ${rec} | ${ui} | ${verdict}`;
}
