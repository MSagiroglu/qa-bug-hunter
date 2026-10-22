// Self-test for templates/playwright/screen-health-gate.ts, templates/playwright/settle.ts
// and tools/export-diff.mjs. Local 127.0.0.1 server only; the real templates are compiled
// with the agent's TypeScript into a temp dir outside the repo.
// Usage: node tools/selftest/run-health-selftest.mjs
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir, homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..');
const req = createRequire(join(repo, 'agent', 'package.json'));
const ts = req('typescript');
const { chromium } = req('playwright');

const tmp = mkdtempSync(join(tmpdir(), 'health-selftest-'));
async function compile(name) {
  const src = readFileSync(join(repo, 'templates', 'playwright', name + '.ts'), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
  const p = join(tmp, name + '.mjs');
  writeFileSync(p, js);
  return import(pathToFileURL(p).href);
}
const { attachHealthGate, toMarkdown, maskUrl, maskText } = await compile('screen-health-gate');
const { waitForSettled, sampleLayoutTwice } = await compile('settle');

const failures = [];
const check = (ok, text) => {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + text);
  if (!ok) failures.push(text);
};

// ---- tiny local server ----
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAX+XDSwAAAABJRU5ErkJggg==', 'base64');
const server = createServer((rq, rs) => {
  const url = new URL(rq.url, 'http://127.0.0.1');
  const later = (ms, fn) => setTimeout(fn, ms);
  const json = (code, obj) => { rs.writeHead(code, { 'content-type': 'application/json' }); rs.end(JSON.stringify(obj)); };
  const p = url.pathname;
  if (p === '/health-good.html' || p === '/health-bad.html') {
    rs.writeHead(200, { 'content-type': 'text/html' });
    return rs.end(readFileSync(join(here, p.slice(1)), 'utf8'));
  }
  if (p === '/api/ok') return json(200, { ok: true });
  if (p === '/api/save') { rq.resume(); return rq.on('end', () => json(200, { saved: true })); }
  if (p === '/api/err500') return json(500, { error: 'boom' });
  if (p === '/api/slow') return later(4000, () => json(200, { slow: true }));
  if (p === '/late.png') return later(1300, () => { rs.writeHead(200, { 'content-type': 'image/png' }); rs.end(PNG); });
  if (p === '/late.woff2') return later(1200, () => { rs.writeHead(200, { 'content-type': 'font/woff2' }); rs.end(Buffer.from('not a font')); });
  return json(404, { error: 'not found' });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = 'http://127.0.0.1:' + server.address().port;

async function launch() {
  try {
    return await chromium.launch({ headless: true });
  } catch {
    const root = join(homedir(), '.qa-bug-hunter', 'playwright');
    if (existsSync(root) && readdirSync(root).some((d) => d.startsWith('chromium'))) process.env.PLAYWRIGHT_BROWSERS_PATH = root;
    return chromium.launch({ headless: true });
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const merge = (snaps, f) => snaps.flatMap(f);

const browser = await launch();
try {
  // ================= masking unit checks =================
  console.log('\n== masking ==');
  check(maskUrl('http://x.test/a/b?token=abc&id=5#frag') === '/a/b?token=*&id=*', 'maskUrl drops host, fragment and query values (' + maskUrl('http://x.test/a/b?token=abc&id=5#frag') + ')');
  check(maskUrl('http://x.test/files/' + 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4') === '/files/:tok', 'maskUrl masks token-like path segment');
  check(!/abc123/.test(maskText('Authorization: Bearer abc123 and cookie=abc123 and ?x=abc123')), 'maskText hides bearer, cookie and query secrets');

  // ================= gate: bad page =================
  console.log('\n== gate: health-bad.html ==');
  {
    const page = await browser.newPage();
    const gate = attachHealthGate(page);
    gate.start();
    await page.goto(origin + '/health-bad.html');
    await sleep(1700);
    const early = gate.snapshot('bad: early');
    await sleep(3200);
    const late = gate.snapshot('bad: late');
    const all = [early, late];
    const consoleErr = merge(all, (s) => s.console.filter((c) => c.type === 'error'));
    check(consoleErr.some((c) => /seeded console error/.test(c.text)), 'console.error recorded');
    check(merge(all, (s) => s.pageErrors).some((e) => /seeded uncaught exception/.test(e.text)), 'uncaught exception recorded');
    check(merge(all, (s) => s.httpFailures).some((h) => h.status === 500 && /\/api\/err500/.test(h.path)), 'HTTP 500 recorded');
    check(merge(all, (s) => s.httpFailures).some((h) => h.status === 404 && h.path === '/api/missing'), 'HTTP 404 recorded');
    check(merge(all, (s) => s.slow).some((x) => x.path === '/api/slow' && x.ms >= 3000), 'slow 4 s endpoint recorded over the 3000 ms default');
    check(merge(all, (s) => s.duplicates).some((d) => d.method === 'POST' && d.path === '/api/save' && d.count >= 2), 'duplicate POST within 200 ms recorded');
    check(early.unfinished.some((u) => u.path === '/api/slow'), 'request still pending at snapshot reported as unfinished');
    check(!late.unfinished.some((u) => u.path === '/api/slow'), 'unfinished clears after the request finished');
    check(early.summary.errors >= 2 && merge(all, (s) => [s.summary.httpFailures]).reduce((a, b) => a + b, 0) >= 2, 'summary counts errors and http failures');
    const dump = JSON.stringify(all) + toMarkdown(early) + toMarkdown(late);
    check(!/secret123/.test(dump), 'query/console secret (secret123) not present in any snapshot output');
    check(!/topsecretbody/.test(dump), 'request body (topsecretbody) not present in any snapshot output');
    check(/Health: bad: late/.test(toMarkdown(late)), 'toMarkdown renders');
    console.log(toMarkdown(early).split('\n').map((l) => '    ' + l).join('\n'));

    // stop() removes every listener
    const before = typeof page.listenerCount === 'function' ? ['console', 'pageerror', 'request', 'response', 'requestfinished', 'requestfailed'].reduce((n, e) => n + page.listenerCount(e), 0) : null;
    gate.stop();
    gate.stop();
    const after = typeof page.listenerCount === 'function' ? ['console', 'pageerror', 'request', 'response', 'requestfinished', 'requestfailed'].reduce((n, e) => n + page.listenerCount(e), 0) : null;
    if (before !== null) check(before >= 6 && after === 0, `stop() removed all listeners (${before} -> ${after})`);
    await page.evaluate(() => console.error('after stop'));
    await sleep(100);
    const post = gate.snapshot('after stop');
    check(post.console.length === 0 && post.summary.counts.requests === 0, 'nothing recorded after stop()');
    await page.close();
  }

  // ================= gate: good page =================
  console.log('\n== gate: health-good.html ==');
  {
    const page = await browser.newPage();
    const gate = attachHealthGate(page);
    gate.start();
    await page.goto(origin + '/health-good.html');
    await page.waitForFunction(() => document.getElementById('status').textContent === 'Ready');
    await sleep(1200);
    const s = gate.snapshot('good');
    console.log('    ' + JSON.stringify(s.summary));
    check(s.summary.errors === 0 && s.summary.httpFailures === 0 && s.summary.slow === 0 && s.summary.duplicates === 0 && s.summary.counts.unfinished === 0, 'good page: no errors, http failures, slow, duplicates, unfinished');
    check(s.console.length === 0 && s.pageErrors.length === 0, 'good page: no console output flagged');
    check(s.summary.counts.requests >= 4, 'good page: requests were observed (' + s.summary.counts.requests + ')');
    gate.stop();
    await page.close();
  }

  // ================= settle =================
  console.log('\n== settle ==');
  {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    await page.goto(origin + '/health-bad.html', { waitUntil: 'domcontentloaded' });
    const t0 = await waitForSettled(page, { timeoutMs: 300 });
    console.log('    t=0   ' + JSON.stringify(t0));
    check(t0.settled === false && /^timeout:/.test(t0.reason), 'bad page unsettled at t=0 (' + t0.reason + ')');
    const diff = await sampleLayoutTwice(page);
    check(diff.stable === false && diff.changed.length > 0, 'sampleLayoutTwice reports movement while animating (' + diff.changed.length + ' changed)');
    const later = await waitForSettled(page);
    console.log('    later ' + JSON.stringify(later));
    check(later.settled === true && later.reason === 'ok', 'bad page settled later (waited ' + later.waitedMs + ' ms)');
    check(later.waitedMs < 7000, 'settle returned before the hard timeout');
    const diff2 = await sampleLayoutTwice(page);
    check(diff2.stable === true, 'sampleLayoutTwice stable after settle');
    await page.close();
  }
  {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    await page.goto(origin + '/health-good.html');
    await page.waitForFunction(() => document.getElementById('status').textContent === 'Ready');
    const r = await waitForSettled(page);
    console.log('    good  ' + JSON.stringify(r));
    check(r.settled === true && r.waitedMs < 1500, 'good page settled immediately (' + r.waitedMs + ' ms), infinite spinner ignored');
    const d = await sampleLayoutTwice(page);
    check(d.stable === true, 'good page layout stable');
    await page.close();
  }
  {
    // Hard timeout returns, never throws, and does not hang.
    const page = await browser.newPage();
    await page.goto(origin + '/health-bad.html', { waitUntil: 'domcontentloaded' });
    const t = Date.now();
    let threw = false, r;
    try { r = await waitForSettled(page, { timeoutMs: 400 }); } catch { threw = true; }
    check(!threw && r && r.settled === false && Date.now() - t < 2500, 'hard timeout returns instead of throwing');
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

// ================= export-diff =================
console.log('\n== export-diff ==');
{
  const cli = join(repo, 'tools', 'export-diff.mjs');
  const run = (args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  const A = [
    'id,Name,Amount,Date,Note',
    '1,Alice,10.5,2024-03-05,"a, ""b"""',
    '2,Bob,"1,234.50",2024-03-06,',
    '3,Carol,7,2024-03-07,line1',
    '4,Dan,8,2024-03-08,über',
    '5,Eve,9,2024-03-09,y',
    '',
  ].join('\n');
  const B = [
    'ID,Name,Amount,Date,Note',
    '1,Alice,"10,5",05.03.2024,"a, ""b"""',
    '2,Bob ,"1.234,50",2024-03-06',
    '3,Carol,7,2024-03-07,line1<br>',
    '4,Dan,8,2024-03-08,Ã¼ber',
    '',
  ].join('\r\n');
  const fa = join(tmp, 'a.csv'), fb = join(tmp, 'b.csv');
  writeFileSync(fa, A);
  writeFileSync(fb, '﻿' + B);
  const r = run([fa, fb, '--key', 'id', '--json']);
  check(r.status === 1, 'seeded differences: exit code 1 (got ' + r.status + ')');
  let j = null;
  try { j = JSON.parse(r.stdout); } catch { /* reported below */ }
  check(!!j, 'json output parses');
  if (j) {
    const has = (type, row, colPrefix) => j.cellDiffs.some((c) => c.type === type && String(c.row) === String(row) && (!colPrefix || c.column.startsWith(colPrefix)));
    check(j.headerDiffs.some((h) => h.type === 'case' && h.a === 'id' && h.b === 'ID'), 'header case difference reported (id vs ID)');
    check(has('number-format', 2, 'C'), 'decimal dot vs comma reported at row 2, col C');
    check(has('number-format', 3, 'C'), 'thousand/decimal separator swap reported at row 3, col C');
    check(has('date-format', 2, 'D'), 'date pattern difference reported at row 2, col D');
    check(has('whitespace', 3, 'B'), 'trailing space reported at row 3, col B');
    check(has('html-markup', 4, 'E'), 'html <br> in cell reported at row 4, col E');
    check(has('encoding', 5, 'E'), 'mojibake difference reported at row 5, col E');
    check(has('empty-vs-missing', 3, 'E'), 'empty vs missing cell reported at row 3, col E');
    check(j.rowDiffs.some((d) => d.type === 'missing-in-B' && d.row === 6), 'missing row reported (row 6 missing in B)');
    check(j.rowCount.a === 5 && j.rowCount.b === 4, 'row count difference reported (5 vs 4)');
    check(j.findings.some((f) => f.side === 'B' && f.kind === 'html-tag') && j.findings.some((f) => f.side === 'B' && f.kind === 'mojibake'), 'in-file findings: html tag and mojibake in B');
    check(!j.cellDiffs.some((c) => String(c.row) === '2' && c.column.startsWith('E')), 'quoted comma/quote cell parsed identically (no false cell diff)');
  }
  const t = run([fa, fb, '--key', 'id', '--trim', '--json']);
  const jt = JSON.parse(t.stdout);
  check(!jt.cellDiffs.some((c) => c.type === 'whitespace'), '--trim removes the whitespace difference');
  const ig = JSON.parse(run([fa, fb, '--key', '1', '--ignore-cols', '3,4,5', '--json']).stdout);
  check(!ig.cellDiffs.some((c) => /^[CDE] /.test(c.column)), '--ignore-cols 3,4,5 silences those columns');

  // identical after normalization (BOM + CRLF + semicolon-free) exits 0
  const fc = join(tmp, 'c.csv');
  writeFileSync(fc, '﻿' + A.replace(/\n/g, '\r\n'));
  const same = run([fa, fc]);
  check(same.status === 0, 'identical content with BOM and CRLF: exit 0 (got ' + same.status + ')');
  const same2 = run([fa, fa, '--key', 'id']);
  check(same2.status === 0, 'same file with key: exit 0');
  // delimiter auto-detect: semicolon file vs same content with commas
  const fd = join(tmp, 'd.csv');
  writeFileSync(fd, 'id;Name\n1;"x;y"\n');
  const fe = join(tmp, 'e.csv');
  writeFileSync(fe, 'id,Name\n1,"x;y"\n');
  check(run([fd, fe]).status === 0, 'semicolon vs comma delimiter auto-detected, same content: exit 0');
  // usage and xlsx
  check(run([]).status === 2, 'no arguments: exit 2');
  check(run([fa, fb, '--key', 'nope']).status === 2, 'unknown key column: exit 2');
  const fx = join(tmp, 'x.xlsx');
  writeFileSync(fx, Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]));
  const x = run([fx, fa]);
  check(x.status === 2 && /convert/i.test(x.stderr), 'xlsx: exit 2 with conversion message');
}

rmSync(tmp, { recursive: true, force: true });
console.log('');
if (failures.length) {
  console.log('HEALTH SELFTEST FAILED');
  for (const f of failures) console.log(' - ' + f);
  process.exit(1);
}
console.log('HEALTH SELFTEST PASSED');
