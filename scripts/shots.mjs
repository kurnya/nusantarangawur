// Tangkapan layar pembanding: prototipe vs proyek baru.
// Pakai: node scripts/shots.mjs [urlBaru] [folderKeluar]
import { chromium } from '@playwright/test';

import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:5173/';
const out = process.argv[3] ?? 'test-results/shots';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const errors = [];
async function shoot(name, target, setup) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${name} console: ${m.text()}`));
  await page.goto(target);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${name}-intro.png` });
  await page.click('#start');
  await page.waitForTimeout(1000);
  await page.click('#camFx');
  await page.locator('.fxpanel .wxrow button', { hasText: /^Cerah$/ }).click();
  await page.click('#camFx');
  await page.waitForTimeout(setup ?? 5000);
  await page.screenshot({ path: `${out}/${name}-start.png` });
  await page.click('#camMap');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/${name}-map.png` });
  await page.close();
}
await shoot('proto', new URL('reference/prototype/index.html', url).href);
await shoot('baru', url);
await browser.close();
console.log(errors.length ? errors.join('\n') : 'tanpa error halaman');
