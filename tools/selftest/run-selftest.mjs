// Self-test for templates/playwright/overlay-invariants.ts against local demo pages.
// Usage: node tools/selftest/run-selftest.mjs
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..');
const req = createRequire(join(repo, 'agent', 'package.json'));
const ts = req('typescript');
const { chromium } = req('playwright');

// Compile the real helper into a temp dir outside the repo (no logic duplication).
const src = readFileSync(join(repo, 'templates', 'playwright', 'overlay-invariants.ts'), 'utf8');
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const tmp = mkdtempSync(join(tmpdir(), 'ov-selftest-'));
const helperPath = join(tmp, 'overlay-invariants.mjs');
writeFileSync(helperPath, js);
const { assertOverlayInvariants } = await import(pathToFileURL(helperPath).href);

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

const REQUIRED_BAD = ['OV1', 'OV3', 'OV4', 'OV6', 'OV7', 'OV10'];
const GOOD_IDS = ['OV1', 'OV2', 'OV3', 'OV4', 'OV6', 'OV7', 'OV10', 'OV2-restore'];
const failures = [];
const browser = await launch();
try {
  for (const name of ['good-modal', 'bad-modal']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(pathToFileURL(join(here, name + '.html')).href);
    const results = await assertOverlayInvariants(page, {
      dialog: page.locator('.modal'),
      trigger: page.locator('#open-btn'),
      close: page.locator('#close-btn'),
    });
    console.log(`\n== ${name} ==`);
    for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.id}  ${r.detail ?? ''}`);
    const byId = new Map(results.map((r) => [r.id, r]));
    if (name === 'good-modal') {
      for (const r of results) if (!r.pass) failures.push(`good-modal false-flagged ${r.id}: ${r.detail}`);
      for (const id of GOOD_IDS) if (!byId.has(id)) failures.push(`good-modal: missing result ${id}`);
      const ov6 = byId.get('OV6');
      if (ov6 && ov6.detail && ov6.detail.startsWith('n/a')) failures.push('good-modal: OV6 was n/a (page not scrollable)');
    } else {
      if (byId.has('ERR')) failures.push(`bad-modal: helper error: ${byId.get('ERR').detail}`);
      for (const id of REQUIRED_BAD) {
        const r = byId.get(id);
        if (!r) failures.push(`bad-modal: no result for ${id}`);
        else if (r.pass) failures.push(`bad-modal: defect ${id} NOT detected`);
      }
    }
    await page.close();
  }
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
