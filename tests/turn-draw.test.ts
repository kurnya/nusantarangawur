import { describe, expect, it } from 'vitest';
import { createGame } from '../src/engine/engine';
import { turnOrder } from '../src/ui/turnDraw';

describe('undian urutan giliran', () => {
  it('menampilkan urutan deterministik dari state engine', () => {
    const a = createGame({
      seed: 12345,
      players: [
        { name: 'A', pawn: 0 },
        { name: 'B', pawn: 1 },
        { name: 'C', pawn: 2 },
      ],
    });
    const b = createGame({
      seed: 12345,
      players: [
        { name: 'A', pawn: 0 },
        { name: 'B', pawn: 1 },
        { name: 'C', pawn: 2 },
      ],
    });
    expect(turnOrder(a)).toEqual(turnOrder(b));
    expect(turnOrder(a)).toHaveLength(3);
  });

  it('melewati pemain bangkrut tanpa mengubah state', () => {
    const s = createGame({
      seed: 7,
      players: [
        { name: 'A', pawn: 0 },
        { name: 'B', pawn: 1 },
        { name: 'C', pawn: 2 },
      ],
    });
    s.turn = 1;
    s.players[2]!.bankrupt = true;
    expect(turnOrder(s)).toEqual([1, 0]);
    expect(s.turn).toBe(1);
  });
});
