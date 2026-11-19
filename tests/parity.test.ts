/**
 * Paritas dengan prototipe: rumus dan data dijalankan langsung dari reference/prototype/index.html
 * lalu dibandingkan dengan mesin baru.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PROVINCES, TILES, jailNear } from '../src/engine/board';
import * as C from '../src/engine/config';
import { cityPrice, fmtMoney, rentFor } from '../src/engine/rules';
import { goodChance } from '../src/engine/weather';
import type { WeatherKey } from '../src/engine/types';

const html = readFileSync('reference/prototype/index.html', 'utf8');
const line = (re: RegExp) => {
  const m = html.match(re);
  if (!m) throw new Error(`tidak ketemu di prototipe: ${re}`);
  return m[0];
};
const wxBlock = html.slice(html.indexOf('const WX={'), html.indexOf('const WXW='));
const proto = new Function(
  [
    line(/^const cityPrice=.*$/m),
    line(/^function rentFor.*$/m),
    line(/^function fmt\(.*$/m),
    'const LVMULT=' + line(/LVMULT=\[[^\]]*\]/).split('=')[1] + ';',
    wxBlock,
    'const goodChance=l=>Math.max(.02,Math.min(.9,l>=0?.2+l:.2*(1+l)));',
    'return {cityPrice,rentFor,fmt,WX,goodChance};',
  ].join('\n'),
)() as {
  cityPrice: (p: { price: number }) => number;
  rentFor: (p: { price: number }, k: number, lv: number) => number;
  fmt: (n: number) => string;
  WX: Record<string, { luck: number }>;
  goodChance: (l: number) => number;
};

describe('paritas dengan prototipe', () => {
  it('harga kota semua provinsi', () => {
    for (const p of PROVINCES) expect(cityPrice(p)).toBe(proto.cityPrice(p));
  });

  it('sewa untuk semua provinsi x k x level', () => {
    for (const p of PROVINCES)
      for (let k = 1; k <= 5; k++)
        for (let lv = 0; lv <= 3; lv++)
          expect(rentFor(p, k, lv), `${p.code} k=${k} lv=${lv}`).toBe(proto.rentFor(p, k, lv));
  });

  it('format uang', () => {
    for (const n of [0, 10, 50, 999, 1000, 1500, 2000, 12345, 15000, -300, -2500])
      expect(fmtMoney(n)).toBe(proto.fmt(n));
  });

  it('luck cuaca dan peluang Nasib baik', () => {
    for (const k of Object.keys(C.WEATHER) as WeatherKey[]) {
      expect(C.WEATHER[k].luck, k).toBe(proto.WX[k]!.luck);
      expect(goodChance(k), k).toBeCloseTo(proto.goodChance(proto.WX[k]!.luck), 10);
    }
  });

  it('angka peluang sesuai brief', () => {
    expect(goodChance('cerah')).toBeCloseTo(0.5);
    expect(goodChance('berawan')).toBeCloseTo(0.3);
    expect(goodChance('hujan')).toBeCloseTo(0.2);
    expect(goodChance('kabut')).toBeCloseTo(0.1);
    expect(goodChance('asap')).toBeCloseTo(0.04);
  });

  it('komposisi papan sesuai brief', () => {
    const cnt: Record<string, number> = {};
    for (const T of TILES) {
      const k = T.t === 'city' ? 'city' : T.k;
      cnt[k] = (cnt[k] ?? 0) + 1;
    }
    expect(TILES.length).toBe(279);
    expect(cnt).toEqual({
      START: 1,
      city: 190,
      NASIB: 57,
      BENCANA: 19,
      RAZIA: 4,
      JAIL: 4,
      PAJAK: 3,
      PARK: 1,
    });
    expect(PROVINCES.length).toBe(38);
    PROVINCES.forEach((p) => expect(p.tiles.length).toBe(5));
  });

  it('menyisipkan Nasib atau Bencana setiap dua atau tiga kota', () => {
    let cities = 0;
    let previous = 0;
    TILES.forEach((T) => {
      if (T.t === 'city') {
        cities++;
        return;
      }
      if (!['NASIB', 'BENCANA'].includes(T.k)) return;
      expect(cities - previous).toBeGreaterThanOrEqual(2);
      expect(cities - previous).toBeLessThanOrEqual(3);
      previous = cities;
    });
  });

  it('bobot cuaca sesuai brief', () => {
    const w = Object.fromEntries(Object.entries(C.WEATHER).map(([k, v]) => [k, v.weight]));
    expect(w).toEqual({
      cerah: 22,
      berawan: 20,
      hujan: 16,
      badai: 10,
      panas: 12,
      kabut: 12,
      asap: 8,
    });
  });

  it('penjara terdekat', () => {
    const jails = TILES.map((T, i) => (T.t === 'sp' && T.k === 'JAIL' ? i : -1)).filter(
      (i) => i >= 0,
    );
    for (const j of jails) expect(jailNear(j)).toBe(j);
    for (let pos = 0; pos < TILES.length; pos++) expect(jails).toContain(jailNear(pos));
  });
});
