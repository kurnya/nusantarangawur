import { describe, expect, it } from 'vitest';
import { CARD_BY_ID } from '../src/engine/board';
import { cardChips, cardNo, cardTone } from '../src/ui/cardMeta';

describe('cardMeta', () => {
  it('chip uang, gerak, penjara', () => {
    expect(cardChips({ m: 150, mv: 2 }).map((c) => c.t)).toEqual(['+Rp150 jt', 'Maju 2 petak']);
    expect(cardChips({ m: -1000 })[0]).toEqual({ k: 'minus', t: '-Rp1 M' });
    expect(cardChips({ jail: 1, mv: 3 }).map((c) => c.k)).toEqual(['jail']);
    expect(cardChips({ mv: -2 })[0]?.t).toBe('Mundur 2 petak');
    expect(cardChips(undefined)).toEqual([]);
  });
  it('nada dan nomor', () => {
    expect(cardTone('Nasib baik')).toBe('baik');
    expect(cardTone('Nasib buruk')).toBe('buruk');
    expect(cardTone('Musibah cuaca')).toBe('bencana');
    expect(cardNo('nb-6')).toBe('No. 07');
  });
  it('semua kartu punya paling tidak satu chip', () => {
    for (const c of Object.values(CARD_BY_ID)) expect(cardChips(c.e).length).toBeGreaterThan(0);
  });
});
