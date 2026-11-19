import { describe, expect, it } from 'vitest';
import { TILES } from '../src/engine/board';

const isCard = (i: number) => {
  const T = TILES[i]!;
  return T.t === 'sp' && (T.k === 'NASIB' || T.k === 'BENCANA');
};
const isNasib = (i: number) => {
  const T = TILES[i]!;
  return T.t === 'sp' && T.k === 'NASIB';
};
const cityProv = (i: number) => {
  const T = TILES[i]!;
  return T.t === 'city' ? T.p : null;
};

describe('susunan petak', () => {
  it('pergantian provinsi selalu punya kartu Nasib di antaranya', () => {
    let prev = -1;
    for (let i = 0; i < TILES.length; i++) {
      if (!cityProv(i)) continue;
      if (prev >= 0 && cityProv(prev) !== cityProv(i)) {
        let found = false;
        for (let j = prev + 1; j < i; j++) if (isNasib(j)) found = true;
        expect(found, `${cityProv(prev)} -> ${cityProv(i)}`).toBe(true);
      }
      prev = i;
    }
  });

  it('antar kartu Nasib selalu ada paling sedikit 2 kota', () => {
    let last = -1;
    let cities = 0;
    for (let k = 0; k < TILES.length * 2; k++) {
      const i = k % TILES.length;
      if (TILES[i]!.t === 'city') cities++;
      if (isNasib(i)) {
        if (last >= 0) expect(cities, `Nasib di petak ${i}`).toBeGreaterThanOrEqual(2);
        last = i;
        cities = 0;
      }
    }
  });

  it('aturan setiap 3 kota ada kartu Nasib atau Bencana tetap berlaku', () => {
    // dua putaran supaya sambungan Titik Nol ikut diperiksa
    let cities = 0;
    for (let k = 0; k < TILES.length * 2; k++) {
      const i = k % TILES.length;
      if (TILES[i]!.t === 'city') {
        cities++;
        expect(cities).toBeLessThanOrEqual(3);
      }
      if (isCard(i)) cities = 0;
    }
  });

  it('tiap provinsi punya 5 kota berurutan', () => {
    const seen: Record<string, number> = {};
    TILES.forEach((T) => {
      if (T.t === 'city') {
        expect(T.ci).toBe(seen[T.p] ?? 0);
        seen[T.p] = T.ci + 1;
      }
    });
    Object.values(seen).forEach((n) => expect(n).toBe(5));
  });
});
