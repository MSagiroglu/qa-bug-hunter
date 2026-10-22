// Copies the skill's Playwright templates into src/lib/vendor/ so the agent compiles the
// current implementations instead of keeping a second copy of the logic.
// Only change to each file: a generated-file header comment. Run by `prebuild`.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const agentDir = resolve(here, '..');
const templatesDir = resolve(agentDir, '..', 'templates', 'playwright');
const outDir = join(agentDir, 'src', 'lib', 'vendor');
const FILES = ['layout-scan.ts', 'settle.ts', 'screen-health-gate.ts'];

mkdirSync(outDir, { recursive: true });
for (const name of FILES) {
  const from = join(templatesDir, name);
  if (!existsSync(from)) {
    console.error(`sync-templates: missing template ${from}`);
    process.exit(1);
  }
  const header = `// GENERATED FILE - DO NOT EDIT. Copied from templates/playwright/${name} by agent/scripts/sync-templates.mjs.\n// Edit the template and run \`npm run build\` (prebuild re-syncs). This directory is git-ignored.\n`;
  writeFileSync(join(outDir, name), header + readFileSync(from, 'utf8'));
  console.log(`sync-templates: ${name} -> src/lib/vendor/${name}`);
}
