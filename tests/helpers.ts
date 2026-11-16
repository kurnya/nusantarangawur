import { TILES } from '../src/engine/board';
import { applyIntent, createGame } from '../src/engine/engine';
import { Rng } from '../src/engine/rng';
import type {
  GameEvent,
  GameState,
  Intent,
  IntentOk,
  SpecialKind,
  WeatherKey,
} from '../src/engine/types';

export function mkGame(n = 3, weather: WeatherKey = 'cerah', seed = 1): GameState {
  const s = createGame({
    seed,
    players: Array.from({ length: n }, (_, i) => ({ name: `P${i}`, pawn: i })),
  });
  s.weather = weather;
  return s;
}

/** Cari seed RNG yang memenuhi predikat (predikat mereplikasi urutan pengambilan angka acak). */
export function rig(s: GameState, pred: (r: Rng) => boolean): GameState {
  for (let seed = 1; seed < 2_000_000; seed++) {
    if (pred(new Rng(seed))) return { ...s, rng: seed };
  }
  throw new Error('seed tidak ketemu');
}

/** Atur dadu berikutnya jadi (a,b). Hanya benar jika cuaca tidak mengarahkan dadu. */
export function rigDice(
  s: GameState,
  a: number,
  b: number,
  extra: (r: Rng) => boolean = () => true,
): GameState {
  return rig(s, (r) => r.d6() === a && r.d6() === b && extra(r));
}

export function place(s: GameState, pid: number, pos: number): void {
  (s.players[pid] as { pos: number }).pos = pos;
}
export function own(s: GameState, tile: number, pid: number, lv = 0): void {
  s.owners[tile] = { p: pid, lv };
}
export function tilesOf(kind: SpecialKind): number[] {
  return TILES.map((T, i) => (T.t === 'sp' && T.k === kind ? i : -1)).filter((i) => i >= 0);
}
export function cityTiles(): number[] {
  return TILES.map((T, i) => (T.t === 'city' ? i : -1)).filter((i) => i >= 0);
}

export function step(s: GameState, i: Intent): IntentOk {
  const r = applyIntent(s, i);
  if (!r.ok) throw new Error(`ditolak: ${r.reason}`);
  return r;
}
export const has = (ev: GameEvent[], e: GameEvent['e']) => ev.some((x) => x.e === e);
export const ofType = <K extends GameEvent['e']>(ev: GameEvent[], e: K) =>
  ev.filter((x): x is Extract<GameEvent, { e: K }> => x.e === e);

/** Cek invarian state. Mengembalikan daftar pelanggaran. */
export function violations(s: GameState): string[] {
  const v: string[] = [];
  const n = s.players.length;
  s.players.forEach((p) => {
    if (!Number.isInteger(p.money)) v.push(`uang bukan integer: P${p.id} ${p.money}`);
    if (p.money < 0) v.push(`uang negatif: P${p.id} ${p.money}`);
    if (p.pos < 0 || p.pos >= TILES.length) v.push(`posisi di luar papan: P${p.id}`);
    if (p.jail < 0 || p.skip < 0 || p.free < 0) v.push(`penghitung negatif: P${p.id}`);
    if (p.bankrupt && p.money !== 0) v.push(`bangkrut tapi punya uang: P${p.id}`);
  });
  if (s.owners.length !== TILES.length) v.push('panjang owners salah');
  s.owners.forEach((o, i) => {
    if (!o) return;
    const T = TILES[i];
    if (!T || T.t !== 'city') v.push(`pemilik di petak bukan kota: ${i}`);
    const p = s.players[o.p];
    if (!p) v.push(`pemilik tidak ada: petak ${i}`);
    else if (p.bankrupt) v.push(`pemilik sudah bangkrut: petak ${i}`);
    if (o.lv < 0 || o.lv > 3) v.push(`level tidak sah: petak ${i}`);
  });
  if (s.phase !== 'over' && s.players[s.turn]?.bankrupt) v.push('giliran jatuh ke pemain bangkrut');
  if (s.turn < 0 || s.turn >= n) v.push('turn di luar jangkauan');
  if (s.pending !== null) {
    if (s.owners[s.pending]) v.push('pending menunjuk kota yang sudah dimiliki');
    if (TILES[s.pending]?.t !== 'city') v.push('pending bukan kota');
  }
  return v;
}
