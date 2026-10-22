/**
 * Markdown renderers for scanner (layout) and observer (health) results.
 * Everything here is a CANDIDATE: measured or observed leads that need confirmation.
 */
const NL = '\n';

const cell = (v: unknown): string => String(v ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

const measured = (r: { detail: string; values?: Record<string, unknown> }): string => {
  const vals = r.values
    ? Object.entries(r.values).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join(', ')
    : '';
  return cell(vals ? `${r.detail} [${vals}]` : r.detail);
};

/** Layout findings: per-viewport counts, then one row per finding. */
export function renderLayoutDetails(d: any): string {
  const vps: any[] = d.viewports ?? [];
  const out: string[] = [];
  out.push('**Layout findings (candidates from the measuring scanner; confirm before filing):**', '');
  out.push('| Viewport | Status | Elements | Findings above info | Info | Worst | Screenshot |');
  out.push('|----------|--------|----------|---------------------|------|-------|------------|');
  for (const v of vps) {
    const status = v.status === 'unsettled' ? `unsettled (${cell(v.settleReason)}), not compared` : 'scanned';
    out.push(`| ${v.viewport} | ${status} | ${v.elements} | ${v.nonInfo} | ${v.info} | ${v.worst} | ${v.screenshot ?? ''} |`);
  }
  out.push('');
  const rows = vps.flatMap((v) => (v.rows ?? []).map((r: any) => ({ v: v.viewport, ...r })));
  if (rows.length) {
    out.push('| Viewport | Check | Severity | Selector | Measured values |');
    out.push('|----------|-------|----------|----------|-----------------|');
    for (const r of rows) {
      const sev = r.scannerSeverity !== r.severity ? `${r.severity} (scanner: ${r.scannerSeverity})` : r.severity;
      out.push(`| ${r.v} | ${r.check} | ${sev} | \`${cell(r.selector)}\` | ${measured(r)} |`);
    }
    out.push('');
  }
  for (const v of vps) if (v.rowsOmitted > 0) out.push(`- ${v.viewport}: ${v.rowsOmitted} more finding(s) not listed (lower severity).`);
  return out.join(NL) + NL + NL;
}

/** Health summary: counts per segment, then the individual leads. */
export function renderHealthDetails(d: any): string {
  const segs: any[] = d.segments ?? [];
  const out: string[] = [];
  out.push('**Health summary (observed events are leads; classify before filing):**', '');
  if (d.settled === false) out.push(`- Page did not settle (${cell(d.settleReason)}); observations may be incomplete.`, '');
  out.push('| Segment | Requests | Console errors | Uncaught | HTTP 4xx | HTTP 5xx | Failed | Slow | Duplicates | Unfinished |');
  out.push('|---------|----------|----------------|----------|----------|----------|--------|------|------------|------------|');
  for (const s of segs) {
    const c = s.summary.counts;
    out.push(`| ${cell(s.label)} | ${c.requests} | ${c.consoleErrors} | ${c.pageErrors} | ${c.http4xx} | ${c.http5xx} | ${c.failedRequests} | ${s.summary.slow} | ${s.summary.duplicates} | ${c.unfinished} |`);
  }
  out.push('');
  for (const s of segs) {
    const lines: string[] = [];
    for (const e of s.pageErrors ?? []) lines.push(`- uncaught exception x${e.count}: ${cell(e.text)}`);
    for (const e of (s.console ?? []).filter((x: any) => x.type === 'error')) lines.push(`- console error x${e.count}: ${cell(e.text)}${e.where ? ` (${cell(e.where)})` : ''}`);
    for (const h of s.httpFailures ?? []) lines.push(`- HTTP ${h.status} ${h.method} ${cell(h.path)} x${h.count}`);
    for (const f of (s.failedRequests ?? []).filter((x: any) => !x.aborted)) lines.push(`- failed request ${f.method} ${cell(f.path)}: ${cell(f.errorText)} x${f.count}`);
    for (const x of s.slow ?? []) lines.push(`- slow ${x.method} ${cell(x.path)}: ${x.ms} ms`);
    for (const x of s.duplicates ?? []) lines.push(`- duplicate ${x.method} ${cell(x.path)} x${x.count}, min gap ${x.minGapMs} ms${x.hasBody ? ', same body' : ''}`);
    for (const x of s.unfinished ?? []) lines.push(`- never finished ${x.method} ${cell(x.path)} (pending ${x.ageMs} ms)`);
    if (lines.length) out.push(`Segment "${cell(s.label)}":`, ...lines, '');
  }
  return out.join(NL) + NL;
}
