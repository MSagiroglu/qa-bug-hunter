/**
 * Overlay/dialog invariants helper (see references/invariants/overlay-dialog.md).
 *
 * Automated here: OV1, OV2, OV3, OV4, OV6, OV7, OV10.
 * Manual-only (not measured by this helper): OV5, OV8, OV9, OV11, OV12, OV13, OV14.
 *
 * The helper never throws on a failed invariant or on a locator error; it
 * returns one InvariantResult per check so the caller can print a table.
 * Note: OV7 checks a 320px viewport only; verify 200% zoom by hand.
 */
import type { Page, Locator } from '@playwright/test';

export type OverlayTarget = { dialog: Locator; trigger: Locator; close?: Locator };
export type InvariantResult = { id: string; pass: boolean; detail?: string };

const scrollTop = (page: Page): Promise<number> =>
  page.evaluate(() => document.scrollingElement?.scrollTop ?? 0);

export async function assertOverlayInvariants(page: Page, t: OverlayTarget): Promise<InvariantResult[]> {
  const out: InvariantResult[] = [];
  const push = (id: string, pass: boolean, detail?: string): void => { out.push({ id, pass, detail }); };
  const anyDialogs = page.locator('[role="dialog"]:visible, [role="alertdialog"]:visible');
  const originalViewport = page.viewportSize();

  try {
    // Make the page scroll before opening so OV6 is meaningful (only if scrollable).
    const scrollable = await page.evaluate(() => {
      const el = document.scrollingElement;
      return !!el && el.scrollHeight > el.clientHeight + 50;
    });
    if (scrollable) {
      await page.evaluate(() => window.scrollTo(0, Math.min(300, document.scrollingElement!.scrollHeight)));
    }

    // Activate the trigger twice in quick succession so OV10 sees a double-open attempt.
    // Synthetic clicks: a real second pointer click would land on the backdrop and blur the dialog (false OV2).
    await t.trigger.evaluate((el) => { (el as HTMLElement).click(); (el as HTMLElement).click(); });
    await t.dialog.first().waitFor({ state: 'visible', timeout: 5000 });
    const scrollBefore = await scrollTop(page);

    // OV10
    const roleCount = await anyDialogs.count();
    const targetCount = await t.dialog.evaluateAll((els) =>
      els.filter((e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden').length);
    const count = Math.max(roleCount, targetCount);
    push('OV10', count <= 1, `visible dialogs=${count} (role=${roleCount}, target=${targetCount})`);

    // OV1
    const role = (await t.dialog.first().getAttribute('role')) ?? '';
    const modal = await t.dialog.first().getAttribute('aria-modal');
    const name = (await t.dialog.first().getAttribute('aria-label')) ?? (await t.dialog.first().getAttribute('aria-labelledby'));
    push('OV1', /^(dialog|alertdialog)$/.test(role) && modal === 'true' && !!name,
      `role=${role || 'none'} aria-modal=${modal} name=${name ? 'yes' : 'no'}`);

    // OV2 (focus in)
    const focusIn = await t.dialog.first().evaluate((d) => d.contains(document.activeElement));
    push('OV2', focusIn, 'focus inside on open');

    // OV6
    if (!scrollable) {
      push('OV6', true, 'n/a: page not scrollable');
    } else {
      await page.mouse.move(2, 2);
      await page.mouse.wheel(0, 800);
      await page.waitForTimeout(100);
      const scrollAfter = await scrollTop(page);
      push('OV6', scrollAfter === scrollBefore, `before=${scrollBefore} after=${scrollAfter}`);
    }

    // OV3 (forward and backward)
    let trapped = true;
    for (let i = 0; i < 25 && trapped; i++) {
      await page.keyboard.press('Tab');
      trapped = await t.dialog.first().evaluate((d) => d.contains(document.activeElement));
    }
    for (let i = 0; i < 25 && trapped; i++) {
      await page.keyboard.press('Shift+Tab');
      trapped = await t.dialog.first().evaluate((d) => d.contains(document.activeElement));
    }
    push('OV3', trapped, 'Tab and Shift+Tab x25');

    // OV4
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const closedByEsc = !(await t.dialog.first().isVisible());
    push('OV4', closedByEsc, closedByEsc ? undefined : 'dialog still visible after ESC');
    if (!closedByEsc && t.close) await t.close.first().click().catch(() => {});

    // OV2 (focus restore)
    await page.waitForTimeout(200);
    push('OV2-restore', await t.trigger.evaluate((el) => el === document.activeElement), 'focus back on trigger');

    // OV7 at 320px
    await page.setViewportSize({ width: 320, height: 568 });
    await t.trigger.click();
    await t.dialog.first().waitFor({ state: 'visible', timeout: 5000 });
    if (t.close) {
      const visible = await t.close.first().isVisible();
      const enabled = visible && (await t.close.first().isEnabled());
      const box = visible ? await t.close.first().boundingBox() : null;
      const inView = !!box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 320 && box.y + box.height <= 568;
      push('OV7', visible && enabled && inView, `visible=${visible} enabled=${enabled} inViewport=${inView}`);
    } else {
      push('OV7', false, 'n/a: no close locator supplied');
    }
    await page.keyboard.press('Escape');
    if (await t.dialog.first().isVisible() && t.close) await t.close.first().click().catch(() => {});
  } catch (e) {
    push('ERR', false, e instanceof Error ? e.message : String(e));
  } finally {
    if (originalViewport) await page.setViewportSize(originalViewport).catch(() => {});
  }
  return out;
}
