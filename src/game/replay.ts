/**
 * Menerapkan satu GameEvent ke state tampilan supaya layar bisa menampilkan keadaan antara
 * (bidak melangkah satu-satu, uang berubah bertahap). State akhir tetap dari mesin/Host.
 * Murni: tidak menyentuh DOM.
 */
import { CARD_BY_ID } from '../engine/board';
import * as C from '../engine/config';
import { cloneState } from '../engine/engine';
import type { GameEvent, GameState } from '../engine/types';

export function applyEvent(s: GameState, ev: GameEvent): void {
  const P = (id: number) => s.players[id];
  switch (ev.e) {
    case 'TurnStarted':
      s.turn = ev.pid;
      s.phase = 'roll';
      s.dbl = 0;
      s.pending = null;
      break;
    case 'TurnSkipped': {
      const p = P(ev.pid);
      if (p) p.skip = Math.max(0, p.skip - 1);
      break;
    }
    case 'DiceRolled':
      s.last = ev.a + ev.b;
      break;
    case 'PawnStepped': {
      const p = P(ev.pid);
      if (p) p.pos = ev.to;
      break;
    }
    case 'Landed':
      s.pending = ev.buyable ? ev.tile : null;
      break;
    case 'MoneyChanged': {
      const p = P(ev.pid);
      if (p) p.money += ev.amount;
      break;
    }
    case 'PaidRent': {
      const a = P(ev.from);
      const b = P(ev.to);
      if (a) a.money -= ev.amount;
      if (b) b.money += ev.amount;
      break;
    }
    case 'TicketUsed': {
      const p = P(ev.pid);
      if (p) p.free = Math.max(0, p.free - 1);
      break;
    }
    case 'CardDrawn': {
      const p = P(ev.pid);
      const e = CARD_BY_ID[ev.card]?.e;
      if (p && e) {
        if (e.skip) p.skip += e.skip;
        if (e.free) p.free += e.free;
        if (e.disc) p.disc = true;
      }
      break;
    }
    case 'HazardHit': {
      const p = P(ev.pid);
      if (p && ev.kind === 'petir') p.skip += 1;
      break;
    }
    case 'CityBought':
      s.owners[ev.tile] = { p: ev.pid, lv: 0 };
      s.pending = null;
      break;
    case 'CityBuilt': {
      const o = s.owners[ev.tile];
      if (o) o.lv = ev.level;
      const p = P(ev.pid);
      if (p) p.disc = false;
      break;
    }
    case 'CitySold': {
      const p = P(ev.pid);
      if (p) p.money += ev.value;
      s.owners[ev.tile] = null;
      break;
    }
    case 'CityMortgaged': {
      const o = s.owners[ev.tile];
      if (o) o.m = true;
      break;
    }
    case 'CityRedeemed': {
      const o = s.owners[ev.tile];
      if (o) delete o.m;
      break;
    }
    case 'CityLost':
      if (ev.level === null) s.owners[ev.tile] = null;
      else {
        const o = s.owners[ev.tile];
        if (o) o.lv = ev.level;
      }
      break;
    case 'PlayerJailed': {
      const p = P(ev.pid);
      if (p) {
        p.pos = ev.pos;
        p.jail = C.JAIL_TURNS;
      }
      s.dbl = 0;
      s.pending = null;
      break;
    }
    case 'JailReleased': {
      const p = P(ev.pid);
      if (p) p.jail = 0;
      break;
    }
    case 'JailStay': {
      const p = P(ev.pid);
      if (p) p.jail = ev.left;
      break;
    }
    case 'Bankrupt': {
      const p = P(ev.pid);
      if (p) {
        p.bankrupt = true;
        p.money = 0;
      }
      s.owners.forEach((o, i) => {
        if (o && o.p === ev.pid) s.owners[i] = null;
      });
      break;
    }
    case 'WeatherChanged':
      s.weather = ev.to;
      break;
    case 'GameOver':
      s.phase = 'over';
      s.winner = ev.winner;
      break;
    default:
      break;
  }
}

/** Terapkan semua event ke salinan state. */
export function replay(prev: GameState, events: readonly GameEvent[]): GameState {
  const s = cloneState(prev);
  events.forEach((e) => applyEvent(s, e));
  return s;
}
