import { describe, expect, it } from 'vitest';
import { PROV } from '../src/engine/board';
import * as C from '../src/engine/config';
import { applyIntent } from '../src/engine/engine';
import {
  assetValue,
  mortgageValue,
  redeemCost,
  rentOf,
  saleValue,
  wealth,
} from '../src/engine/rules';
import { mkGame, ofType, own, place, rigDice, step } from './helpers';

const DKI = PROV.DKI!.tiles[0]!;
const BKL = PROV.BKL!.tiles[0]!;

describe('kelola aset: gadai, tebus, jual, bangun', () => {
  it('angka: gadai 60% nilai aset, tebus +10%, jual = nilai aset', () => {
    const s = mkGame(3);
    own(s, DKI, 0, 2);
    const av = assetValue(s, DKI);
    expect(mortgageValue(s, DKI)).toBe(Math.round((av * C.MORTGAGE_RATE) / 10) * 10);
    expect(redeemCost(s, DKI)).toBe(Math.round((mortgageValue(s, DKI) * 1.1) / 10) * 10);
    expect(saleValue(s, DKI)).toBe(av);
  });

  it('gadai kapan saja, termasuk di luar giliran: uang masuk, kota tetap milik, sewa 0', () => {
    const s = mkGame(3);
    own(s, DKI, 1, 1);
    expect(s.turn).toBe(0);
    const v = mortgageValue(s, DKI);
    const r = step(s, { t: 'mortgage', pid: 1, tile: DKI });
    expect(r.state.players[1]!.money).toBe(15000 + v);
    expect(r.state.owners[DKI]).toEqual({ p: 1, lv: 1, m: true });
    expect(rentOf(r.state, DKI)).toBe(0);
    expect(ofType(r.events, 'CityMortgaged')[0]).toMatchObject({ pid: 1, tile: DKI, value: v });
    expect(r.state.turn).toBe(0);
  });

  it('kota tergadai: tidak bisa dibangun atau digadai lagi', () => {
    const s = mkGame(3);
    own(s, DKI, 0);
    const g = step(s, { t: 'mortgage', pid: 0, tile: DKI }).state;
    expect(applyIntent(g, { t: 'build', pid: 0, tile: DKI }).ok).toBe(false);
    expect(applyIntent(g, { t: 'mortgage', pid: 0, tile: DKI }).ok).toBe(false);
  });

  it('tebus: bayar nilai gadai + bunga, sewa kembali', () => {
    const s = mkGame(3);
    own(s, DKI, 0, 1);
    const g = step(s, { t: 'mortgage', pid: 0, tile: DKI }).state;
    const cost = redeemCost(g, DKI);
    const r = step(g, { t: 'redeem', pid: 0, tile: DKI });
    expect(r.state.owners[DKI]).toEqual({ p: 0, lv: 1 });
    expect(r.state.players[0]!.money).toBe(g.players[0]!.money - cost);
    expect(rentOf(r.state, DKI)).toBeGreaterThan(0);
    g.players[0]!.money = 10;
    expect(applyIntent(g, { t: 'redeem', pid: 0, tile: DKI }).ok).toBe(false);
  });

  it('jual ke bank: kota lepas, uang = nilai jual; kota tergadai dipotong biaya tebus', () => {
    const s = mkGame(3);
    own(s, DKI, 2, 3);
    const v = saleValue(s, DKI);
    const r = step(s, { t: 'sell', pid: 2, tile: DKI });
    expect(r.state.owners[DKI]).toBeNull();
    expect(r.state.players[2]!.money).toBe(15000 + v);
    expect(ofType(r.events, 'CitySold')[0]!.forced).toBe(false);

    const s2 = mkGame(3);
    own(s2, DKI, 2, 3);
    const g = step(s2, { t: 'mortgage', pid: 2, tile: DKI }).state;
    expect(saleValue(g, DKI)).toBe(assetValue(g, DKI) - redeemCost(g, DKI));
  });

  it('bangun dari menu di luar giliran', () => {
    const s = mkGame(3);
    own(s, DKI, 2);
    const r = step(s, { t: 'build', pid: 2, tile: DKI });
    expect(r.state.owners[DKI]!.lv).toBe(1);
  });

  it('hanya pemilik yang bisa mengelola kotanya', () => {
    const s = mkGame(3);
    own(s, DKI, 1);
    for (const t of ['build', 'mortgage', 'redeem', 'sell'] as const)
      expect(applyIntent(s, { t, pid: 0, tile: DKI }).ok).toBe(false);
    expect(applyIntent(s, { t: 'sell', pid: 0, tile: 3 }).ok).toBe(false);
  });

  it('mendarat di kota lawan yang tergadai: bebas sewa', () => {
    let s = mkGame(3);
    own(s, DKI, 1, 3);
    s = step(s, { t: 'mortgage', pid: 1, tile: DKI }).state;
    place(s, 0, DKI - 7);
    const r = step(rigDice(s, 3, 4), { t: 'roll', pid: 0 });
    expect(ofType(r.events, 'RentWaived')).toHaveLength(1);
    expect(ofType(r.events, 'PaidRent')).toHaveLength(0);
    expect(r.state.players[0]!.money).toBe(15000);
  });

  it('kota tergadai tetap dihitung untuk kepemilikan provinsi', () => {
    const pr = PROV.SUT!;
    let s = mkGame(3);
    pr.tiles.forEach((t) => own(s, t, 0));
    s = step(s, { t: 'mortgage', pid: 0, tile: pr.tiles[0]! }).state;
    // kota lain di provinsi itu tetap pakai sewa k=5
    expect(rentOf(s, pr.tiles[1]!)).toBe(rentOf(mkGameOwnAll(pr.tiles), pr.tiles[1]!));
  });

  it('jual paksa: kota tidak tergadai dijual lebih dulu', () => {
    let s = mkGame(3);
    own(s, BKL, 0); // murah
    own(s, PROV.SUT!.tiles[1]!, 0);
    own(s, DKI + 1, 1, 3);
    s = step(s, { t: 'mortgage', pid: 0, tile: BKL }).state;
    s.players[0]!.money = 0;
    place(s, 0, DKI + 1 - 7);
    const r = step(rigDice(s, 3, 4), { t: 'roll', pid: 0 });
    const sold = ofType(r.events, 'CitySold');
    expect(sold[0]!.tile).toBe(PROV.SUT!.tiles[1]!);
    expect(sold[0]!.forced).toBe(true);
  });

  it('kekayaan memperhitungkan gadai', () => {
    let s = mkGame(3);
    own(s, DKI, 0, 2);
    const before = wealth(s, 0);
    s = step(s, { t: 'mortgage', pid: 0, tile: DKI }).state;
    // uang + (nilai aset - biaya tebus) = sebelum + gadai - tebus
    expect(wealth(s, 0)).toBe(before + mortgageValue(s, DKI) - redeemCost(s, DKI));
  });
});

function mkGameOwnAll(tiles: number[]) {
  const s = mkGame(3);
  tiles.forEach((t) => own(s, t, 0));
  return s;
}
