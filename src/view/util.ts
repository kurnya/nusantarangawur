import * as THREE from 'three';
import { assetUrl } from '../assetUrl';
import { PROVINCES } from '../engine/board';
import manifest from './assets-manifest.json';

export const TAU = Math.PI * 2;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export type RGB = [number, number, number];
export const mix3 = (a: RGB, b: RGB, t: number): RGB => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];
export const ez = (t: number) => t * t * (3 - 2 * t);

/** RNG Park-Miller untuk dekorasi. Urutan panggilan menentukan tampilan (sama dengan prototipe). */
export function makeLcg(seed = 20241116): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/* ---- derau untuk gunung ---- */
const hash2 = (i: number, j: number) => {
  let h = (i * 374761393 + j * 668265263) | 0;
  // sengaja perkalian float biasa (bukan Math.imul) supaya identik dengan prototipe
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
const vnoise = (x: number, y: number) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
export const fbm = (x: number, y: number, o: number) => {
  let s = 0;
  let a = 0.5;
  let f = 1;
  for (let k = 0; k < o; k++) {
    s += a * vnoise(x * f, y * f);
    f *= 2;
    a *= 0.5;
  }
  return s;
};

export function canvas2d(w: number, h = w): { c: HTMLCanvasElement; x: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  if (!x) throw new Error('canvas 2d tidak tersedia');
  return { c, x };
}

export const BODY_FONT = "'Plus Jakarta Sans',system-ui,-apple-system,'Segoe UI',sans-serif";
export const DISP_FONT = "Bungee,Impact,'Arial Black',sans-serif";

/* ---- aset ---- */
export const MANIFEST = manifest as unknown as {
  cityLetters: string;
  cityHave: string[];
  specIdx: Record<string, number>;
  trees: [number, number][];
  ships: [number, number][];
  fx: [number, number][];
  fxIdx: Record<string, number>;
};

export function loadImg(url: string, cb?: (im: HTMLImageElement) => void): HTMLImageElement {
  const im = new Image();
  im.onload = () => cb?.(im);
  im.src = url;
  return im;
}

export function imgTex(path: string): THREE.Texture {
  const t = new THREE.Texture();
  t.anisotropy = 4;
  loadImg(assetUrl(path), (im) => {
    t.image = im;
    t.needsUpdate = true;
  });
  return t;
}

/** Ikon kota di atlas (5 kolom x 4 baris per huruf). null jika atlasnya belum ada. */
export function cityIcon(code: string, ci: number): { L: string; col: number; row: number } | null {
  const pi = PROVINCES.findIndex((p) => p.code === code);
  if (pi < 0) return null;
  const L = MANIFEST.cityLetters[Math.floor(pi / 4)];
  if (!L || !MANIFEST.cityHave.includes(L)) return null;
  return { L, col: ci, row: pi % 4 };
}

/** Inisial kota untuk cadangan bila atlas belum ada (bukan emoji). */
export function cityInitials(name: string): string {
  const w = name.split(/\s+/).filter(Boolean);
  const s = w.length > 1 ? (w[0]![0] ?? '') + (w[1]![0] ?? '') : name.slice(0, 2);
  return s.toUpperCase();
}

/** Lingkaran berwarna berisi inisial: cadangan ikon kota di kanvas. */
export function drawInitials(
  x: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  name: string,
  color: string,
): void {
  x.save();
  x.beginPath();
  x.arc(cx, cy, r, 0, TAU);
  x.fillStyle = color;
  x.fill();
  x.fillStyle = '#fff';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = `800 ${Math.round(r * 0.9)}px ${BODY_FONT}`;
  x.fillText(cityInitials(name), cx, cy + r * 0.04);
  x.restore();
}

export const provColor = (hue: number) => `hsl(${hue} 62% 46%)`;
