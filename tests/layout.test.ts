import { describe, expect, it } from 'vitest';
import { N_TILES } from '../src/engine/board';
import { createGame } from '../src/engine/engine';
import { ANG, POS, PITCH, pawnXY } from '../src/view/layout';
import { cityInitials } from '../src/view/util';

describe('tata letak papan', () => {
  it('posisi semua petak berjarak tetap sepanjang jalur', () => {
    expect(POS).toHaveLength(N_TILES);
    expect(ANG).toHaveLength(N_TILES);
    for (let i = 1; i < POS.length; i++) {
      const d = Math.hypot(POS[i]![0] - POS[i - 1]![0], POS[i]![1] - POS[i - 1]![1]);
      expect(d).toBeGreaterThan(PITCH * 0.8);
      expect(d).toBeLessThan(PITCH * 1.05);
    }
  });
  it('8 bidak di petak yang sama tidak bertumpuk', () => {
    const s = createGame({
      seed: 1,
      players: Array.from({ length: 8 }, (_, i) => ({ name: 'x', pawn: i })),
    });
    const xy = s.players.map((p) => pawnXY(s.players, p));
    for (let a = 0; a < xy.length; a++)
      for (let b = a + 1; b < xy.length; b++)
        expect(Math.hypot(xy[a]![0] - xy[b]![0], xy[a]![1] - xy[b]![1])).toBeGreaterThan(20);
  });
  it('inisial kota cadangan', () => {
    expect(cityInitials('Tanah Merah')).toBe('TM');
    expect(cityInitials('Asmat')).toBe('AS');
  });
});
