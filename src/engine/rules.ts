import * as C from './config';
import { PROV, TILES } from './board';
import type { GameState, Province } from './types';

const prov = (tile: number): Province => {
  const T = TILES[tile];
  if (!T || T.t !== 'city') throw new Error(`petak ${tile} bukan kota`);
  return PROV[T.p] as Province;
};

export const cityPrice = (p: Province): number =>
  Math.round((p.price * C.CITY_PRICE_RATE) / 10) * 10;

/** k = jumlah kota yang dipegang pemilik di provinsi itu (1..5). */
export function rentFor(p: Province, k: number, level: number): number {
  const base = cityPrice(p) * C.RENT_RATE * (1 + C.RENT_SET_STEP * (k - 1)) * C.LVMULT[level]!;
  return Math.max(C.MIN_RENT, Math.round(base / 10) * 10);
}

export function ownedCount(s: GameState, pid: number, p: Province): number {
  return p.tiles.filter((i) => s.owners[i]?.p === pid).length;
}

export function rentOf(s: GameState, tile: number): number {
  const o = s.owners[tile];
  if (!o || o.m) return 0;
  const p = prov(tile);
  return rentFor(p, ownedCount(s, o.p, p), o.lv);
}

export function buildCost(s: GameState, tile: number, pid: number): number {
  const c = Math.round((cityPrice(prov(tile)) * C.BUILD_RATE) / 10) * 10;
  return s.players[pid]?.disc ? Math.round(c / 20) * 10 : c;
}

export function canBuild(s: GameState, pid: number, tile: number): boolean {
  const o = s.owners[tile];
  return !!o && o.p === pid && !o.m && o.lv < C.MAX_LEVEL;
}

export function assetValue(s: GameState, tile: number): number {
  const o = s.owners[tile];
  if (!o) return 0;
  const cp = cityPrice(prov(tile));
  return Math.round(cp * C.ASSET_BASE + o.lv * cp * C.ASSET_PER_LEVEL);
}

/** uang yang diterima saat kota digadaikan */
export function mortgageValue(s: GameState, tile: number): number {
  return Math.round((assetValue(s, tile) * C.MORTGAGE_RATE) / 10) * 10;
}

/** biaya menebus kota tergadai (nilai gadai + bunga) */
export function redeemCost(s: GameState, tile: number): number {
  return Math.round((mortgageValue(s, tile) * (1 + C.REDEEM_INTEREST)) / 10) * 10;
}

/** uang yang diterima saat kota dijual ke bank; kota tergadai dipotong biaya tebus */
export function saleValue(s: GameState, tile: number): number {
  const o = s.owners[tile];
  if (!o) return 0;
  return Math.max(0, assetValue(s, tile) - (o.m ? redeemCost(s, tile) : 0));
}

/** kekayaan = uang + nilai jual semua kota (kota tergadai sudah dipotong biaya tebus) */
export function wealth(s: GameState, pid: number): number {
  let w = s.players[pid]?.money ?? 0;
  s.owners.forEach((o, i) => {
    if (o && o.p === pid) w += saleValue(s, i);
  });
  return w;
}

export const alive = (s: GameState) => s.players.filter((p) => !p.bankrupt);

export function fmtMoney(n: number): string {
  const sign = n < 0 ? '-' : '';
  n = Math.abs(Math.round(n));
  if (n >= 1000) {
    const v = n / 1000;
    const txt = String(Number.isInteger(v) ? v : parseFloat(v.toFixed(2))).replace('.', ',');
    return `${sign}Rp${txt} M`;
  }
  return `${sign}Rp${n} jt`;
}
