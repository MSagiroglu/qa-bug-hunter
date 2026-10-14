import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CJK = /[　-鿿가-힯＀-￯]/;

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.md')) out.push(p);
  }
  return out;
}

const files = ['SKILL.md', 'ENFORCEMENT.md'].map((f) => join(root, f)).filter(existsSync);
const refs = join(root, 'references');
if (existsSync(refs)) files.push(...walk(refs));

let findings = 0;
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split(/\r?\n/);
  const rel = relative(root, f).split(String.fromCharCode(92)).join('/');
  lines.forEach((l, i) => {
    if (CJK.test(l)) { console.log(`${rel}:${i + 1}: CJK: ${l.trim().slice(0, 100)}`); findings++; }
    if (i > 0 && /^\s*- \[ \]/.test(l) && l === lines[i - 1]) { console.log(`${rel}:${i + 1}: duplicate checklist line: ${l.trim()}`); findings++; }
  });
}
console.log(`${findings} finding(s)`);
process.exit(findings ? 1 : 0);
