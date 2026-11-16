import { expect, test, type Page } from '@playwright/test';

const idle = (p: Page) =>
  p.waitForFunction(() => !window.__nn?.game?.playing, null, { timeout: 30_000 });

/** Mainkan sampai pemain yang sedang giliran baru saja membeli kota. */
async function buyACity(page: Page): Promise<number> {
  for (let k = 0; k < 80; k++) {
    await idle(page);
    const acts = page.locator('#acts button:not([disabled])');
    const labels = await acts.allTextContents();
    const buy = labels.find((l) => l.startsWith('Beli'));
    if (buy) {
      await acts.filter({ hasText: buy }).first().click();
      await idle(page);
      return page.evaluate(() => window.__nn!.game!.state!.turn);
    }
    const pick =
      labels.find((l) => l.startsWith('Lempar') || l.startsWith('Kembar')) ??
      labels.find((l) => l.startsWith('Akhiri'))!;
    await acts.filter({ hasText: pick }).first().click();
  }
  throw new Error('tidak pernah mendarat di kota kosong');
}

test('panel Aset: gadai, tebus, jual dengan konfirmasi', async ({ page }) => {
  await page.goto('?fast=1&mode=local');
  await page.click('#start');
  const pid = await buyACity(page);
  const money = () => page.evaluate((p) => window.__nn!.game!.state!.players[p]!.money, pid);
  const m0 = await money();

  await page.click('#camAssets');
  const panel = page.locator('.overlay.assets:not(.hidden)');
  await expect(panel.locator('.arow')).toHaveCount(1);
  await panel.locator('[data-act="mortgage"]').click();
  await expect(panel.locator('.tag.mort')).toBeVisible();
  expect(await money()).toBeGreaterThan(m0);
  const tile = await page.evaluate(
    (p) => window.__nn!.game!.state!.owners.findIndex((o) => o?.p === p),
    pid,
  );
  expect(await page.evaluate((t) => window.__nn!.game!.state!.owners[t]!.m, tile)).toBe(true);

  await panel.locator('[data-act="redeem"]').click();
  await expect(panel.locator('.tag.mort')).toHaveCount(0);
  expect(await money()).toBeLessThan(m0);

  // jual butuh dua klik
  await panel.locator('[data-act="ask-sell"]').click();
  await expect(panel.locator('[data-act="sell"]')).toContainText('Yakin');
  await panel.locator('[data-act="sell"]').click();
  await expect(panel.locator('.arow')).toHaveCount(0);
  expect(await page.evaluate((t) => window.__nn!.game!.state!.owners[t], tile)).toBeNull();

  await page.keyboard.press('Escape');
  await expect(page.locator('.overlay.assets')).toHaveClass(/hidden/);
});
