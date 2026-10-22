// Logic for tools/export-diff.mjs. Plain Node ESM, zero dependencies, read-only.
// Compares two delimited exports (CSV/TSV) and reports what a person would miss:
// header drift, cell differences, number/date format differences, stray whitespace,
// HTML tags or entities inside cells, mojibake, empty vs missing.
import { readFileSync } from 'node:fs';

// ---------- reading ----------

/** Decode bytes: UTF-8 (BOM stripped), UTF-16 LE/BE by BOM, else latin1 with a flag. */
export function decodeBuffer(buf) {
  let encoding = 'utf-8';
  let bom = false;
  let text;
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    encoding = 'utf-16le'; bom = true; text = new TextDecoder('utf-16le').decode(buf.subarray(2));
  } else if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    encoding = 'utf-16be'; bom = true; text = new TextDecoder('utf-16be').decode(buf.subarray(2));
  } else {
    let b = buf;
    if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) { bom = true; b = buf.subarray(3); }
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(b); }
    catch { encoding = 'latin1 (not valid UTF-8)'; text = new TextDecoder('latin1').decode(b); }
  }
  return { text, encoding, bom };
}

/** Pick the delimiter that is most consistent across the first lines (quotes respected). */
export function detectDelimiter(text) {
  const candidates = [',', ';', '\t', '|'];
  const lines = [];
  let cur = '', inQ = false;
  for (const ch of text) {
    if (ch === '"') inQ = !inQ;
    if ((ch === '\n') && !inQ) { lines.push(cur); cur = ''; if (lines.length >= 10) break; continue; }
    cur += ch;
  }
  if (cur && lines.length < 10) lines.push(cur);
  let best = ',', bestScore = -1;
  for (const d of candidates) {
    const counts = lines.map((l) => { let n = 0, q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === d && !q) n++; } return n; }).filter((_, i) => lines[i].trim() !== '');
    if (!counts.length || counts[0] === 0) continue;
    const consistent = counts.filter((c) => c === counts[0]).length;
    const score = consistent * 1000 + counts[0];
    if (score > bestScore) { bestScore = score; best = d; }
  }
  return best;
}

/** RFC 4180 parser: quoted fields, doubled quotes, embedded newlines, CRLF or LF. */
export function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [], field = '', inQ = false, i = 0, sawAny = false;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQ = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"' && field === '') { inQ = true; sawAny = true; i++; continue; }
    if (ch === delimiter) { row.push(field); field = ''; sawAny = true; i++; continue; }
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      i++;
      row.push(field); field = '';
      rows.push(row); row = []; sawAny = false;
      continue;
    }
    field += ch; sawAny = true; i++;
  }
  if (sawAny || field !== '' || row.length) { row.push(field); rows.push(row); }
  // Drop fully empty trailing lines (a single empty cell).
  while (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') rows.pop();
  return rows;
}

export function readTable(path, delimiterOverride) {
  const buf = readFileSync(path);
  if (/\.xlsx?$/i.test(path) || (buf.length > 3 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04)) {
    const e = new Error(XLSX_MESSAGE);
    e.code = 'XLSX';
    throw e;
  }
  const { text, encoding, bom } = decodeBuffer(buf);
  const delimiter = delimiterOverride || detectDelimiter(text);
  const rows = parseDelimited(text, delimiter);
  return { path, encoding, bom, delimiter, rows };
}

export const XLSX_MESSAGE =
  'xlsx/xls files are not read by this tool. Convert each file to CSV (UTF-8) first, with the same settings on both sides, then diff the CSVs. ' +
  'Safe ways: open the file in a spreadsheet application and use "Save As" CSV UTF-8 (the CSV keeps the DISPLAYED text of each cell, which is what you want to compare), or run a headless converter on a copy, ' +
  'for example: soffice --headless --convert-to csv --outdir <empty-folder> <copy-of-file>.xlsx. Never open untrusted workbooks with macros enabled. See references/core/screen-health-and-export.md.';

// ---------- per-cell analysis ----------

const HTML_TAG = /<\/?[a-z][a-z0-9-]*(\s[^<>]*)?\/?>/i;
const HTML_ENTITY = /&(lt|gt|amp|nbsp|quot|apos|#\d{1,6}|#x[0-9a-f]{1,6});/i;
const MOJIBAKE = /Ã[\u0080-¿]|Â[\u0080-¿ ]|â€[\u0080-¿™œ“”¢¦]|Ä[\u0080-¿]|Å[\u0080-¿]|ï¿½|�/;

/** Problems visible inside one cell, independent of the other file. */
export function cellFindings(value) {
  const out = [];
  if (value === undefined) return out;
  if (HTML_TAG.test(value)) out.push('html-tag');
  if (HTML_ENTITY.test(value)) out.push('html-entity');
  if (MOJIBAKE.test(value)) out.push('mojibake');
  if (value !== value.trim() && value.trim() !== '') out.push('leading-trailing-space');
  if (/ /.test(value)) out.push('nbsp-char');
  return out;
}

/** Classify a cell as number/date/text/empty with a format pattern name and, for numbers, a numeric value. */
export function formatOf(raw) {
  const v = (raw ?? '').trim();
  if (v === '') return { kind: 'empty', pattern: 'empty' };
  let m;
  if (/^[+-]?\d+$/.test(v)) return { kind: 'number', pattern: 'integer', value: Number(v) };
  if (/^[+-]?\d{1,3}(\.\d{3})+,\d+$/.test(v)) return { kind: 'number', pattern: 'thousand-dot decimal-comma', value: Number(v.replace(/\./g, '').replace(',', '.')) };
  if (/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(v)) return { kind: 'number', pattern: 'thousand-comma decimal-dot', value: Number(v.replace(/,/g, '')) };
  if (/^[+-]?\d{1,3}( \d{3})+([.,]\d+)?$/.test(v)) return { kind: 'number', pattern: 'thousand-space', value: Number(v.replace(/ /g, '').replace(',', '.')) };
  if (/^[+-]?\d*,\d+$/.test(v)) return { kind: 'number', pattern: 'decimal-comma', value: Number(v.replace(',', '.')) };
  if (/^[+-]?\d*\.\d+$/.test(v)) return { kind: 'number', pattern: 'decimal-dot', value: Number(v) };
  if (/^[+-]?\d+(\.\d+)?%$/.test(v)) return { kind: 'number', pattern: 'percent-dot', value: Number(v.slice(0, -1)) };
  if (/^[+-]?\d+,\d+%$/.test(v)) return { kind: 'number', pattern: 'percent-comma', value: Number(v.slice(0, -1).replace(',', '.')) };
  const time = '(?:[ T]\\d{1,2}:\\d{2}(?::\\d{2})?(?:\\.\\d+)?(?:Z|[+-]\\d{2}:?\\d{2})?)?';
  if (new RegExp('^\\d{4}-\\d{2}-\\d{2}' + time + '$').test(v)) return { kind: 'date', pattern: /[ T]\d/.test(v) ? 'iso yyyy-mm-dd hh:mm' : 'iso yyyy-mm-dd' };
  if (new RegExp('^\\d{1,2}\\.\\d{1,2}\\.\\d{4}' + time + '$').test(v)) return { kind: 'date', pattern: /[ T]\d/.test(v) ? 'dd.mm.yyyy hh:mm' : 'dd.mm.yyyy' };
  if ((m = v.match(new RegExp('^(\\d{1,2})/(\\d{1,2})/\\d{4}' + time + '$')))) {
    const a = Number(m[1]), b = Number(m[2]);
    const p = a > 12 ? 'dd/mm/yyyy' : b > 12 ? 'mm/dd/yyyy' : 'nn/nn/yyyy (day/month order ambiguous)';
    return { kind: 'date', pattern: p + (/[ T]\d/.test(v) ? ' hh:mm' : '') };
  }
  if (new RegExp('^\\d{1,2}-\\d{1,2}-\\d{4}' + time + '$').test(v)) return { kind: 'date', pattern: 'dd-mm-yyyy' };
  return { kind: 'text', pattern: 'text' };
}

const stripMarkup = (s) => s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/\s+/g, ' ').trim();

export function colLetter(i) {
  let s = '', n = i + 1;
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

const show = (v, max = 70) => {
  if (v === undefined) return '<missing>';
  const s = JSON.stringify(v);
  return s.length > max ? s.slice(0, max) + '..."' : s;
};

// ---------- comparison ----------

function resolveColumn(spec, headers) {
  if (spec === undefined || spec === null || spec === '') return -1;
  const s = String(spec).trim();
  if (/^\d+$/.test(s)) { const i = Number(s) - 1; return i >= 0 && i < headers.length ? i : -1; }
  const norm = (x) => String(x).trim().toLowerCase();
  return headers.findIndex((h) => norm(h) === norm(s));
}

/**
 * Compare two parsed tables.
 * opts: { key, ignoreCols: string[], trim }
 * Column numbers in opts and in the report are 1-based, row numbers are spreadsheet rows (header = row 1).
 */
export function compareTables(a, b, opts = {}) {
  const trimOpt = !!opts.trim;
  const norm = (v) => {
    if (v === undefined) return v;
    const x = v.replace(/\r\n?/g, '\n');
    return trimOpt ? x.trim() : x;
  };
  const rowsA = a.rows, rowsB = b.rows;
  const headA = rowsA[0] || [], headB = rowsB[0] || [];
  const res = {
    identical: false,
    delimiters: { a: a.delimiter, b: b.delimiter },
    encodings: { a: a.encoding, b: b.encoding },
    bom: { a: a.bom, b: b.bom },
    rowCount: { a: Math.max(0, rowsA.length - 1), b: Math.max(0, rowsB.length - 1) },
    columnCount: { a: headA.length, b: headB.length },
    headerDiffs: [],
    rowDiffs: [],
    cellDiffs: [],
    findings: [],
    notes: [],
  };
  if (a.delimiter !== b.delimiter) res.notes.push(`delimiter differs: A ${JSON.stringify(a.delimiter)} vs B ${JSON.stringify(b.delimiter)}`);
  if (a.encoding !== b.encoding) res.notes.push(`encoding differs: A ${a.encoding} vs B ${b.encoding}`);
  if (a.bom !== b.bom) res.notes.push(`BOM differs: A ${a.bom} vs B ${b.bom}`);

  // ---- headers ----
  const hn = (h) => h.trim().toLowerCase();
  const exactB = new Map(headB.map((h, i) => [h, i]));
  const looseB = new Map();
  headB.forEach((h, i) => { if (!looseB.has(hn(h))) looseB.set(hn(h), i); });
  const map = new Array(headA.length).fill(-1); // A col -> B col
  const usedB = new Set();
  headA.forEach((h, i) => { if (exactB.has(h) && !usedB.has(exactB.get(h))) { map[i] = exactB.get(h); usedB.add(map[i]); } });
  headA.forEach((h, i) => {
    if (map[i] >= 0) return;
    const j = looseB.get(hn(h));
    if (j !== undefined && !usedB.has(j)) {
      map[i] = j; usedB.add(j);
      res.headerDiffs.push({ type: h.trim() === headB[j].trim() ? 'whitespace' : 'case', column: `${colLetter(i)} (${i + 1})`, a: h, b: headB[j] });
    }
  });
  // Unmatched A headers: fall back to same index when B has an unused header there.
  headA.forEach((h, i) => {
    if (map[i] >= 0) return;
    if (i < headB.length && !usedB.has(i)) {
      map[i] = i; usedB.add(i);
      res.headerDiffs.push({ type: 'renamed', column: `${colLetter(i)} (${i + 1})`, a: h, b: headB[i] });
    } else {
      res.headerDiffs.push({ type: 'missing-in-B', column: `${colLetter(i)} (${i + 1})`, a: h, b: null });
    }
  });
  headB.forEach((h, j) => { if (!usedB.has(j)) res.headerDiffs.push({ type: 'extra-in-B', column: `${colLetter(j)} (${j + 1})`, a: null, b: h }); });
  const mappedPairs = map.map((j, i) => [i, j]).filter(([, j]) => j >= 0);
  if (mappedPairs.length === headA.length && mappedPairs.length === headB.length && mappedPairs.some(([i, j]) => i !== j)) {
    res.headerDiffs.push({ type: 'order', column: '', a: headA.join(' | '), b: headB.join(' | ') });
  }
  if (res.columnCount.a !== res.columnCount.b) res.notes.push(`column count differs: A ${res.columnCount.a} vs B ${res.columnCount.b}`);

  // ---- ignored columns (given on A's numbering or by A's header name) ----
  const ignoreA = new Set();
  for (const spec of opts.ignoreCols || []) { const i = resolveColumn(spec, headA); if (i >= 0) ignoreA.add(i); else res.notes.push(`--ignore-cols: column "${spec}" not found in A`); }

  // ---- row alignment ----
  const keyCol = resolveColumn(opts.key, headA);
  let keyColB = -1;
  if (opts.key !== undefined && opts.key !== null && opts.key !== '') {
    if (keyCol < 0) throw Object.assign(new Error(`key column "${opts.key}" not found in A`), { code: 'USAGE' });
    keyColB = map[keyCol];
    if (keyColB === undefined || keyColB < 0) throw Object.assign(new Error(`key column "${opts.key}" not found in B`), { code: 'USAGE' });
  }
  const pairs = []; // { rowA, rowB, idxA, idxB, label }
  const dataA = rowsA.slice(1), dataB = rowsB.slice(1);
  if (keyCol >= 0) {
    const index = (data, col) => {
      const m = new Map(); const seen = new Map();
      data.forEach((r, i) => {
        const k0 = norm(r[col] ?? '');
        const c = (seen.get(k0) || 0) + 1; seen.set(k0, c);
        m.set(c > 1 ? `${k0}\u0000#${c}` : k0, { r, i });
      });
      return m;
    };
    const ia = index(dataA, keyCol), ib = index(dataB, keyColB);
    for (const [k, { r, i }] of ia) {
      const hit = ib.get(k);
      const label = `key ${show(k.split('\u0000')[0])}${k.includes('\u0000') ? ' (repeated)' : ''}`;
      if (hit) pairs.push({ ra: r, rb: hit.r, rowNoA: i + 2, rowNoB: hit.i + 2, label });
      else res.rowDiffs.push({ type: 'missing-in-B', row: i + 2, key: k.split('\u0000')[0], values: r });
    }
    for (const [k, { r, i }] of ib) if (!ia.has(k)) res.rowDiffs.push({ type: 'missing-in-A', row: i + 2, key: k.split('\u0000')[0], values: r });
  } else {
    const n = Math.max(dataA.length, dataB.length);
    for (let i = 0; i < n; i++) {
      if (i >= dataA.length) res.rowDiffs.push({ type: 'missing-in-A', row: i + 2, key: null, values: dataB[i] });
      else if (i >= dataB.length) res.rowDiffs.push({ type: 'missing-in-B', row: i + 2, key: null, values: dataA[i] });
      else pairs.push({ ra: dataA[i], rb: dataB[i], rowNoA: i + 2, rowNoB: i + 2, label: `row ${i + 2}` });
    }
    if (dataA.length !== dataB.length) res.notes.push('row counts differ and no --key was given: rows are matched by position, so one missing row in the middle shifts every later row. Re-run with --key <column>.');
  }

  // ---- cells ----
  for (const p of pairs) {
    for (const [ci, cj] of mappedPairs) {
      if (ignoreA.has(ci)) continue;
      const va = p.ra[ci], vb = p.rb[cj];
      const na = norm(va), nb = norm(vb);
      if (na === nb) continue;
      const where = { row: p.rowNoA === p.rowNoB ? p.rowNoA : `${p.rowNoA} (A) / ${p.rowNoB} (B)`, column: `${colLetter(ci)} (${ci + 1}) "${headA[ci]}"`, id: p.label };
      let type = 'value', detail = '';
      if (va === undefined || vb === undefined) {
        type = 'empty-vs-missing';
        detail = va === undefined ? 'A has no cell (short row), B has ' + show(vb) : 'B has no cell (short row), A has ' + show(va);
        if ((va ?? '') !== (vb ?? '')) type = 'value';
        else detail = (va === undefined ? 'A' : 'B') + ' row is short (cell missing), the other side has an empty cell';
      } else {
        const fa = formatOf(va), fb = formatOf(vb);
        if (fa.kind === fb.kind && (fa.kind === 'number' || fa.kind === 'date') && fa.pattern !== fb.pattern) {
          type = fa.kind + '-format';
          const same = fa.kind === 'number' && fa.value === fb.value;
          detail = `${fa.pattern} vs ${fb.pattern}${fa.kind === 'number' ? (same ? ' (same number)' : ' (and the numbers differ)') : ''}`;
        } else if (va.trim() === vb.trim()) {
          type = 'whitespace';
          const side = (s) => (s === s.trim() ? 'clean' : `lead ${s.length - s.trimStart().length}, trail ${s.length - s.trimEnd().length}`);
          detail = `A ${side(va)}, B ${side(vb)}`;
        } else if (stripMarkup(va) === stripMarkup(vb) && (HTML_TAG.test(va) || HTML_TAG.test(vb) || HTML_ENTITY.test(va) || HTML_ENTITY.test(vb))) {
          type = 'html-markup';
          detail = `markup in ${HTML_TAG.test(va) || HTML_ENTITY.test(va) ? 'A' : ''}${(HTML_TAG.test(va) || HTML_ENTITY.test(va)) && (HTML_TAG.test(vb) || HTML_ENTITY.test(vb)) ? ' and ' : ''}${HTML_TAG.test(vb) || HTML_ENTITY.test(vb) ? 'B' : ''}; text is the same once stripped`;
        } else if (va.toLowerCase() === vb.toLowerCase()) {
          type = 'case';
        } else if (MOJIBAKE.test(va) !== MOJIBAKE.test(vb)) {
          type = 'encoding';
          detail = `mojibake signs in ${MOJIBAKE.test(va) ? 'A' : 'B'}`;
        }
      }
      res.cellDiffs.push({ ...where, type, detail, a: va, b: vb });
    }
  }

  // ---- per-file findings (even when both sides agree: that is a BOTH defect) ----
  for (const [side, t, head] of [['A', a, headA], ['B', b, headB]]) {
    t.rows.forEach((r, ri) => r.forEach((v, ci) => {
      if (ri > 0 && ignoreA.size && side === 'A' && ignoreA.has(ci)) return;
      const f = cellFindings(v);
      if (ri === 0 && f.includes('leading-trailing-space')) f.push('header-space');
      for (const kind of f) res.findings.push({ side, kind, row: ri + 1, column: `${colLetter(ci)} (${ci + 1}) "${head[ci] ?? ''}"`, value: show(v) });
    }));
  }

  res.identical = !res.headerDiffs.length && !res.rowDiffs.length && !res.cellDiffs.length && a.rows.length === b.rows.length;
  // A difference in row count with no row diffs cannot happen; keep the explicit guard for clarity.
  return res;
}

export function diffFiles(pathA, pathB, opts = {}) {
  const a = readTable(pathA, opts.delimiter);
  const b = readTable(pathB, opts.delimiter);
  return compareTables(a, b, opts);
}

// ---------- reporting ----------

export function formatReport(res, pathA = 'A', pathB = 'B', maxPerSection = 200) {
  const L = [];
  L.push(`export-diff: A = ${pathA}`);
  L.push(`             B = ${pathB}`);
  L.push(`rows (without header): A ${res.rowCount.a}, B ${res.rowCount.b}${res.rowCount.a !== res.rowCount.b ? `  <-- difference of ${res.rowCount.b - res.rowCount.a}` : ''}`);
  L.push(`columns: A ${res.columnCount.a}, B ${res.columnCount.b}   delimiter: A ${JSON.stringify(res.delimiters.a)}, B ${JSON.stringify(res.delimiters.b)}`);
  for (const n of res.notes) L.push(`note: ${n}`);
  const section = (title, items, line) => {
    if (!items.length) return;
    L.push('', `${title} (${items.length})`);
    items.slice(0, maxPerSection).forEach((x) => L.push('  ' + line(x)));
    if (items.length > maxPerSection) L.push(`  ... ${items.length - maxPerSection} more (use --json for all)`);
  };
  section('HEADER DIFFERENCES', res.headerDiffs, (d) => `[${d.type}] ${d.column} A=${show(d.a)} B=${show(d.b)}`);
  section('ROW DIFFERENCES', res.rowDiffs, (d) => `[${d.type}] row ${d.row}${d.key !== null ? ` key ${show(d.key)}` : ''}: ${show(d.values.join(' | '), 110)}`);
  section('CELL DIFFERENCES', res.cellDiffs, (d) => `[${d.type}] row ${d.row}, col ${d.column}${d.id.startsWith('key') ? ` (${d.id})` : ''}: A=${show(d.a)} B=${show(d.b)}${d.detail ? ' -- ' + d.detail : ''}`);
  section('FINDINGS INSIDE FILES (each file on its own, even when A and B agree)', res.findings, (f) => `[${f.side}:${f.kind}] row ${f.row}, col ${f.column}: ${f.value}`);
  L.push('', res.identical ? 'RESULT: identical after normalization (exit 0)' : 'RESULT: differences found (exit 1)');
  if (res.identical && res.findings.length) L.push('NOTE: files agree but contain the findings above: report them as BOTH-side defects.');
  return L.join('\n');
}
