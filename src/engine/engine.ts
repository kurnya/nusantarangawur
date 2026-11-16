/**
 * Mesin permainan murni dan deterministik.
 * applyIntent(state, intent) -> { ok, state, events } | { ok:false, reason }
 * Tidak memakai DOM, Three.js, waktu, atau Math.random. Semua acak lewat Rng di state.
 */
import * as C from './config';
import { CARDS, N_TILES, TILES, cityOf, jailNear } from './board';
import { Rng } from './rng';
import {
  alive,
  assetValue,
  buildCost,
  canBuild,
  cityPrice,
  ownedCount,
  rentOf,
  wealth,
} from './rules';
import { goodChance, nextWeather } from './weather';
import type {
  Card,
  CardKind,
  Effect,
  GameEvent,
  GameState,
  Intent,
  IntentResult,
  MoneyReason,
  Player,
  WeatherKey,
} from './types';

export interface NewGameOptions {
  players: { name: string; pawn: number }[];
  seed: number;
  startMoney?: number;
}

export function createGame(opts: NewGameOptions): GameState {
  const n = opts.players.length;
  if (n < 2 || n > C.MAX_PLAYERS) throw new Error(`jumlah pemain tidak sah: ${n}`);
  const rng = new Rng(opts.seed | 0);
  const money = opts.startMoney ?? C.START_MONEY;
  const players: Player[] = opts.players.map((p, id) => ({
    id,
    name: p.name,
    pawn: p.pawn,
    money,
    pos: 0,
    jail: 0,
    skip: 0,
    free: 0,
    disc: false,
    bankrupt: false,
  }));
  const weather = nextWeather(rng, null);
  return {
    rev: 0,
    players,
    owners: TILES.map(() => null),
    turn: 0,
    phase: 'roll',
    dbl: 0,
    pending: null,
    last: 0,
    weather,
    rng: rng.state,
    winner: null,
  };
}

const err = (reason: string): IntentResult => ({ ok: false, reason });

/** Salinan dalam state (lebih cepat dari structuredClone). */
export function cloneState(s: GameState): GameState {
  return {
    ...s,
    players: s.players.map((p) => ({ ...p })),
    owners: s.owners.map((o) => (o ? { ...o } : null)),
  };
}

export function applyIntent(state: GameState, intent: Intent): IntentResult {
  if (state.phase === 'over') return err('Permainan sudah selesai.');
  const bad = validate(state, intent);
  if (bad) return err(bad);
  const g = new Game(state);
  g.run(intent);
  return g.result();
}

/** Cek aturan tanpa mengubah state. Mengembalikan alasan penolakan, atau null jika sah. */
export function validate(s: GameState, i: Intent): string | null {
  if (s.phase === 'over') return 'Permainan sudah selesai.';
  if (i.t === 'weather' || i.t === 'endGame') return null;
  const p = s.players[i.pid];
  if (!p || p.bankrupt) return 'Pemain tidak dikenal.';
  if (i.pid !== s.turn) return 'Bukan giliranmu.';
  switch (i.t) {
    case 'roll':
      if (s.phase === 'roll') return null;
      if (s.phase === 'act' && s.dbl > 0 && p.jail <= 0) return null;
      return 'Belum waktunya melempar dadu.';
    case 'payJail':
      if (s.phase !== 'roll' || p.jail <= 0) return 'Kamu tidak sedang di penjara.';
      return p.money < C.JAIL_FEE ? 'Uang tidak cukup untuk denda.' : null;
    case 'buy': {
      if (s.phase !== 'act' || s.pending === null) return 'Tidak ada kota untuk dibeli.';
      const T = TILES[s.pending];
      if (!T || T.t !== 'city') return 'Petak tidak sah.';
      return p.money < cityPrice(cityOf(s.pending)!.prov) ? 'Uang tidak cukup.' : null;
    }
    case 'build': {
      if (!Number.isInteger(i.tile) || i.tile < 0 || i.tile >= N_TILES) return 'Petak tidak sah.';
      if (!canBuild(s, i.pid, i.tile)) return 'Kota ini tidak bisa dibangun.';
      return p.money < buildCost(s, i.tile, i.pid) ? 'Uang tidak cukup.' : null;
    }
    case 'endTurn':
      return s.phase === 'act' ? null : 'Belum bisa mengakhiri giliran.';
  }
}

class Game {
  private s: GameState;
  private rng: Rng;
  private ev: GameEvent[] = [];

  constructor(prev: GameState) {
    this.s = cloneState(prev);
    this.rng = new Rng(this.s.rng);
  }

  result(): IntentResult {
    this.s.rng = this.rng.state;
    this.s.rev += 1;
    return { ok: true, state: this.s, events: this.ev };
  }

  private get over(): boolean {
    return this.s.phase === 'over';
  }
  private emit(e: GameEvent): void {
    this.ev.push(e);
  }
  private player(id: number): Player {
    return this.s.players[id] as Player;
  }
  private get cur(): Player {
    return this.player(this.s.turn);
  }
  private mine(pid: number): number[] {
    const r: number[] = [];
    this.s.owners.forEach((o, i) => {
      if (o && o.p === pid) r.push(i);
    });
    return r;
  }

  run(i: Intent): void {
    switch (i.t) {
      case 'roll':
        return this.doRoll();
      case 'payJail':
        return this.doPayJail();
      case 'buy':
        return this.doBuy();
      case 'build':
        return this.doBuild(i.tile);
      case 'endTurn':
        return this.endTurn();
      case 'weather':
        return this.doWeather();
      case 'endGame':
        return this.doEndGame();
    }
  }

  /* ---------- uang ---------- */

  private change(p: Player, amt: number, reason: MoneyReason): void {
    p.money += amt;
    this.emit({ e: 'MoneyChanged', pid: p.id, amount: amt, reason });
    if (p.money < 0) this.settle(p);
  }

  private pay(from: Player, to: Player, amt: number, tile: number): void {
    from.money -= amt;
    to.money += amt;
    this.emit({ e: 'PaidRent', from: from.id, to: to.id, amount: amt, tile });
    if (from.money < 0) this.settle(from);
  }

  /** Uang negatif: jual kota termurah satu per satu; kalau masih negatif, bangkrut. */
  private settle(p: Player): void {
    while (p.money < 0) {
      const mine = this.mine(p.id);
      if (!mine.length) break;
      const price = (t: number) => cityPrice(cityOf(t)!.prov);
      mine.sort((a, b) => price(a) - price(b) || a - b);
      const k = mine[0] as number;
      const v = assetValue(this.s, k);
      p.money += v;
      this.s.owners[k] = null;
      this.emit({ e: 'CitySold', pid: p.id, tile: k, value: v });
    }
    if (p.money < 0) this.bankrupt(p);
  }

  private bankrupt(p: Player): void {
    p.bankrupt = true;
    p.money = 0;
    this.s.owners.forEach((o, i) => {
      if (o && o.p === p.id) this.s.owners[i] = null;
    });
    this.emit({ e: 'Bankrupt', pid: p.id });
    const a = alive(this.s);
    if (a.length <= 1) {
      this.s.phase = 'over';
      this.s.winner = a[0]?.id ?? null;
      this.emit({
        e: 'GameOver',
        winner: this.s.winner,
        ranking: a.map((q) => ({ pid: q.id, wealth: wealth(this.s, q.id) })),
      });
    }
  }

  /* ---------- gerak dan pendaratan ---------- */

  private move(p: Player, n: number, depth: number): void {
    const dir = n >= 0 ? 1 : -1;
    for (let k = 0; k < Math.abs(n); k++) {
      const from = p.pos;
      const np = (p.pos + dir + N_TILES) % N_TILES;
      p.pos = np;
      this.emit({ e: 'PawnStepped', pid: p.id, from, to: np });
      if (dir > 0 && np === 0) {
        this.emit({ e: 'PassedStart', pid: p.id, amount: C.SALARY });
        this.change(p, C.SALARY, 'salary');
      }
    }
    if (!this.over) this.land(p, depth);
  }

  private goJail(p: Player, reason: 'razia' | 'kartu' | 'kembar3'): void {
    p.pos = jailNear(p.pos);
    p.jail = C.JAIL_TURNS;
    this.s.dbl = 0;
    this.s.pending = null;
    this.emit({ e: 'PlayerJailed', pid: p.id, pos: p.pos, reason });
  }

  private loseCity(p: Player, pre: number | null): void {
    const mine = this.mine(p.id);
    if (!mine.length) {
      this.emit({ e: 'NoCityFine', pid: p.id, amount: C.NO_CITY_FINE });
      this.change(p, -C.NO_CITY_FINE, 'fine');
      return;
    }
    const k = pre !== null && this.s.owners[pre]?.p === p.id ? pre : this.rng.pick(mine);
    const o = this.s.owners[k]!;
    if (o.lv > 0) {
      o.lv--;
      this.emit({ e: 'CityLost', pid: p.id, tile: k, level: o.lv });
    } else {
      this.s.owners[k] = null;
      this.emit({ e: 'CityLost', pid: p.id, tile: k, level: null });
    }
  }

  private applyEffect(
    p: Player,
    e: Effect,
    depth: number,
    lcTile: number | null,
    reason: MoneyReason = 'card',
  ): void {
    if (e.m) this.change(p, e.m, reason);
    if (e.lc && !p.bankrupt) this.loseCity(p, lcTile);
    if (e.skip) p.skip += e.skip;
    if (e.free) p.free += e.free;
    if (e.disc) p.disc = true;
    if (p.bankrupt || this.over) return;
    if (e.jail) {
      this.goJail(p, 'kartu');
      return;
    }
    if (e.mv) this.move(p, e.mv, depth + 1);
  }

  private drawCard(p: Player, kind: CardKind, depth: number): void {
    let list: Card[];
    let tag: 'baik' | 'buruk' | 'bencana';
    let chance: number | undefined;
    if (kind === 'NASIB') {
      const gc = goodChance(this.s.weather);
      const bad = this.rng.float() >= gc;
      list = bad ? CARDS.nasibBad : CARDS.nasibGood;
      tag = bad ? 'buruk' : 'baik';
      if (C.WEATHER[this.s.weather].luck !== 0) chance = gc;
    } else {
      list = CARDS.bencana;
      tag = 'bencana';
    }
    const c = this.rng.pick(list);
    this.emit({ e: 'CardDrawn', pid: p.id, kind, tag, card: c.id, chance });
    let tk: number | null = null;
    if (c.e.lc) {
      const mine = this.mine(p.id);
      if (mine.length) tk = this.rng.pick(mine);
    }
    if (kind === 'BENCANA' && c.fx) {
      this.emit({ e: 'BencanaFx', key: c.fx, tile: tk ?? p.pos, player: p.id });
    }
    this.applyEffect(p, c.e, depth, tk);
  }

  private land(p: Player, depth: number): void {
    const i = p.pos;
    const T = TILES[i] as (typeof TILES)[number];
    this.s.pending = null;
    if (T.t === 'city') {
      const o = this.s.owners[i];
      if (!o) {
        this.s.pending = i;
        this.emit({ e: 'Landed', pid: p.id, tile: i, buyable: true });
      } else {
        this.emit({ e: 'Landed', pid: p.id, tile: i, buyable: false });
        if (o.p !== p.id) {
          const q = this.player(o.p);
          if (p.free > 0) {
            p.free--;
            this.emit({ e: 'TicketUsed', pid: p.id, tile: i });
          } else {
            this.pay(p, q, rentOf(this.s, i), i);
          }
        }
      }
    } else {
      this.emit({ e: 'Landed', pid: p.id, tile: i, buyable: false });
      const k = T.k;
      if (k === 'NASIB' || k === 'BENCANA') {
        if (depth >= C.CARD_DEPTH_LIMIT) this.emit({ e: 'CardIdle', pid: p.id, kind: k });
        else this.drawCard(p, k, depth);
      } else if (k === 'PAJAK') {
        const a = Math.max(C.PAJAK_MIN, Math.round((p.money * C.PAJAK_RATE) / 10) * 10);
        this.change(p, -a, 'pajak');
      } else if (k === 'PARK') {
        this.change(p, C.PARK_BONUS, 'park');
      } else if (k === 'RAZIA') {
        this.goJail(p, 'razia');
      }
    }
  }

  /* ---------- cuaca ---------- */

  /** Dadu diarahkan ke petak Nasib/Bencana saat cuaca berkabut. */
  private steerDice(p: Player, a: number, b: number): [number, number] {
    const l = C.WEATHER[this.s.weather].luck;
    if (l >= 0 || this.rng.float() >= -l) return [a, b];
    const isNB = (step: number) => {
      const T = TILES[(p.pos + step) % N_TILES];
      return !!T && T.t === 'sp' && (T.k === 'NASIB' || T.k === 'BENCANA');
    };
    if (isNB(a + b)) return [a, b];
    const c: number[] = [];
    for (let sum = 2; sum <= 12; sum++) {
      if (isNB(sum)) for (let k = 0; k < 6 - Math.abs(sum - 7); k++) c.push(sum);
    }
    if (!c.length) return [a, b];
    const t = this.rng.pick(c);
    const lo = Math.max(1, t - 6);
    const hi = Math.min(6, t - 1);
    const na = lo + this.rng.int(hi - lo + 1);
    this.emit({ e: 'DiceSteered', pid: p.id, weather: this.s.weather });
    return [na, t - na];
  }

  private weatherHazard(p: Player): void {
    const k = this.s.weather;
    const pr = C.WEATHER[k].hazard;
    if (!pr || this.rng.float() >= pr || p.bankrupt || this.over) return;
    if (k === 'hujan') {
      this.emit({
        e: 'HazardHit',
        pid: p.id,
        kind: 'banjir',
        tile: p.pos,
        text: `Hujan deras tak berhenti. Kawasanmu kebanjiran dan kamu rugi Rp${C.FLOOD_LOSS} jt.`,
      });
      this.emit({ e: 'BencanaFx', key: 'banjir', tile: p.pos, player: p.id });
      this.applyEffect(p, { m: -C.FLOOD_LOSS }, 0, null, 'flood');
    } else if (k === 'badai') {
      this.emit({
        e: 'HazardHit',
        pid: p.id,
        kind: 'petir',
        tile: p.pos,
        text: 'Badai petir! Petir menyambar bidakmu. Gosong, lewati 1 giliran.',
      });
      this.emit({ e: 'BencanaFx', key: 'petir', tile: p.pos, player: p.id });
      this.applyEffect(p, { skip: 1 }, 0, null);
    } else if (k === 'panas') {
      const mine = this.mine(p.id);
      if (!mine.length) return;
      const t = this.rng.pick(mine);
      this.emit({
        e: 'HazardHit',
        pid: p.id,
        kind: 'kebakaran',
        tile: t,
        text: `Panas terik memicu kebakaran. ${cityOf(t)!.name} ikut terbakar.`,
      });
      this.emit({ e: 'BencanaFx', key: 'kebakaran', tile: t, player: p.id });
      this.loseCity(p, t);
    }
  }

  private doWeather(): void {
    const from = this.s.weather;
    const to: WeatherKey = nextWeather(this.rng, from);
    this.s.weather = to;
    this.emit({ e: 'WeatherChanged', from, to });
  }

  /* ---------- aksi pemain ---------- */

  private afterAction(): void {
    if (this.over) return;
    const p = this.cur;
    if (p.bankrupt || p.jail > 0) {
      this.endTurn();
      return;
    }
    this.s.phase = 'act';
  }

  private doRoll(): void {
    const p = this.cur;
    let a = this.rng.d6();
    let b = this.rng.d6();
    if (p.jail <= 0) [a, b] = this.steerDice(p, a, b);
    const dbl = a === b;
    this.s.last = a + b;
    this.emit({ e: 'DiceRolled', pid: p.id, a, b, double: dbl });
    if (p.jail > 0) {
      if (dbl) {
        p.jail = 0;
        this.s.dbl = 0;
        this.emit({ e: 'JailReleased', pid: p.id, reason: 'kembar' });
        this.move(p, a + b, 0);
      } else {
        p.jail--;
        if (p.jail === 0) {
          this.emit({ e: 'JailReleased', pid: p.id, reason: 'denda' });
          this.change(p, -C.JAIL_FEE, 'jailfee');
          if (!p.bankrupt && !this.over) this.move(p, a + b, 0);
        } else {
          this.emit({ e: 'JailStay', pid: p.id, left: p.jail });
          this.endTurn();
          return;
        }
      }
    } else {
      if (dbl) {
        this.s.dbl++;
        if (this.s.dbl >= C.DOUBLES_TO_JAIL) {
          this.goJail(p, 'kembar3');
          this.s.dbl = 0;
          this.afterAction();
          return;
        }
      } else {
        this.s.dbl = 0;
      }
      this.move(p, a + b, 0);
    }
    if (!p.bankrupt && !this.over && p.jail <= 0) this.weatherHazard(p);
    this.afterAction();
  }

  private doPayJail(): void {
    const p = this.cur;
    p.jail = 0;
    this.change(p, -C.JAIL_FEE, 'jailfee');
    this.emit({ e: 'JailReleased', pid: p.id, reason: 'bayar' });
  }

  private doBuy(): void {
    const p = this.cur;
    const i = this.s.pending as number;
    const price = cityPrice(cityOf(i)!.prov);
    p.money -= price;
    this.emit({ e: 'MoneyChanged', pid: p.id, amount: -price, reason: 'buy' });
    this.s.owners[i] = { p: p.id, lv: 0 };
    this.s.pending = null;
    const monopoly = ownedCount(this.s, p.id, cityOf(i)!.prov) === 5;
    this.emit({ e: 'CityBought', pid: p.id, tile: i, price, monopoly });
  }

  private doBuild(tile: number): void {
    const p = this.cur;
    const cost = buildCost(this.s, tile, p.id);
    p.money -= cost;
    p.disc = false;
    const o = this.s.owners[tile]!;
    o.lv++;
    this.emit({ e: 'MoneyChanged', pid: p.id, amount: -cost, reason: 'build' });
    this.emit({ e: 'CityBuilt', pid: p.id, tile, level: o.lv, cost });
  }

  private endTurn(): void {
    this.s.dbl = 0;
    this.s.pending = null;
    let guard = 0;
    do {
      this.s.turn = (this.s.turn + 1) % this.s.players.length;
      const n = this.cur;
      if (n.bankrupt) continue;
      if (n.skip > 0) {
        n.skip--;
        this.emit({ e: 'TurnSkipped', pid: n.id });
        continue;
      }
      break;
    } while (++guard < 100);
    this.s.phase = 'roll';
    this.emit({ e: 'TurnStarted', pid: this.s.turn });
  }

  private doEndGame(): void {
    const ranking = alive(this.s)
      .map((q) => ({ pid: q.id, wealth: wealth(this.s, q.id) }))
      .sort((x, y) => y.wealth - x.wealth);
    this.s.phase = 'over';
    this.s.winner = ranking[0]?.pid ?? null;
    this.emit({ e: 'GameOver', winner: this.s.winner, ranking });
  }
}
