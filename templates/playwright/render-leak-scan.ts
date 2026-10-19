/**
 * Render leak scan helper (see references/core/render-leak-scan.md).
 *
 * Reads the visible text plus title / aria-label / placeholder values of the
 * current page and reports raw JSON, object dumps, unresolved templates,
 * visible markup and similar leaks. Read-only: it never clicks or types.
 * NEVER throws: failures are recorded in `errors`.
 */
export type LeakKind =
  | 'json'
  | 'object-dump'
  | 'missing-value'
  | 'template'
  | 'markup-as-text'
  | 'translation-key';

export type Leak = {
  kind: LeakKind;
  /** Where the text came from: 'text', 'title', 'aria-label' or 'placeholder'. */
  source: string;
  /** Short context around the match (max ~120 chars). */
  context: string;
  /** Element path such as 'div.card > span' when known, else ''. */
  path: string;
};

export type LeakScanResult = {
  url: string;
  leaks: Leak[];
  errors: string[];
};

const RULES: { kind: LeakKind; re: RegExp }[] = [
  { kind: 'json', re: /\{\s*"[^"\n]{1,40}"\s*:|\[\s*\{\s*"/ },
  { kind: 'object-dump', re: /\[object Object\]/ },
  { kind: 'missing-value', re: /\b(undefined|NaN|Infinity|Invalid Date)\b|(^|\s)null(\s|$)/ },
  { kind: 'template', re: /\{\{[^}]*\}\}|\$\{[^}]*\}|%s\b|\{\d+\}/ },
  { kind: 'markup-as-text', re: /<\/?[a-z][a-z0-9]*[^>]*>|&(lt|gt|amp|nbsp|quot);/i },
  { kind: 'translation-key', re: /\b[a-z][a-z0-9]*(\.[a-z][a-zA-Z0-9_]*){2,}\b/ },
];

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** `page` is a Playwright Page; typed loosely so the template compiles without the package. */
export async function scanRenderLeaks(page: any, opts: { ignoreKinds?: LeakKind[] } = {}): Promise<LeakScanResult> {
  const errors: string[] = [];
  const leaks: Leak[] = [];
  const ignore = new Set(opts.ignoreKinds ?? []);
  let url = '';
  try {
    url = page.url();
    const items: { source: string; text: string; path: string }[] = await page.evaluate(() => {
      const out: { source: string; text: string; path: string }[] = [];
      const pathOf = (el: Element): string => {
        const parts: string[] = [];
        let cur: Element | null = el;
        for (let i = 0; cur && i < 3; i++, cur = cur.parentElement) {
          parts.unshift(cur.tagName.toLowerCase() + (cur.className && typeof cur.className === 'string' ? '.' + cur.className.trim().split(/\s+/)[0] : ''));
        }
        return parts.join(' > ');
      };
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n: Node | null;
      while ((n = walker.nextNode())) {
        const p = n.parentElement;
        if (!p || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(p.tagName)) continue;
        const text = (n.textContent || '').trim();
        if (text.length > 1) out.push({ source: 'text', text, path: pathOf(p) });
      }
      document.querySelectorAll('[title],[aria-label],[placeholder]').forEach((el) => {
        for (const a of ['title', 'aria-label', 'placeholder']) {
          const v = el.getAttribute(a);
          if (v) out.push({ source: a, text: v, path: pathOf(el) });
        }
      });
      return out;
    });
    for (const it of items) {
      for (const r of RULES) {
        if (ignore.has(r.kind)) continue;
        const m = r.re.exec(it.text);
        if (m) {
          const i = Math.max(0, m.index - 40);
          leaks.push({ kind: r.kind, source: it.source, context: it.text.slice(i, i + 120), path: it.path });
        }
      }
    }
  } catch (e) {
    errors.push(msg(e));
  }
  return { url, leaks, errors };
}
