import type { Page, Request, Response } from 'playwright';
import type { TestResult } from './executor.js';

/**
 * Rapid-action (double-submit) probe.
 *
 * Discovers mutating triggers from the DOM, fires bursts of 2 then 5 quick clicks on the ones
 * the run can safely trigger, and counts the mutating requests that result. Everything it
 * reports is a CANDIDATE: a human or a data oracle must confirm duplicate records.
 *
 * Safety rules:
 *  - create/update triggers: only forms whose text fields are empty at start (not an edit of an
 *    existing record) and are filled by this run with a TEST_-prefixed value; no auth forms.
 *  - delete/destructive triggers: only if the record row contains this run's TEST_ marker.
 *  - clicks are dispatched on the tagged element only (never by screen coordinates).
 */

export interface RapidOptions {
  /** Hard cap on click attempts for the whole run. */
  maxClicks: number;
  /** Delay between clicks inside a burst (ms). */
  gapMs: number;
}

export const RAPID_DEFAULTS: RapidOptions = { maxClicks: 12, gapMs: 30 };
const BURSTS = [2, 5];
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const INDICATOR_SEL =
  '[aria-busy="true"], [role="progressbar"], .spinner, .loading, .p-progress-spinner, [class*="spinner" i], [class*="loading" i]';

interface Candidate {
  index: number;
  label: string;
  kind: 'create' | 'delete';
  safe: boolean;
  reason?: string;
}

export interface RapidRow {
  action: string;
  kind: 'create' | 'delete';
  burst: number;
  clicks: number;
  acceptedByDom: number;
  requests: number;
  endpoint: string;
  statuses: number[];
  guard: boolean;
  loadingIndicator: boolean;
  releasedAfterSettle: boolean | 'removed';
  note?: string;
}

interface Verdict { action: string; status: 'pass' | 'warning' | 'fail' | 'skipped' | 'info'; text: string }

async function discover(page: Page, prefix: string): Promise<Candidate[]> {
  return page.evaluate((prefix) => {
    document.querySelectorAll('[data-qa-rapid]').forEach(e => e.removeAttribute('data-qa-rapid'));
    document.querySelectorAll('[data-qa-rapid-field]').forEach(e => e.removeAttribute('data-qa-rapid-field'));
    const MUT = /(?<![\p{L}])(save|saving|create|add|adding|submit|delete|remove|update|send|ekle|kaydet|sil|gönder|gonder|güncelle|guncelle|kaldır|kaldir)(s|d|ed)?(?![\p{L}])/iu;
    const DESTR = /(?<![\p{L}])(delete|remove|destroy|erase|sil|kaldır|kaldir)/iu;
    const SKIP = /(?<![\p{L}])(search|login|log in|sign in|giriş|giris|ara)(?![\p{L}])/iu;
    const vis = (e: Element) => {
      const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
    };
    const out: Array<{ index: number; label: string; kind: 'create' | 'delete'; safe: boolean; reason?: string }> = [];
    const els = Array.from(document.querySelectorAll<HTMLElement>(
      'button, input[type="submit"], input[type="button"], [role="button"]'));
    for (const el of els) {
      if (!vis(el) || (el as HTMLButtonElement).disabled) continue;
      const label = ((el as HTMLInputElement).value || el.getAttribute('aria-label') || el.textContent || el.title ||
        el.getAttribute('data-testid') || el.id || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 50);
      const hay = [label, el.getAttribute('aria-label'), el.title, el.getAttribute('data-testid'), el.id,
        el.getAttribute('name')].filter(Boolean).join(' ');
      const form = el.closest('form');
      const isSubmit = !!form && ((el as HTMLButtonElement).type === 'submit' ||
        (el.tagName === 'BUTTON' && !el.getAttribute('type')));
      if (!MUT.test(hay) && !isSubmit) continue;
      if (SKIP.test(hay) && !DESTR.test(hay)) continue;
      if (form && ((form.getAttribute('method') || '').toLowerCase() === 'get' || form.getAttribute('role') === 'search')) continue;
      const index = out.length;
      const destructive = DESTR.test(hay);
      if (destructive) {
        const row = el.closest('tr, li, [data-id], [data-row-id], [role="row"], [role="listitem"], article, .card, .item');
        const safe = !!row && (row.textContent || '').includes(prefix);
        if (safe) el.setAttribute('data-qa-rapid', String(index));
        out.push({ index, label, kind: 'delete', safe,
          reason: safe ? undefined : 'record not created by this run (no TEST_ marker in its row)' });
        continue;
      }
      let box: Element | null = form;
      if (!box) {
        let p: Element | null = el.parentElement;
        for (let d = 0; p && d < 4 && !p.querySelector('input, textarea'); d++) p = p.parentElement;
        box = p;
      }
      if (!box) { out.push({ index, label, kind: 'create', safe: false, reason: 'no form fields to mark with TEST_ value' }); continue; }
      if (box.querySelector('input[type="password"]')) {
        out.push({ index, label, kind: 'create', safe: false, reason: 'authentication form' }); continue;
      }
      if (box.querySelector('input[type="file"]')) {
        out.push({ index, label, kind: 'create', safe: false, reason: 'file upload form' }); continue;
      }
      const fields = Array.from(box.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea'))
        .filter(f => vis(f) && !f.disabled && !f.readOnly &&
          (f.tagName === 'TEXTAREA' || ['text', 'email', 'url', ''].includes((f as HTMLInputElement).type || '')));
      if (fields.length === 0) { out.push({ index, label, kind: 'create', safe: false, reason: 'no form fields to mark with TEST_ value' }); continue; }
      if (fields.some(f => f.value.trim() !== '')) {
        out.push({ index, label, kind: 'create', safe: false, reason: 'form is prefilled (possible edit of an existing record)' }); continue;
      }
      fields.forEach(f => f.setAttribute('data-qa-rapid-field', String(index)));
      el.setAttribute('data-qa-rapid', String(index));
      out.push({ index, label, kind: 'create', safe: true });
    }
    return out;
  }, prefix);
}

interface BurstDom {
  missing?: boolean; accepted: number; blocked: number; guard: boolean; indicator: boolean; removed: boolean;
}

function burstInPage(page: Page, index: number, n: number, gap: number): Promise<BurstDom> {
  return page.evaluate(async ({ index, n, gap, indSel }) => {
    const el = document.querySelector<HTMLElement>(`[data-qa-rapid="${index}"]`);
    if (!el) return { missing: true, accepted: 0, blocked: 0, guard: false, indicator: false, removed: false };
    const vis = (e: Element) => {
      const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
    };
    const countInd = () => Array.from(document.querySelectorAll(indSel)).filter(vis).length;
    const base = countInd();
    const isDisabled = () => (el as HTMLButtonElement).disabled === true || el.getAttribute('aria-disabled') === 'true';
    const isGuarded = () => isDisabled() || el.getAttribute('aria-busy') === 'true' ||
      !!el.closest('[aria-busy="true"]') || getComputedStyle(el).pointerEvents === 'none';
    const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
    let accepted = 0, blocked = 0, clicked = 0, nextClick = 0, guard = false, indicator = false, removed = false;
    const t0 = performance.now();
    for (;;) {
      const t = performance.now() - t0;
      if (clicked < n && t >= nextClick) {
        if (!el.isConnected) { blocked++; removed = true; }
        else if (isDisabled()) blocked++;
        else { el.click(); accepted++; }
        clicked++;
        nextClick = clicked * gap;
      }
      if (el.isConnected) { if (isGuarded()) guard = true; } else removed = true;
      if (countInd() > base) indicator = true;
      if (clicked >= n && t >= 150) break;
      await sleep(5);
    }
    return { accepted, blocked, guard, indicator, removed };
  }, { index, n, gap, indSel: INDICATOR_SEL });
}

function endpointKey(r: Request): string {
  return `${r.method()} ${r.url().split('?')[0]}`;
}

export async function runRapidSuite(page: Page, opts: Partial<RapidOptions> = {}): Promise<TestResult> {
  const o: RapidOptions = { ...RAPID_DEFAULTS, ...opts };
  const runId = Date.now().toString(36);
  const prefix = `TEST_rapid_${runId}`;
  const rows: RapidRow[] = [];
  const verdicts: Verdict[] = [];
  const observations: string[] = [];
  let budget = o.maxClicks;
  let seq = 0;
  let rateLimited = false;
  let dialogs = 0;
  const startUrl = page.url();

  const pending = new Set<Request>();
  let burstReqs: Request[] = [];
  const statusByReq = new Map<Request, number>();
  const onReq = (r: Request) => { if (MUTATING.has(r.method())) { burstReqs.push(r); pending.add(r); } };
  const onDone = (r: Request) => { pending.delete(r); };
  const onResp = (res: Response) => {
    const r = res.request();
    if (!MUTATING.has(r.method())) return;
    statusByReq.set(r, res.status());
    if (res.status() === 429) rateLimited = true;
  };
  // A confirm() on a run-created record is accepted; otherwise Playwright would dismiss it.
  const onDialog = (d: { accept: () => Promise<void> }) => { dialogs++; d.accept().catch(() => {}); };
  page.on('request', onReq);
  page.on('requestfinished', onDone);
  page.on('requestfailed', onDone);
  page.on('response', onResp);
  page.on('dialog', onDialog);

  const settle = async (): Promise<void> => {
    const deadline = Date.now() + 6000;
    let quietSince = Date.now();
    while (Date.now() < deadline) {
      if (pending.size > 0) quietSince = Date.now();
      else if (Date.now() - quietSince >= 300) return;
      await page.waitForTimeout(50);
    }
  };

  const fill = async (c: Candidate): Promise<boolean> => {
    const fields = page.locator(`[data-qa-rapid-field="${c.index}"]`);
    const n = await fields.count();
    for (let i = 0; i < n; i++) {
      const f = fields.nth(i);
      const type = (await f.getAttribute('type')) ?? 'text';
      const v = `${prefix}_${++seq}`;
      const value = type === 'email' ? `${v}@example.test` : type === 'url' ? `https://example.test/${v}` : v;
      await f.fill(value, { timeout: 3000 }).catch(() => {});
    }
    return n > 0;
  };

  const testCandidate = async (c: Candidate): Promise<void> => {
    const action = `${c.kind}: ${c.label}`;
    let consumed = false;
    for (const size of BURSTS) {
      if (rateLimited) { verdicts.push({ action, status: 'info', text: 'stopped: 429 seen' }); return; }
      if (budget < 2) {
        verdicts.push({ action, status: 'info', text: `stopped: click budget (${o.maxClicks}) exhausted` });
        return;
      }
      const n = Math.min(size, budget);
      if (c.kind === 'create' && !(await fill(c))) return;
      burstReqs = [];
      statusByReq.clear();
      let dom: BurstDom;
      try {
        dom = await burstInPage(page, c.index, n, o.gapMs);
      } catch (e) {
        // Navigation (classic form post) destroys the execution context.
        budget -= n;
        const sent = burstReqs.length;
        await settle();
        rows.push({ action, kind: c.kind, burst: n, clicks: n, acceptedByDom: -1, requests: sent,
          endpoint: sent ? endpointKey(burstReqs[0]) : '-', statuses: [], guard: false, loadingIndicator: false,
          releasedAfterSettle: 'removed', note: 'page navigated during burst (full-page form post); guard not observable' });
        verdicts.push({ action, status: sent > 1 ? 'fail' : 'info', text: `page navigated; requests=${sent}` });
        return;
      }
      budget -= n;
      if (dom.missing) { verdicts.push({ action, status: 'info', text: 'trigger gone before burst' }); return; }
      await settle();
      const counts = new Map<string, number>();
      for (const r of burstReqs) counts.set(endpointKey(r), (counts.get(endpointKey(r)) ?? 0) + 1);
      let endpoint = '-', requests = 0;
      for (const [k, v] of counts) if (v > requests) { endpoint = k; requests = v; }
      const statuses = burstReqs.filter(r => endpointKey(r) === endpoint)
        .map(r => statusByReq.get(r) ?? 0);
      const released: RapidRow['releasedAfterSettle'] = await page.evaluate((i) => {
        const el = document.querySelector<HTMLElement>(`[data-qa-rapid="${i}"]`);
        if (!el || !el.isConnected) return 'removed' as const;
        return !((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true' ||
          el.getAttribute('aria-busy') === 'true');
      }, c.index).catch(() => 'removed' as const);
      const row: RapidRow = { action, kind: c.kind, burst: n, clicks: n, acceptedByDom: dom.accepted, requests,
        endpoint, statuses, guard: dom.guard || dom.removed, loadingIndicator: dom.indicator, releasedAfterSettle: released };
      if (requests === 0) row.note = 'no mutating request observed (client-side only, or all clicks blocked)';
      if (dom.removed) row.note = 'trigger removed from DOM by the first click';
      rows.push(row);
      if (rateLimited) observations.push(`HTTP 429 seen during "${action}" burst of ${n}; remaining bursts stopped (rate limit respected)`);
      if (dom.removed || released === 'removed') consumed = true;
      if (requests === 0) { verdicts.push({ action, status: 'info', text: 'no mutating request observed' }); return; }
      if (consumed && c.kind === 'delete') {
        observations.push(`"${action}": record consumed by burst of ${n}; burst of 5 not possible on a deleted record`);
        break;
      }
    }
    void consumed;
  };

  try {
    // Pass 1: create/update triggers. Pass 2 (after records exist): delete triggers on run-created rows.
    for (const pass of [1, 2] as const) {
      if (rateLimited || budget < 2) break;
      const cands = await discover(page, prefix);
      for (const c of cands) {
        if (rateLimited || budget < 2) break;
        const wanted = pass === 1 ? c.kind === 'create' : c.kind === 'delete';
        if (!wanted) continue;
        if (!c.safe) {
          if (pass === 1 && c.kind === 'create' || pass === 2) {
            verdicts.push({ action: `${c.kind}: ${c.label}`, status: 'skipped', text: `skipped: not safe (${c.reason})` });
          }
          continue;
        }
        await testCandidate(c);
        if (page.url() !== startUrl) { await page.goto(startUrl, { waitUntil: 'networkidle' }).catch(() => {}); }
      }
    }
  } finally {
    page.off('request', onReq);
    page.off('requestfinished', onDone);
    page.off('requestfailed', onDone);
    page.off('response', onResp);
    page.off('dialog', onDialog);
  }

  // Per-action verdict hints from the measured rows.
  const byAction = new Map<string, RapidRow[]>();
  for (const r of rows) byAction.set(r.action, [...(byAction.get(r.action) ?? []), r]);
  for (const [action, rs] of byAction) {
    const sent = rs.filter(r => r.requests > 0);
    if (sent.length === 0) continue;
    const dup = sent.filter(r => r.requests > 1);
    const unprotected = sent.every(r => !r.guard && !r.loadingIndicator);
    if (dup.length > 0) {
      verdicts.push({ action, status: 'fail', text:
        `FAIL candidate: ${dup.map(r => `${r.requests} requests for ${r.burst} clicks (${r.endpoint.split('://').pop()})`).join('; ')}; verify duplicate records` });
    } else if (unprotected) {
      verdicts.push({ action, status: 'warning', text: 'WARN: no guard and no loading indicator observed (visibility of system status)' });
    } else {
      verdicts.push({ action, status: 'pass', text:
        `1 request per intent; guard=${sent.some(r => r.guard) ? 'Y' : 'N'}, indicator=${sent.some(r => r.loadingIndicator) ? 'Y' : 'N'}; guard release after an error response not verified` });
    }
  }
  if (dialogs > 0) observations.push(`${dialogs} confirm dialog(s) accepted on run-created records`);

  const failN = verdicts.filter(v => v.status === 'fail').length;
  const warnN = verdicts.filter(v => v.status === 'warning').length;
  const testedN = verdicts.filter(v => ['fail', 'warning', 'pass'].includes(v.status)).length;
  const skippedN = verdicts.filter(v => v.status === 'skipped').length;
  const clicksUsed = o.maxClicks - budget;
  const base = {
    testCaseId: 'RPD-001',
    evidence: [] as string[],
    oracle: 'mutating request count via page request events + DOM guard/indicator sampling (150ms)',
    details: { clickCap: o.maxClicks, clicksUsed, rows, verdicts, observations },
  };
  const tail = `Candidates only, need oracle confirmation (records/DB, server response). Clicks used ${clicksUsed}/${o.maxClicks}.`;

  if (testedN === 0) {
    return { ...base, status: skippedN > 0 || rows.length > 0 ? 'skipped' : 'warning',
      message: rows.length > 0
        ? `No mutating request observed for ${rows.length} burst(s); skipped (not safe): ${skippedN}. ${tail}`
        : `No safely triggerable mutating action found (skipped: not safe ${skippedN}). ${tail}`,
      confidence: 'low' };
  }
  if (failN > 0) {
    return { ...base, status: 'fail', severity: 'medium', confidence: 'medium',
      message: `Duplicate-request candidate(s): ${failN} of ${testedN} action(s) sent >1 request per intent; no-guard warnings ${warnN}. ${tail}` };
  }
  if (warnN > 0) {
    return { ...base, status: 'warning', confidence: 'medium',
      message: `${warnN} of ${testedN} action(s) showed no guard and no loading indicator. ${tail}` };
  }
  return { ...base, status: 'pass', confidence: 'medium',
    message: `${testedN} action(s): one request per intent with a guard/indicator. ${tail}` };
}
