/**
 * Profil kualitas grafis. 'auto' memilih berdasarkan perangkat lalu menyesuaikan resolusi render
 * dari FPS yang terukur (lihat DynamicResolution di scene.ts).
 */
export type QualityLevel = 'high' | 'medium' | 'low';
export type QualityPref = 'auto' | QualityLevel;
export type FpsPref = 'auto' | '30' | '45' | '60' | '90' | '120';

export interface GraphicsPrefs {
  quality: QualityPref;
  fps: FpsPref;
}

export interface QualityProfile {
  level: QualityLevel;
  /** batas atas devicePixelRatio untuk render */
  maxPixelRatio: number;
  /** batas bawah saat resolusi dinamis menurunkan resolusi */
  minPixelRatio: number;
  antialias: boolean;
  /** ukuran peta bayangan; 0 = tanpa bayangan */
  shadowMap: number;
  /** ukuran kanvas label petak (px) */
  labelSize: number;
  /** proporsi pohon yang digambar */
  treeDensity: number;
  waterSeg: [number, number];
  /** jumlah tetes hujan global */
  rainDrops: number;
  /** segmen medan pulau utama dan pulau kecil */
  terrainSeg: [number, number];
  /** batas FPS (hemat baterai pada layar 90/120 Hz) */
  maxFps: number;
}

export const PROFILES: Record<QualityLevel, QualityProfile> = {
  high: {
    level: 'high',
    maxPixelRatio: 1.75,
    minPixelRatio: 0.9,
    antialias: true,
    shadowMap: 2048,
    labelSize: 512,
    treeDensity: 1,
    waterSeg: [320, 230],
    rainDrops: 2600,
    terrainSeg: [190, 70],
    // requestAnimationFrame tetap mengikuti refresh rate perangkat (60/90/120 Hz).
    maxFps: 120,
  },
  medium: {
    level: 'medium',
    maxPixelRatio: 1.25,
    minPixelRatio: 0.75,
    antialias: true,
    shadowMap: 1024,
    labelSize: 256,
    treeDensity: 0.6,
    waterSeg: [220, 160],
    rainDrops: 1600,
    terrainSeg: [140, 56],
    maxFps: 120,
  },
  low: {
    level: 'low',
    maxPixelRatio: 1,
    minPixelRatio: 0.6,
    antialias: false,
    shadowMap: 0,
    labelSize: 256,
    treeDensity: 0.35,
    waterSeg: [160, 115],
    rainDrops: 900,
    terrainSeg: [110, 44],
    maxFps: 30,
  },
};

export interface DeviceHints {
  /** navigator.hardwareConcurrency */
  cores?: number;
  /** navigator.deviceMemory (GB, hanya Chromium) */
  memory?: number;
  /** layar sentuh / HP */
  mobile: boolean;
  /** lebar layar terkecil (px CSS) */
  minSide: number;
}

/** Pilih tingkat kualitas otomatis dari petunjuk perangkat. */
export function autoLevel(h: DeviceHints): QualityLevel {
  const cores = h.cores ?? 4;
  const mem = h.memory ?? 4;
  if (h.mobile && (mem <= 3 || cores <= 4)) return 'low';
  if (h.mobile || mem <= 4 || cores <= 4) return 'medium';
  return 'high';
}

export function deviceHints(): DeviceHints {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const coarse = !!window.matchMedia?.('(pointer: coarse)').matches;
  return {
    cores: nav.hardwareConcurrency,
    memory: nav.deviceMemory,
    mobile: coarse || /Android|iPhone|iPad|Mobile/i.test(nav.userAgent),
    minSide: Math.min(window.screen?.width ?? 1280, window.screen?.height ?? 800),
  };
}

const KEY = 'nn.quality';
const GRAPHICS_KEY = 'nn.graphics';

export function loadGraphicsPrefs(): GraphicsPrefs {
  try {
    const raw = localStorage.getItem(GRAPHICS_KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<GraphicsPrefs>;
      const quality: QualityPref =
        v.quality === 'high' || v.quality === 'medium' || v.quality === 'low' ? v.quality : 'auto';
      const fps: FpsPref =
        v.fps === '30' ||
        v.fps === '45' ||
        v.fps === '60' ||
        v.fps === '90' ||
        v.fps === '120'
          ? v.fps
          : 'auto';
      return { quality, fps };
    }
  } catch {
    /* gunakan bawaan */
  }
  return { quality: loadQualityPref(), fps: 'auto' };
}

export function saveGraphicsPrefs(p: GraphicsPrefs): void {
  try {
    localStorage.setItem(GRAPHICS_KEY, JSON.stringify(p));
  } catch {
    /* abaikan */
  }
}

export function loadQualityPref(): QualityPref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'high' || v === 'medium' || v === 'low' ? v : 'auto';
  } catch {
    return 'auto';
  }
}
export function saveQualityPref(p: QualityPref): void {
  try {
    localStorage.setItem(KEY, p);
  } catch {
    /* abaikan */
  }
}

/** Target FPS lokal; 'auto' mengikuti batas profil kualitas. */
export function resolveFps(pref: FpsPref, quality: QualityProfile): number {
  return pref === 'auto' ? quality.maxFps : Number(pref);
}

/** Profil akhir dari preferensi (+ ?low=1 sebagai paksaan rendah). */
export function resolveQuality(pref: QualityPref, forceLow = false): QualityProfile {
  if (forceLow) return PROFILES.low;
  return PROFILES[pref === 'auto' ? autoLevel(deviceHints()) : pref];
}

/**
 * Resolusi dinamis: turunkan pixelRatio jika FPS rendah, naikkan pelan jika longgar.
 * Murni (tanpa DOM) supaya bisa dites.
 */
export class DynamicResolution {
  ratio: number;
  private frames = 0;
  private time = 0;
  private goodStreak = 0;
  constructor(
    private readonly min: number,
    private readonly max: number,
    start: number,
  ) {
    this.ratio = Math.min(max, Math.max(min, start));
  }
  /** catat satu frame; kembalikan pixelRatio baru jika berubah, selain itu null */
  tick(dt: number): number | null {
    this.frames++;
    this.time += dt;
    if (this.time < 2) return null;
    const fps = this.frames / this.time;
    this.frames = 0;
    this.time = 0;
    let next = this.ratio;
    if (fps < 40) {
      next = Math.max(this.min, this.ratio - (fps < 25 ? 0.25 : 0.15));
      this.goodStreak = 0;
    } else if (fps > 57) {
      this.goodStreak++;
      if (this.goodStreak >= 3) {
        next = Math.min(this.max, this.ratio + 0.1);
        this.goodStreak = 0;
      }
    } else this.goodStreak = 0;
    next = Math.round(next * 100) / 100;
    if (next === this.ratio) return null;
    this.ratio = next;
    return next;
  }
}
