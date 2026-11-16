/* global window, document -- dipakai di dalam page.evaluate (konteks browser) */
// Verifikasi hasil build di bawah sub-path GitHub Pages.
// 1) VITE_BASE=/nusantara-ngawur/ npm run build
// 2) VITE_BASE=/nusantara-ngawur/ npx vite preview --port 4174
// 3) node scripts/pages-check.mjs http://localhost:4174/nusantara-ngawur/
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:4174/nusantara-ngawur/';
const b = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const ctx = await b.newContext({ viewport: { width: 1000, height: 700 } });
const bad = [];
const errors = [];
ctx.on('response', (r) => {
  // manifest model GLB memang opsional (404 = pakai model bawaan)
  if (r.status() >= 400 && !r.url().includes('/models/manifest.json'))
    bad.push(`${r.status()} ${r.url()}`);
});
const page = async () => {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  return p;
};
let ok = true;
const check = (cond, msg) => {
  console.log(`${cond ? 'OK  ' : 'GAGAL'} ${msg}`);
  if (!cond) ok = false;
};

// mode satu perangkat
const p = await page();
await p.goto(base + '?mode=local&fast=1&low=1');
await p.click('#start');
await p.waitForSelector('#acts button');
for (let k = 0; k < 6; k++) {
  const btn = p.locator('#acts button:not([disabled])').first();
  await btn.click();
  await p.waitForFunction(() => !window.__nn?.game?.playing);
  const modal = p.locator('#modal:not(.hidden) .row button').first();
  if (await modal.isVisible()) await modal.click();
}
const rev = await p.evaluate(() => window.__nn.game.state.rev);
check(rev > 0, `mode satu perangkat berjalan (rev ${rev})`);
const imgs = await p.evaluate(() =>
  [...document.querySelectorAll('img')].map((i) => ({
    src: i.src,
    ok: i.complete && i.naturalWidth > 0,
  })),
);
check(imgs.length > 0 && imgs.every((i) => i.ok), `${imgs.length} gambar UI termuat dari sub-path`);
check(
  imgs.every((i) => new URL(i.src).pathname.startsWith(new URL(base).pathname)),
  'semua gambar memakai base path',
);

// mode online antar tab: tautan undangan memuat sub-path
const h = await page();
await h.goto(base + '?fast=1&low=1&net=tab');
await h.fill('#mName', 'Host');
await h.click('#mCreate');
await h.waitForSelector('#lbCode', { timeout: 30000 });
const invite = await h.inputValue('#lbLink');
check(
  new URL(invite).pathname === new URL(base).pathname,
  `tautan undangan memakai sub-path: ${invite}`,
);
const g = await page();
const u = new URL(invite);
u.search = '?fast=1&low=1&net=tab';
await g.goto(u.href);
await g.waitForSelector('#lbCode', { timeout: 30000 });
check(
  (await g.textContent('#lbCode')).trim() === (await h.textContent('#lbCode')).trim(),
  'tamu bergabung lewat tautan undangan',
);

check(bad.length === 0, `tanpa respons gagal${bad.length ? ': ' + bad.join(', ') : ''}`);
check(errors.length === 0, `tanpa error halaman${errors.length ? ': ' + errors.join(' | ') : ''}`);
await b.close();
process.exit(ok ? 0 : 1);
