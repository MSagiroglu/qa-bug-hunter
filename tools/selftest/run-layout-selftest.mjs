// Self-test for templates/playwright/layout-scan.ts against two local pages (file://).
// Usage: node tools/selftest/run-layout-selftest.mjs
// Exit 0 = every seeded defect found and the good page is clean (nothing above 'info').
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..');
const req = createRequire(join(repo, 'agent', 'package.json'));
const ts = req('typescript');
const { chromium } = req('playwright');

// Compile the real template into a temp dir outside the repo (no logic duplication).
const src = readFileSync(join(repo, 'templates', 'playwright', 'layout-scan.ts'), 'utf8');
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const tmp = mkdtempSync(join(tmpdir(), 'layout-selftest-'));
const helperPath = join(tmp, 'layout-scan.mjs');
writeFileSync(helperPath, js);
const L = await import(pathToFileURL(helperPath).href);

async function launch() {
  try {
    return await chromium.launch({ headless: true });
  } catch (e1) {
    const root = join(homedir(), '.qa-bug-hunter', 'playwright');
    if (existsSync(root) && readdirSync(root).some((d) => d.startsWith('chromium'))) {
      process.env.PLAYWRIGHT_BROWSERS_PATH = root;
    }
    return chromium.launch({ headless: true });
  }
}

const SCAN_OPTS = { roles: { primary: '[data-role="primary"]' } };
const PHONE = [
  { name: 'phone-375x812', width: 375, height: 812 },
  { name: 'phone-landscape-812x375', width: 812, height: 375 },
];

// Seeded defects: where = which run must report it. 'desktop' = 1280x800, 'phone' = 375x812.
const SEEDED = [
  { id: 'D01 horizontal scroll', check: 'HSCROLL', where: 'phone', match: () => true },
  { id: 'D02 element beyond viewport', check: 'OFFSCREEN', where: 'phone', match: (f) => f.selector.includes('hscroll-box') },
  { id: 'D03 child overflows container', check: 'CONTAINER_OVERFLOW', where: 'desktop', match: (f) => f.selector.includes('card-child') },
  { id: 'D04 icon 4 px off center', check: 'CENTER', where: 'desktop', match: (f) => f.selector.includes('icon-off') },
  { id: 'D05 form field 3 px misaligned', check: 'ALIGN', where: 'desktop', match: (f) => f.selector.includes('field-offset') },
  { id: 'D06 one uneven gap (16 among 8)', check: 'GAP', where: 'desktop', match: (f) => f.selector.includes('chip-gap') },
  { id: 'D07 near-miss primary colors', check: 'COLOR_NEAR_MISS', where: 'desktop', match: (f) => JSON.stringify(f.values).includes('#2564ee') },
  { id: 'D08 role variance (primary)', check: 'COLOR_ROLE_VARIANCE', where: 'desktop', match: (f) => f.values && f.values.role === 'primary' && f.values.property === 'backgroundColor' },
  { id: 'D09 toolbar button 6 px shorter', check: 'SIZE_VARIANCE', where: 'desktop', match: (f) => f.selector.includes('btn-short') },
  { id: 'D10 16x16 tap target', check: 'TAP_TARGET', where: 'desktop', match: (f) => f.selector.includes('tiny-btn') && f.severity !== 'info' },
  { id: 'D11 low-contrast text (#999 on #fff)', check: 'CONTRAST', where: 'desktop', match: (f) => f.selector.includes('low-contrast') },
  { id: 'D12 overlapping controls', check: 'OVERLAP', where: 'desktop', match: (f) => f.selector.includes('ov-a') || f.selector.includes('ov-b') },
  { id: 'D13 truncated label', check: 'CLIPPED_TEXT', where: 'desktop', match: (f) => f.selector.includes('trunc') },
  { id: 'D14 plain-div round box, icon 5 px low', check: 'CENTER', where: 'desktop', match: (f) => f.selector.includes('round-off') },
];

const failures = [];
const rows = [];
const browser = await launch();
const runs = {};
try {
  for (const name of ['good', 'bad', 'legit']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const url = pathToFileURL(join(here, `layout-${name}.html`)).href;
    await page.goto(url);
    const before = await page.evaluate(() => document.documentElement.outerHTML);
    const desktop = await L.scanLayout(page, SCAN_OPTS);
    const vps = await L.scanViewports(page, async (p) => { await p.goto(url); }, PHONE, SCAN_OPTS);
    const after = await page.evaluate(() => document.documentElement.outerHTML);
    runs[name] = { desktop, vps, page, url, readOnly: before === after };
  }

  // ---- seeded defects on the bad page ----
  const bad = runs.bad;
  const phone = bad.vps.perViewport.find((p) => p.name === 'phone-375x812');
  console.log('\n== layout-bad.html: seeded defects ==');
  for (const d of SEEDED) {
    const res = d.where === 'phone' ? phone && phone.result : bad.desktop;
    const hit = res ? res.findings.find((f) => f.check === d.check && d.match(f)) : null;
    rows.push({ pass: !!hit, text: `${d.id}  [${d.check} @ ${d.where}]  ${hit ? hit.severity + ': ' + hit.detail.slice(0, 90) : 'NOT DETECTED'}` });
    if (!hit) failures.push(`bad page: defect not detected: ${d.id} (${d.check})`);
  }
  for (const r of rows) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.text}`);
  if (bad.desktop.stats.errors.length) failures.push('bad page scanner errors: ' + bad.desktop.stats.errors.join('; '));

  // ---- good page must be clean (nothing above info) in every viewport ----
  const good = runs.good;
  for (const pageName of ['good', 'legit']) {
    const pr = runs[pageName];
    console.log(`\n== layout-${pageName}.html: must have no finding above info ==`);
    const pageRuns = [['desktop-1280x800', pr.desktop], ...pr.vps.perViewport.map((p) => [p.name, p.result])];
    for (const [name, res] of pageRuns) {
      const bad2 = res.findings.filter((f) => f.severity !== 'info');
      console.log(`${bad2.length ? 'FAIL' : 'PASS'}  ${pageName} ${name}: ${res.stats.elements} elements, ${res.findings.length} finding(s), ${bad2.length} above info`);
      for (const f of bad2) { console.log(`        ${f.check} ${f.severity} ${f.selector}: ${f.detail}`); failures.push(`${pageName} page false positive @${name}: ${f.check} ${f.selector}`); }
      if (res.stats.errors.length) failures.push(`${pageName} page scanner errors @${name}: ` + res.stats.errors.join('; '));
      if (res.stats.elements < 20) failures.push(`${pageName} page @${name}: only ${res.stats.elements} elements scanned (scanner not working?)`);
    }
  }
  if (good.vps.errors.length || bad.vps.errors.length || runs.legit.vps.errors.length) failures.push('scanViewports errors: ' + [...good.vps.errors, ...bad.vps.errors, ...runs.legit.vps.errors].join('; '));

  // ---- helpers around the scanner ----
  console.log('\n== helpers ==');
  const check = (ok, text) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${text}`); if (!ok) failures.push('helper: ' + text); };
  check(good.readOnly && bad.readOnly, 'scanLayout + scanViewports leave the DOM unchanged (read-only)');
  check(bad.vps.restoredBy === 'setViewportSize' && JSON.stringify(await bad.page.viewportSize()) === JSON.stringify({ width: 1280, height: 800 }), 'scanViewports restores the original viewport');
  const png = join(tmp, 'annotated.png');
  const ann = await L.annotateFindings(bad.page, bad.desktop.findings.slice(0, 8), png);
  const left = await bad.page.evaluate(() => !!document.getElementById('__layout_scan_overlay'));
  check(!ann.error && existsSync(png) && statSync(png).size > 1000 && !left && ann.legend.length > 0, `annotateFindings writes a screenshot and removes its overlay (${existsSync(png) ? statSync(png).size : 0} bytes)`);
  const sg = await L.styleSignature(good.page, '.btn, .chip');
  const sb = await L.styleSignature(bad.page, '.btn, .chip');
  const diff = L.diffSignatures(sg, sb, { colorDeltaE: 0.3 });
  check(sg.entries.length > 5 && diff.matched > 5, `styleSignature matched ${diff.matched} elements across good and bad`);
  check(diff.diffs.some((d) => d.property === 'height' && d.key.includes('Export')), 'diffSignatures reports the 6 px shorter button');
  check(diff.diffs.some((d) => d.property === 'background' && d.key.includes('Publish')), 'diffSignatures reports the near-miss background (deltaE tolerance 0.3)');
  const same = L.diffSignatures(sg, await L.styleSignature(good.page, '.btn, .chip'));
  check(same.diffs.length === 0 && same.onlyInReference.length === 0, 'diffSignatures of a page against itself is empty');
  const md = L.toMarkdown(bad.desktop) + L.toMarkdown(bad.vps) + L.toMarkdown(diff);
  check(md.includes('| Check |') && md.includes('HSCROLL') && md.includes('Reference'), 'toMarkdown renders layout, viewport and signature tables');
  const capped = await L.scanLayout(bad.page, { ...SCAN_OPTS, maxPerCheck: 1 });
  check(capped.findings.length <= 14 && Object.keys(capped.stats.counts).length > 5, 'maxPerCheck caps rows but stats.counts keeps real totals');

  for (const r of Object.values(runs)) await r.page.close();
} finally {
  await browser.close();
}
console.log('');
if (failures.length) {
  console.log('SELFTEST FAILED');
  for (const f of failures) console.log(' - ' + f);
  process.exit(1);
}
console.log('SELFTEST PASSED');
