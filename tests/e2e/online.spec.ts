import { expect, test, type Page } from '@playwright/test';

/**
 * Multiplayer di beberapa tab: transport antar tab (?net=tab) supaya stabil tanpa internet.
 * Jalur protokol, Host, Client, lobi, dan UI sama persis dengan PeerJS.
 */
const Q = '?fast=1&low=1&net=tab';

async function snap(p: Page) {
  return p.evaluate(() => {
    const s = window.__nn!.online!.client!.state!;
    return JSON.stringify({
      rev: s.rev,
      turn: s.turn,
      players: s.players,
      owners: s.owners,
      weather: s.weather,
    });
  });
}
const idle = (p: Page) =>
  p.waitForFunction(() => !window.__nn?.game?.playing, null, { timeout: 30_000 });

async function lobbyJoin(page: Page, code: string, name: string) {
  await page.goto(`${Q}#/join/${code}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#lbCode')).toHaveText(code, { timeout: 30_000 });
  await page.fill('#lbName', name);
  await page.locator('#lbName').blur();
}

test('3 tab: buat ruangan, gabung dengan kode, main beberapa giliran, state konsisten', async ({
  context,
}) => {
  test.setTimeout(420_000);
  const errors: string[] = [];
  const pages: Page[] = [];
  for (let i = 0; i < 3; i++) {
    const p = await context.newPage();
    p.on('pageerror', (e) => errors.push(`tab${i}: ${e.message}`));
    pages.push(p);
  }
  const [host, a, b] = pages as [Page, Page, Page];

  // Host membuat ruangan
  await host.goto(Q, { waitUntil: 'domcontentloaded' });
  await host.fill('#mName', 'Host');
  await host.click('#mCreate');
  const code = (await host.locator('#lbCode').textContent())!.trim();
  expect(code).toMatch(/^[A-Z2-9]{5}$/);
  await expect(host.locator('#lbStart')).toBeDisabled();

  // satu pemain lewat tautan, satu lewat kode di menu
  await lobbyJoin(a, code, 'Ani');
  await b.goto(Q, { waitUntil: 'domcontentloaded' });
  await b.fill('#mName', 'Budi');
  await b.fill('#mCode', code.toLowerCase());
  await b.click('#mJoin');
  await expect(b.locator('#lbCode')).toHaveText(code, { timeout: 30_000 });
  await expect(host.locator('#lbList li')).toHaveCount(3);

  // bidak tidak boleh kembar: bidak milik Host tidak bisa dipilih tab lain
  const hostPawn = await host.evaluate(() => window.__nn!.online!.client!.lobby!.players[0]!.pawn);
  await expect(a.locator(`[data-pawn="${hostPawn}"]`)).toBeDisabled();
  await a.locator('[data-pawn="5"]').click();
  await expect(b.locator('[data-pawn="5"]')).toBeDisabled();

  await a.click('#lbReady');
  await b.click('#lbReady');
  await expect(host.locator('#lbStart')).toBeEnabled();
  await host.click('#lbStart');
  for (const p of pages) await expect(p.locator('#menu')).toHaveClass(/hidden/);
  await expect(host.locator('#players .pc')).toHaveCount(3);
  await expect(a.locator('#players .pc.me b')).toContainText('Ani');

  // main: hanya pemain giliran yang punya tombol aksi
  for (let k = 0; k < 24; k++) {
    for (const p of pages) await idle(p);
    const turn = await host.evaluate(() => window.__nn!.online!.client!.state!.turn);
    const mine = pages[turn]!;
    for (const [i, p] of pages.entries()) {
      if (i === turn) continue;
      await expect(p.locator('#acts .wait')).toContainText('Menunggu');
    }
    const acts = mine.locator('#acts button:not([disabled])');
    await expect(acts.first()).toBeVisible();
    const labels = await acts.allTextContents();
    const pick =
      labels.find((l) => l.startsWith('Beli')) ??
      labels.find((l) => l.startsWith('Lempar') || l.startsWith('Kembar')) ??
      labels.find((l) => l.startsWith('Akhiri')) ??
      labels[0]!;
    await acts.filter({ hasText: pick }).first().click();
    await mine
      .waitForFunction((r) => window.__nn!.online!.client!.state!.rev > r, k, { timeout: 15_000 })
      .catch(() => {});
  }
  for (const p of pages) await idle(p);
  const s0 = await snap(host);
  expect(JSON.parse(s0).rev).toBeGreaterThan(10);
  expect(await snap(a)).toBe(s0);
  expect(await snap(b)).toBe(s0);

  // sambung ulang: tab B dimuat ulang, kembali ke bidak yang sama
  const bPid = await b.evaluate(() => window.__nn!.online!.me);
  await b.reload();
  await b.waitForFunction(() => window.__nn?.online?.client?.state != null, null, {
    timeout: 15_000,
  });
  expect(await b.evaluate(() => window.__nn!.online!.me)).toBe(bPid);
  await idle(b);
  expect(await snap(b)).toBe(await snap(host));

  // hanya Host yang bisa mengakhiri permainan
  await expect(a.locator('#endGame')).toBeHidden();
  await host.click('#camLog');
  await host.click('#endGame');
  await host.locator('#modal:not(.hidden) button', { hasText: 'Akhiri sekarang' }).click();
  for (const p of pages)
    await expect(p.locator('#dlg h3')).toContainText('menang', { timeout: 15_000 });
  expect(errors).toEqual([]);
});

test('kode salah: pesan jelas, kembali ke menu', async ({ page }) => {
  await page.goto(Q);
  await page.fill('#mName', 'X');
  await page.fill('#mCode', 'ZZZZZ');
  await page.click('#mJoin');
  await expect(page.locator('#mErr')).toContainText('tidak ditemukan', { timeout: 10_000 });
});
