// Self-test for templates/playwright/rapid-action.ts against a local 127.0.0.1 server.
// Usage: node tools/selftest/run-rapid-selftest.mjs
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startRapidServer } from './rapid-server.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..');
const req = createRequire(join(repo, 'agent', 'package.json'));
const ts = req('typescript');
const { chromium } = req('playwright');

// Compile the real helper into a temp dir outside the repo (no logic duplication).
const src = readFileSync(join(repo, 'templates', 'playwright', 'rapid-action.ts'), 'utf8');
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const tmp = mkdtempSync(join(tmpdir(), 'rapid-selftest-'));
const helperPath = join(tmp, 'rapid-action.mjs');
writeFileSync(helperPath, js);
const { rapidAction, rapidActionRow } = await import(pathToFileURL(helperPath).href);

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

const failures = [];
const check = (ok, text) => {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + text);
  if (!ok) failures.push(text);
};
const server = await startRapidServer();
const browser = await launch();
try {
  const fresh = async (variant) => {
    server.reset(variant);
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    await page.goto(server.origin + '/rapid-' + variant + '.html');
    return page;
  };
  const verify = (variant) => async () => ({ recordCount: server.count(variant) });
  const createOpts = (page, variant, extra = {}) => ({
    trigger: page.locator('#create'),
    request: { method: 'POST', urlPattern: '/api/' + variant + '/items' },
    loadingIndicator: page.locator('#spinner'),
    verify: verify(variant),
    settleMs: 500,
    ...extra,
  });
  const hintsOf = (b) => b.hints.join(',') || 'none';

  // ---- good page: must NOT be flagged ----
  console.log('\n== rapid-good: create (rapidClicks) ==');
  {
    const page = await fresh('good');
    const rep = await rapidAction(page, createOpts(page, 'good'));
    for (const b of rep.bursts) console.log(rapidActionRow('create', b));
    check(rep.errors.length === 0 && rep.bursts.every((b) => b.errors.length === 0), 'good create: no helper errors');
    check(rep.bursts.length === 2, 'good create: two bursts ran');
    for (const b of rep.bursts) {
      check(b.requestsSent === 1, 'good create burst ' + b.burst + ': exactly 1 request (got ' + b.requestsSent + ')');
      check(b.recordDelta === 1, 'good create burst ' + b.burst + ': exactly 1 record created (got ' + b.recordDelta + ')');
      check(b.guardObserved && b.guardFirstAtMs <= 150, 'good create burst ' + b.burst + ': guard seen within 150ms');
      check(b.loadingSeen, 'good create burst ' + b.burst + ': loading indicator seen');
      check(b.guardReleased === true, 'good create burst ' + b.burst + ': guard released after settle');
      check(b.hints.length === 0, 'good create burst ' + b.burst + ': no verdict hints (got ' + hintsOf(b) + ')');
    }
    check(server.state.good.posts === 2, 'good create: server saw 2 POSTs total (got ' + server.state.good.posts + ')');
    await page.close();
  }
  for (const mode of ['doubleClick', 'enterRepeat']) {
    console.log('\n== rapid-good: create (' + mode + ') ==');
    const page = await fresh('good');
    const rep = await rapidAction(page, createOpts(page, 'good', { mode, bursts: [4] }));
    for (const b of rep.bursts) console.log(rapidActionRow('create/' + mode, b));
    const b = rep.bursts[0];
    check(b.requestsSent === 1 && b.recordDelta === 1 && b.hints.length === 0,
      'good ' + mode + ': 1 request, 1 record, no hints (hints: ' + hintsOf(b) + ')');
    await page.close();
  }
  console.log('\n== rapid-good: delete ==');
  {
    const page = await fresh('good');
    const rep = await rapidAction(page, {
      trigger: page.locator('#delete'),
      request: { method: 'DELETE', urlPattern: '/api/good/items/' },
      bursts: [2],
      verify: verify('good'),
    });
    const b = rep.bursts[0];
    console.log(rapidActionRow('delete', b));
    check(b.requestsSent === 1 && !b.hints.includes('SERVER_ERROR_5XX') && b.recordDelta === -1,
      'good delete: 1 DELETE, no 5xx, 1 record removed (hints: ' + hintsOf(b) + ')');
    await page.close();
  }

  // ---- bad page: duplicates must be caught ----
  console.log('\n== rapid-bad: create (rapidClicks) ==');
  {
    const page = await fresh('bad');
    const rep = await rapidAction(page, createOpts(page, 'bad'));
    for (const b of rep.bursts) console.log(rapidActionRow('create', b));
    check(rep.errors.length === 0, 'bad create: no helper errors');
    const [b1, b2] = rep.bursts;
    check(!!b1 && b1.requestsSent === 2 && b1.recordDelta === 2, 'bad create burst 1: 2 requests, 2 records (got ' + b1?.requestsSent + '/' + b1?.recordDelta + ')');
    check(!!b2 && b2.requestsSent === 5 && b2.recordDelta === 5, 'bad create burst 2: 5 requests, 5 records (got ' + b2?.requestsSent + '/' + b2?.recordDelta + ')');
    for (const b of rep.bursts) {
      for (const h of ['MULTI_REQUEST', 'DUPLICATE_RECORDS', 'NO_UI_GUARD', 'NO_LOADING_INDICATOR']) {
        check(b.hints.includes(h), 'bad create burst ' + b.burst + ': hint ' + h);
      }
      check(b.severityHint === 'High', 'bad create burst ' + b.burst + ': severity hint High (got ' + b.severityHint + ')');
    }
    check(server.state.bad.posts === 7, 'bad create: server saw 7 POSTs (got ' + server.state.bad.posts + ')');
    await page.close();
  }
  console.log('\n== rapid-bad: create (doubleClick, enterRepeat) ==');
  for (const [mode, n] of [['doubleClick', 2], ['enterRepeat', 3]]) {
    const page = await fresh('bad');
    const rep = await rapidAction(page, createOpts(page, 'bad', { mode, bursts: [n] }));
    const b = rep.bursts[0];
    console.log(rapidActionRow('create/' + mode, b));
    check(b.requestsSent === n && b.hints.includes('MULTI_REQUEST') && b.hints.includes('DUPLICATE_RECORDS'),
      'bad ' + mode + ': ' + n + ' requests flagged MULTI_REQUEST + DUPLICATE_RECORDS (got ' + b.requestsSent + ': ' + hintsOf(b) + ')');
    await page.close();
  }
  console.log('\n== rapid-bad: delete ==');
  {
    const page = await fresh('bad');
    const rep = await rapidAction(page, {
      trigger: page.locator('#delete'),
      request: { method: 'DELETE', urlPattern: '/api/bad/items/' },
      bursts: [2],
      verify: verify('bad'),
    });
    const b = rep.bursts[0];
    console.log(rapidActionRow('delete', b));
    check(b.requestsSent === 2 && b.hints.includes('SERVER_ERROR_5XX') && b.severityHint === 'High',
      'bad delete: 2 DELETEs, 5xx flagged High (hints: ' + hintsOf(b) + ')');
    await page.close();
  }

  // ---- hard cap ----
  console.log('\n== cap: maxTotalClicks=3 on bad page ==');
  {
    const page = await fresh('bad');
    const rep = await rapidAction(page, createOpts(page, 'bad', { bursts: [2, 5, 10], maxTotalClicks: 3 }));
    for (const b of rep.bursts) console.log(rapidActionRow('create', b));
    check(rep.totalClicks <= 3 && server.state.bad.posts <= 3, 'cap: total clicks ' + rep.totalClicks + ', POSTs ' + server.state.bad.posts + ' (<= 3)');
    check(rep.capped === true, 'cap: report.capped is true');
    await page.close();
  }
} finally {
  await browser.close();
  await server.stop();
}
console.log('');
if (failures.length) {
  console.log('RAPID SELFTEST FAILED');
  for (const f of failures) console.log(' - ' + f);
  process.exit(1);
}
console.log('RAPID SELFTEST PASSED');
