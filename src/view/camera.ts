import type * as THREE from 'three';
import { BOUNDS, G, POS } from './layout';
import { clamp } from './util';

/** Status kamera orbit milik tiap pemain (lokal, tidak disinkronkan). */
export interface Cam {
  tilt: number;
  az: number;
  dist: number;
  fx: number;
  fz: number;
  fy: number;
  ty: number;
  rate: number;
  tx: number;
  tz: number;
  follow: boolean;
  /** tampilan cuaca hidup/mati (aturannya tetap jalan) */
  weather: boolean;
  shake: number;
  /** pengali jarak agar framing tetap sama saat FOV lebih sempit (mode HP) */
  lens: number;
}

/** Layar HP: potret sempit atau lanskap pendek. Dipakai CSS (kelas `mob`) dan kamera. */
export const MOBILE_QUERY = '(max-width: 700px), (max-height: 560px) and (orientation: landscape)';
export const isMobile = (): boolean => !!window.matchMedia?.(MOBILE_QUERY).matches;
/** Sudut kamera bawaan: HP sedikit lebih menunduk ala board game isometrik. */
export const defaultTilt = (): number => (isMobile() ? 44 : 52);

export function makeCam(): Cam {
  return {
    tilt: 52,
    az: 0,
    dist: 1750,
    fx: 0,
    fz: 0,
    fy: 0,
    ty: 0,
    rate: 5,
    tx: 0,
    tz: 0,
    follow: true,
    weather: true,
    shake: 0,
    lens: 1,
  };
}

export function focusOn(cam: Cam, i: number, snap = false): void {
  const q = POS[i];
  if (!q) return;
  cam.tx = q[0];
  cam.tz = q[1];
  if (snap) {
    cam.fx = q[0];
    cam.fz = q[1];
  }
}

export function overview(cam: Cam, stage: HTMLElement): void {
  const asp = (stage.clientWidth || 900) / (stage.clientHeight || 600);
  const w = BOUNDS.maxx - BOUNDS.minx + 2700 * G;
  const h = BOUNDS.maxy - BOUNDS.miny + 2700 * G;
  const t = Math.tan((21 * Math.PI) / 180);
  cam.follow = false;
  cam.tilt = 40;
  cam.az = 0;
  cam.tx = (BOUNDS.minx + BOUNDS.maxx) / 2;
  cam.tz = (BOUNDS.miny + BOUNDS.maxy) / 2;
  cam.dist = Math.max(w / (2 * t * asp), (h / (2 * t)) * 0.95) * 1.02;
}

export function updateCamera(cam: Cam, camera: THREE.PerspectiveCamera, dt: number): void {
  const k = dt ? 1 - Math.exp(-dt * (cam.rate || 5)) : 0;
  cam.fx += (cam.tx - cam.fx) * k;
  cam.fz += (cam.tz - cam.fz) * k;
  cam.fy += ((cam.ty || 0) - cam.fy) * k;
  const t = (clamp(cam.tilt, 2, 78) * Math.PI) / 180;
  const a = (cam.az * Math.PI) / 180;
  const d = cam.dist * (cam.lens || 1);
  camera.position.set(
    cam.fx + d * Math.sin(t) * Math.sin(a),
    cam.fy + d * Math.cos(t),
    cam.fz + d * Math.sin(t) * Math.cos(a),
  );
  if (cam.shake > 0.5) {
    camera.position.x += (Math.random() - 0.5) * cam.shake;
    camera.position.y += (Math.random() - 0.5) * cam.shake * 0.6;
    camera.position.z += (Math.random() - 0.5) * cam.shake;
  }
  camera.lookAt(cam.fx, cam.fy, cam.fz);
  camera.updateMatrixWorld();
}
