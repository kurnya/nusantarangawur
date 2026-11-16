import { test } from '@playwright/test';

/**
 * Tes visual ringan: tangkapan layar tiap cuaca dan tiap animasi Bencana untuk diperiksa manual.
 * Hasil: test-results/visual/*.png. Jalankan: npm run test:visual
 */
const OUT = 'test-results/visual';
const WX = [
  'Cerah',
  'Berawan',
  'Hujan',
  'Hujan badai petir',
  'Panas terik',
  'Berkabut',
  'Kabut asap',
];
const FX = [
  'Banjir',
  'Banjir rob',
  'Gunung meletus',
  'Gempa bumi',
  'Tsunami',
  'Kebakaran hutan',
  'Tanah longsor',
  'Kekeringan',
  'Puting beliung',
  'Meteor',
  'Hujan meteor',
  'Petir menyambar bidak',
];

test.describe.configure({ mode: 'serial' });

test('cuaca @visual', async ({ page }) => {
  test.setTimeout(600_000);
  await page.goto('?mode=local&dev=1');
  await page.click('#start');
  await page.waitForTimeout(1500);
  for (const w of WX) {
    await page.click('#camFx');
    await page.locator('.fxpanel .wxrow button', { hasText: new RegExp(`^${w}$`) }).click();
    await page.click('#camFx');
    await page.waitForTimeout(4500);
    await page.screenshot({ path: `${OUT}/cuaca-${w.replace(/\s+/g, '-').toLowerCase()}.png` });
  }
});

test('animasi bencana @visual', async ({ page }) => {
  test.setTimeout(900_000);
  await page.goto('?mode=local&dev=1');
  await page.click('#start');
  await page.waitForTimeout(1500);
  const only = process.env.FX_ONLY?.split(',');
  for (const f of FX.filter((x) => !only || only.includes(x))) {
    await page.click('#camFx');
    await page.locator('.fxpanel > button', { hasText: new RegExp(` ${f}$`) }).click();
    await page.waitForTimeout(2600);
    const nm = f.replace(/\s+/g, '-').toLowerCase();
    await page.screenshot({ path: `${OUT}/fx-${nm}-a.png` });
    await page.waitForTimeout(6000);
    await page.screenshot({ path: `${OUT}/fx-${nm}-b.png` });
    await page.waitForFunction(() => !document.querySelector('.fxpanel button[disabled]'), null, {
      timeout: 150_000,
    });
    await page.click('#camFx');
  }
});
