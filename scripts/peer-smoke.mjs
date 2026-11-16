/* global window -- dipakai di dalam page.evaluate (konteks browser) */
// Uji asap PeerJS sungguhan: dua konteks browser terpisah (seperti dua perangkat), broker publik.
// Pakai: node scripts/peer-smoke.mjs [baseUrl]   (tambahkan ?relay=1 di baseUrl untuk memaksa lewat TURN)
import { chromium } from '@playwright/test';
const base = process.argv[2] ?? 'http://localhost:4173/';
/** gabungkan query bawaan uji dengan query di baseUrl */
const at = (hash = '') => {
  const u = new URL(base);
  u.searchParams.set('fast', '1');
  u.searchParams.set('low', '1');
  return u.href.replace(/#.*$/, '') + hash;
};
const b = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const errs = [];
const mk = async (name) => {
  const ctx = await b.newContext({ viewport: { width: 900, height: 700 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`${name}: ${e.message}`));
  return p;
};
const host = await mk('host');
const guest = await mk('guest');
const t0 = Date.now();
await host.goto(at(), { waitUntil: 'domcontentloaded' });
await host.fill('#mName', 'Host');
await host.click('#mCreate');
await host.waitForSelector('#lbCode', { timeout: 30000 });
const code = (await host.textContent('#lbCode')).trim();
console.log('ruangan', code, 'dibuka dalam', Date.now() - t0, 'ms');
const t1 = Date.now();
await guest.goto(at(`#/join/${code}`), { waitUntil: 'domcontentloaded' });
await guest.waitForSelector('#lbCode', { timeout: 30000 });
await host.waitForFunction(() => window.__nn.online.client.lobby.players.length === 2, null, {
  timeout: 20000,
});
console.log('tamu tersambung lewat WebRTC dalam', Date.now() - t1, 'ms');
await guest.waitForFunction(() => window.__nn.online.client.ping >= 0, null, { timeout: 15000 });
console.log('ping tamu ke host:', await guest.evaluate(() => window.__nn.online.client.ping), 'ms');
console.log('jalur:', await guest.evaluate(() => window.__nn.online.client.route()));
console.log(errs.length ? errs.join('\n') : 'tanpa error halaman');
await b.close();
