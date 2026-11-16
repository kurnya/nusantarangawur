import { expect, test } from '@playwright/test';

/** Mainkan beberapa giliran hot-seat dengan ?fast=1 dan pastikan tidak ada error. */
test('hot-seat: beberapa giliran tanpa error, tombol sesuai giliran', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('?fast=1');
  await page.click('#start');
  await expect(page.locator('#players .pc')).toHaveCount(4);
  for (let k = 0; k < 40; k++) {
    // tutup modal kartu jika ada
    const modal = page.locator('#modal:not(.hidden) .row button').first();
    if (await modal.isVisible()) {
      await modal.click();
      continue;
    }
    const acts = page.locator('#acts button:not([disabled])');
    await expect(acts.first()).toBeVisible({ timeout: 10_000 });
    const labels = await acts.allTextContents();
    const pick =
      labels.find((l) => l.startsWith('Beli')) ??
      labels.find((l) => l.startsWith('Lempar') || l.startsWith('Kembar')) ??
      labels.find((l) => l.startsWith('Akhiri')) ??
      labels[0]!;
    await acts.filter({ hasText: pick }).first().click();
    await page.waitForFunction(() => !window.__nn?.game?.playing);
  }
  const st = await page.evaluate(() => {
    const s = window.__nn!.game!.state!;
    return {
      rev: s.rev,
      owned: s.owners.filter(Boolean).length,
      money: s.players.map((p) => p.money),
    };
  });
  expect(st.rev).toBeGreaterThan(20);
  expect(st.money.every((m) => Number.isInteger(m) && m >= 0)).toBe(true);
  // saldo di panel sama dengan state
  const shown = await page.locator('#players .pc .m').allTextContents();
  expect(shown.length).toBe(4);
  expect(errors).toEqual([]);
});
