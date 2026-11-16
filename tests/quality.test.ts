import { describe, expect, it } from 'vitest';
import { DynamicResolution, PROFILES, autoLevel } from '../src/view/quality';

describe('kualitas grafis', () => {
  it('pilihan otomatis dari petunjuk perangkat', () => {
    expect(autoLevel({ mobile: true, cores: 4, memory: 2, minSide: 390 })).toBe('low');
    expect(autoLevel({ mobile: true, cores: 8, memory: 8, minSide: 390 })).toBe('medium');
    expect(autoLevel({ mobile: false, cores: 4, memory: 8, minSide: 1080 })).toBe('medium');
    expect(autoLevel({ mobile: false, cores: 12, memory: 16, minSide: 1080 })).toBe('high');
  });
  it('profil rendah lebih ringan dari tinggi', () => {
    const h = PROFILES.high;
    const l = PROFILES.low;
    expect(l.labelSize).toBeLessThan(h.labelSize);
    expect(l.shadowMap).toBe(0);
    expect(l.treeDensity).toBeLessThan(h.treeDensity);
    expect(l.maxFps).toBeLessThanOrEqual(h.maxFps);
  });
  const run = (dr: DynamicResolution, fps: number, seconds: number) => {
    const out: number[] = [];
    for (let t = 0; t < seconds * fps; t++) {
      const r = dr.tick(1 / fps);
      if (r !== null) out.push(r);
    }
    return out;
  };
  it('resolusi dinamis turun saat FPS rendah, tidak di bawah batas', () => {
    const dr = new DynamicResolution(0.6, 1.5, 1.5);
    run(dr, 20, 20);
    expect(dr.ratio).toBe(0.6);
  });
  it('resolusi naik pelan saat FPS longgar, tidak di atas batas', () => {
    const dr = new DynamicResolution(0.6, 1.5, 0.8);
    run(dr, 60, 60);
    expect(dr.ratio).toBe(1.5);
  });
  it('FPS sedang (45): resolusi tidak berubah', () => {
    const dr = new DynamicResolution(0.6, 1.5, 1.2);
    expect(run(dr, 45, 30)).toEqual([]);
  });
});
