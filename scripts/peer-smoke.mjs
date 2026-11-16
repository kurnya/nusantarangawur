/* global window -- dipakai di dalam page.evaluate (konteks browser) */
// Uji asap PeerJS sungguhan: dua konteks browser terpisah (seperti dua perangkat), broker publik.
// Pakai: node scripts/peer-smoke.mjs [baseUrl]
import { chromium } from '@playwright/test';
const base = process.argv[2] ?? 'http://localhost:4173/';
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
await host.goto(base + '?fast=1&low=1', { waitUntil: 'domcontentloaded' });
await host.fill('#mName', 'Host');
await host.click('#mCreate');
await host.waitForSelector('#lbCode', { timeout: 30000 });
const code = (await host.textContent('#lbCode')).trim();
console.log('ruangan', code, 'dibuka dalam', Date.now() - t0, 'ms');
const t1 = Date.now();
await guest.goto(`${base}?fast=1&low=1#/join/${code}`, { waitUntil: 'domcontentloaded' });
await guest.waitForSelector('#lbCode', { timeout: 30000 });
await host.waitForFunction(() => window.__nn.online.client.lobby.players.length === 2, null, {
  timeout: 20000,
});
console.log('tamu tersambung lewat WebRTC dalam', Date.now() - t1, 'ms');
await guest.waitForFunction(() => window.__nn.online.client.ping >= 0, null, { timeout: 15000 });
console.log('ping tamu ke host:', await guest.evaluate(() => window.__nn.online.client.ping), 'ms');
console.log(errs.length ? errs.join('\n') : 'tanpa error halaman');
await b.close();
