/* global document, window -- dipakai di dalam page.evaluate (konteks browser) */
// Tangkapan layar ukuran HP. Pakai: node scripts/mobile-shot.mjs [url] [folder]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const url = process.argv[2] ?? 'http://localhost:4173/?fast=1&mode=local';
const out = process.argv[3] ?? 'test-results/mobile';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
for (const [name, w, h] of [
  ['hp', 390, 844],
  ['hp-lanskap', 844, 390],
  ['tablet', 820, 1180],
]) {
  const p = await b.newPage({
    viewport: { width: w, height: h },
    deviceScaleFactor: 1,
    hasTouch: true,
  });
  await p.goto(url);
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}/${name}-setup.png` });
  await p.click('#start');
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}/${name}-main.png` });
  await p.click('#camLog');
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}/${name}-log.png` });
  const ov = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  console.log(name, 'overflow-x', ov);
  await p.close();
}
await b.close();
