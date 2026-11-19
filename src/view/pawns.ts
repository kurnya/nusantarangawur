/**
 * Bidak berupa orang (16 karakter profesi), selalu menghadap kamera. Model GLB opsional menggantikan
 * model prosedural (lihat models.ts).
 */
import * as THREE from 'three';
import { PAWNS } from '../engine/board';
import type { Player } from '../engine/types';
import { pawnXY } from './layout';
import { clamp } from './util';
import { buildPerson, type MatRef } from './person';

const BLK = new THREE.Color(0x151515);
/** Warna emisif per material (dipakai efek gosong). */
export const emi = (m: THREE.Material): THREE.Color =>
  (m.userData.em as THREE.Color | undefined) ?? (m.userData.em = new THREE.Color(0, 0, 0));

/** Ubah semua material bidak ke arah hitam mengikuti warna "pengendali" (efek gosong). */
function charSync(g: THREE.Group): void {
  const u = g.userData;
  if (!u.mats) return;
  const c = (u.ctl as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material;
  const d = Math.hypot(1 - c.color.r, 1 - c.color.g, 1 - c.color.b);
  const k = Math.min(1, d / 1.59);
  if (k <= 0.001 && !u.chk) return;
  u.chk = k > 0.001;
  const em = emi(c);
  (u.mats as MatRef[]).forEach((e) => {
    e.m.color.copy(e.b).lerp(BLK, k);
    if ('emissive' in e.m && e.m.emissive) e.m.emissive.copy(em);
  });
}

/**
 * Skala dan letakkan model GLB: tinggi = targetH, dasar di y=0, terpusat di x/z.
 * Material dikloning supaya efek gosong tidak bocor ke model lain.
 */
export function fitModel(src: THREE.Object3D, targetH: number, mats: MatRef[]): THREE.Group {
  const o = src.clone(true);
  const bb = new THREE.Box3().setFromObject(o);
  const sz = bb.getSize(new THREE.Vector3());
  const c = bb.getCenter(new THREE.Vector3());
  const k = targetH / Math.max(sz.y, 1e-3);
  const w = new THREE.Group();
  o.position.set(-c.x, -bb.min.y, -c.z);
  const sc = new THREE.Group();
  sc.add(o);
  sc.scale.setScalar(k);
  w.add(sc);
  o.traverse((n) => {
    const mesh = n as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    const ms = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const nm = ms.map((m) => {
      const c2 = m.clone();
      const col = (c2 as THREE.MeshStandardMaterial).color;
      if (col) mats.push({ m: c2 as THREE.MeshStandardMaterial, b: col.clone() });
      return c2;
    });
    mesh.material = Array.isArray(mesh.material) ? nm : nm[0]!;
  });
  return w;
}

export class Pawns {
  /** bidak per id pemain */
  readonly list: THREE.Group[] = [];
  private ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | null = null;
  models: Record<string, THREE.Object3D> = {};

  constructor(private readonly root: THREE.Group) {}

  build(players: readonly Player[]): void {
    this.list.forEach((g) => this.root.remove(g));
    this.list.length = 0;
    players.forEach((p) => {
      const g = new THREE.Group();
      const mats: MatRef[] = [];
      const ctl = new THREE.Mesh(
        new THREE.BufferGeometry(),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      );
      ctl.visible = false;
      g.add(ctl);
      const bb = new THREE.Group();
      g.add(bb);
      const model = this.models[`pawn${p.pawn}`];
      bb.add(
        model
          ? fitModel(model, 104, mats)
          : buildPerson(p.pawn, mats, PAWNS[p.pawn]?.color ?? '#ffffff'),
      );
      g.scale.setScalar(1.55);
      g.userData = { tx: 0, tz: 0, hop: 0, init: 0, bb, ctl, mats };
      this.root.add(g);
      this.list[p.id] = g;
    });
    if (!this.ring) {
      this.ring = new THREE.Mesh(
        new THREE.RingGeometry(30, 40, 40),
        new THREE.MeshBasicMaterial({
          color: 0xffd24a,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      this.ring.rotation.x = -Math.PI / 2;
      this.root.add(this.ring);
    }
  }

  /** Material "pengendali" bidak, dipakai efek untuk membuat gosong. */
  ctlMat(pid: number): THREE.MeshBasicMaterial | null {
    const g = this.list[pid];
    return g
      ? (g.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material
      : null;
  }

  sync(players: readonly Player[], turn: number, active: boolean): void {
    players.forEach((p) => {
      const g = this.list[p.id];
      if (!g) return;
      const xy = pawnXY(players, p);
      g.userData.tx = xy[0];
      g.userData.tz = xy[1];
      g.visible = !p.bankrupt;
      if (!g.userData.init) {
        g.position.set(xy[0], 13, xy[1]);
        g.userData.init = 1;
      }
    });
    const p = players[turn];
    const ring = this.ring;
    if (ring) {
      ring.visible = !!p && !p.bankrupt && active;
      if (ring.visible && p) {
        const xy = pawnXY(players, p);
        ring.userData.tx = xy[0];
        ring.userData.tz = xy[1];
        if (!ring.userData.init) {
          ring.position.set(xy[0], 12.9, xy[1]);
          ring.userData.init = 1;
        }
      }
    }
  }

  hop(pid: number): void {
    const g = this.list[pid];
    if (g) g.userData.hop = 0.26;
  }

  step(dt: number, camera: THREE.Camera, clock: number): void {
    const kk = 1 - Math.exp(-dt * 9);
    this.list.forEach((g) => {
      if (!g) return;
      const u = g.userData;
      if (u.bb)
        (u.bb as THREE.Group).rotation.y =
          Math.atan2(camera.position.x - g.position.x, camera.position.z - g.position.z) -
          g.rotation.y;
      if (u.mats) charSync(g);
      if (u.fx) return;
      g.position.x += (u.tx - g.position.x) * kk;
      g.position.z += (u.tz - g.position.z) * kk;
      let hy = 0;
      if (u.hop > 0) {
        u.hop -= dt;
        hy = Math.sin(Math.PI * clamp(1 - u.hop / 0.26, 0, 1)) * 28;
      }
      g.position.y = 13 + hy;
    });
    const ring = this.ring;
    if (ring && ring.visible) {
      ring.position.x += (ring.userData.tx - ring.position.x) * kk;
      ring.position.z += (ring.userData.tz - ring.position.z) * kk;
      const s = 1 + 0.12 * Math.sin(clock * 4);
      ring.scale.set(s, s, s);
    }
  }

  /** Kembalikan bidak ke keadaan normal setelah efek. */
  resetFx(): void {
    this.list.forEach((g) => {
      if (!g) return;
      g.userData.fx = false;
      g.rotation.set(0, 0, 0);
      // pastikan warna dan kilau bidak benar-benar kembali (juga bila efek terputus di tengah)
      const ctl = (g.userData.ctl as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>)
        .material;
      ctl.color.setRGB(1, 1, 1);
      emi(ctl).setRGB(0, 0, 0);
      g.userData.chk = true;
      if (g.userData.mats) charSync(g);
    });
  }
}
