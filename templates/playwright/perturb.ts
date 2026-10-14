import { Page } from '@playwright/test';

export type Step = { name: string; run: (page: Page) => Promise<void> };
export type Fault = 'offline' | 'reload' | 'back' | 'doubleClick' | 'slowRoute';

export async function perturb(
  page: Page,
  steps: Step[],
  faults: Fault[],
  opts: { routeGlob?: string; delayMs?: number; verify: (page: Page) => Promise<void> },
) {
  const results: { step: string; fault: Fault; ok: boolean; error?: string }[] = [];
  for (const fault of faults) {
    for (let i = 0; i < steps.length; i++) {
      try {
        for (let j = 0; j < i; j++) await steps[j].run(page);
        await inject(page, fault, opts);
        await steps[i].run(page);
        await restore(page, fault, opts);
        for (let j = i + 1; j < steps.length; j++) await steps[j].run(page);
        await opts.verify(page);
        results.push({ step: steps[i].name, fault, ok: true });
      } catch (e) {
        results.push({ step: steps[i].name, fault, ok: false, error: String(e) });
      }
    }
  }
  return results;
}

// doubleClick: applied inside the step's own run() using dblclick; no injection here.
async function inject(page: Page, f: Fault, o: { routeGlob?: string; delayMs?: number }) {
  if (f === 'offline') await page.context().setOffline(true);
  if (f === 'reload') await page.reload();
  if (f === 'back') { await page.goBack(); await page.goForward(); }
  if (f === 'slowRoute' && o.routeGlob) {
    await page.route(o.routeGlob, async (r) => {
      await new Promise((res) => setTimeout(res, o.delayMs ?? 3000));
      await r.continue();
    });
  }
}

async function restore(page: Page, f: Fault, o: { routeGlob?: string }) {
  if (f === 'offline') await page.context().setOffline(false);
  if (f === 'slowRoute' && o.routeGlob) await page.unroute(o.routeGlob);
}
