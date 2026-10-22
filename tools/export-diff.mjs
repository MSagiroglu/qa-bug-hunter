#!/usr/bin/env node
// Compare two CSV/TSV exports. Zero dependencies, read-only.
// Usage: node tools/export-diff.mjs <fileA> <fileB> [--key <colIndexOrName>] [--ignore-cols 1,3] [--trim] [--json] [--delimiter ,]
// Columns are 1-based. Exit: 0 identical after normalization, 1 differences, 2 usage error.
import { diffFiles, formatReport } from './export-diff-lib.mjs';

const usage = 'usage: node tools/export-diff.mjs <fileA> <fileB> [--key <colIndexOrName>] [--ignore-cols 1,3] [--trim] [--json] [--delimiter <char>]';
const args = process.argv.slice(2);
const files = [];
const opts = { ignoreCols: [], trim: false };
let json = false;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--key') opts.key = args[++i];
  else if (a === '--ignore-cols') opts.ignoreCols = String(args[++i] ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  else if (a === '--trim') opts.trim = true;
  else if (a === '--json') json = true;
  else if (a === '--delimiter') { const d = args[++i]; opts.delimiter = d === 'tab' ? '\t' : d; }
  else if (a === '-h' || a === '--help') { console.log(usage); process.exit(0); }
  else if (a.startsWith('--')) { console.error('unknown option ' + a + '\n' + usage); process.exit(2); }
  else files.push(a);
}
if (files.length !== 2 || (args.includes('--key') && !opts.key)) { console.error(usage); process.exit(2); }
try {
  const res = diffFiles(files[0], files[1], opts);
  console.log(json ? JSON.stringify(res, null, 2) : formatReport(res, files[0], files[1]));
  process.exit(res.identical ? 0 : 1);
} catch (e) {
  console.error((e && e.code === 'XLSX' ? 'xlsx: ' : 'error: ') + (e && e.message ? e.message : e));
  process.exit(2);
}
