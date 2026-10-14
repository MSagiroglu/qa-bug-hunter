import type { Page, Locator } from 'playwright';

/**
 * Overlay/dialog invariants (references/invariants/overlay-dialog.md).
 * Automated: OV1, OV2, OV3, OV4, OV6, OV7, OV10. Never throws on a failed
 * invariant; returns one result per check.
 */
export type OverlayTarget = { dialog: Locator; trigger: Locator; close?: Locator };
export type InvariantResult = { id: string; pass: boolean; detail?: string };

const scrollTop = (page: Page): Promise<number> =>
  page.evaluate(() => document.scrollingElement?.scrollTop ?? 0);

export async function runOverlayInvariants(page: Page, t: OverlayTarget): Promise<InvariantResult[]> {
  const out: InvariantResult[] = [];
  const push = (id: string, pass: boolean, detail?: string): void => { out.push({ id, pass, detail }); };
  const anyDialogs = page.locator('[role="dialog"]:visible, [role="alertdialog"]:visible, dialog[open]');
  const originalViewport = page.viewportSize();

  try {
    const scrollable = await page.evaluate(() => {
      const el = document.scrollingElement;
      return !!el && el.scrollHeight > el.clientHeight + 50;
    });
    if (scrollable) {
      await page.evaluate(() => window.scrollTo(0, Math.min(300, document.scrollingElement!.scrollHeight)));
    }

    await t.trigger.dblclick({ timeout: 5000 });
    await t.dialog.first().waitFor({ state: 'visible', timeout: 5000 });
    const scrollBefore = await scrollTop(page);

    const count = await anyDialogs.count();
    push('OV10', count <= 1, `visible dialogs=${count}`);

    const role = (await t.dialog.getAttribute('role')) ?? '';
    const modal = await t.dialog.getAttribute('aria-modal');
    const name = (await t.dialog.getAttribute('aria-label')) ?? (await t.dialog.getAttribute('aria-labelledby'));
    push('OV1', /^(dialog|alertdialog)$/.test(role) && modal === 'true' && !!name,
      `role=${role || 'none'} aria-modal=${modal} name=${name ? 'yes' : 'no'}`);

    const focusIn = await t.dialog.evaluate((d) => d.contains(document.activeElement));
    push('OV2', focusIn, 'focus inside on open');

    if (!scrollable) {
      push('OV6', true, 'n/a: page not scrollable');
    } else {
      await page.mouse.move(2, 2);
      await page.mouse.wheel(0, 800);
      await page.waitForTimeout(100);
      const scrollAfter = await scrollTop(page);
      push('OV6', scrollAfter === scrollBefore, `before=${scrollBefore} after=${scrollAfter}`);
    }

    let trapped = true;
    for (let i = 0; i < 25 && trapped; i++) {
      await page.keyboard.press('Tab');
      trapped = await t.dialog.evaluate((d) => d.contains(document.activeElement));
    }
    for (let i = 0; i < 25 && trapped; i++) {
      await page.keyboard.press('Shift+Tab');
      trapped = await t.dialog.evaluate((d) => d.contains(document.activeElement));
    }
    push('OV3', trapped, 'Tab and Shift+Tab x25');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const closedByEsc = !(await t.dialog.isVisible());
    push('OV4', closedByEsc, closedByEsc ? undefined : 'dialog still visible after ESC');
    if (!closedByEsc && t.close) await t.close.click().catch(() => {});

    await page.waitForTimeout(200);
    push('OV2-restore', await t.trigger.evaluate((el) => el === document.activeElement), 'focus back on trigger');

    await page.setViewportSize({ width: 320, height: 568 });
    await t.trigger.click({ timeout: 5000 });
    await t.dialog.first().waitFor({ state: 'visible', timeout: 5000 });
    if (t.close) {
      const visible = await t.close.isVisible();
      const enabled = visible && (await t.close.isEnabled());
      const box = visible ? await t.close.boundingBox() : null;
      const inView = !!box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 320 && box.y + box.height <= 568;
      push('OV7', visible && enabled && inView, `visible=${visible} enabled=${enabled} inViewport=${inView}`);
    } else {
      push('OV7', false, 'n/a: no close locator found');
    }
    await page.keyboard.press('Escape');
    if ((await t.dialog.isVisible()) && t.close) await t.close.click().catch(() => {});
  } catch (e) {
    push('ERR', false, e instanceof Error ? e.message : String(e));
  } finally {
    if (originalViewport) await page.setViewportSize(originalViewport).catch(() => {});
  }
  return out;
}

export interface DiscoveredOverlay {
  index: number;
  triggerSelector: string;
  dialogSelector: string;
  closeSelector: string | null;
  triggerLabel: string;
}

const DIALOG_SEL = '[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog';
const TRIGGER_SEL =
  '[aria-haspopup="dialog"], [data-toggle="modal"], [data-bs-toggle="modal"], [data-testid*="modal" i], [aria-controls], [data-target], [data-bs-target]';

/**
 * Finds dialog triggers from the DOM and tags each trigger/dialog pair with
 * data-qa-ovl-* attributes so they can be addressed with stable selectors.
 */
export async function discoverOverlays(page: Page, max = 5): Promise<DiscoveredOverlay[]> {
  return page.evaluate(
    ({ dialogSel, triggerSel, max }) => {
      const dialogs = Array.from(document.querySelectorAll<HTMLElement>(dialogSel));
      const triggers = Array.from(document.querySelectorAll<HTMLElement>(triggerSel))
        .filter(el => !dialogs.includes(el));
      const found: Array<{ index: number; closeSelector: string | null; triggerLabel: string }> = [];
      const used = new Set<HTMLElement>();
      const targetOf = (t: HTMLElement): HTMLElement | null => {
        const refs = [t.getAttribute('aria-controls'), t.getAttribute('data-target'), t.getAttribute('data-bs-target'), t.getAttribute('href')]
          .filter((v): v is string => !!v);
        for (const r of refs) {
          const el = r.startsWith('#') ? document.querySelector<HTMLElement>(r) : document.getElementById(r);
          if (el && dialogs.includes(el)) return el;
          if (el) {
            const inner = el.querySelector<HTMLElement>(dialogSel);
            if (inner) return inner;
            if (el.matches('.modal, [class*="modal" i]')) return el;
          }
        }
        if (dialogs.length === 1 && (t.getAttribute('aria-haspopup') === 'dialog' ||
          t.matches('[data-toggle="modal"], [data-bs-toggle="modal"], [data-testid*="modal" i]'))) return dialogs[0];
        return null;
      };
      for (const t of triggers) {
        if (found.length >= max) break;
        const d = targetOf(t);
        if (!d || used.has(d)) continue;
        used.add(d);
        const i = found.length;
        t.setAttribute('data-qa-ovl-trigger', String(i));
        d.setAttribute('data-qa-ovl-dialog', String(i));
        const close = d.querySelector<HTMLElement>(
          '[data-dismiss], [data-bs-dismiss], [aria-label*="close" i], [data-testid*="close" i], button.close, .btn-close');
        if (close) close.setAttribute('data-qa-ovl-close', String(i));
        found.push({
          index: i,
          closeSelector: close ? `[data-qa-ovl-close="${i}"]` : null,
          triggerLabel: (t.getAttribute('aria-label') || t.textContent || t.tagName).trim().slice(0, 60),
        });
      }
      return found.map(f => ({
        index: f.index,
        triggerSelector: `[data-qa-ovl-trigger="${f.index}"]`,
        dialogSelector: `[data-qa-ovl-dialog="${f.index}"]`,
        closeSelector: f.closeSelector,
        triggerLabel: f.triggerLabel,
      }));
    },
    { dialogSel: DIALOG_SEL, triggerSel: TRIGGER_SEL, max },
  );
}
