/**
 * UI-under-load observer (see references/load; method doc: references/core/api-ui-crosscheck.md).
 *
 * ROLE: a SINGLE headed browser user that observes user-experience invariants
 * WHILE load is being generated elsewhere (e.g. by a separate, gated k6 run).
 * THIS FILE GENERATES NO LOAD. It performs one create flow and one double-submit.
 *
 * SAFETY GATE (Node side, evaluated before any browser action). The test is
 * skipped unless ALL hold:
 *   - LOAD_TARGET is set and appears (exact match, trailing slash ignored) as a
 *     line in the file at LOAD_ALLOWLIST (targets.allow; '#' comments and blank lines ignored)
 *   - LOAD_TARGET matches NO pattern in the file at LOAD_DENYLIST ('*' wildcard; one per line)
 *   - LOAD_WINDOW_OK === '1'  (you confirmed the agreed time window and approvals)
 * Never run against a target that is not on the allowlist.
 *
 * Everything marked CONFIGURE-ME below must be filled in for the target app.
 * Own `TEST_<timestamp>` data only; records are removed in cleanup.
 */
import { test, expect } from '@playwright/test';
import type { Response } from '@playwright/test';
import * as fs from 'fs';
import { assertOverlayInvariants } from './overlay-invariants';
import { threeWitness } from './api-ui-crosscheck';

// ---------------------------------------------------------------- CONFIGURE-ME
const PAGE_PATH = '/CONFIGURE-ME/list-page'; // page that hosts the list + create button
const LIST_API_PATH = '/CONFIGURE-ME/api/items'; // GET returns the list as JSON (re-read witness)
const WRITE_URL_MATCH = '/CONFIGURE-ME/api/items'; // substring of the create request URL
const WRITE_METHOD = 'POST';
const SEL = {
  openModal: '[data-testid="CONFIGURE-ME-open"]', // button that opens the create modal
  dialog: '[role="dialog"]',
  closeBtn: '[data-testid="CONFIGURE-ME-close"]',
  nameInput: '[data-testid="CONFIGURE-ME-name"]',
  submit: '[data-testid="CONFIGURE-ME-submit"]',
  row: '[data-testid="CONFIGURE-ME-row"]', // one list row; must contain the record name
  rowDelete: '[data-testid="CONFIGURE-ME-row-delete"]', // delete control inside a row
  confirmDelete: '[data-testid="CONFIGURE-ME-confirm-delete"]',
  errorMessage: '[role="alert"], [data-testid="CONFIGURE-ME-error"]', // user-visible error on 429/5xx
};
/** Extract record names from the list API JSON. CONFIGURE-ME to the real shape. */
const namesFromApi = (json: unknown): string[] =>
  Array.isArray(json) ? json.map((x) => String((x as { name?: unknown }).name ?? '')) : [];
// ---------------------------------------------------------------------------

// ------------------------------------------------------------ Node-side gate
const readLines = (p: string | undefined): string[] | null => {
  if (!p) return null;
  try {
    return fs
      .readFileSync(p, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
  } catch {
    return null;
  }
};
const norm = (u: string): string => u.trim().replace(/\/+$/, '').toLowerCase();
const globToRe = (g: string): RegExp =>
  new RegExp('^' + g.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', 'i');

/** Returns null when the target may be used, otherwise the reason to skip. */
function gate(): string | null {
  const target = process.env.LOAD_TARGET;
  if (!target) return 'LOAD_TARGET is not set';
  const allow = readLines(process.env.LOAD_ALLOWLIST);
  if (!allow) return 'LOAD_ALLOWLIST is not set or unreadable (targets.allow required)';
  const deny = readLines(process.env.LOAD_DENYLIST);
  if (!deny) return 'LOAD_DENYLIST is not set or unreadable (deny patterns required)';
  if (!allow.some((a) => norm(a) === norm(target))) return `target not in allowlist: ${target}`;
  if (deny.some((d) => globToRe(d).test(target.trim()) || globToRe(d).test(norm(target)))) {
    return `target matches a denylist pattern: ${target}`;
  }
  if (process.env.LOAD_WINDOW_OK !== '1') return 'LOAD_WINDOW_OK is not "1" (time window / approval not confirmed)';
  return null;
}
const gateReason = gate();
// ---------------------------------------------------------------------------

test.describe('ui-under-load observer (no load generated here)', () => {
  test.skip(gateReason !== null, `Safety gate: ${gateReason ?? ''}. Refusing to run against an unlisted target.`);

  test('create flow, double submit, error visibility, cleanup', async ({ page, request }) => {
    const base = (process.env.LOAD_TARGET ?? '').replace(/\/+$/, '');
    const stamp = `TEST_${Date.now()}`;
    const name = stamp;
    const dsName = `${stamp}_DS`;
    const rowsOf = (n: string) => page.locator(SEL.row).filter({ hasText: n });
    const writeStatuses: number[] = [];
    page.on('response', (r: Response) => {
      if (r.request().method() === WRITE_METHOD && r.url().includes(WRITE_URL_MATCH)) writeStatuses.push(r.status());
    });
    const note = (type: string, description: string): void => {
      test.info().annotations.push({ type, description });
    };

    try {
      await page.goto(base + PAGE_PATH);

      // 1. Overlay invariants on the create modal.
      const inv = await assertOverlayInvariants(page, {
        trigger: page.locator(SEL.openModal),
        dialog: page.locator(SEL.dialog),
        close: page.locator(SEL.closeBtn),
      });
      for (const r of inv) note(`overlay:${r.id}`, `${r.pass ? 'PASS' : 'FAIL'} ${r.detail ?? ''}`);

      // 2. Create via three witnesses.
      await page.locator(SEL.openModal).click();
      await page.locator(SEL.nameInput).fill(name);
      const w = await threeWitness<number>(page, request, {
        act: () => page.locator(SEL.submit).click(),
        response: { url: WRITE_URL_MATCH, method: WRITE_METHOD },
        uiState: async () => rowsOf(name).count(),
        reread: async (api) => {
          const res = await api.get(base + LIST_API_PATH);
          return namesFromApi(await res.json().catch(() => [])).filter((n) => n === name).length;
        },
      });
      note('threeWitness', JSON.stringify({ status: w.status, mismatches: w.mismatches, errors: w.errors }));
      // Under load a 429/5xx here is a legitimate observation, not a harness failure.
      if (w.status !== null && w.status < 400) {
        expect.soft(w.consistent, `witnesses disagree: ${w.mismatches.join(',')}`).toBe(true);
      }

      // 3. Double submit: exactly one record must result.
      await page.goto(base + PAGE_PATH);
      await page.locator(SEL.openModal).click();
      await page.locator(SEL.nameInput).fill(dsName);
      await page.locator(SEL.submit).dblclick();
      await page.waitForTimeout(1500);
      await page.reload();
      const dupes = await rowsOf(dsName).count();
      const throttledOrFailed = writeStatuses.some((s) => s === 429 || s >= 500);
      if (!throttledOrFailed) {
        expect.soft(dupes, 'double submit must create exactly one record').toBe(1);
      } else {
        expect.soft(dupes, 'double submit must never create more than one record').toBeLessThanOrEqual(1);
      }

      // 4. If the server throttled or failed any write, the user must have been told.
      if (throttledOrFailed) {
        await expect
          .soft(page.locator(SEL.errorMessage).first(), 'user must see an error on 429/5xx')
          .toBeVisible({ timeout: 5000 });
      } else {
        note('error-visibility', 'not observed: no 429/5xx on write (run while load is active)');
      }
    } finally {
      // 5. Cleanup own TEST_ rows (best effort, UI-driven).
      try {
        await page.goto(base + PAGE_PATH);
        for (let i = 0; i < 6; i++) {
          const row = page.locator(SEL.row).filter({ hasText: stamp }).first();
          if (!(await row.isVisible().catch(() => false))) break;
          await row.locator(SEL.rowDelete).click();
          await page.locator(SEL.confirmDelete).click().catch(() => undefined);
          await page.waitForTimeout(500);
        }
        const left = await page.locator(SEL.row).filter({ hasText: stamp }).count();
        note('cleanup', `remaining TEST_ rows: ${left}`);
      } catch (e) {
        note('cleanup', `failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  });
});
