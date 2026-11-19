/**
 * Dekorasi alam khas tiap provinsi di sepanjang jalur. Provinsi dimuat hanya saat kamera
 * dekat (dan dibuang saat jauh) supaya memori dan GPU tetap ringan di HP.
 * Provinsi baru: tambah resep di recipes.ts (atau pembangun khusus seperti Aceh).
 */
import * as THREE from 'three';
import { PROVINCES, TILES } from '../../engine/board';
import { MID, PITCH, POS } from '../layout';
import { cpt } from '../tiles';
import { makeLcg } from '../util';
import { ACEH_RANGE, buildAceh } from './aceh';
import { NatureKit } from './kit';
import { RECIPES } from './recipes';
import { FEATURES, makeCtx } from './species';

/** jarak kamera (satuan dunia) di atasnya dekorasi disembunyikan (peta penuh) */
export const HIDE_DIST = 9000;
/** jumlah petak di kiri/kanan fokus kamera yang dimuat */
const LOAD_SPAN = 11;
const KEEP_SPAN = 20;

interface Entry {
  code: string;
  idx: number;
  i0: number;
  i1: number;
  range: [number, number];
  outer: 1 | -1;
  kit: NatureKit | null;
}

/** +1 bila sisi `cpt().n` positif menghadap keluar pulau (laut), -1 bila sebaliknya. */
function outerSign(range: [number, number]): 1 | -1 {
  const t = (range[0] + range[1]) / 2;
  const p = cpt(t * PITCH);
  return (p.x - MID[0]) * p.nx + (p.z - MID[1]) * p.nz >= 0 ? 1 : -1;
}

function buildEntries(): Entry[] {
  return PROVINCES.map((pr) => {
    let i0 = 1e9;
    let i1 = -1;
    TILES.forEach((T, i) => {
      if (T.t === 'city' && T.p === pr.code) {
        i0 = Math.min(i0, i);
        i1 = Math.max(i1, i);
      }
    });
    const range: [number, number] = pr.code === 'ACH' ? ACEH_RANGE : [i0 - 0.45, i1 + 0.6];
    return { code: pr.code, idx: pr.idx, i0, i1, range, outer: outerSign(range), kit: null };
  });
}

export function buildKit(
  code: string,
  idx: number,
  range: [number, number],
  outer: 1 | -1,
  density: number,
): NatureKit | null {
  const k = new NatureKit(makeLcg(1101 + idx * 97));
  const d = Math.max(0.35, density);
  if (code === 'ACH') buildAceh(k, d * 0.45, outer);
  else {
    const rec = RECIPES[code];
    if (!rec) return null;
    const c = makeCtx(k, d, outer, range[0], range[1]);
    // bidang (sawah, kebun, danau, sungai) dulu supaya bentang alam besar dan pohon menghindarinya;
    // lalu bentang alam besar, lalu sisanya
    const FIELDS = new Set([
      'rice',
      'terrace',
      'tea',
      'coffee',
      'corn',
      'orchard',
      'pineapple',
      'lake',
      'trilake',
      'river',
      'minepit',
      'swamp',
      'hotspring',
    ]);
    const BIG = new Set([
      'volcano',
      'peak',
      'cliff',
      'hills',
      'karst',
      'granite',
      'seastack',
      'megalith',
    ]);
    const pri = (f: string) => (FIELDS.has(f) ? 0 : BIG.has(f) ? 1 : 2);
    [...rec]
      .map((it, i) => ({ it, i }))
      .sort((a, b) => pri(a.it.f) - pri(b.it.f) || a.i - b.i)
      .forEach(({ it }) => {
        k.rec = FIELDS.has(it.f);
        FEATURES[it.f]?.(c, it);
        k.rec = false;
      });
  }
  return k;
}

export interface Nature {
  /** dipanggil tiap frame dengan fokus kamera (x, z) dan jarak kamera */
  update(fx: number, fz: number, dist: number): void;
  /** muat alam di sekitar (x, z) lebih dulu; selesai saat antrean kosong (maks ~2 detik) */
  prefetch(x: number, z: number): Promise<void>;
  dispose(): void;
}

export function buildProvinceNature(parent: THREE.Object3D, density: number): Nature {
  const entries = buildEntries();
  const root = new THREE.Group();
  root.name = 'nature';
  parent.add(root);
  let lastIdx = -1;
  let frame = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const queue: Entry[] = [];

  const nearest = (fx: number, fz: number): number => {
    let b = 0;
    let bd = 1e18;
    for (let i = 0; i < POS.length; i++) {
      const d = (POS[i]![0] - fx) ** 2 + (POS[i]![1] - fz) ** 2;
      if (d < bd) {
        bd = d;
        b = i;
      }
    }
    return b;
  };
  const cyc = (a: number, b: number) => {
    const d = Math.abs(a - b);
    return Math.min(d, POS.length - d);
  };
  const near = (e: Entry, i: number, span: number) =>
    cyc(i, e.i0) <= span || cyc(i, e.i1) <= span || (i >= e.i0 && i <= e.i1);

  const pump = () => {
    timer = null;
    const e = queue.shift();
    if (!e || e.kit) {
      if (queue.length) timer = setTimeout(pump, 0);
      return;
    }
    const k = buildKit(e.code, e.idx, e.range, e.outer, density);
    if (k) {
      k.finish(root);
      e.kit = k;
    } else e.kit = null;
    if (queue.length) timer = setTimeout(pump, 0);
  };

  return {
    update(fx, fz, dist) {
      root.visible = dist < HIDE_DIST;
      if (!root.visible) return;
      if (frame++ % 20 !== 0 && lastIdx >= 0) return;
      const i = nearest(fx, fz);
      if (i === lastIdx) return;
      lastIdx = i;
      // muat yang dekat (terdekat dahulu), buang yang jauh
      const want = entries
        .filter((e) => !e.kit && near(e, i, LOAD_SPAN))
        .sort((a, b) => cyc(i, a.i0) - cyc(i, b.i0));
      want.forEach((e) => {
        if (!queue.includes(e)) queue.push(e);
      });
      for (const e of entries)
        if (e.kit && !near(e, i, KEEP_SPAN)) {
          e.kit.dispose();
          e.kit = null;
        }
      if (queue.length && timer === null) timer = setTimeout(pump, 0);
    },
    prefetch(x, z) {
      frame = 0;
      lastIdx = -2;
      this.update(x, z, 0);
      const t0 = performance.now();
      return new Promise<void>((res) => {
        const tick = () => {
          if ((!queue.length && timer === null) || performance.now() - t0 > 2000) res();
          else setTimeout(tick, 16);
        };
        tick();
      });
    },
    dispose() {
      if (timer !== null) clearTimeout(timer);
      entries.forEach((e) => e.kit?.dispose());
      root.parent?.remove(root);
    },
  };
}
