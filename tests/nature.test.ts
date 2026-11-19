import { describe, expect, it } from 'vitest';
import { groundY, zone } from '../src/view/nature/kit';

describe('nature kit', () => {
  it('tinggi daratan jalur: datar di atas, miring di pantai', () => {
    expect(groundY(0)).toBe(1);
    expect(groundY(-300)).toBe(1);
    expect(groundY(700)).toBeLessThan(0);
    expect(groundY(700)).toBe(groundY(-700));
  });
  it('bobot zona 1 di dalam, 0 jauh di luar', () => {
    expect(zone(3, 2, 4)).toBe(1);
    expect(zone(0, 2, 4)).toBe(0);
    expect(zone(4.2, 2, 4, 0.4)).toBeGreaterThan(0);
    expect(zone(4.2, 2, 4, 0.4)).toBeLessThan(1);
  });
});
