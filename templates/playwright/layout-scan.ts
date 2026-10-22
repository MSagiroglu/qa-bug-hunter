/**
 * Layout and visual consistency scanner (see references/core/layout-consistency.md).
 *
 * Measures instead of eyeballing: horizontal overflow, off-screen and clipped
 * elements, overlapping controls, off-center icons, near-miss alignment,
 * uneven gaps, same-role size/color/font drift, contrast and tap targets.
 *
 * Read-only: no clicks, no typing, no navigation. The only DOM write is the
 * temporary overlay of annotateFindings(), removed in a finally block.
 * NEVER throws on a finding or on a page error: problems land in stats.errors.
 *
 * Limits: open shadow roots and iframes are not traversed; backgrounds that are
 * gradients or images are skipped by CONTRAST; geometry is exact (layout units),
 * colors are computed values, not rendered pixels (no antialiasing analysis).
 */
import type { Page } from '@playwright/test';

export type CheckId =
  | 'HSCROLL' | 'OFFSCREEN' | 'CONTAINER_OVERFLOW' | 'CLIPPED_TEXT' | 'OVERLAP'
  | 'CENTER' | 'ALIGN' | 'GAP' | 'SIZE_VARIANCE'
  | 'COLOR_NEAR_MISS' | 'COLOR_ROLE_VARIANCE' | 'FONT_NEAR_MISS' | 'CONTRAST' | 'TAP_TARGET';

export const ALL_CHECKS: CheckId[] = [
  'HSCROLL', 'OFFSCREEN', 'CONTAINER_OVERFLOW', 'CLIPPED_TEXT', 'OVERLAP',
  'CENTER', 'ALIGN', 'GAP', 'SIZE_VARIANCE',
  'COLOR_NEAR_MISS', 'COLOR_ROLE_VARIANCE', 'FONT_NEAR_MISS', 'CONTRAST', 'TAP_TARGET',
];

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
/** Rectangle in DOCUMENT coordinates (scroll offset included), CSS px. */
export type Rect = { x: number; y: number; w: number; h: number };

export type Finding = {
  id: string;
  check: CheckId;
  severity: Severity;
  selector: string;
  rect: Rect;
  detail: string;
  values?: Record<string, unknown>;
};

export type Tolerances = {
  /** px of horizontal overflow tolerated before HSCROLL/OFFSCREEN/CONTAINER_OVERFLOW */
  overflowTol: number;
  /** intersection / smaller area needed for OVERLAP */
  overlapMinRatio: number;
  /** intersection must be wider AND taller than this (px) */
  overlapMinPx: number;
  /** icon center vs container center offset tolerated (px) */
  centerTol: number;
  /** offsets below this are treated as equal (sub-pixel rounding) */
  alignMin: number;
  /** offsets above this are treated as intentional, not near-miss */
  alignMax: number;
  /** gap deviation from the median tolerated (px) */
  gapTol: number;
  /** same-role height/width spread tolerated (px) */
  sizeTol: number;
  /** CIE76 delta E below which two distinct colors are a near miss */
  colorDeltaE: number;
  /** Lab chroma below which a color counts as neutral (white/gray ramp) */
  neutralChroma: number;
  /** two NEUTRAL colors are a near miss only below this deltaE76 (white vs #f3f4f6 is a normal ramp step) */
  neutralDeltaE: number;
  /** near-miss centering: container sides at most this (px) */
  centerNearMaxBox: number;
  /** near-miss centering: the single child must be at most this fraction of the container per axis */
  centerNearChildRatio: number;
  /** near-miss centering: smallest and largest child-vs-container center offset reported (px) */
  centerNearMin: number;
  centerNearMax: number;
  /** offsets above this fraction of the container are intentional placements (corner badge), never reported */
  centerNearIntentional: number;
  fontNearMin: number;
  fontNearMax: number;
  /** more distinct family/size/weight combos than this is reported */
  maxFontCombos: number;
  contrastNormal: number;
  contrastLarge: number;
  /** WCAG 2.2 SC 2.5.8 minimum target size, CSS px */
  tapMin: number;
  /** platform guideline (44pt iOS / 48dp Android approx), info only */
  tapGuideline: number;
};

export const DEFAULTS: Tolerances & { maxPerCheck: number } = {
  overflowTol: 1,
  overlapMinRatio: 0.15,
  overlapMinPx: 2,
  centerTol: 1.5,
  alignMin: 0.75,
  alignMax: 4,
  gapTol: 1,
  sizeTol: 1,
  colorDeltaE: 6,
  neutralChroma: 8,
  neutralDeltaE: 1.5,
  centerNearMaxBox: 64,
  centerNearChildRatio: 0.7,
  centerNearMin: 1,
  centerNearMax: 6,
  centerNearIntentional: 0.25,
  fontNearMin: 0.5,
  fontNearMax: 1.5,
  maxFontCombos: 12,
  contrastNormal: 4.5,
  contrastLarge: 3,
  tapMin: 24,
  tapGuideline: 44,
  maxPerCheck: 25,
};

export type ScanOptions = {
  tolerances?: Partial<Tolerances>;
  /** Explicit inner-vs-outer centering pairs (CSS selectors; inner is searched inside outer). */
  centerPairs?: { inner: string; outer: string }[];
  /** Role name -> selector. Elements of one role must share color/background/border/font. */
  roles?: Record<string, string>;
  /** Run only these checks (default: all). */
  checks?: CheckId[];
  /** 'mobile' adds the 44 px guideline as info; 'auto' = mobile when viewport < 768 px. */
  profile?: 'auto' | 'desktop' | 'mobile';
  /** Cap per check; the real count stays in stats.counts (default 25). */
  maxPerCheck?: number;
  /** Selectors whose elements (and descendants) are skipped. `[data-layout-ignore]` always is. */
  ignore?: string[];
  /** Limit the element scan to this subtree (HSCROLL stays document-wide). */
  root?: string;
  /** Intentional near-miss color pairs, as CSS color strings in rgb()/hex form. */
  allowColorPairs?: [string, string][];
};

export type ScanStats = {
  elements: number;
  interactive: number;
  skippedHidden: number;
  skippedAnimated: number;
  skippedOffCanvas: number;
  contrastSkipped: number;
  fontCombos: number;
  profile: 'desktop' | 'mobile';
  /** Real number of findings per check before the cap. */
  counts: Partial<Record<CheckId, number>>;
  /** Checks whose list was cut by maxPerCheck: check -> findings dropped. */
  capped: Partial<Record<CheckId, number>>;
  errors: string[];
  ms: number;
};

export type ViewportInfo = { width: number; height: number; dpr: number };
export type LayoutResult = { kind: 'layout'; viewport: ViewportInfo; findings: Finding[]; stats: ScanStats };

type RawFinding = Omit<Finding, 'id'>;
type BrowserArg = {
  t: Tolerances;
  checks: CheckId[];
  profile: 'auto' | 'desktop' | 'mobile';
  centerPairs: { inner: string; outer: string }[];
  roles: Record<string, string>;
  ignore: string[];
  root: string;
  allow: [string, string][];
};
type BrowserOut = {
  raw: RawFinding[];
  viewport: ViewportInfo;
  stats: { elements: number; interactive: number; skippedHidden: number; skippedAnimated: number; skippedOffCanvas: number; contrastSkipped: number; fontCombos: number; profile: 'desktop' | 'mobile' };
};

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const SEV_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

/* ------------------------------------------------------------------ */
/* Browser side. Must stay self-contained: it is serialized by Playwright. */
/* ------------------------------------------------------------------ */
function browserScan(arg: BrowserArg): BrowserOut {
  const t = arg.t;
  const enabled = new Set<string>(arg.checks);
  const doc = document;
  const win = window;
  const sx = win.scrollX;
  const sy = win.scrollY;
  const R1 = (n: number): number => Math.round(n * 10) / 10;
  type R = { x: number; y: number; w: number; h: number };
  const docRect = (r: DOMRect): R => ({ x: R1(r.left + sx), y: R1(r.top + sy), w: R1(r.width), h: R1(r.height) });
  const raw: RawFinding[] = [];
  const add = (check: CheckId, severity: Severity, selector: string, rect: R, detail: string, values?: Record<string, unknown>): void => {
    if (!enabled.has(check)) return;
    raw.push({ check, severity, selector, rect, detail, values });
  };

  const vw = doc.documentElement.clientWidth;
  const profile: 'desktop' | 'mobile' =
    arg.profile === 'auto' ? (vw < 768 ? 'mobile' : 'desktop') : arg.profile;

  // ---------- helpers ----------
  const selMemo = new Map<Element, string>();
  const selOf = (el: Element): string => {
    const m = selMemo.get(el);
    if (m !== undefined) return m;
    const parts: string[] = [];
    let cur: Element | null = el;
    for (let depth = 0; cur && cur !== doc.documentElement && depth < 4; depth++, cur = cur.parentElement) {
      const c: Element = cur;
      if (c.id) { parts.unshift('#' + CSS.escape(c.id)); break; }
      let p = c.tagName.toLowerCase();
      const cls = typeof c.className === 'string' ? c.className.trim().split(/\s+/).filter(Boolean).slice(0, 2) : [];
      if (cls.length) p += '.' + cls.map((x) => CSS.escape(x)).join('.');
      const par = c.parentElement;
      if (par) {
        const same = Array.from(par.children).filter((x) => x.tagName === c.tagName);
        if (same.length > 1) p += ':nth-of-type(' + (same.indexOf(c) + 1) + ')';
      }
      parts.unshift(p);
    }
    const out = parts.join(' > ');
    selMemo.set(el, out);
    return out;
  };

  type RGBA = { r: number; g: number; b: number; a: number };
  const parseColor = (s: string): RGBA | null => {
    const m = /^rgba?\(([^)]+)\)$/.exec(s.trim());
    if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
    if (p.length < 3 || p.some((n) => Number.isNaN(n))) return null;
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const hex = (c: RGBA): string =>
    '#' + [c.r, c.g, c.b].map((n) => Math.round(n).toString(16).padStart(2, '0')).join('');
  const lin = (v: number): number => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = (c: RGBA): number => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const lab = (c: RGBA): [number, number, number] => {
    const r = lin(c.r), g = lin(c.g), b = lin(c.b);
    const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
    const Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
    const Z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
    const f = (v: number): number => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
    return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
  };
  const dE = (a: RGBA, b: RGBA): number => {
    const x = lab(a), y = lab(b);
    return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
  };
  const chroma = (c: RGBA): number => { const x = lab(c); return Math.hypot(x[1], x[2]); };
  const median = (xs: number[]): number => {
    const s = xs.slice().sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  /** Most common value (members within tol of it) and how many members it has. */
  const modeOf = (xs: number[], tol: number): { value: number; count: number } => {
    let best = { value: xs[0], count: 0 };
    for (const v of xs) {
      let n = 0;
      for (const w of xs) if (Math.abs(w - v) < tol) n++;
      if (n > best.count) best = { value: v, count: n };
    }
    return best;
  };

  const ROLES = new Set(['button', 'link', 'checkbox', 'radio', 'tab', 'menuitem', 'switch', 'option', 'slider', 'textbox', 'combobox', 'menuitemcheckbox', 'menuitemradio']);
  const isInteractive = (el: Element): boolean => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'a') return el.hasAttribute('href');
    if (tag === 'button' || tag === 'select' || tag === 'textarea' || tag === 'summary') return true;
    if (tag === 'input') return (el as HTMLInputElement).type !== 'hidden';
    const role = el.getAttribute('role');
    if (role && ROLES.has(role)) return true;
    const ti = el.getAttribute('tabindex');
    if (ti !== null && parseInt(ti, 10) >= 0) return true;
    return el.hasAttribute('onclick');
  };
  const isDisabled = (el: Element): boolean => {
    try { if (el.matches(':disabled')) return true; } catch { /* ignore */ }
    return el.getAttribute('aria-disabled') === 'true';
  };
  const hasOwnText = (el: Element): boolean => {
    for (const n of Array.from(el.childNodes)) if (n.nodeType === 3 && (n.textContent || '').trim()) return true;
    return false;
  };

  // ---------- element records ----------
  type Rec = {
    el: Element; r: DOMRect; cs: CSSStyleDeclaration; sel: string;
    interactive: boolean; hasText: boolean; fixedAnc: boolean; opacity: number;
    kids: Rec[]; parent: Rec | null;
  };
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'BR', 'WBR', 'OPTION', 'OPTGROUP', 'DATALIST', 'TITLE']);
  const recs = new Map<Element, Rec>();
  const list: Rec[] = [];
  const stat = { elements: 0, interactive: 0, skippedHidden: 0, skippedAnimated: 0, skippedOffCanvas: 0, contrastSkipped: 0, fontCombos: 0 };

  const rootEl: Element = (arg.root && doc.querySelector(arg.root)) || doc.body;
  const fixedMemo = new Map<Element, boolean>();
  const hasFixed = (el: Element | null): boolean => {
    if (!el || el === doc.documentElement) return false;
    const m = fixedMemo.get(el);
    if (m !== undefined) return m;
    const v = getComputedStyle(el).position === 'fixed' || hasFixed(el.parentElement);
    fixedMemo.set(el, v);
    return v;
  };
  const opMemo = new Map<Element, number>();
  const effOpacity = (el: Element | null): number => {
    if (!el || el === doc.documentElement) return 1;
    const m = opMemo.get(el);
    if (m !== undefined) return m;
    const v = parseFloat(getComputedStyle(el).opacity) * effOpacity(el.parentElement);
    opMemo.set(el, v);
    return v;
  };
  const ignoreSel = ['[data-layout-ignore]'].concat(arg.ignore).join(',');
  const makeRec = (el: Element, isRoot: boolean): Rec | null => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (!isRoot) {
      if (cs.display === 'none' || cs.visibility !== 'visible' || r.width <= 0 || r.height <= 0) { stat.skippedHidden++; return null; }
      if (effOpacity(el) <= 0.01) { stat.skippedHidden++; return null; }
      if ((r.width <= 1 && r.height <= 1) || /^rect\(0(px)?,? 0(px)?,? 0(px)?,? 0(px)?\)$/.test(cs.clip) || cs.clipPath === 'inset(50%)') { stat.skippedHidden++; return null; }
      try { if (ignoreSel && el.closest(ignoreSel)) return null; } catch { /* bad selector */ }
      const anims = typeof el.getAnimations === 'function' ? el.getAnimations() : [];
      if (anims.some((a) => a.playState === 'running')) { stat.skippedAnimated++; return null; }
    }
    const rec: Rec = {
      el, r, cs, sel: selOf(el), interactive: !isRoot && isInteractive(el), hasText: hasOwnText(el),
      fixedAnc: hasFixed(el), opacity: effOpacity(el), kids: [], parent: null,
    };
    return rec;
  };
  const rootRec = makeRec(rootEl, true);
  if (rootRec) recs.set(rootEl, rootRec);
  for (const el of Array.from(rootEl.querySelectorAll('*'))) {
    if (SKIP_TAGS.has(el.tagName)) continue;
    if (el instanceof SVGElement && el.tagName.toLowerCase() !== 'svg') continue;
    const rec = makeRec(el, false);
    if (!rec) continue;
    recs.set(el, rec);
    list.push(rec);
    if (rec.interactive) stat.interactive++;
  }
  stat.elements = list.length;
  for (const rec of list) {
    let p = rec.el.parentElement;
    while (p && !recs.has(p) && p !== rootEl) p = p.parentElement;
    const pr = p ? recs.get(p) || null : null;
    if (pr) { rec.parent = pr; pr.kids.push(rec); }
  }

  const inFlow = (c: Rec): boolean => {
    const p = c.cs.position;
    return p !== 'absolute' && p !== 'fixed' && c.cs.display !== 'inline' && c.cs.display !== 'contents';
  };
  /** Ancestor (below body) that clips horizontally? */
  const clipMemo = new Map<Element, boolean>();
  const clippedX = (el: Element | null): boolean => {
    if (!el || el === doc.body || el === doc.documentElement) return false;
    const m = clipMemo.get(el);
    if (m !== undefined) return m;
    const v = getComputedStyle(el).overflowX !== 'visible' || clippedX(el.parentElement);
    clipMemo.set(el, v);
    return v;
  };

  const docEl = doc.documentElement;

  // ---------- HSCROLL ----------
  const sw = Math.max(docEl.scrollWidth, doc.body ? doc.body.scrollWidth : 0);
  const hscroll = sw > docEl.clientWidth + t.overflowTol;
  if (hscroll) {
    const culprits = list
      .filter((c) => !c.fixedAnc && c.r.right > docEl.clientWidth + t.overflowTol && !clippedX(c.el.parentElement))
      .sort((a, b) => b.r.right - a.r.right).slice(0, 3);
    add('HSCROLL', 'high', 'html', { x: 0, y: 0, w: docEl.clientWidth, h: docEl.clientHeight },
      'Page scrolls horizontally: scrollWidth ' + sw + ' > clientWidth ' + docEl.clientWidth,
      { scrollWidth: sw, clientWidth: docEl.clientWidth, widestBy: R1(sw - docEl.clientWidth), culprits: culprits.map((c) => c.sel) });
  }

  // ---------- OFFSCREEN ----------
  if (enabled.has('OFFSCREEN')) {
    for (const c of list) {
      if (c.fixedAnc || clippedX(c.el.parentElement)) continue;
      const r = c.r;
      const beyondRight = r.right > vw + t.overflowTol;
      const beyondLeft = r.left < -t.overflowTol;
      if (!beyondRight && !beyondLeft) continue;
      if (r.right <= 0) { stat.skippedOffCanvas++; continue; } // fully off to the left: off-canvas / skip-link convention
      const pr = c.parent;
      if (pr && pr.el !== rootEl && (pr.r.right > vw + t.overflowTol || pr.r.left < -t.overflowTol) && !pr.fixedAnc) continue; // report outermost offender only
      const fully = r.left >= vw;
      const sev: Severity = fully && !hscroll ? 'critical' : 'high';
      add('OFFSCREEN', sev, c.sel, docRect(r),
        beyondRight ? 'Extends ' + R1(r.right - vw) + ' px beyond the right edge of the viewport (' + vw + ' px)' : 'Starts ' + R1(-r.left) + ' px left of the viewport',
        { right: R1(r.right), left: R1(r.left), viewportWidth: vw, interactive: c.interactive, fullyOutside: fully, pageScrolls: hscroll });
    }
  }

  // ---------- CONTAINER_OVERFLOW and CLIPPED_TEXT ----------
  for (const c of list) {
    const cs = c.cs;
    const el = c.el as HTMLElement;
    const clipsX = cs.overflowX === 'hidden' || cs.overflowX === 'clip';
    const clipsY = cs.overflowY === 'hidden' || cs.overflowY === 'clip';
    const clamp = cs.getPropertyValue('-webkit-line-clamp');
    const clamped = clamp !== '' && clamp !== 'none';
    if (c.hasText && ((clipsX && el.scrollWidth > el.clientWidth + t.overflowTol) || (clamped && el.scrollHeight > el.clientHeight + t.overflowTol))) {
      const ellipsis = cs.textOverflow === 'ellipsis';
      const hasTip = !!(el.getAttribute('title') || el.getAttribute('aria-label'));
      const sev: Severity = hasTip ? 'low' : c.interactive ? 'high' : 'medium';
      add('CLIPPED_TEXT', sev, c.sel, docRect(c.r),
        'Text is cut off (' + (clamped ? 'line clamp' : ellipsis ? 'ellipsis' : 'overflow hidden') + '): content ' + el.scrollWidth + 'x' + el.scrollHeight + ' px in a ' + el.clientWidth + 'x' + el.clientHeight + ' px box',
        { text: (el.textContent || '').trim().slice(0, 60), ellipsis, hasTooltip: hasTip, interactive: c.interactive });
    } else if (!c.hasText && (clipsX || clipsY) && el.clientWidth > 0 && el.clientHeight > 0) {
      const overX = clipsX && el.scrollWidth > el.clientWidth + t.overflowTol;
      const overY = clipsY && el.scrollHeight > el.clientHeight + 2;
      if (overX || overY) {
        add('CONTAINER_OVERFLOW', 'medium', c.sel, docRect(c.r),
          'Container clips its content: scroll ' + el.scrollWidth + 'x' + el.scrollHeight + ' px vs box ' + el.clientWidth + 'x' + el.clientHeight + ' px (overflow ' + cs.overflowX + '/' + cs.overflowY + ')',
          { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight });
      }
    }
    // child sticking out of a non-scrolling parent
    const pr = c.parent;
    if (pr && pr.el !== rootEl && inFlow(c) && pr.cs.overflowX === 'visible' && !/^(inline|contents|table|inline-table)/.test(pr.cs.display)) {
      const right = c.r.right - pr.r.right;
      const left = pr.r.left - c.r.left;
      if (right > t.overflowTol || left > t.overflowTol) {
        add('CONTAINER_OVERFLOW', c.interactive ? 'high' : 'medium', c.sel, docRect(c.r),
          'Child sticks out of its parent by ' + R1(Math.max(right, left)) + ' px on the ' + (right > left ? 'right' : 'left') + ' (parent ' + pr.sel + ' is ' + R1(pr.r.width) + ' px wide, child ' + R1(c.r.width) + ' px)',
          { parent: pr.sel, childWidth: R1(c.r.width), parentWidth: R1(pr.r.width), overBy: R1(Math.max(right, left)) });
      }
    }
  }

  // ---------- OVERLAP ----------
  if (enabled.has('OVERLAP')) {
    const inter = list.filter((c) => c.interactive && c.cs.pointerEvents !== 'none').slice(0, 400);
    for (let i = 0; i < inter.length; i++) {
      for (let j = i + 1; j < inter.length; j++) {
        const a = inter[i], b = inter[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const la = (a.el as HTMLInputElement).labels, lb = (b.el as HTMLInputElement).labels;
        if ((la && Array.from(la).some((l) => l.contains(b.el))) || (lb && Array.from(lb).some((l) => l.contains(a.el)))) continue;
        const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
        const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        if (w <= t.overlapMinPx || h <= t.overlapMinPx) continue;
        const ratio = (w * h) / Math.min(a.r.width * a.r.height, b.r.width * b.r.height);
        if (ratio < t.overlapMinRatio) continue;
        add('OVERLAP', 'high', a.sel, { x: R1(Math.max(a.r.left, b.r.left) + sx), y: R1(Math.max(a.r.top, b.r.top) + sy), w: R1(w), h: R1(h) },
          'Interactive elements overlap by ' + Math.round(ratio * 100) + '% of the smaller one (' + R1(w) + 'x' + R1(h) + ' px) with ' + b.sel,
          { other: b.sel, ratio: Math.round(ratio * 100) / 100, width: R1(w), height: R1(h) });
      }
    }
  }

  // ---------- CENTER ----------
  if (enabled.has('CENTER')) {
    const seen = new Set<Element>();
    const centerOf = (r: DOMRect): [number, number] => [r.left + r.width / 2, r.top + r.height / 2];
    const test = (outer: Element, inner: Element): void => {
      if (seen.has(outer)) return;
      seen.add(outer);
      const o = outer.getBoundingClientRect(), i = inner.getBoundingClientRect();
      if (o.width <= 0 || i.width <= 0) return;
      const oc = centerOf(o), ic = centerOf(i);
      const dx = R1(ic[0] - oc[0]), dy = R1(ic[1] - oc[1]);
      const worst = Math.max(Math.abs(dx), Math.abs(dy));
      if (worst > t.centerTol) {
        add('CENTER', worst <= 2 ? 'low' : 'medium', selOf(outer), docRect(o),
          'Content is not centered: inner ' + selOf(inner) + ' is off by dx ' + dx + ' px, dy ' + dy + ' px',
          { dx, dy, inner: selOf(inner), outerSize: R1(o.width) + 'x' + R1(o.height), innerSize: R1(i.width) + 'x' + R1(i.height) });
      }
    };
    for (const p of arg.centerPairs) {
      for (const outer of Array.from(doc.querySelectorAll(p.outer))) {
        const inner = outer.querySelector(p.inner);
        if (inner) test(outer, inner);
      }
    }
    for (const c of list) {
      if (c.hasText || c.r.width > 96 || c.r.height > 96) continue;
      if (!(c.interactive || /badge|avatar|icon/i.test(typeof c.el.className === 'string' ? c.el.className : ''))) continue;
      const kids = c.kids.filter(inFlow);
      if (kids.length === 1 && c.kids.length === 1) test(c.el, kids[0].el);
    }
    // Generic near-miss centering: a small chip/avatar/icon box (visible background or border)
    // with exactly one visible element child much smaller than the box.
    for (const c of list) {
      if (seen.has(c.el) || c.hasText || c.kids.length !== 1) continue;
      if (c.r.width > t.centerNearMaxBox || c.r.height > t.centerNearMaxBox) continue;
      const bg = parseColor(c.cs.backgroundColor);
      let hasBorder = false;
      for (const side of ['top', 'right', 'bottom', 'left']) {
        const st = c.cs.getPropertyValue('border-' + side + '-style');
        if (parseFloat(c.cs.getPropertyValue('border-' + side + '-width')) > 0 && st !== 'none' && st !== 'hidden') hasBorder = true;
      }
      if (!((bg && bg.a > 0) || hasBorder)) continue;
      const k = c.kids[0];
      if (k.r.width > t.centerNearChildRatio * c.r.width || k.r.height > t.centerNearChildRatio * c.r.height) continue;
      const oc = centerOf(c.r), ic = centerOf(k.r);
      const dx = R1(ic[0] - oc[0]), dy = R1(ic[1] - oc[1]);
      const worst = Math.max(Math.abs(dx), Math.abs(dy));
      if (worst < t.centerNearMin || worst > t.centerNearMax) continue;
      if (worst > t.centerNearIntentional * Math.min(c.r.width, c.r.height)) continue; // intentional placement (corner badge)
      seen.add(c.el);
      add('CENTER', worst <= 2 ? 'low' : 'medium', c.sel, docRect(c.r),
        'Near-miss centering: single child ' + k.sel + ' of a small ' + R1(c.r.width) + 'x' + R1(c.r.height) + ' px box is off center by dx ' + dx + ' px, dy ' + dy + ' px',
        { dx, dy, inner: k.sel, outerSize: R1(c.r.width) + 'x' + R1(c.r.height), innerSize: R1(k.r.width) + 'x' + R1(k.r.height), heuristic: 'small-box-single-child' });
    }
  }

  // ---------- groups: rows and columns of in-flow siblings ----------
  type Group = { parent: Rec; kind: 'row' | 'col'; members: Rec[] };
  const groups: Group[] = [];
  for (const prec of [rootRec as Rec | null].concat(list)) {
    if (!prec) continue;
    const kids = prec.kids.filter(inFlow).sort((a, b) => a.r.top - b.r.top || a.r.left - b.r.left);
    if (kids.length < 3) continue;
    const clusters: Rec[][] = [];
    for (const k of kids) {
      let placed = false;
      for (const cl of clusters) {
        const f = cl[0];
        const ov = Math.min(f.r.bottom, k.r.bottom) - Math.max(f.r.top, k.r.top);
        const horiz = cl.every((m) => Math.min(m.r.right, k.r.right) - Math.max(m.r.left, k.r.left) < 0.5 * Math.min(m.r.width, k.r.width));
        if (ov >= 0.5 * Math.min(f.r.height, k.r.height) && horiz) { cl.push(k); placed = true; break; }
      }
      if (!placed) clusters.push([k]);
    }
    if (clusters.every((cl) => cl.length === 1)) groups.push({ parent: prec, kind: 'col', members: kids });
    else for (const cl of clusters) if (cl.length >= 3) groups.push({ parent: prec, kind: 'row', members: cl.sort((a, b) => a.r.left - b.r.left) });
  }

  // ---------- ALIGN ----------
  const canvas = doc.createElement('canvas').getContext('2d');
  const baselineOf = (c: Rec): number | null => {
    if (!canvas) return null;
    for (const n of Array.from(c.el.childNodes)) {
      if (n.nodeType === 3 && (n.textContent || '').trim()) {
        const rg = doc.createRange();
        rg.selectNodeContents(n);
        const rr = rg.getClientRects()[0];
        if (!rr) return null;
        canvas.font = c.cs.fontStyle + ' ' + c.cs.fontWeight + ' ' + c.cs.fontSize + ' ' + c.cs.fontFamily;
        const mt = canvas.measureText('x') as TextMetrics & { fontBoundingBoxAscent?: number };
        return rr.top + (mt.fontBoundingBoxAscent ?? 0);
      }
    }
    return null;
  };
  if (enabled.has('ALIGN')) {
    for (const g of groups) {
      const n = g.members.length;
      const metrics: Record<string, number[]> = {};
      if (g.kind === 'row') {
        metrics.top = g.members.map((m) => m.r.top);
        metrics.centerY = g.members.map((m) => m.r.top + m.r.height / 2);
        metrics.bottom = g.members.map((m) => m.r.bottom);
        const bl = g.members.map(baselineOf);
        if (bl.every((v): v is number => v !== null)) metrics.baseline = bl;
      } else {
        metrics.left = g.members.map((m) => m.r.left);
        metrics.centerX = g.members.map((m) => m.r.left + m.r.width / 2);
        metrics.right = g.members.map((m) => m.r.right);
      }
      const modes: Record<string, { value: number; count: number }> = {};
      for (const k of Object.keys(metrics)) {
        const md = modeOf(metrics[k], t.alignMin);
        if (md.count * 2 > n) modes[k] = md;
      }
      let used = Object.keys(modes);
      if (g.kind === 'col') used = modes.left ? used.filter((k) => k !== 'right') : used;
      if (!used.length) continue;
      g.members.forEach((m, idx) => {
        const offs: Record<string, number> = {};
        for (const k of used) offs[k] = R1(metrics[k][idx] - modes[k].value);
        const devs = used.map((k) => Math.abs(offs[k]));
        if (devs.some((d) => d < t.alignMin)) return; // aligned on at least one valid axis
        const best = Math.min(...devs);
        if (best < t.alignMin || best > t.alignMax) return;
        const key = used[devs.indexOf(best)];
        const firstKey = used[0];
        const shown = g.kind === 'col' && offs[firstKey] !== undefined ? firstKey : key;
        add('ALIGN', Math.abs(offs[shown]) <= 2 ? 'low' : 'medium', m.sel, docRect(m.r),
          (g.kind === 'row' ? 'Row' : 'Column') + ' member is ' + Math.abs(offs[shown]) + ' px off the ' + shown + ' line shared by ' + modes[shown].count + ' of ' + n + ' siblings in ' + g.parent.sel,
          { group: g.parent.sel, axis: g.kind, metric: shown, offset: offs[shown], offsets: offs, groupSize: n });
      });
    }
  }

  // ---------- GAP ----------
  const sigOf = (c: Rec): string =>
    c.el.tagName + '|' + (typeof c.el.className === 'string' ? c.el.className.trim().split(/\s+/).sort().join('.') : '') + '|' + (c.el.getAttribute('type') || '') + '|' + (c.el.getAttribute('role') || '');
  if (enabled.has('GAP')) {
    for (const g of groups) {
      const ms = g.kind === 'row' ? g.members : g.members;
      const pairs: { a: Rec; b: Rec; gap: number }[] = [];
      for (let i = 0; i + 1 < ms.length; i++) {
        const a = ms[i], b = ms[i + 1];
        if (sigOf(a) !== sigOf(b)) continue;
        pairs.push({ a, b, gap: g.kind === 'row' ? b.r.left - a.r.right : b.r.top - a.r.bottom });
      }
      if (pairs.length < 3) continue;
      const med = median(pairs.map((p) => p.gap));
      const agree = pairs.filter((p) => Math.abs(p.gap - med) <= t.gapTol).length;
      if (agree * 2 <= pairs.length) continue;
      for (const p of pairs) {
        const dev = p.gap - med;
        if (Math.abs(dev) <= t.gapTol || p.gap < 0 || p.gap > 3 * med + 8) continue;
        add('GAP', Math.abs(dev) <= 2 ? 'low' : 'medium', p.b.sel, docRect(p.b.r),
          'Gap before this element is ' + R1(p.gap) + ' px, the typical gap in ' + g.parent.sel + ' is ' + R1(med) + ' px (' + (dev > 0 ? '+' : '') + R1(dev) + ')',
          { gap: R1(p.gap), median: R1(med), deviation: R1(dev), previous: p.a.sel, axis: g.kind, group: g.parent.sel });
      }
    }
  }

  // ---------- SIZE_VARIANCE ----------
  if (enabled.has('SIZE_VARIANCE')) {
    for (const prec of [rootRec as Rec | null].concat(list)) {
      if (!prec) continue;
      const bySig = new Map<string, Rec[]>();
      for (const k of prec.kids) {
        if (!k.interactive || !inFlow(k) || isDisabled(k.el)) continue;
        const s = sigOf(k);
        const arr = bySig.get(s);
        if (arr) arr.push(k); else bySig.set(s, [k]);
      }
      bySig.forEach((ms) => {
        if (ms.length < 2) return;
        const lines = (c: Rec): number => {
          const rg = doc.createRange();
          rg.selectNodeContents(c.el);
          return new Set(Array.from(rg.getClientRects()).map((q) => Math.round(q.top))).size;
        };
        if (ms.some((c) => lines(c) > 1 && c.hasText)) return;
        for (const dim of ['height', 'width'] as const) {
          if (dim === 'width' && ms.some((c) => c.hasText)) continue;
          const vals = ms.map((c) => (dim === 'height' ? c.r.height : c.r.width));
          const med = ms.length === 2 ? vals[0] : median(vals);
          ms.forEach((c, i) => {
            if (ms.length === 2 && i === 0) return;
            const dev = vals[i] - med;
            if (Math.abs(dev) <= t.sizeTol || Math.abs(dev) > 0.5 * med) return;
            add('SIZE_VARIANCE', Math.abs(dev) <= 2 ? 'low' : 'medium', c.sel, docRect(c.r),
              'Same-role control is ' + R1(Math.abs(dev)) + ' px ' + (dev < 0 ? 'smaller' : 'larger') + ' in ' + dim + ' than its ' + (ms.length === 2 ? 'sibling' : 'siblings\' median') + ' (' + R1(vals[i]) + ' vs ' + R1(med) + ' px, ' + ms.length + ' like elements in ' + prec.sel + ')',
              { dimension: dim, value: R1(vals[i]), reference: R1(med), deviation: R1(dev), siblings: ms.length, parent: prec.sel });
          });
        }
      });
    }
  }

  // ---------- COLOR_NEAR_MISS ----------
  type Bucket = { c: RGBA; count: number; ex: Rec[] };
  if (enabled.has('COLOR_NEAR_MISS') || enabled.has('FONT_NEAR_MISS') || enabled.has('CONTRAST')) {
    const cats: Record<'text' | 'background' | 'border', Map<string, Bucket>> = { text: new Map(), background: new Map(), border: new Map() };
    const put = (cat: 'text' | 'background' | 'border', col: string, rec: Rec): void => {
      const p = parseColor(col);
      if (!p || p.a < 1) return;
      const key = hex(p);
      const m = cats[cat];
      const b = m.get(key);
      if (b) { b.count++; if (b.ex.length < 3) b.ex.push(rec); } else m.set(key, { c: p, count: 1, ex: [rec] });
    };
    for (const c of list) {
      if (c.hasText) put('text', c.cs.color, c);
      put('background', c.cs.backgroundColor, c);
      for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
        const w = parseFloat(c.cs.getPropertyValue('border-' + side.toLowerCase() + '-width'));
        const st = c.cs.getPropertyValue('border-' + side.toLowerCase() + '-style');
        if (w > 0 && st !== 'none' && st !== 'hidden') { put('border', c.cs.getPropertyValue('border-' + side.toLowerCase() + '-color'), c); break; }
      }
    }
    if (enabled.has('COLOR_NEAR_MISS')) {
      const allowed = arg.allow.map((p) => p.map((s) => { const q = parseColor(s); return q ? hex(q) : s.toLowerCase(); }));
      (Object.keys(cats) as ('text' | 'background' | 'border')[]).forEach((cat) => {
        const entries = Array.from(cats[cat].entries());
        for (let i = 0; i < entries.length; i++) {
          for (let j = i + 1; j < entries.length; j++) {
            const [ka, a] = entries[i], [kb, b] = entries[j];
            const d = dE(a.c, b.c);
            if (d <= 0 || d >= t.colorDeltaE) continue;
            const bothNeutral = chroma(a.c) < t.neutralChroma && chroma(b.c) < t.neutralChroma;
            if (bothNeutral && d >= t.neutralDeltaE) continue; // normal neutral surface ramp step
            if (allowed.some((p) => (p[0] === ka && p[1] === kb) || (p[0] === kb && p[1] === ka))) continue;
            const minor = a.count <= b.count ? a : b;
            add('COLOR_NEAR_MISS', 'low', minor.ex[0].sel, docRect(minor.ex[0].r),
              'Near-miss ' + cat + ' colors ' + ka + ' (' + a.count + 'x) and ' + kb + ' (' + b.count + 'x), deltaE76 ' + R1(d) + ': probably meant to be one color',
              { category: cat, a: ka, b: kb, deltaE: R1(d), countA: a.count, countB: b.count, examplesA: a.ex.map((e) => e.sel), examplesB: b.ex.map((e) => e.sel) });
          }
        }
      });
    }
  }

  // ---------- COLOR_ROLE_VARIANCE ----------
  if (enabled.has('COLOR_ROLE_VARIANCE')) {
    const props = ['color', 'backgroundColor', 'borderTopColor', 'borderTopWidth', 'borderRadius', 'fontFamily', 'fontSize', 'fontWeight'] as const;
    for (const role of Object.keys(arg.roles)) {
      let members: Rec[] = [];
      try {
        members = Array.from(doc.querySelectorAll(arg.roles[role])).map((e) => recs.get(e)).filter((x): x is Rec => !!x && !isDisabled(x.el));
      } catch { /* bad selector */ }
      if (members.length < 2) continue;
      for (const p of props) {
        const by = new Map<string, Rec[]>();
        for (const m of members) {
          const v = m.cs[p] as string;
          const a = by.get(v);
          if (a) a.push(m); else by.set(v, [m]);
        }
        if (by.size < 2) continue;
        const sorted = Array.from(by.entries()).sort((x, y) => y[1].length - x[1].length);
        const minority = sorted[sorted.length - 1][1][0];
        add('COLOR_ROLE_VARIANCE', 'medium', minority.sel, docRect(minority.r),
          'Role "' + role + '": ' + p + ' differs across ' + members.length + ' elements (' + sorted.map((s) => s[0] + ' x' + s[1].length).join(' vs ') + ')',
          { role, property: p, distribution: Object.fromEntries(sorted.map((s) => [s[0], s[1].length])), examples: sorted.map((s) => s[1][0].sel) });
      }
    }
  }

  // ---------- FONT_NEAR_MISS ----------
  if (enabled.has('FONT_NEAR_MISS')) {
    const sizes = new Map<number, { count: number; ex: Rec[] }>();
    const combos = new Set<string>();
    for (const c of list) {
      if (!c.hasText) continue;
      const s = parseFloat(c.cs.fontSize);
      const b = sizes.get(s);
      if (b) { b.count++; if (b.ex.length < 3) b.ex.push(c); } else sizes.set(s, { count: 1, ex: [c] });
      combos.add(c.cs.fontFamily + '|' + c.cs.fontSize + '|' + c.cs.fontWeight);
    }
    stat.fontCombos = combos.size;
    const ks = Array.from(sizes.keys()).sort((a, b) => a - b);
    for (let i = 0; i + 1 < ks.length; i++) {
      const d = ks[i + 1] - ks[i];
      if (d < t.fontNearMin || d > t.fontNearMax) continue;
      const a = sizes.get(ks[i]) as { count: number; ex: Rec[] }, b = sizes.get(ks[i + 1]) as { count: number; ex: Rec[] };
      const minor = a.count <= b.count ? a : b;
      add('FONT_NEAR_MISS', 'low', minor.ex[0].sel, docRect(minor.ex[0].r),
        'Font sizes ' + ks[i] + ' px (' + a.count + 'x) and ' + ks[i + 1] + ' px (' + b.count + 'x) differ by only ' + R1(d) + ' px: probably one size',
        { a: ks[i], b: ks[i + 1], countA: a.count, countB: b.count, examplesA: a.ex.map((e) => e.sel), examplesB: b.ex.map((e) => e.sel) });
    }
    if (combos.size > t.maxFontCombos) {
      const first = list.find((c) => c.hasText);
      if (first) add('FONT_NEAR_MISS', 'low', 'body', docRect(first.r), combos.size + ' distinct family/size/weight combinations (limit ' + t.maxFontCombos + '): type scale is not controlled', { combos: combos.size });
    }
  }

  // ---------- CONTRAST ----------
  if (enabled.has('CONTRAST')) {
    const groupsC = new Map<string, { recs: Rec[]; ratio: number; fg: string; bg: string; need: number }>();
    for (const c of list) {
      if (!c.hasText || isDisabled(c.el)) continue;
      if (!(c.el.textContent || '').trim()) continue;
      let fg = parseColor(c.cs.color);
      if (!fg) { stat.contrastSkipped++; continue; }
      // effective background: composite ancestor layers until opaque
      const layers: RGBA[] = [];
      let unknown = false;
      let cur: Element | null = c.el;
      let opaque = false;
      while (cur) {
        const cs2 = getComputedStyle(cur);
        if (cs2.backgroundImage && cs2.backgroundImage !== 'none') { unknown = true; break; }
        const bg = parseColor(cs2.backgroundColor);
        if (bg && bg.a > 0) { layers.push(bg); if (bg.a >= 1) { opaque = true; break; } }
        cur = cur.parentElement;
      }
      if (unknown) { stat.contrastSkipped++; continue; }
      let base: RGBA = opaque ? layers.pop() as RGBA : { r: 255, g: 255, b: 255, a: 1 };
      while (layers.length) {
        const top = layers.pop() as RGBA;
        base = { r: top.r * top.a + base.r * (1 - top.a), g: top.g * top.a + base.g * (1 - top.a), b: top.b * top.a + base.b * (1 - top.a), a: 1 };
      }
      const alpha = fg.a * c.opacity;
      fg = { r: fg.r * alpha + base.r * (1 - alpha), g: fg.g * alpha + base.g * (1 - alpha), b: fg.b * alpha + base.b * (1 - alpha), a: 1 };
      const l1 = lum(fg), l2 = lum(base);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const size = parseFloat(c.cs.fontSize);
      const large = size >= 24 || (size >= 18.66 && parseInt(c.cs.fontWeight, 10) >= 700);
      const need = large ? t.contrastLarge : t.contrastNormal;
      if (ratio >= need) continue;
      const key = hex(fg) + '|' + hex(base) + '|' + (large ? 'L' : 'N');
      const g = groupsC.get(key);
      if (g) g.recs.push(c); else groupsC.set(key, { recs: [c], ratio, fg: hex(fg), bg: hex(base), need });
    }
    groupsC.forEach((g) => {
      const r = g.ratio;
      const sev: Severity = r < 1.3 ? 'critical' : r < 2.5 ? 'high' : 'medium';
      add('CONTRAST', sev, g.recs[0].sel, docRect(g.recs[0].r),
        'Contrast ' + (Math.round(r * 100) / 100) + ':1 (' + g.fg + ' on ' + g.bg + ') is below the required ' + g.need + ':1; ' + g.recs.length + ' element(s)',
        { ratio: Math.round(r * 100) / 100, required: g.need, foreground: g.fg, background: g.bg, count: g.recs.length, examples: g.recs.slice(0, 3).map((e) => e.sel) });
    });
  }

  // ---------- TAP_TARGET ----------
  if (enabled.has('TAP_TARGET')) {
    type T = { rec: Rec; r: { left: number; top: number; right: number; bottom: number } };
    const targets: T[] = [];
    for (const c of list) {
      if (!c.interactive || isDisabled(c.el)) continue;
      if (c.cs.display === 'inline') {
        const par = c.el.parentElement;
        if (par && (par.textContent || '').trim().length > (c.el.textContent || '').trim().length + 1) continue; // inline-in-sentence exception
      }
      let box = { left: c.r.left, top: c.r.top, right: c.r.right, bottom: c.r.bottom };
      const labels = (c.el as HTMLInputElement).labels;
      if (labels) for (const l of Array.from(labels)) {
        const lr = l.getBoundingClientRect();
        if (lr.width > 0) box = { left: Math.min(box.left, lr.left), top: Math.min(box.top, lr.top), right: Math.max(box.right, lr.right), bottom: Math.max(box.bottom, lr.bottom) };
      }
      targets.push({ rec: c, r: box });
    }
    for (const tg of targets) {
      const w = tg.r.right - tg.r.left, h = tg.r.bottom - tg.r.top;
      const rect = docRect(tg.rec.r);
      if (Math.min(w, h) < t.tapMin - 0.01) {
        // spacing exception (WCAG 2.5.8): a 24 px circle centered on the target touches no other target
        const cx = (tg.r.left + tg.r.right) / 2, cy = (tg.r.top + tg.r.bottom) / 2, rad = t.tapMin / 2;
        const crowded = targets.some((o) => {
          if (o === tg || o.rec.el.contains(tg.rec.el) || tg.rec.el.contains(o.rec.el)) return false;
          const dx = Math.max(o.r.left - cx, 0, cx - o.r.right), dy = Math.max(o.r.top - cy, 0, cy - o.r.bottom);
          return dx * dx + dy * dy < rad * rad;
        });
        if (crowded) {
          add('TAP_TARGET', 'medium', tg.rec.sel, rect, 'Tap target ' + R1(w) + 'x' + R1(h) + ' px is below ' + t.tapMin + 'x' + t.tapMin + ' px (WCAG 2.2 SC 2.5.8) and has no clear spacing around it',
            { width: R1(w), height: R1(h), minimum: t.tapMin, guideline: t.tapGuideline, text: (tg.rec.el.textContent || '').trim().slice(0, 30) });
        } else {
          add('TAP_TARGET', 'info', tg.rec.sel, rect, 'Tap target ' + R1(w) + 'x' + R1(h) + ' px is below ' + t.tapMin + ' px but passes the spacing exception',
            { width: R1(w), height: R1(h), exception: 'spacing' });
        }
      } else if (profile === 'mobile' && Math.min(w, h) < t.tapGuideline - 0.01) {
        add('TAP_TARGET', 'info', tg.rec.sel, rect, 'Tap target ' + R1(w) + 'x' + R1(h) + ' px meets the 24 px minimum but is below the ' + t.tapGuideline + ' px platform guideline',
          { width: R1(w), height: R1(h), guideline: t.tapGuideline });
      }
    }
  }

  return {
    raw,
    viewport: { width: win.innerWidth, height: win.innerHeight, dpr: win.devicePixelRatio },
    stats: { ...stat, profile },
  };
}

/* ------------------------------------------------------------------ */
/* Public API                                                           */
/* ------------------------------------------------------------------ */

/** Scan the current page state. Read-only. Never throws. */
export async function scanLayout(page: Page, opts: ScanOptions = {}): Promise<LayoutResult> {
  const t0 = Date.now();
  const tol: Tolerances = { ...DEFAULTS, ...(opts.tolerances ?? {}) };
  const cap = opts.maxPerCheck ?? DEFAULTS.maxPerCheck;
  const errors: string[] = [];
  const empty: LayoutResult = {
    kind: 'layout',
    viewport: { width: 0, height: 0, dpr: 1 },
    findings: [],
    stats: { elements: 0, interactive: 0, skippedHidden: 0, skippedAnimated: 0, skippedOffCanvas: 0, contrastSkipped: 0, fontCombos: 0, profile: 'desktop', counts: {}, capped: {}, errors, ms: 0 },
  };
  try {
    try { await page.evaluate(() => (document.fonts ? document.fonts.ready.then(() => undefined) : undefined)); } catch (e) { errors.push('fonts.ready: ' + msg(e)); }
    const out = await page.evaluate(browserScan, {
      t: tol,
      checks: opts.checks ?? ALL_CHECKS,
      profile: opts.profile ?? 'auto',
      centerPairs: opts.centerPairs ?? [],
      roles: opts.roles ?? {},
      ignore: opts.ignore ?? [],
      root: opts.root ?? '',
      allow: opts.allowColorPairs ?? [],
    });
    const byCheck = new Map<CheckId, RawFinding[]>();
    for (const f of out.raw) {
      const a = byCheck.get(f.check);
      if (a) a.push(f); else byCheck.set(f.check, [f]);
    }
    const counts: Partial<Record<CheckId, number>> = {};
    const capped: Partial<Record<CheckId, number>> = {};
    const findings: Finding[] = [];
    for (const check of ALL_CHECKS) {
      const items = byCheck.get(check);
      if (!items) continue;
      counts[check] = items.length;
      const sorted = items.map((f, i) => ({ f, i })).sort((a, b) => SEV_RANK[b.f.severity] - SEV_RANK[a.f.severity] || a.i - b.i).map((x) => x.f);
      if (sorted.length > cap) capped[check] = sorted.length - cap;
      sorted.slice(0, cap).forEach((f, i) => findings.push({ id: check + '-' + (i + 1), ...f }));
    }
    return {
      kind: 'layout',
      viewport: out.viewport,
      findings,
      stats: { ...out.stats, counts, capped, errors, ms: Date.now() - t0 },
    };
  } catch (e) {
    errors.push(msg(e));
    empty.stats.ms = Date.now() - t0;
    return empty;
  }
}

export type NamedViewport = { name: string; width: number; height: number };
/** Matrix from references/core/layout-consistency.md (200% zoom = halve the CSS viewport). */
export const DEFAULT_VIEWPORTS: NamedViewport[] = [
  { name: 'phone-small', width: 320, height: 568 },
  { name: 'phone', width: 375, height: 812 },
  { name: 'phone-landscape', width: 812, height: 375 },
  { name: 'phone-large', width: 414, height: 896 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'laptop-scaled', width: 1536, height: 739 },
  { name: 'desktop', width: 1920, height: 1080 },
];

export type ViewportResult = { name: string; result: LayoutResult };
export type ViewportsResult = {
  kind: 'viewports';
  perViewport: ViewportResult[];
  /** check -> viewport name -> number of findings (real count, before the cap) */
  matrix: Partial<Record<CheckId, Record<string, number>>>;
  errors: string[];
  restoredBy: 'setViewportSize' | 'clearDeviceMetricsOverride' | 'none';
};

/**
 * Run scanLayout at every viewport. `prepare(page)` runs after each resize
 * (re-open the state under test: navigate, open the dropdown, wait for data).
 * The original viewport is restored afterwards. Never throws.
 */
export async function scanViewports(
  page: Page,
  prepare: (page: Page) => Promise<void>,
  viewports: NamedViewport[] = DEFAULT_VIEWPORTS,
  opts: ScanOptions = {},
): Promise<ViewportsResult> {
  const errors: string[] = [];
  const perViewport: ViewportResult[] = [];
  const matrix: Partial<Record<CheckId, Record<string, number>>> = {};
  const original = page.viewportSize();
  let restoredBy: ViewportsResult['restoredBy'] = 'none';
  try {
    for (const vp of viewports) {
      try {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await prepare(page);
        await page.evaluate(() => new Promise<void>((res) => requestAnimationFrame(() => requestAnimationFrame(() => res()))));
        const result = await scanLayout(page, opts);
        perViewport.push({ name: vp.name, result });
        for (const check of Object.keys(result.stats.counts) as CheckId[]) {
          const row = matrix[check] ?? (matrix[check] = {});
          row[vp.name] = result.stats.counts[check] ?? 0;
        }
      } catch (e) {
        errors.push(vp.name + ': ' + msg(e));
      }
    }
  } finally {
    try {
      if (original) {
        await page.setViewportSize(original);
        restoredBy = 'setViewportSize';
      } else {
        // CDP-attached or no fixed viewport: drop the emulation instead of pinning a size.
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Emulation.clearDeviceMetricsOverride');
        await cdp.detach().catch(() => undefined);
        restoredBy = 'clearDeviceMetricsOverride';
      }
    } catch (e) {
      errors.push('restore viewport: ' + msg(e));
    }
  }
  return { kind: 'viewports', perViewport, matrix, errors, restoredBy };
}

const SEV_COLOR: Record<Severity, string> = { critical: '#b91c1c', high: '#ea580c', medium: '#ca8a04', low: '#2563eb', info: '#6b7280' };

/**
 * Draw numbered outlines for the findings, screenshot the page, remove the overlay.
 * Returns the legend (number -> finding id) to paste next to the image.
 */
export async function annotateFindings(
  page: Page,
  findings: Finding[],
  outPath: string,
  fullPage = true,
): Promise<{ path: string; legend: { n: number; id: string; check: CheckId; severity: Severity; selector: string; detail: string }[]; error?: string }> {
  const legend = findings.map((f, i) => ({ n: i + 1, id: f.id, check: f.check, severity: f.severity, selector: f.selector, detail: f.detail }));
  const boxes = findings.map((f, i) => ({ n: i + 1, rect: f.rect, color: SEV_COLOR[f.severity] }));
  try {
    await page.evaluate((bs) => {
      const d = document;
      const wrap = d.createElement('div');
      wrap.id = '__layout_scan_overlay';
      wrap.setAttribute('data-layout-ignore', '');
      wrap.style.cssText = 'position:absolute;left:0;top:0;width:' + Math.max(d.documentElement.scrollWidth, d.documentElement.clientWidth) + 'px;height:' + Math.max(d.documentElement.scrollHeight, d.documentElement.clientHeight) + 'px;pointer-events:none;z-index:2147483647;margin:0;padding:0;';
      for (const b of bs) {
        const box = d.createElement('div');
        box.style.cssText = 'position:absolute;box-sizing:border-box;border:2px solid ' + b.color + ';left:' + b.rect.x + 'px;top:' + b.rect.y + 'px;width:' + Math.max(b.rect.w, 4) + 'px;height:' + Math.max(b.rect.h, 4) + 'px;';
        const tag = d.createElement('span');
        tag.textContent = String(b.n);
        tag.style.cssText = 'position:absolute;left:-2px;top:-16px;min-width:16px;height:16px;line-height:16px;text-align:center;font:bold 11px/16px sans-serif;color:#fff;background:' + b.color + ';padding:0 3px;';
        box.appendChild(tag);
        wrap.appendChild(box);
      }
      d.body.appendChild(wrap);
    }, boxes);
    await page.screenshot({ path: outPath, fullPage });
    return { path: outPath, legend };
  } catch (e) {
    return { path: outPath, legend, error: msg(e) };
  } finally {
    try { await page.evaluate(() => { const o = document.getElementById('__layout_scan_overlay'); if (o) o.remove(); }); } catch { /* page gone */ }
  }
}

/* ------------------------------------------------------------------ */
/* Parity: style signatures                                             */
/* ------------------------------------------------------------------ */

export type SigEntry = {
  key: string;
  selector: string;
  tag: string;
  text: string;
  /** Position and size relative to the parent element's box (not the viewport). */
  rel: { x: number; y: number; w: number; h: number };
  color: string;
  background: string;
  borderColor: string;
  borderWidth: number;
  radius: string;
  font: { family: string; size: number; weight: string; lineHeight: string; letterSpacing: string };
  padding: [number, number, number, number];
  margin: [number, number, number, number];
};
export type StyleSignature = { kind: 'signature'; url: string; viewport: ViewportInfo; selector: string; entries: SigEntry[]; error?: string };

/** Capture the style signature of every visible element matching `selector`. Read-only. */
export async function styleSignature(page: Page, selector: string): Promise<StyleSignature> {
  try {
    const out = await page.evaluate((sel: string) => {
      const R1 = (n: number): number => Math.round(n * 10) / 10;
      const four = (cs: CSSStyleDeclaration, p: string): [number, number, number, number] =>
        [parseFloat(cs.getPropertyValue(p + '-top')), parseFloat(cs.getPropertyValue(p + '-right')), parseFloat(cs.getPropertyValue(p + '-bottom')), parseFloat(cs.getPropertyValue(p + '-left'))].map(R1) as [number, number, number, number];
      const pathOf = (el: Element): string => {
        const parts: string[] = [];
        let cur: Element | null = el;
        for (let i = 0; cur && cur !== document.body && i < 3; i++, cur = cur.parentElement) {
          const c: Element = cur;
          const cls = typeof c.className === 'string' ? c.className.trim().split(/\s+/).filter(Boolean)[0] : '';
          parts.unshift(c.id ? '#' + c.id : c.tagName.toLowerCase() + (cls ? '.' + cls : ''));
          if (c.id) break;
        }
        return parts.join(' > ');
      };
      const entries: SigEntry[] = [];
      const seenKeys = new Map<string, number>();
      for (const el of Array.from(document.querySelectorAll(sel))) {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (r.width <= 0 || r.height <= 0 || cs.visibility !== 'visible' || cs.display === 'none') continue;
        const par = el.parentElement ? el.parentElement.getBoundingClientRect() : r;
        const text = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
        const base = el.tagName.toLowerCase() + '|' + (text || (el.getAttribute('aria-label') || el.getAttribute('title') || ''));
        const n = (seenKeys.get(base) ?? 0) + 1;
        seenKeys.set(base, n);
        entries.push({
          key: base + '#' + n,
          selector: pathOf(el),
          tag: el.tagName.toLowerCase(),
          text,
          rel: { x: R1(r.left - par.left), y: R1(r.top - par.top), w: R1(r.width), h: R1(r.height) },
          color: cs.color,
          background: cs.backgroundColor,
          borderColor: cs.borderTopColor,
          borderWidth: R1(parseFloat(cs.borderTopWidth)),
          radius: cs.borderRadius,
          font: { family: cs.fontFamily, size: R1(parseFloat(cs.fontSize)), weight: cs.fontWeight, lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing },
          padding: four(cs, 'padding'),
          margin: four(cs, 'margin'),
        });
      }
      return { entries, viewport: { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio }, url: location.href };
    }, selector);
    return { kind: 'signature', url: out.url, viewport: out.viewport, selector, entries: out.entries };
  } catch (e) {
    return { kind: 'signature', url: '', viewport: { width: 0, height: 0, dpr: 1 }, selector, entries: [], error: msg(e) };
  }
}

export type SigTolerances = {
  /** position/size difference tolerated (px) */
  geometry: number;
  /** font size difference tolerated (px) */
  fontSize: number;
  /** padding/margin difference tolerated (px) */
  spacing: number;
  /** colors closer than this deltaE are the same */
  colorDeltaE: number;
};
export const SIG_DEFAULTS: SigTolerances = { geometry: 2, fontSize: 0.5, spacing: 1, colorDeltaE: 2 };

export type SigDiff = {
  key: string;
  selector: string;
  property: string;
  reference: string;
  underTest: string;
  delta?: number;
  severity: Severity;
};
export type SignatureDiff = {
  kind: 'signature-diff';
  matched: number;
  diffs: SigDiff[];
  onlyInReference: string[];
  onlyUnderTest: string[];
};

const rgbOf = (s: string): [number, number, number, number] | null => {
  const m = /^rgba?\(([^)]+)\)$/.exec(s.trim());
  if (!m) return null;
  const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
  return p.length >= 3 ? [p[0], p[1], p[2], p.length > 3 ? p[3] : 1] : null;
};
const labOf = (c: [number, number, number, number]): [number, number, number] => {
  const lin = (v: number): number => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  const r = lin(c[0]), g = lin(c[1]), b = lin(c[2]);
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047, Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b, Z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (v: number): number => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
};
const colorDelta = (a: string, b: string): number => {
  if (a === b) return 0;
  const x = rgbOf(a), y = rgbOf(b);
  if (!x || !y) return 100;
  if (x[3] === 0 && y[3] === 0) return 0;
  if ((x[3] === 0) !== (y[3] === 0)) return 100;
  const p = labOf(x), q = labOf(y);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
};

/**
 * Compare two signatures of the same screen (reference vs under test).
 * Elements are matched by tag + text (+ occurrence number). Differences beyond
 * tolerance are returned; unmatched elements are listed separately.
 */
export function diffSignatures(reference: StyleSignature, underTest: StyleSignature, tol: Partial<SigTolerances> = {}): SignatureDiff {
  const T: SigTolerances = { ...SIG_DEFAULTS, ...tol };
  const byKey = new Map<string, SigEntry>(underTest.entries.map((e) => [e.key, e]));
  const diffs: SigDiff[] = [];
  const onlyInReference: string[] = [];
  let matched = 0;
  const num = (key: string, selector: string, property: string, a: number, b: number, limit: number): void => {
    const d = Math.round((b - a) * 10) / 10;
    if (Math.abs(d) > limit) diffs.push({ key, selector, property, reference: String(a), underTest: String(b), delta: d, severity: Math.abs(d) <= 2 ? 'low' : 'medium' });
  };
  for (const a of reference.entries) {
    const b = byKey.get(a.key);
    if (!b) { onlyInReference.push(a.key); continue; }
    byKey.delete(a.key);
    matched++;
    const k = a.key, s = b.selector;
    num(k, s, 'rel.x', a.rel.x, b.rel.x, T.geometry);
    num(k, s, 'rel.y', a.rel.y, b.rel.y, T.geometry);
    num(k, s, 'width', a.rel.w, b.rel.w, T.geometry);
    num(k, s, 'height', a.rel.h, b.rel.h, T.geometry);
    num(k, s, 'font-size', a.font.size, b.font.size, T.fontSize);
    for (const [name, x, y] of [['color', a.color, b.color], ['background', a.background, b.background], ['border-color', a.borderColor, b.borderColor]] as [string, string, string][]) {
      const d = colorDelta(x, y);
      if (d > T.colorDeltaE) diffs.push({ key: k, selector: s, property: name, reference: x, underTest: y, delta: Math.round(d * 10) / 10, severity: d < 6 ? 'low' : 'medium' });
    }
    num(k, s, 'border-width', a.borderWidth, b.borderWidth, 0.5);
    if (a.font.weight !== b.font.weight) diffs.push({ key: k, selector: s, property: 'font-weight', reference: a.font.weight, underTest: b.font.weight, severity: 'low' });
    if (a.font.family.split(',')[0].trim() !== b.font.family.split(',')[0].trim()) diffs.push({ key: k, selector: s, property: 'font-family', reference: a.font.family, underTest: b.font.family, severity: 'medium' });
    if (a.radius !== b.radius) diffs.push({ key: k, selector: s, property: 'border-radius', reference: a.radius, underTest: b.radius, severity: 'low' });
    (['top', 'right', 'bottom', 'left'] as const).forEach((side, i) => {
      num(k, s, 'padding-' + side, a.padding[i], b.padding[i], T.spacing);
      num(k, s, 'margin-' + side, a.margin[i], b.margin[i], T.spacing);
    });
  }
  return { kind: 'signature-diff', matched, diffs, onlyInReference, onlyUnderTest: Array.from(byKey.keys()) };
}

/* ------------------------------------------------------------------ */
/* Report                                                               */
/* ------------------------------------------------------------------ */

const cell = (s: string): string => s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const rectStr = (r: Rect): string => r.x + ',' + r.y + ' ' + r.w + 'x' + r.h;

function findingsTable(findings: Finding[]): string[] {
  const out = ['| # | Check | Severity | Element | Rect (x,y wxh) | Detail |', '|---|---|---|---|---|---|'];
  findings.forEach((f, i) => out.push('| ' + (i + 1) + ' | ' + f.check + ' | ' + f.severity + ' | `' + cell(f.selector) + '` | ' + rectStr(f.rect) + ' | ' + cell(f.detail) + ' |'));
  return out;
}

function capNote(stats: ScanStats): string[] {
  const lines: string[] = [];
  for (const k of Object.keys(stats.capped) as CheckId[]) lines.push('- ' + k + ': ' + stats.counts[k] + ' found, ' + stats.capped[k] + ' not listed (cap).');
  return lines;
}

/** Markdown report table for a scan, a viewport matrix or a signature diff. */
export function toMarkdown(result: LayoutResult | ViewportsResult | SignatureDiff): string {
  const out: string[] = [];
  if (result.kind === 'layout') {
    const v = result.viewport, s = result.stats;
    out.push('**Viewport** ' + v.width + 'x' + v.height + ' @' + v.dpr + 'x, profile ' + s.profile + ', ' + s.elements + ' elements scanned (' + s.interactive + ' interactive; skipped: ' + s.skippedHidden + ' hidden, ' + s.skippedAnimated + ' animating, ' + s.skippedOffCanvas + ' off-canvas).', '');
    if (!result.findings.length) out.push('No layout findings.');
    else out.push(...findingsTable(result.findings));
    const notes = capNote(s);
    if (notes.length) out.push('', ...notes);
    if (s.errors.length) out.push('', 'Scanner errors: ' + s.errors.map(cell).join('; '));
    return out.join('\n');
  }
  if (result.kind === 'viewports') {
    const names = result.perViewport.map((p) => p.name);
    out.push('| Check | ' + names.join(' | ') + ' |', '|---|' + names.map(() => '---').join('|') + '|');
    for (const check of ALL_CHECKS) {
      const row = result.matrix[check];
      if (!row) continue;
      out.push('| ' + check + ' | ' + names.map((n) => String(row[n] ?? 0)).join(' | ') + ' |');
    }
    for (const p of result.perViewport) out.push('', '### ' + p.name + ' (' + p.result.viewport.width + 'x' + p.result.viewport.height + ')', '', toMarkdown(p.result));
    if (result.errors.length) out.push('', 'Errors: ' + result.errors.map(cell).join('; '));
    out.push('', 'Viewport restored by: ' + result.restoredBy);
    return out.join('\n');
  }
  out.push('Matched ' + result.matched + ' element(s); ' + result.diffs.length + ' difference(s); ' + result.onlyInReference.length + ' only in reference; ' + result.onlyUnderTest.length + ' only in the side under test.', '');
  if (result.diffs.length) {
    out.push('| Element | Property | Reference | Under test | Delta | Severity |', '|---|---|---|---|---|---|');
    for (const d of result.diffs) out.push('| `' + cell(d.key) + '` | ' + d.property + ' | ' + cell(d.reference) + ' | ' + cell(d.underTest) + ' | ' + (d.delta ?? '') + ' | ' + d.severity + ' |');
  }
  if (result.onlyInReference.length) out.push('', 'Only in reference: ' + result.onlyInReference.slice(0, 25).map((k) => '`' + cell(k) + '`').join(', '));
  if (result.onlyUnderTest.length) out.push('', 'Only under test: ' + result.onlyUnderTest.slice(0, 25).map((k) => '`' + cell(k) + '`').join(', '));
  return out.join('\n');
}
