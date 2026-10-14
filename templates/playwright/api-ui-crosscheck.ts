/**
 * Three-witness helper (see references/core/api-ui-crosscheck.md).
 *
 * After a write action, three witnesses must agree:
 *   1. UI state        (what the user sees)
 *   2. Network response (matched by URL + method, not "first response")
 *   3. Independent re-read (API request context or reload)
 *
 * The helper NEVER throws on a mismatch or on a failing witness. Every
 * problem is recorded in `errors`; the caller decides how to report it.
 */
import type { Page, APIRequestContext, Response } from '@playwright/test';

export type ThreeWitnessOptions<T> = {
  /** The write action (click submit, etc.). */
  act: () => Promise<void>;
  /** Which response is the write: URL (substring, glob-free string, or RegExp) AND HTTP method. */
  response: { url: string | RegExp; method?: string };
  /** Witness 1: read what the UI shows. */
  uiState: () => Promise<T>;
  /** Witness 3: independent re-read (api.get(...) or page.reload() then read). */
  reread: (api: APIRequestContext) => Promise<T>;
  /** Optional comparer; default is JSON equality. */
  equal?: (a: T, b: T) => boolean;
  /** Timeout for the network witness in ms (default 15000). */
  timeoutMs?: number;
};

export type ThreeWitnessResult<T> = {
  /** HTTP status of the matched response, or null if none was seen. */
  status: number | null;
  /** Raw response body text ('' if unavailable). */
  body: string;
  ui: T | null;
  back: T | null;
  /** True only if the network witness succeeded (<400), UI and re-read are both available and equal. */
  consistent: boolean;
  /** Short mismatch class tag(s), see the reference doc. Empty when consistent. */
  mismatches: string[];
  /** Non-fatal problems (timeouts, thrown callbacks). */
  errors: string[];
};

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export async function threeWitness<T>(
  page: Page,
  api: APIRequestContext,
  o: ThreeWitnessOptions<T>,
): Promise<ThreeWitnessResult<T>> {
  const errors: string[] = [];
  const wantMethod = (o.response.method ?? 'POST').toUpperCase();
  const urlOk = (u: string): boolean =>
    typeof o.response.url === 'string' ? u.includes(o.response.url) : o.response.url.test(u);

  // Start listening BEFORE the action so a fast response is not missed.
  const respPromise: Promise<Response | null> = page
    .waitForResponse((r) => r.request().method() === wantMethod && urlOk(r.url()), {
      timeout: o.timeoutMs ?? 15000,
    })
    .catch((e: unknown) => {
      errors.push(`network witness: ${msg(e)}`);
      return null;
    });

  try {
    await o.act();
  } catch (e) {
    errors.push(`act: ${msg(e)}`);
  }

  const resp = await respPromise;
  let status: number | null = null;
  let body = '';
  if (resp) {
    status = resp.status();
    try {
      body = await resp.text();
    } catch (e) {
      errors.push(`response body: ${msg(e)}`);
    }
  }

  let ui: T | null = null;
  try {
    ui = await o.uiState();
  } catch (e) {
    errors.push(`uiState: ${msg(e)}`);
  }

  let back: T | null = null;
  try {
    back = await o.reread(api);
  } catch (e) {
    errors.push(`reread: ${msg(e)}`);
  }

  const eq = o.equal ?? ((a: T, b: T): boolean => JSON.stringify(a) === JSON.stringify(b));
  const mismatches: string[] = [];
  if (status === null) mismatches.push('NO_NETWORK_WITNESS');
  else if (status >= 400) mismatches.push('API_ERROR_STATUS');
  if (ui === null || back === null) mismatches.push('WITNESS_UNAVAILABLE');
  else if (!eq(ui, back)) mismatches.push('UI_REREAD_DIFFER');

  return { status, body, ui, back, consistent: mismatches.length === 0, mismatches, errors };
}
