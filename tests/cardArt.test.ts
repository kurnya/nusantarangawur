import { describe, expect, it } from 'vitest';
import cards from '../src/engine/data/cards.json';
import { ART_KEYS, ART_MAP, cardArt } from '../src/ui/cardArt';

describe('gambar garis kartu', () => {
  const all = [...cards.nasibBad, ...cards.nasibGood, ...cards.bencana];

  it('setiap kartu punya motif yang ada', () => {
    for (const c of all) {
      const key = ART_MAP[c.id];
      expect(key, c.id).toBeTruthy();
      expect(ART_KEYS, `${c.id} -> ${key}`).toContain(key);
    }
  });

  it('semua kartu Bencana memakai motif berbeda', () => {
    const keys = cards.bencana.map((c) => ART_MAP[c.id]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('kartu Nasib hampir semuanya unik (maksimal 1 pasangan berulang)', () => {
    const keys = [...cards.nasibBad, ...cards.nasibGood].map((c) => ART_MAP[c.id]);
    expect(keys.length - new Set(keys).size).toBeLessThanOrEqual(2);
  });

  it('menghasilkan svg garis tanpa isian warna', () => {
    const svg = cardArt('bc-2', 'BENCANA');
    expect(svg).toContain('<svg');
    expect(svg).toContain('stroke="currentColor"');
    expect(svg).toContain('fill="none"');
    expect(cardArt('tidak-ada', 'NASIB')).toContain('<svg');
  });
});
