import { describe, expect, it } from 'vitest';
import { simulate } from '../src/engine/bot';
import { stateHash } from '../src/engine/hash';
import { violations } from './helpers';

describe('simulasi permainan penuh dengan bot', () => {
  it('500 permainan (3-8 pemain): tanpa crash, tanpa state tidak sah, selalu berakhir', () => {
    const N = 500;
    let natural = 0;
    let steps = 0;
    const bad: string[] = [];
    for (let g = 0; g < N; g++) {
      const n = 3 + (g % 6);
      const res = simulate(n, 1000 + g, 20000, (s) => {
        if (bad.length < 5) {
          const v = violations(s);
          if (v.length) bad.push(`game ${g} rev ${s.rev}: ${v.join('; ')}`);
        }
      });
      expect(res.state.phase).toBe('over');
      expect(res.state.winner).not.toBeNull();
      if (res.natural) natural++;
      steps += res.steps;
    }
    expect(bad).toEqual([]);
    // laporan untuk pemilik proyek
    console.log(
      `simulasi: ${N} game, berakhir alami ${natural}, rata-rata ${Math.round(steps / N)} niat/game`,
    );
    expect(natural).toBeGreaterThan(N * 0.5);
  }, 120_000);

  it('simulasi deterministik: seed sama, hasil sama', () => {
    const a = simulate(5, 42);
    const b = simulate(5, 42);
    expect(stateHash(a.state)).toBe(stateHash(b.state));
    expect(a.steps).toBe(b.steps);
  });
});
