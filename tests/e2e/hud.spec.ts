import { expect, test, type Page } from '@playwright/test';

/** Mainkan sampai giliran berganti (mode cepat). */
async function finishTurn(page: Page): Promise<void> {
  const start = await page.evaluate(() => window.__nn!.game!.state!.turn);
  for (let k = 0; k < 30; k++) {
    const turn = await page.evaluate(() => window.__nn!.game!.state!.turn);
    if (turn !== start) return;
    const modal = page.locator('#modal:not(.hidden) .row button').first();
    if (await modal.isVisible()) {
      await modal.click();
      continue;
    }
    const acts = page.locator('#acts button:not([disabled])');
    await expect(acts.first()).toBeVisible({ timeout: 10_000 });
    const labels = await acts.allTextContents();
    const pick =
      labels.find((l) => l.startsWith('Lempar') || l.startsWith('Kembar')) ??
      labels.find((l) => l.startsWith('Akhiri')) ??
      labels[labels.length - 1]!;
    await acts.filter({ hasText: pick }).first().click();
    await page.waitForFunction(() => !window.__nn?.game?.playing);
  }
  throw new Error('giliran tidak berganti');
}

test('catatan: status buka/tutup disimpan per pemain', async ({ page }) => {
  await page.goto('?fast=1');
  await page.click('#minus'); // 3 pemain
  await page.click('#start');
  await expect(page.locator('#logd')).not.toHaveClass(/open/);
  await page.click('#camLog');
  await expect(page.locator('#logd')).toHaveClass(/open/);
  await finishTurn(page);
  // pemain kedua belum pernah membuka catatan
  await expect(page.locator('#logd')).not.toHaveClass(/open/);
  await expect(page.locator('#logBd')).toHaveClass(/on/);
  expect(await page.evaluate(() => localStorage.getItem('nn.logOpen.0'))).toBe('1');
  await finishTurn(page);
  await finishTurn(page);
  // kembali ke pemain pertama: catatan terbuka lagi
  const turn = await page.evaluate(() => window.__nn!.game!.state!.turn);
  if (turn === 0) await expect(page.locator('#logd')).toHaveClass(/open/);
});

test('tombol aksi terkunci selama animasi', async ({ page }) => {
  await page.goto('./');
  await page.click('#start');
  await page.locator('#acts button', { hasText: 'Lempar dadu' }).click();
  await expect(page.locator('#acts button').first()).toBeDisabled();
  await page.waitForFunction(
    () => !window.__nn?.game?.playing || !!document.querySelector('#modal:not(.hidden)'),
    null,
    {
      timeout: 60_000,
    },
  );
});

test('modal info petak: Escape menutup dan fokus kembali', async ({ page }) => {
  await page.goto('?fast=1');
  await page.click('#start');
  await page.locator('#camLog').focus();
  await page.evaluate(() => window.__nn!.openTile(1));
  await expect(page.locator('#modal')).not.toHaveClass(/hidden/, { timeout: 5_000 });
  await expect(page.locator('#dlg h3')).toContainText('Banda Aceh');
  await page.keyboard.press('Escape');
  await expect(page.locator('#modal')).toHaveClass(/hidden/);
  await expect(page.locator('#camLog')).toBeFocused();
});

test.describe('HP', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test('tanpa geser horizontal, toolbar satu baris, kartu kontrol terlihat', async ({ page }) => {
    await page.goto('?fast=1');
    await page.click('#start');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBe(0);
    const cam = (await page.locator('.cam').boundingBox())!;
    expect(cam.height).toBeLessThan(50);
    const btn = page.locator('#acts button', { hasText: 'Lempar dadu' });
    await expect(btn).toBeInViewport();
    const wx = (await page.locator('#wxchip').boundingBox())!;
    const hud = (await page.locator('#hud').boundingBox())!;
    expect(wx.y + wx.height).toBeLessThan(hud.y);
  });
});
