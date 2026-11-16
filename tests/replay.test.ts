import { describe, expect, it } from 'vitest';
import { botIntent } from '../src/engine/bot';
import { applyIntent, createGame } from '../src/engine/engine';
import type { GameState } from '../src/engine/types';
import { replay } from '../src/game/replay';

const pick = (s: GameState) => ({
  players: s.players,
  owners: s.owners,
  turn: s.turn,
  weather: s.weather,
  winner: s.winner,
  last: s.last,
});

describe('replay event ke state tampilan', () => {
  it('menerapkan events menghasilkan pemain, kota, giliran, cuaca yang sama dengan mesin', () => {
    let checked = 0;
    for (let g = 0; g < 25; g++) {
      let s = createGame({
        seed: 7000 + g,
        players: Array.from({ length: 3 + (g % 6) }, (_, i) => ({ name: `B${i}`, pawn: i })),
      });
      for (let k = 0; k < 4000 && s.phase !== 'over'; k++) {
        const intent = k % 97 === 0 ? ({ t: 'weather' } as const) : botIntent(s);
        const r = applyIntent(s, intent);
        if (!r.ok) throw new Error(r.reason);
        const a = pick(replay(s, r.events));
        const b = pick(r.state);
        if (JSON.stringify(a) !== JSON.stringify(b)) expect(a).toEqual(b);
        s = r.state;
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(10000);
  }, 60_000);
});
