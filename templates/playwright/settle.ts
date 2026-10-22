/**
 * Settle helper (see references/core/screen-health-and-export.md).
 *
 * Call `waitForSettled(page)` before any layout measurement or screenshot.
 * It returns `{ settled, waitedMs, reason }` and NEVER throws. A measurement
 * or screenshot taken while `settled === false` must be reported as
 * 'unsettled' and must not be compared with another side.
 *
 * Stable means, over two consecutive samples spaced `intervalMs` apart:
 *  - document.fonts is loaded,
 *  - every visible image is complete and decoded (broken images are noted,
 *    not waited for forever),
 *  - no finite CSS animation / transition is running (document.getAnimations();
 *    infinite animations such as spinners are ignored by default and noted),
 *  - the main landmark and a sample of elements did not move or resize,
 *  - no request started, finished or is in flight for `networkQuietMs`.
 *
 * Read-only: it only reads the DOM and listens to page events (removed on exit).
 */
import type { Page, Request } from '@playwright/test';

export type SettleOptions = {
  /** Hard timeout. Default 8000. */
  timeoutMs?: number;
  /** Spacing of the two layout samples. Default 150. */
  intervalMs?: number;
  /** No request activity for this long counts as quiet. Default 300. */
  networkQuietMs?: number;
  /** Selectors whose boxes are compared. Default: landmarks, headings, controls, images, tables. */
  selectors?: string[];
  /** Max sampled elements. Default 60. */
  sampleLimit?: number;
  /** Position tolerance in px. Default 0.5. */
  tolerancePx?: number;
  /** Ignore animations with infinite iterations (spinners). Default true. */
  ignoreInfiniteAnimations?: boolean;
  /** Ignore requests whose URL matches (long polling, websockets fallbacks). */
  ignoreRequestUrl?: RegExp;
};

export type SettleResult = {
  settled: boolean;
  waitedMs: number;
  /** 'ok' when settled; otherwise the blocking condition at timeout: fonts | images | animations | layout | network | error. */
  reason: string;
  /** Non-blocking observations (infinite animations ignored, broken images). */
  notes: string[];
};

export type Box = { key: string; x: number; y: number; w: number; h: number };
export type LayoutChange = { key: string; before: Box | null; after: Box | null };
export type LayoutDiff = {
  stable: boolean;
  intervalMs: number;
  compared: number;
  changed: LayoutChange[];
};

const DEFAULT_SELECTORS = ['main', '[role="main"]', 'header', 'nav', 'footer', 'h1', 'h2', 'h3', 'button', 'a', 'input', 'select', 'textarea', 'img', 'table', 'form', 'section', 'article', 'aside', 'ul', 'li', 'p', 'label', '[id]'];

type PageSample = {
  fontsLoaded: boolean;
  imagesPending: number;
  imagesBroken: number;
  animationsRunning: number;
  infiniteAnimations: number;
  boxes: Box[];
};

async function takeSample(page: Page, selectors: string[], limit: number, ignoreInfinite: boolean): Promise<PageSample> {
  return page.evaluate(
    async ({ selectors, limit, ignoreInfinite }) => {
      const isVisible = (el: Element): DOMRect | null => {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return null;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') return null;
        return r;
      };
      const fontsLoaded = !document.fonts || document.fonts.status === 'loaded';

      let imagesPending = 0;
      let imagesBroken = 0;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      for (const img of Array.from(document.images)) {
        const r = isVisible(img);
        if (!r) continue;
        const inView = r.bottom > 0 && r.right > 0 && r.top < vh * 2 && r.left < vw;
        if (!inView) continue;
        if (!img.complete) {
          imagesPending++;
        } else if (img.naturalWidth === 0) {
          imagesBroken++;
        } else {
          try { await img.decode(); } catch { imagesBroken++; }
        }
      }

      let animationsRunning = 0;
      let infiniteAnimations = 0;
      const anims = typeof document.getAnimations === 'function' ? document.getAnimations() : [];
      for (const a of anims) {
        if (a.playState === 'paused' || a.playState === 'idle' || a.playState === 'finished') continue;
        const timing = a.effect ? a.effect.getComputedTiming() : null;
        if (timing && timing.iterations === Infinity) {
          infiniteAnimations++;
          if (ignoreInfinite) continue;
        }
        animationsRunning++;
      }

      const boxes: { key: string; x: number; y: number; w: number; h: number }[] = [];
      const counters: Record<string, number> = {};
      for (const sel of selectors) {
        let list: Element[] = [];
        try { list = Array.from(document.querySelectorAll(sel)); } catch { continue; }
        for (const el of list) {
          if (boxes.length >= limit) break;
          const r = isVisible(el);
          if (!r) continue;
          const tag = el.tagName.toLowerCase();
          counters[tag] = (counters[tag] || 0) + 1;
          const id = el.id ? '#' + el.id : '';
          const key = tag + id + '[' + counters[tag] + ']';
          if (boxes.some((b) => b.key === key)) continue;
          boxes.push({ key, x: Math.round(r.left * 10) / 10, y: Math.round((r.top + window.scrollY) * 10) / 10, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 });
        }
      }
      return { fontsLoaded, imagesPending, imagesBroken, animationsRunning, infiniteAnimations, boxes };
    },
    { selectors, limit, ignoreInfinite },
  );
}

function diffBoxes(a: Box[], b: Box[], tol: number): LayoutChange[] {
  const mapB = new Map(b.map((x) => [x.key, x]));
  const mapA = new Map(a.map((x) => [x.key, x]));
  const out: LayoutChange[] = [];
  for (const x of a) {
    const y = mapB.get(x.key);
    if (!y) {
      out.push({ key: x.key, before: x, after: null });
    } else if (Math.abs(x.x - y.x) > tol || Math.abs(x.y - y.y) > tol || Math.abs(x.w - y.w) > tol || Math.abs(x.h - y.h) > tol) {
      out.push({ key: x.key, before: x, after: y });
    }
  }
  for (const y of b) if (!mapA.has(y.key)) out.push({ key: y.key, before: null, after: y });
  return out;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export async function waitForSettled(page: Page, opts: SettleOptions = {}): Promise<SettleResult> {
  const timeoutMs = opts.timeoutMs ?? 8000;
  const intervalMs = opts.intervalMs ?? 150;
  const quietMs = opts.networkQuietMs ?? 300;
  const selectors = opts.selectors ?? DEFAULT_SELECTORS;
  const limit = opts.sampleLimit ?? 60;
  const tol = opts.tolerancePx ?? 0.5;
  const ignoreInfinite = opts.ignoreInfiniteAnimations ?? true;
  const started = Date.now();

  let inflight = 0;
  let lastActivity = 0;
  const relevant = (r: Request): boolean => !(opts.ignoreRequestUrl && opts.ignoreRequestUrl.test(r.url()));
  const onReq = (r: Request): void => { if (relevant(r)) { inflight++; lastActivity = Date.now(); } };
  const onDone = (r: Request): void => { if (relevant(r)) { inflight = Math.max(0, inflight - 1); lastActivity = Date.now(); } };
  page.on('request', onReq);
  page.on('requestfinished', onDone);
  page.on('requestfailed', onDone);

  let reason = 'timeout';
  const notes = new Set<string>();
  try {
    while (Date.now() - started < timeoutMs) {
      const s1 = await takeSample(page, selectors, limit, ignoreInfinite);
      await sleep(intervalMs);
      const s2 = await takeSample(page, selectors, limit, ignoreInfinite);
      if (s2.infiniteAnimations > 0 && ignoreInfinite) notes.add(`${s2.infiniteAnimations} infinite animation(s) ignored`);
      if (s2.imagesBroken > 0) notes.add(`${s2.imagesBroken} broken image(s)`);

      const changed = diffBoxes(s1.boxes, s2.boxes, tol);
      const netQuiet = inflight === 0 && Date.now() - lastActivity >= quietMs;
      if (!s2.fontsLoaded) reason = 'fonts';
      else if (s1.imagesPending > 0 || s2.imagesPending > 0) reason = 'images';
      else if (s1.animationsRunning > 0 || s2.animationsRunning > 0) reason = 'animations';
      else if (changed.length > 0) reason = 'layout';
      else if (!netQuiet) reason = 'network';
      else {
        return { settled: true, waitedMs: Date.now() - started, reason: 'ok', notes: [...notes] };
      }
    }
    return { settled: false, waitedMs: Date.now() - started, reason: 'timeout:' + reason, notes: [...notes] };
  } catch (e) {
    return { settled: false, waitedMs: Date.now() - started, reason: 'error: ' + String(e instanceof Error ? e.message : e).slice(0, 120), notes: [...notes] };
  } finally {
    page.off('request', onReq);
    page.off('requestfinished', onDone);
    page.off('requestfailed', onDone);
  }
}

/** Two layout samples `intervalMs` apart and their diff. Use it to prove a page is still moving. */
export async function sampleLayoutTwice(page: Page, selectors?: string[], intervalMs = 150, tolerancePx = 0.5): Promise<LayoutDiff> {
  const sel = selectors ?? DEFAULT_SELECTORS;
  const a = await takeSample(page, sel, 60, true);
  await sleep(intervalMs);
  const b = await takeSample(page, sel, 60, true);
  const changed = diffBoxes(a.boxes, b.boxes, tolerancePx);
  return { stable: changed.length === 0, intervalMs, compared: Math.max(a.boxes.length, b.boxes.length), changed };
}
