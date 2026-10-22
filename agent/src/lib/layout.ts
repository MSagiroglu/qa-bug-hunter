import * as fs from 'fs';
import * as path from 'path';
import type { Page } from 'playwright';
import type { TestResult, TestSuite } from './executor.js';
import { scanViewports, annotateFindings, type NamedViewport, type Finding, type CheckId, type ScanOptions } from './vendor/layout-scan.js';
import { waitForSettled, type SettleResult } from './vendor/settle.js';

/** Default matrix (CSS px). Override with `--viewports 375x812,1280x800`. */
export const LAYOUT_VIEWPORTS: NamedViewport[] = [
  { name: '375x812', width: 375, height: 812 },
  { name: '812x375', width: 812, height: 375 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1920x1080', width: 1920, height: 1080 },
];

export function parseViewports(spec?: string): NamedViewport[] {
  if (!spec || !spec.trim()) return LAYOUT_VIEWPORTS;
  return spec.split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
    const m = /^(\d{2,5})x(\d{2,5})$/i.exec(s);
    if (!m) throw new Error(`Invalid --viewports entry "${s}" (expected WIDTHxHEIGHT, e.g. 375x812)`);
    return { name: `${m[1]}x${m[2]}`, width: Number(m[1]), height: Number(m[2]) };
  });
}

type Sev = 'critical' | 'high' | 'medium' | 'low' | 'info';
const RANK: Record<Sev, number> = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };
const HIGH_ALLOWED = new Set<CheckId>(['HSCROLL', 'OFFSCREEN', 'OVERLAP']);

/**
 * Scanner findings are heuristic candidates. Nothing is reported above `high`, and only
 * HSCROLL / OFFSCREEN / OVERLAP may reach `high`; every other check is capped at `medium`.
 */
export function reportedSeverity(f: Pick<Finding, 'check' | 'severity'>): Sev {
  const cap: Sev = HIGH_ALLOWED.has(f.check) ? 'high' : 'medium';
  return RANK[f.severity] > RANK[cap] ? cap : f.severity;
}

export interface LayoutRow {
  check: string;
  severity: Sev;
  scannerSeverity: Sev;
  selector: string;
  detail: string;
  values?: Record<string, unknown>;
}
export interface LayoutViewportDetail {
  viewport: string;
  width: number;
  height: number;
  status: 'scanned' | 'unsettled';
  settleReason: string;
  elements: number;
  counts: Record<string, number>;
  nonInfo: number;
  info: number;
  worst: Sev | 'none';
  screenshot?: string;
  rows: LayoutRow[];
  rowsOmitted: number;
  errors: string[];
}
export interface LayoutDetails {
  kind: 'layout-matrix';
  candidates: true;
  viewports: LayoutViewportDetail[];
}

const MAX_ROWS_PER_VIEWPORT = 40;

/** Pages can declare `data-role="x"`; elements of one role must look alike (COLOR_ROLE_VARIANCE). */
async function discoverRoles(page: Page): Promise<Record<string, string>> {
  try {
    const names = await page.evaluate(() =>
      Array.from(new Set(Array.from(document.querySelectorAll('[data-role]')).map((e) => e.getAttribute('data-role') || '').filter(Boolean))).slice(0, 12));
    return Object.fromEntries(names.map((n) => [n, `[data-role="${n.replace(/"/g, '\\"')}"]`]));
  } catch {
    return {};
  }
}

export async function runLayoutScan(
  page: Page,
  url: string,
  viewports: NamedViewport[],
  evidenceDir = './evidence/layout',
): Promise<{ details: LayoutDetails; settledCount: number }> {
  const settleByViewport = new Map<string, SettleResult>();
  const key = (w: number, h: number): string => `${w}x${h}`;
  const prepare = async (p: Page): Promise<void> => {
    await p.goto(url, { waitUntil: 'load' }).catch(() => undefined);
    const s = await waitForSettled(p);
    const vp = p.viewportSize();
    if (vp) settleByViewport.set(key(vp.width, vp.height), s);
  };

  await page.goto(url, { waitUntil: 'load' }).catch(() => undefined);
  const scanOpts: ScanOptions = { roles: await discoverRoles(page) };
  const res = await scanViewports(page, prepare, viewports, scanOpts);

  fs.mkdirSync(evidenceDir, { recursive: true });
  const out: LayoutViewportDetail[] = [];
  for (const vp of viewports) {
    const settle = settleByViewport.get(key(vp.width, vp.height));
    const per = res.perViewport.find((p) => p.name === vp.name);
    const base = { viewport: vp.name, width: vp.width, height: vp.height };
    if (!per) {
      out.push({ ...base, status: 'unsettled', settleReason: 'scan error: ' + (res.errors.find((e) => e.startsWith(vp.name)) ?? 'no result'), elements: 0, counts: {}, nonInfo: 0, info: 0, worst: 'none', rows: [], rowsOmitted: 0, errors: res.errors });
      continue;
    }
    if (!settle || !settle.settled) {
      out.push({ ...base, status: 'unsettled', settleReason: settle ? settle.reason : 'no settle result', elements: per.result.stats.elements, counts: {}, nonInfo: 0, info: 0, worst: 'none', rows: [], rowsOmitted: 0, errors: [] });
      continue;
    }
    const all = per.result.findings;
    const real = all.filter((f) => reportedSeverity(f) !== 'info');
    const sorted = real.slice().sort((a, b) => RANK[reportedSeverity(b)] - RANK[reportedSeverity(a)]);
    const rows: LayoutRow[] = sorted.slice(0, MAX_ROWS_PER_VIEWPORT).map((f) => ({
      check: f.check,
      severity: reportedSeverity(f),
      scannerSeverity: f.severity,
      selector: f.selector,
      detail: f.detail,
      values: f.values,
    }));
    const counts: Record<string, number> = {};
    for (const [c, n] of Object.entries(per.result.stats.counts)) counts[c] = n ?? 0;
    out.push({
      ...base,
      status: 'scanned',
      settleReason: settle.reason,
      elements: per.result.stats.elements,
      counts,
      nonInfo: real.length,
      info: all.length - real.length,
      worst: sorted.length ? reportedSeverity(sorted[0]) : 'none',
      rows,
      rowsOmitted: Math.max(0, sorted.length - rows.length),
      errors: per.result.stats.errors,
    });
  }

  // One annotated screenshot per viewport that has findings: re-open the state at that
  // viewport, settle, draw the worst findings, restore the viewport.
  const original = page.viewportSize();
  try {
    for (const d of out) {
      if (d.status !== 'scanned' || d.nonInfo === 0) continue;
      const per = res.perViewport.find((p) => p.name === d.viewport)!;
      const worst = per.result.findings
        .filter((f) => reportedSeverity(f) !== 'info')
        .sort((a, b) => RANK[reportedSeverity(b)] - RANK[reportedSeverity(a)])
        .slice(0, 12);
      await page.setViewportSize({ width: d.width, height: d.height });
      await prepare(page);
      const file = path.join(evidenceDir, `layout-${d.viewport}.png`);
      const ann = await annotateFindings(page, worst, file);
      if (!ann.error) d.screenshot = `evidence/layout/layout-${d.viewport}.png`;
    }
  } catch {
    // screenshots are evidence only; never fail the scan because of them
  } finally {
    if (original) await page.setViewportSize(original).catch(() => undefined);
  }
  return { details: { kind: 'layout-matrix', candidates: true, viewports: out }, settledCount: out.filter((o) => o.status === 'scanned').length };
}

export function createLayoutSuite(url: string, viewports: NamedViewport[]): TestSuite {
  return {
    name: 'Layout Consistency (measured)',
    testCases: [
      {
        id: 'LAY-001',
        name: 'Layout consistency across viewports (overflow, overlap, alignment, gaps, color/size drift, contrast, tap targets)',
        category: 'responsive',
        description: 'Settle, measure each viewport with the layout scanner, annotate the worst findings',
        execute: async (page: Page): Promise<TestResult> => {
          const { details, settledCount } = await runLayoutScan(page, url, viewports);
          const unsettled = details.viewports.filter((v) => v.status === 'unsettled');
          const scanned = details.viewports.filter((v) => v.status === 'scanned');
          const nonInfo = scanned.reduce((n, v) => n + v.nonInfo, 0);
          const worst = scanned.reduce<Sev>((w, v) => (v.worst !== 'none' && RANK[v.worst] > RANK[w] ? v.worst : w), 'info');
          const unsettledText = unsettled.length
            ? ` Unsettled (not compared): ${unsettled.map((v) => `${v.viewport} (${v.settleReason})`).join(', ')}.`
            : '';
          const evidence = scanned.map((v) => v.screenshot).filter((s): s is string => !!s);
          const perVp = scanned.map((v) => `${v.viewport}: ${v.nonInfo}`).join(', ');
          if (settledCount === 0) {
            return {
              testCaseId: 'LAY-001',
              status: 'warning',
              message: `unsettled: no viewport reached a stable state, layout not measured.${unsettledText}`,
              evidence,
              oracle: 'layout-consistency (measured)',
              confidence: 'low',
              details,
            };
          }
          if (nonInfo === 0) {
            return {
              testCaseId: 'LAY-001',
              status: 'pass',
              message: `No layout candidates above info in ${settledCount} viewport(s).${unsettledText}`,
              evidence,
              oracle: 'layout-consistency (measured)',
              confidence: 'medium',
              details,
            };
          }
          const sev = (worst === 'critical' ? 'high' : worst) as 'high' | 'medium' | 'low';
          const hardGeometry = scanned.some((v) => v.rows.some((r) => r.severity === 'high' && (r.check === 'HSCROLL' || r.check === 'OFFSCREEN')));
          return {
            testCaseId: 'LAY-001',
            status: RANK[sev] >= RANK.medium ? 'fail' : 'warning',
            severity: sev,
            message: `Candidates (scanner findings, confirm before filing): ${nonInfo} layout finding(s) above info; worst ${sev}. Per viewport: ${perVp}.${unsettledText}`,
            evidence,
            oracle: 'layout-consistency (measured)',
            confidence: sev === 'high' ? (hardGeometry ? 'high' : 'medium') : sev === 'medium' ? 'medium' : 'low',
            details,
          };
        },
      },
    ],
  };
}
