/**
 * Screen health gate (see references/core/screen-health-and-export.md).
 *
 * Passive, read-only observer. Attach it to a page, work normally, call
 * `snapshot('screen or step name')` after each screen/step. Each snapshot
 * covers everything seen since the previous snapshot and starts a new segment.
 *
 * Records per segment: console errors and warnings (deduped, allowlist),
 * uncaught page errors, failed requests (network errors), HTTP 4xx/5xx,
 * slow responses over a budget, DUPLICATE requests (same method + normalized
 * URL + same body hash inside a window), and requests that never finished.
 *
 * SAFE TO ATTACH to a page opened over CDP to a user's browser: it only uses
 * `page.on` / `page.off` (no routing, no init scripts, no request
 * interception, no extra CDP session) and `stop()` removes every listener.
 *
 * PRIVACY: headers are never read. Query-string values are replaced by `*`,
 * token-looking path segments by `:tok`, secrets in console text are masked.
 * Request and response bodies are never stored: only a short FNV-1a hash of
 * the request body is kept in memory to detect duplicates, and it is not
 * included in snapshots.
 *
 * A hit is a LEAD, not a verdict: classify it (see the reference).
 */
import type { Page, Request, Response, ConsoleMessage } from '@playwright/test';

export type HealthGateOptions = {
  /** Responses slower than this (request start to finished) are reported. Default 3000. */
  slowMs?: number;
  /** Same method + URL + body inside this window is a duplicate. Default 1000. */
  duplicateWindowMs?: number;
  /** Console text matching any of these is ignored (errors and warnings). */
  ignoreConsole?: RegExp[];
  /** Requests whose masked path matches are ignored everywhere (for example analytics beacons). */
  ignoreUrl?: RegExp[];
  /** Resource types considered for duplicate / slow / unfinished checks. Default document, xhr, fetch. */
  resourceTypes?: string[];
  /** A request still pending at snapshot time is reported after this age. Default 1000. */
  unfinishedMinMs?: number;
  /** Cap per list per snapshot. Default 50. */
  maxPerList?: number;
};

export type ConsoleEntry = { type: 'error' | 'warning'; text: string; count: number; where: string };
export type PageErrorEntry = { text: string; count: number };
export type FailedRequest = { method: string; path: string; errorText: string; aborted: boolean; count: number };
export type HttpFailure = { method: string; path: string; status: number; count: number };
export type SlowRequest = { method: string; path: string; status: number | null; ms: number };
export type DuplicateRequest = { method: string; path: string; count: number; minGapMs: number; hasBody: boolean };
export type UnfinishedRequest = { method: string; path: string; ageMs: number };

export type HealthSummary = {
  /** console errors + page errors + failed requests (aborted navigations excluded). */
  errors: number;
  httpFailures: number;
  slow: number;
  duplicates: number;
  counts: {
    requests: number;
    consoleErrors: number;
    consoleWarnings: number;
    pageErrors: number;
    failedRequests: number;
    http4xx: number;
    http5xx: number;
    unfinished: number;
  };
};

export type HealthSnapshot = {
  label: string;
  startedAt: string;
  endedAt: string;
  console: ConsoleEntry[];
  pageErrors: PageErrorEntry[];
  failedRequests: FailedRequest[];
  httpFailures: HttpFailure[];
  slow: SlowRequest[];
  duplicates: DuplicateRequest[];
  unfinished: UnfinishedRequest[];
  summary: HealthSummary;
  /** True when lists were cut by maxPerList. */
  truncated: boolean;
};

export type HealthGate = {
  /** Begin recording (idempotent). Also resets the current segment. */
  start(): void;
  /** Close the current segment, return it, and begin a new one. */
  snapshot(label: string): HealthSnapshot;
  /** Remove every listener. Safe to call twice. The gate can be started again. */
  stop(): void;
  /** Snapshots taken so far, in order. */
  readonly snapshots: HealthSnapshot[];
};

// ---------- masking and hashing ----------

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

const TOKEN_SEGMENT = /^(?=.*\d)[A-Za-z0-9_-]{24,}$/;
const GUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Path only, query values replaced by `*`, token-like path segments by `:tok`. No host, no fragment. */
export function maskUrl(raw: string): string {
  let path = raw;
  let query = '';
  try {
    const u = new URL(raw);
    path = u.pathname;
    query = u.search;
  } catch {
    const q = raw.indexOf('?');
    if (q >= 0) {
      path = raw.slice(0, q);
      query = raw.slice(q);
    }
    path = path.replace(/^[a-z]+:\/\/[^/]*/i, '');
  }
  const segs = path.split('/').map((s) => (TOKEN_SEGMENT.test(s) && !GUID_SEGMENT.test(s) ? ':tok' : s));
  const keys: string[] = [];
  if (query.length > 1) {
    for (const part of query.slice(1).split('&')) {
      if (!part) continue;
      const k = part.split('=')[0];
      keys.push(k + '=*');
    }
  }
  return segs.join('/') + (keys.length ? '?' + keys.join('&') : '');
}

/** Masks secrets inside free text (console messages, error messages). */
export function maskText(text: string, max = 300): string {
  let t = text
    .replace(/Bearer\s+[A-Za-z0-9._~+\/=-]+/gi, 'Bearer ***')
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g, '***jwt***')
    .replace(
      /(authorization|cookie|set-cookie|password|passwd|secret|api[-_]?key|access[-_]?token|refresh[-_]?token|token|csrf|xsrf|__RequestVerificationToken)(["']?\s*[:=]\s*["']?)([^\s"'&;,}]+)/gi,
      '$1$2***',
    )
    .replace(/([?&][^=&\s#"']+=)[^&\s#"']*/g, '$1*');
  if (t.length > max) t = t.slice(0, max) + '...';
  return t;
}

// ---------- the gate ----------

type Segment = {
  startedAt: number;
  console: Map<string, ConsoleEntry>;
  pageErrors: Map<string, PageErrorEntry>;
  failed: Map<string, FailedRequest>;
  http: Map<string, HttpFailure>;
  slow: SlowRequest[];
  dup: Map<string, DuplicateRequest>;
  requests: number;
};

type Pending = { method: string; path: string; startedAt: number; considered: boolean };

export function attachHealthGate(page: Page, opts: HealthGateOptions = {}): HealthGate {
  const slowMs = opts.slowMs ?? 3000;
  const dupWindow = opts.duplicateWindowMs ?? 1000;
  const ignoreConsole = opts.ignoreConsole ?? [];
  const ignoreUrl = opts.ignoreUrl ?? [];
  const types = new Set(opts.resourceTypes ?? ['document', 'xhr', 'fetch']);
  const unfinishedMin = opts.unfinishedMinMs ?? 1000;
  const cap = opts.maxPerList ?? 50;

  const snapshots: HealthSnapshot[] = [];
  const pending = new Map<Request, Pending>();
  const lastSeen = new Map<string, number>();
  let seg: Segment = newSegment();
  let running = false;

  function newSegment(): Segment {
    return {
      startedAt: Date.now(),
      console: new Map(),
      pageErrors: new Map(),
      failed: new Map(),
      http: new Map(),
      slow: [],
      dup: new Map(),
      requests: 0,
    };
  }

  const ignored = (path: string): boolean => ignoreUrl.some((re) => re.test(path));

  const onConsole = (msg: ConsoleMessage): void => {
    try {
      const t = msg.type();
      if (t !== 'error' && t !== 'warning') return;
      const raw = msg.text();
      if (ignoreConsole.some((re) => re.test(raw))) return;
      const text = maskText(raw);
      let where = '';
      try {
        const loc = msg.location();
        where = loc.url ? maskUrl(loc.url) + (loc.lineNumber >= 0 ? ':' + loc.lineNumber : '') : '';
      } catch { /* location is optional */ }
      const type = t === 'error' ? 'error' : 'warning';
      const key = type + '|' + text;
      const hit = seg.console.get(key);
      if (hit) hit.count++;
      else seg.console.set(key, { type, text, count: 1, where });
    } catch { /* never break the page under test */ }
  };

  const onPageError = (err: Error): void => {
    try {
      const raw = String(err && err.message ? err.message : err);
      if (ignoreConsole.some((re) => re.test(raw))) return;
      const text = maskText(raw);
      const hit = seg.pageErrors.get(text);
      if (hit) hit.count++;
      else seg.pageErrors.set(text, { text, count: 1 });
    } catch { /* ignore */ }
  };

  const onRequest = (req: Request): void => {
    try {
      const path = maskUrl(req.url());
      if (ignored(path)) return;
      const method = req.method();
      const considered = types.has(req.resourceType());
      const now = Date.now();
      seg.requests++;
      pending.set(req, { method, path, startedAt: now, considered });
      if (!considered) return;
      let body = '';
      try { body = req.postData() ?? ''; } catch { /* streamed body */ }
      let q = '';
      try { q = new URL(req.url()).search; } catch { /* relative */ }
      const key = method + '|' + path + '|' + fnv1a(q) + '|' + (body ? fnv1a(body) : '');
      const prev = lastSeen.get(key);
      lastSeen.set(key, now);
      if (prev !== undefined && now - prev <= dupWindow) {
        const gap = now - prev;
        const dkey = method + '|' + path + '|' + (body ? 'b' : '');
        const hit = seg.dup.get(dkey);
        if (hit) {
          hit.count++;
          hit.minGapMs = Math.min(hit.minGapMs, gap);
        } else {
          seg.dup.set(dkey, { method, path, count: 2, minGapMs: gap, hasBody: !!body });
        }
      }
    } catch { /* ignore */ }
  };

  const onResponse = (res: Response): void => {
    try {
      const status = res.status();
      if (status < 400) return;
      const req = res.request();
      const path = maskUrl(res.url());
      if (ignored(path)) return;
      const key = req.method() + '|' + path + '|' + status;
      const hit = seg.http.get(key);
      if (hit) hit.count++;
      else seg.http.set(key, { method: req.method(), path, status, count: 1 });
    } catch { /* ignore */ }
  };

  const onFinished = (req: Request): void => {
    try {
      const p = pending.get(req);
      pending.delete(req);
      if (!p || !p.considered) return;
      const ms = Date.now() - p.startedAt;
      if (ms > slowMs) {
        const entry: SlowRequest = { method: p.method, path: p.path, status: null, ms };
        seg.slow.push(entry);
        // Response is already settled when requestfinished fires; the read is cheap.
        void req.response().then((r) => { entry.status = r ? r.status() : null; }).catch(() => undefined);
      }
    } catch { /* ignore */ }
  };

  const onFailed = (req: Request): void => {
    try {
      const p = pending.get(req);
      pending.delete(req);
      const path = p ? p.path : maskUrl(req.url());
      if (ignored(path)) return;
      const errorText = (req.failure()?.errorText ?? 'unknown').replace(/\s+/g, ' ');
      const aborted = /ERR_ABORTED|NS_BINDING_ABORTED|cancel/i.test(errorText);
      const key = req.method() + '|' + path + '|' + errorText;
      const hit = seg.failed.get(key);
      if (hit) hit.count++;
      else seg.failed.set(key, { method: req.method(), path, errorText, aborted, count: 1 });
    } catch { /* ignore */ }
  };

  function start(): void {
    if (running) return;
    running = true;
    seg = newSegment();
    page.on('console', onConsole);
    page.on('pageerror', onPageError);
    page.on('request', onRequest);
    page.on('response', onResponse);
    page.on('requestfinished', onFinished);
    page.on('requestfailed', onFailed);
  }

  function stop(): void {
    if (!running) return;
    running = false;
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    page.off('request', onRequest);
    page.off('response', onResponse);
    page.off('requestfinished', onFinished);
    page.off('requestfailed', onFailed);
    pending.clear();
    lastSeen.clear();
  }

  function snapshot(label: string): HealthSnapshot {
    const now = Date.now();
    let truncated = false;
    const cut = <T,>(a: T[]): T[] => {
      if (a.length > cap) {
        truncated = true;
        return a.slice(0, cap);
      }
      return a;
    };
    const consoleAll = [...seg.console.values()];
    const failedAll = [...seg.failed.values()];
    const httpAll = [...seg.http.values()];
    const unfinishedAll: UnfinishedRequest[] = [];
    for (const p of pending.values()) {
      if (p.considered && now - p.startedAt >= unfinishedMin) {
        unfinishedAll.push({ method: p.method, path: p.path, ageMs: now - p.startedAt });
      }
    }
    const consoleErrors = consoleAll.filter((c) => c.type === 'error').reduce((n, c) => n + c.count, 0);
    const consoleWarnings = consoleAll.filter((c) => c.type === 'warning').reduce((n, c) => n + c.count, 0);
    const pageErrorCount = [...seg.pageErrors.values()].reduce((n, c) => n + c.count, 0);
    const realFailed = failedAll.filter((f) => !f.aborted).reduce((n, f) => n + f.count, 0);
    const http4xx = httpAll.filter((h) => h.status < 500).reduce((n, h) => n + h.count, 0);
    const http5xx = httpAll.filter((h) => h.status >= 500).reduce((n, h) => n + h.count, 0);
    const dups = [...seg.dup.values()];

    const snap: HealthSnapshot = {
      label,
      startedAt: new Date(seg.startedAt).toISOString(),
      endedAt: new Date(now).toISOString(),
      console: cut(consoleAll),
      pageErrors: cut([...seg.pageErrors.values()]),
      failedRequests: cut(failedAll),
      httpFailures: cut(httpAll),
      slow: cut(seg.slow.slice()),
      duplicates: cut(dups),
      unfinished: cut(unfinishedAll),
      summary: {
        errors: consoleErrors + pageErrorCount + realFailed,
        httpFailures: http4xx + http5xx,
        slow: seg.slow.length,
        duplicates: dups.length,
        counts: {
          requests: seg.requests,
          consoleErrors,
          consoleWarnings,
          pageErrors: pageErrorCount,
          failedRequests: realFailed,
          http4xx,
          http5xx,
          unfinished: unfinishedAll.length,
        },
      },
      truncated,
    };
    snapshots.push(snap);
    seg = newSegment();
    return snap;
  }

  return { start, snapshot, stop, snapshots };
}

/** Compact Markdown for evidence files. Contains no bodies, headers or query values. */
export function toMarkdown(s: HealthSnapshot): string {
  const c = s.summary.counts;
  const out: string[] = [];
  out.push(`### Health: ${s.label}`);
  out.push(
    `errors ${s.summary.errors} | http failures ${s.summary.httpFailures} (4xx ${c.http4xx}, 5xx ${c.http5xx}) | slow ${s.summary.slow} | duplicates ${s.summary.duplicates} | unfinished ${c.unfinished} | requests ${c.requests} | console warnings ${c.consoleWarnings}`,
  );
  if (s.pageErrors.length) out.push('', 'Uncaught page errors:', ...s.pageErrors.map((e) => `- x${e.count} ${e.text}`));
  const ce = s.console.filter((e) => e.type === 'error');
  if (ce.length) out.push('', 'Console errors:', ...ce.map((e) => `- x${e.count} ${e.text}${e.where ? ' (' + e.where + ')' : ''}`));
  const cw = s.console.filter((e) => e.type === 'warning');
  if (cw.length) out.push('', 'Console warnings:', ...cw.map((e) => `- x${e.count} ${e.text}`));
  if (s.httpFailures.length) out.push('', 'HTTP failures:', ...s.httpFailures.map((h) => `- ${h.status} ${h.method} ${h.path} x${h.count}`));
  if (s.failedRequests.length) {
    out.push('', 'Failed requests:', ...s.failedRequests.map((f) => `- ${f.method} ${f.path} ${f.errorText}${f.aborted ? ' (aborted, not counted)' : ''} x${f.count}`));
  }
  if (s.slow.length) out.push('', 'Slow responses:', ...s.slow.map((x) => `- ${x.method} ${x.path} ${x.ms} ms`));
  if (s.duplicates.length) {
    out.push('', 'Duplicate requests (lead: classify before reporting):', ...s.duplicates.map((d) => `- ${d.method} ${d.path} x${d.count}, min gap ${d.minGapMs} ms${d.hasBody ? ', same body' : ''}`));
  }
  if (s.unfinished.length) out.push('', 'Never finished at snapshot:', ...s.unfinished.map((u) => `- ${u.method} ${u.path} pending ${u.ageMs} ms`));
  if (s.truncated) out.push('', '(lists truncated)');
  return out.join('\n') + '\n';
}
