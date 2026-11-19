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
  /** keadaan halus internal: kecepatan fokus, sudut/jarak saat ini, tarikan mundur saat berpindah jauh */
  vx?: number;
  vz?: number;
  ct?: number;
  cd?: number;
  ca?: number;
  pull?: number;
  /** jarak kamera efektif (termasuk tarikan mundur), diisi updateCamera */
  ed?: number;
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
  // dt dibatasi supaya patah-patah sesaat (memuat aset) tidak membuat lompatan
  const h = Math.min(dt, 1 / 30);
  // pegas teredam kritis: mulai pelan, melaju, lalu berhenti lembut (tanpa sentakan)
  // jarak dekat (mengikuti bidak berjalan): pegas kencang agar kamera menempel;
  // jarak jauh (pindah giliran / bencana jauh): pegas lembut seperti terbang
  const gap = Math.hypot(cam.tx - cam.fx, cam.tz - cam.fz);
  const far = clamp((gap - 900) / 2600, 0, 1);
  const w = (cam.rate || 5) * (2 - 1.28 * far);
  if (cam.fx === cam.tx && cam.fz === cam.tz) cam.vx = cam.vz = 0;
  let vx = cam.vx ?? 0;
  let vz = cam.vz ?? 0;
  if (h > 0) {
    vx += ((cam.tx - cam.fx) * w * w - 2 * w * vx) * h;
    vz += ((cam.tz - cam.fz) * w * w - 2 * w * vz) * h;
    cam.fx += vx * h;
    cam.fz += vz * h;
  }
  cam.vx = vx;
  cam.vz = vz;
  const k = h ? 1 - Math.exp(-h * (cam.rate || 5)) : 0;
  cam.fy += ((cam.ty || 0) - cam.fy) * k;
  // sudut, arah, dan jarak juga berubah mulus
  const kv = h ? 1 - Math.exp(-h * 6) : 1;
  cam.ct = cam.ct === undefined ? cam.tilt : cam.ct + (cam.tilt - cam.ct) * kv;
  cam.cd = cam.cd === undefined ? cam.dist : cam.cd + (cam.dist - cam.cd) * kv;
  if (cam.ca === undefined) cam.ca = cam.az;
  else {
    let da = (cam.az - cam.ca) % 360;
    if (da > 180) da -= 360;
    if (da < -180) da += 360;
    cam.ca += da * kv;
  }
  // berpindah jauh: kamera mundur sejenak agar perjalanan terlihat seperti terbang, bukan meluncur cepat
  const rem = Math.hypot(cam.tx - cam.fx, cam.tz - cam.fz);
  const want = clamp((rem - 1100) * 0.5, 0, 6500);
  cam.pull = (cam.pull ?? 0) + (want - (cam.pull ?? 0)) * (h ? 1 - Math.exp(-h * 2.6) : 1);
  const t = (clamp(cam.ct, 2, 78) * Math.PI) / 180;
  const a = (cam.ca * Math.PI) / 180;
  const d = (cam.cd + cam.pull) * (cam.lens || 1);
  cam.ed = d;
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

/** Tunggu sampai fokus kamera tiba di target (atau batas waktu habis). */
export function camArrived(cam: Cam, tol = 40): boolean {
  return Math.hypot(cam.tx - cam.fx, cam.tz - cam.fz) < tol && (cam.pull ?? 0) < 120;
}
