/**
 * Tata letak papan: jalur berkelok (Catmull-Rom) yang mengelilingi pulau, mulai ke kanan.
 * Diportir dari prototipe (blok "LAYOUT"). Murni, tanpa Three.js.
 */
import { PROVINCES, TILES } from '../engine/board';
import type { Player } from '../engine/types';

export type V2 = [number, number];

const CTRL0: V2[] = [
  [-1500, 1200],
  [-950, 1320],
  [-420, 1150],
  [120, 1300],
  [680, 1130],
  [1230, 1290],
  [1750, 1080],
  [1860, 560],
  [1720, 80],
  [1860, -420],
  [1700, -900],
  [1250, -1180],
  [720, -1000],
  [200, -1250],
  [-380, -1050],
  [-900, -1250],
  [-1450, -1020],
  [-1760, -560],
  [-1640, -120],
  [-1760, 360],
  [-1650, 820],
];
/** mulai di ruas yang lurus ke kanan */
const CTRL: V2[] = CTRL0.slice(2).concat(CTRL0.slice(0, 2));

export const F = 3.2;
export const G = F / 1.5;
export const PITCH = 120 * F;
export const TILE_H = 150 * F;

function crPt(p0: V2, p1: V2, p2: V2, p3: V2, t: number): V2 {
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (k: 0 | 1) =>
    0.5 *
    (2 * p1[k] +
      (-p0[k] + p2[k]) * t +
      (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
      (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
  return [f(0), f(1)];
}

function buildLayout(): { POS: V2[]; ANG: number[]; PATH: V2[] } {
  const n = CTRL.length;
  const N = TILES.length;
  const raw: V2[] = [];
  const at = (i: number) => CTRL[(i + n) % n] as V2;
  for (let i = 0; i < n; i++)
    for (let s = 0; s < 60; s++) raw.push(crPt(at(i - 1), at(i), at(i + 1), at(i + 2), s / 60));
  const cum = [0];
  for (let i = 1; i <= raw.length; i++) {
    const a = raw[i - 1]!;
    const b = raw[i % raw.length]!;
    cum.push(cum[i - 1]! + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const L = cum[cum.length - 1]!;
  const k = (N * PITCH) / L;
  const pos: V2[] = [];
  const ang: number[] = [];
  for (let i = 0; i < N; i++) {
    const d = (i * PITCH) / k;
    let j = 0;
    while (cum[j + 1]! < d) j++;
    const f = (d - cum[j]!) / (cum[j + 1]! - cum[j]!);
    const a = raw[j]!;
    const b = raw[(j + 1) % raw.length]!;
    pos.push([(a[0] + (b[0] - a[0]) * f) * k, (a[1] + (b[1] - a[1]) * f) * k]);
    ang.push((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI);
  }
  return { POS: pos, ANG: ang, PATH: raw.map((p) => [p[0] * k, p[1] * k] as V2) };
}

const LAYOUT = buildLayout();
export const POS: readonly V2[] = LAYOUT.POS;
export const ANG: readonly number[] = LAYOUT.ANG;
export const PATH: readonly V2[] = LAYOUT.PATH;

export const BOUNDS = POS.reduce(
  (b, q) => ({
    minx: Math.min(b.minx, q[0]),
    maxx: Math.max(b.maxx, q[0]),
    miny: Math.min(b.miny, q[1]),
    maxy: Math.max(b.maxy, q[1]),
  }),
  { minx: 1e9, maxx: -1e9, miny: 1e9, maxy: -1e9 },
);
export const MID: V2 = [
  POS.reduce((a, q) => a + q[0], 0) / POS.length,
  POS.reduce((a, q) => a + q[1], 0) / POS.length,
];

/** Petak kota per wilayah (untuk label wilayah). */
export const REGTILES: Readonly<Record<string, number[]>> = (() => {
  const r: Record<string, number[]> = {};
  const regOf = Object.fromEntries(PROVINCES.map((p) => [p.code, p.reg]));
  TILES.forEach((T, i) => {
    if (T.t === 'city') (r[regOf[T.p]!] ??= []).push(i);
  });
  return r;
})();

/** Posisi bidak di petaknya (koordinat dunia x,z), disusun rapi jika beberapa bidak sepetak. */
export function pawnXY(players: readonly Player[], p: Player): V2 {
  const same = players.filter((q) => !q.bankrupt && q.pos === p.pos);
  const k = Math.max(0, same.indexOf(p));
  const m = same.length;
  const q = POS[p.pos]!;
  const a = (ANG[p.pos]! * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const cols = m <= 4 ? m : Math.ceil(m / 2);
  const rows = m <= 4 ? 1 : 2;
  const col = k % cols;
  const row = Math.floor(k / cols);
  const sp = cols > 1 ? Math.min(46 * G, (160 * G) / (cols - 1)) : 0;
  const sg = ca >= 0 ? 1 : -1;
  const u = (col - (cols - 1) / 2) * sp;
  const v = sg * (52 * G + (row - (rows - 1) / 2) * 46 * G);
  return [q[0] + ca * u - sa * v, q[1] + sa * u + ca * v];
}
