/** Bot sederhana dan deterministik, untuk tes simulasi. */
import { TILES } from './board';
import * as C from './config';
import { applyIntent, createGame } from './engine';
import { buildCost, canBuild, cityPrice, redeemCost } from './rules';
import type { Ownership } from './types';

/** kota milik pemain yang memenuhi syarat, harga termurah */
function cheapest(s: GameState, pid: number, ok: (o: Ownership) => boolean): number | null {
  let best: number | null = null;
  let bp = Infinity;
  s.owners.forEach((o, i) => {
    if (!o || o.p !== pid || !ok(o)) return;
    const pr = cityPrice(cityOf(i)!.prov);
    if (pr < bp) {
      bp = pr;
      best = i;
    }
  });
  return best;
}
import { cityOf } from './board';
import type { GameState, Intent } from './types';

/** Gaya bot berbeda-beda per pemain supaya permainan bervariasi. */
export function botIntent(s: GameState): Intent {
  const p = s.players[s.turn]!;
  const reserve = 500 + (p.id % 3) * 1000;
  // uang menipis: gadaikan kota termurah yang belum tergadai
  if (p.money < 300) {
    const t = cheapest(s, p.id, (o) => !o.m);
    if (t !== null) return { t: 'mortgage', pid: p.id, tile: t };
  }
  if (s.phase === 'roll') {
    if (p.jail > 0 && p.money > reserve + C.JAIL_FEE * 4) return { t: 'payJail', pid: p.id };
    return { t: 'roll', pid: p.id };
  }
  if (s.pending !== null) {
    const price = cityPrice(cityOf(s.pending)!.prov);
    if (p.money - price >= reserve) return { t: 'buy', pid: p.id };
  }
  for (let i = 0; i < TILES.length; i++) {
    if (!canBuild(s, p.id, i)) continue;
    if (p.money - buildCost(s, i, p.id) >= reserve * 2) return { t: 'build', pid: p.id, tile: i };
  }
  // uang longgar: tebus kota tergadai
  const m = cheapest(s, p.id, (o) => !!o.m);
  if (m !== null && p.money - redeemCost(s, m) >= reserve * 3)
    return { t: 'redeem', pid: p.id, tile: m };
  // gaya bot ke-3: sesekali menjual kota tergadai saat uang tipis
  if (m !== null && p.id % 3 === 2 && p.money < reserve) return { t: 'sell', pid: p.id, tile: m };
  if (s.dbl > 0 && p.jail <= 0) return { t: 'roll', pid: p.id };
  return { t: 'endTurn', pid: p.id };
}

export interface SimResult {
  state: GameState;
  steps: number;
  /** true jika berakhir sendiri (bangkrut), false jika dipaksa endGame di batas langkah */
  natural: boolean;
}

export function simulate(
  nPlayers: number,
  seed: number,
  maxSteps = 20000,
  onStep?: (s: GameState) => void,
): SimResult {
  let s = createGame({
    seed,
    players: Array.from({ length: nPlayers }, (_, i) => ({ name: `Bot${i + 1}`, pawn: i })),
  });
  let steps = 0;
  while (s.phase !== 'over' && steps < maxSteps) {
    const r = applyIntent(s, botIntent(s));
    if (!r.ok) throw new Error(`bot memberi niat tidak sah: ${r.reason}`);
    s = r.state;
    steps++;
    onStep?.(s);
  }
  let natural = true;
  if (s.phase !== 'over') {
    natural = false;
    const r = applyIntent(s, { t: 'endGame' });
    if (!r.ok) throw new Error(r.reason);
    s = r.state;
  }
  return { state: s, steps, natural };
}
