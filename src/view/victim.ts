/**
 * Efek bencana pada bidak pemain: hanyut, tenggelam, terseret tsunami, roboh karena gempa,
 * gosong terbakar, layu kekeringan, dan tertimbun longsor. Semuanya sementara; bidak pulih di akhir.
 */
import * as THREE from 'three';
import type { Pawns } from './pawns';
import { emi } from './pawns';

export type VictimKind = 'flood' | 'rob' | 'tsunami' | 'gempa' | 'burn' | 'dry' | 'slide';
type RGB3 = [number, number, number];
export type Spawn = (
  x: number,
  y: number,
  z: number,
  vx: number,
  vy: number,
  vz: number,
  life: number,
  c: RGB3,
) => void;

export interface Victim {
  /** Ada bidak yang bisa dipengaruhi. */
  readonly ok: boolean;
  step(dt: number, el: number): void;
  end(): void;
}

export interface VictimOpts {
  /** Lama efek (detik); sisa waktu terakhir dipakai untuk pulih. */
  total: number;
  /** Arah arus atau gerak (vektor satuan di bidang tanah). */
  dir: [number, number];
  /** Tinggi muka air saat ini (banjir, rob). */
  water?: () => number;
  /** Detik gelombang tsunami melewati bidak. */
  hit?: number;
  /** Pemancar partikel pecahan (percik, debu, api). */
  emit?: Spawn;
  /** Pemancar asap. */
  smoke?: Spawn;
  /** Dipanggil saat benturan keras (getar kamera, dsb). */
  thud?: () => void;
}

const R = Math.random;
const cl = (v: number, a = 0, b = 1): number => Math.max(a, Math.min(b, v));
const ez = (t: number): number => {
  const x = cl(t);
  return x * x * (3 - 2 * x);
};
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

export function makeVictim(pawns: Pawns, pi: number, kind: VictimKind, o: VictimOpts): Victim {
  const pw = pawns.list[pi] ?? null;
  const mat = pawns.ctlMat(pi);
  if (!pw || !mat) return { ok: false, step() {}, end() {} };
  const ox = pw.position.x;
  const oz = pw.position.z;
  const base = pw.scale.clone();
  const white = new THREE.Color(0xffffff);
  const tint = new THREE.Color();
  const [dx, dz] = o.dir;
  pw.userData.fx = true;
  let acc = 0;
  let hit = false;

  const rest = (): void => {
    pw.userData.fx = false;
    pw.position.set(ox, 13, oz);
    pw.rotation.set(0, 0, 0);
    pw.scale.copy(base);
    mat.color.copy(white);
    emi(mat).setRGB(0, 0, 0);
  };

  const paint = (c: RGB3, k: number): void => {
    tint.setRGB(mix(1, c[0], k), mix(1, c[1], k), mix(1, c[2], k));
    mat.color.copy(tint);
  };

  return {
    ok: true,
    step(dt, el) {
      // rec: 1 saat efek berjalan, turun ke 0 di akhir sehingga bidak pulih mulus
      const rec = ez((o.total - el) / 0.9);
      acc += dt;
      let x: number;
      let y = 13;
      let z: number;
      let rx = 0;
      let rz: number;
      let ry = 0;
      let sy = 1;
      const emit = o.emit;

      if (kind === 'flood' || kind === 'rob') {
        const ramp = ez(el / 1.2);
        const wl = o.water ? o.water() : 0;
        const deep = kind === 'rob';
        const drift = (deep ? 60 : 130) * ez(el / o.total);
        x = ox + dx * drift + Math.sin(el * 1.3) * 10;
        z = oz + dz * drift + Math.cos(el * 1.1) * 10;
        // mengapung dan terombang-ambing; saat rob tubuh hampir tenggelam
        const target = deep ? wl - 38 + Math.sin(el * 2.4) * 5 : wl + 26 + Math.sin(el * 2.6) * 7;
        y = mix(13, Math.max(deep ? -34 : 13, target), ramp);
        rz = Math.sin(el * 2.1) * (deep ? 0.18 : 0.4) * ramp;
        rx = Math.sin(el * 1.7 + 1) * 0.25 * ramp;
        ry = el * 0.6;
        paint([0.5, 0.62, 0.82], ramp * 0.9);
        if (emit && acc > 0.07) {
          acc = 0;
          for (let i = 0; i < (deep ? 2 : 3); i++)
            emit(
              x + (R() - 0.5) * 50,
              wl + 4,
              z + (R() - 0.5) * 50,
              (R() - 0.5) * 120,
              90 + R() * 130,
              (R() - 0.5) * 120,
              0.8,
              [0.85, 0.95, 1],
            );
        }
      } else if (kind === 'tsunami') {
        const t0 = o.hit ?? 2;
        if (el < t0) {
          const s = ez(el / t0);
          x = ox + (R() - 0.5) * 5 * s;
          z = oz + (R() - 0.5) * 5 * s;
          rz = Math.sin(el * 30) * 0.08 * s;
        } else {
          const u = cl((el - t0) / Math.max(0.5, o.total - t0 - 0.6));
          const fly = ez(u);
          // terseret ke arah gelombang sambil terguling
          x = ox + dx * 520 * fly + Math.sin(el * 3) * 25;
          z = oz + dz * 520 * fly + Math.cos(el * 3.4) * 25;
          y = 13 + 60 * Math.sin(Math.min(1, u * 1.4) * Math.PI) + 28;
          rx = el * 6.5;
          rz = el * 4.2;
          paint([0.52, 0.42, 0.3], ez((el - t0) / 0.6));
          if (emit && acc > 0.06) {
            acc = 0;
            for (let i = 0; i < 3; i++)
              emit(
                x + (R() - 0.5) * 40,
                y,
                z + (R() - 0.5) * 40,
                (R() - 0.5) * 160,
                60 + R() * 140,
                (R() - 0.5) * 160,
                0.9,
                [0.9, 0.97, 1],
              );
          }
        }
      } else if (kind === 'gempa') {
        const amp = ez(el / 0.5);
        const tf = 1.4;
        const fall = ez((el - tf) / 0.35);
        const up = ez((el - (o.total - 1.2)) / 0.9);
        x =
          ox +
          (Math.sin(el * 47) + Math.sin(el * 31)) * 5 * amp * (1 - fall * 0.8) +
          dx * 18 * fall;
        z =
          oz +
          (Math.sin(el * 41) + Math.sin(el * 29)) * 5 * amp * (1 - fall * 0.8) +
          dz * 18 * fall;
        y = 13 + Math.abs(Math.sin(el * 25)) * 6 * amp * (1 - fall);
        rz = Math.sin(el * 38) * 0.11 * amp * (1 - fall) + 1.45 * fall * (1 - up);
        rx = Math.sin(el * 23) * 0.06 * amp * (1 - fall);
        if (fall > 0.6 && !hit) {
          hit = true;
          o.thud?.();
          if (emit)
            for (let i = 0; i < 14; i++)
              emit(
                x,
                18,
                z,
                (R() - 0.5) * 220,
                40 + R() * 90,
                (R() - 0.5) * 220,
                1.2,
                [0.62, 0.52, 0.4],
              );
        }
        if (emit && fall < 1 && acc > 0.1) {
          acc = 0;
          emit(
            x + (R() - 0.5) * 30,
            14,
            z + (R() - 0.5) * 30,
            (R() - 0.5) * 60,
            40,
            (R() - 0.5) * 60,
            1,
            [0.62, 0.52, 0.4],
          );
        }
      } else if (kind === 'burn') {
        const b = ez(el / 1.1);
        const flick = 0.55 + R() * 0.45;
        // berlari panik dalam lingkaran kecil sambil melompat, lalu rebah
        const panic = cl(1 - (el - (o.total - 1.5)) / 0.6) * b;
        x = ox + Math.cos(el * 3.4) * 36 * panic;
        z = oz + Math.sin(el * 3.4) * 36 * panic;
        y = 13 + Math.abs(Math.sin(el * 9)) * 28 * panic;
        rz =
          Math.sin(el * 14) * 0.28 * panic +
          1.45 * (1 - panic) * b * ez((el - (o.total - 1.5)) / 0.5);
        paint([0.09, 0.08, 0.075], b);
        emi(mat).setRGB(0.55 * flick * b * rec, 0.16 * flick * b * rec, 0);
        if (emit && acc > 0.035) {
          acc = 0;
          emit(
            x + (R() - 0.5) * 22,
            y + 20 + R() * 55,
            z + (R() - 0.5) * 22,
            (R() - 0.5) * 50,
            150 + R() * 150,
            (R() - 0.5) * 50,
            0.7,
            [1, 0.4 + R() * 0.35, 0.05],
          );
          if (o.smoke && R() < 0.5)
            o.smoke(x, y + 70, z, (R() - 0.5) * 30, 90, (R() - 0.5) * 30, 1.8, [0.12, 0.11, 0.1]);
        }
      } else if (kind === 'dry') {
        const d = ez(el / (o.total * 0.65));
        // layu: pucat, menyusut, membungkuk dan terhuyung
        x = ox + Math.sin(el * 1.2) * 8 * d;
        z = oz + Math.cos(el * 0.9) * 6 * d;
        rx = 0.55 * d + Math.sin(el * 1.4) * 0.07 * d;
        rz = Math.sin(el * 0.8) * 0.1 * d;
        sy = 1 - 0.18 * d;
        paint([0.92, 0.82, 0.58], d);
        if (emit && acc > 0.18) {
          acc = 0;
          emit(
            x + (R() - 0.5) * 30,
            16,
            z + (R() - 0.5) * 30,
            40 + R() * 40,
            30,
            (R() - 0.5) * 30,
            1.6,
            [0.8, 0.68, 0.45],
          );
        }
      } else {
        // tertimbun longsor: terdorong, miring, dan terbenam separuh
        const t0 = 0.9;
        const u = ez((el - t0) / 0.9);
        x = ox + dx * 130 * u;
        z = oz + dz * 130 * u;
        y = mix(13, -14, u);
        rz = 0.55 * u + Math.sin(el * 20) * 0.04 * (1 - u);
        rx = -0.3 * u;
        paint([0.5, 0.36, 0.24], u);
        if (emit && el > t0 && el < t0 + 1.6 && acc > 0.05) {
          acc = 0;
          emit(
            x + (R() - 0.5) * 50,
            10,
            z + (R() - 0.5) * 50,
            (R() - 0.5) * 120,
            60 + R() * 90,
            (R() - 0.5) * 120,
            1.2,
            [0.42, 0.31, 0.2],
          );
        }
      }

      // blend semuanya kembali ke keadaan asal di akhir
      pw.position.set(mix(ox, x, rec), mix(13, y, rec), mix(oz, z, rec));
      pw.rotation.set(rx * rec, ry * rec, rz * rec);
      pw.scale.set(base.x, base.y * mix(1, sy, rec), base.z);
      if (rec < 1) {
        tint.copy(mat.color);
        mat.color.copy(white).lerp(tint, rec);
      }
    },
    end: rest,
  };
}
