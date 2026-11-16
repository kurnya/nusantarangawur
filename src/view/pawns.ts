/**
 * Bidak berupa orang (8 karakter), selalu menghadap kamera. Model GLB opsional menggantikan
 * model prosedural (lihat models.ts).
 */
import * as THREE from 'three';
import { PAWNS } from '../engine/board';
import type { Player } from '../engine/types';
import { pawnXY } from './layout';
import { TAU, clamp } from './util';

interface MatRef {
  m: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
  b: THREE.Color;
}

const BLK = new THREE.Color(0x151515);
const SKIN = [0xd9a070, 0xe0a878, 0xc98d5e, 0xb87a4e, 0xe3b184, 0xd4986a, 0xa86c42, 0xe8b88c];
const g_leg = new THREE.CylinderGeometry(4.4, 4.6, 18, 10);
const g_tor = new THREE.CylinderGeometry(10.5, 13, 30, 16);
const g_arm = new THREE.CylinderGeometry(3.6, 3.8, 24, 8);
const g_hand = new THREE.SphereGeometry(4.3, 10, 8);
const g_head = new THREE.SphereGeometry(15.5, 22, 16);
const g_eye = new THREE.SphereGeometry(2, 8, 6);
const g_base = new THREE.CylinderGeometry(19, 21, 6, 24);

/** Warna emisif per material (dipakai efek gosong). */
export const emi = (m: THREE.Material): THREE.Color =>
  (m.userData.em as THREE.Color | undefined) ?? (m.userData.em = new THREE.Color());

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

/** Model orang prosedural untuk karakter `pi` (0..7). */
export function buildPerson(pi: number, mats: MatRef[]): THREE.Group {
  const g = new THREE.Group();
  const col = PAWNS[pi]?.color ?? '#ffffff';
  const M = (hex: number | string, r?: number, o?: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial({ color: hex, roughness: r ?? 0.62, ...o });
    mats.push({ m, b: new THREE.Color(hex) });
    return m;
  };
  const add = (
    geo: THREE.BufferGeometry,
    m: THREE.Material,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0,
  ) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    if (rx || ry || rz) o.rotation.set(rx, ry, rz);
    o.castShadow = true;
    g.add(o);
    return o;
  };
  const cloth = M(col);
  const skin = M(SKIN[pi] ?? 0xd9a070, 0.7);
  const dark = M(0x2b2f3a);
  const hair = M(0x1c1410, 0.8);
  const eye = M(0x101010, 0.3);
  let pants = dark;
  const spread = 5.6;
  if (pi === 0 || pi === 2) pants = M(0x2b2f3a);
  add(g_base, M(col, 0.4, { metalness: 0.1 }), 0, 3, 0);
  add(g_leg, pants, -spread, 15, 0, 0, 0, pi === 5 ? 0.28 : 0);
  add(g_leg, pants, spread, 15, 0, 0, 0, pi === 5 ? -0.28 : 0);
  if (pi === 1 || pi === 4) {
    const sk = M(pi === 1 ? 0xd9a23a : 0xc99a2e, 0.6);
    add(new THREE.CylinderGeometry(12, 15.5, 22, 18), sk, 0, 22, 0);
  }
  add(g_tor, cloth, 0, 38, 0);
  [-1, 1].forEach((sd) => {
    const raise = pi === 5 && sd < 0 ? -1.9 : pi === 1 ? (sd < 0 ? -1.2 : 0.6) : 0;
    const a = add(g_arm, cloth, sd * 14.5, 38, 0, 0, 0, sd * 0.2 + (raise ? raise * sd * -1 : 0));
    a.position.set(sd * (raise ? 18 : 14.8), raise ? 44 : 36, 0);
    add(g_hand, skin, sd * (raise ? 30 : 17.4), raise ? 58 : 25, raise ? 2 : 0);
  });
  add(g_head, skin, 0, 66, 0);
  [-5.6, 5.6].forEach((x) => add(g_eye, eye, x, 67.5, 14.2));
  const cheek = M(0xe58b86, 0.8);
  [-9, 9].forEach((x) => {
    const c = add(new THREE.SphereGeometry(2.8, 8, 6), cheek, x, 63, 12.8);
    c.scale.z = 0.5;
  });
  const mouth = add(new THREE.TorusGeometry(3.2, 0.7, 6, 12, Math.PI), eye, 0, 62.5, 14.6);
  mouth.rotation.z = Math.PI;
  const dome = (r: number, y: number, m: THREE.Material, sy = 1, sz = 1) => {
    const o = add(new THREE.SphereGeometry(r, 20, 12, 0, TAU, 0, Math.PI / 2), m, 0, y, 0);
    o.scale.set(1, sy, sz);
    return o;
  };
  if (pi === 0) {
    const h = M(0xd8b765, 0.9);
    add(new THREE.ConeGeometry(25, 13, 22), h, 0, 81, 0);
    add(g_tor, M(0x2b2f3a), 0, 0, 0).visible = false;
    add(new THREE.CylinderGeometry(1.8, 1.8, 64, 6), M(0x6b4a2a), -19, 32, 7, 0.1, 0, 0.1);
    add(new THREE.BoxGeometry(14, 10, 3), M(0x8a8f96, 0.4), -24, 66, 7);
  } else if (pi === 1) {
    dome(15.8, 66, hair, 0.96);
    const gd = M(0xf2c14a, 0.35, { metalness: 0.5 });
    for (let k = -3; k <= 3; k++)
      add(
        new THREE.ConeGeometry(3.4, 16, 6),
        gd,
        k * 5.5,
        87 - Math.abs(k) * 1.3,
        -2,
        0,
        0,
        -k * 0.2,
      );
    add(new THREE.SphereGeometry(4, 10, 8), M(0xffffff), 10, 80, 10);
    add(new THREE.CylinderGeometry(15.6, 15.8, 3, 18), gd, 0, 80, 0);
  } else if (pi === 2) {
    const h = M(0xf2e9d0, 0.9);
    add(new THREE.CylinderGeometry(12.5, 13.5, 10, 18), h, 0, 81, 0);
    add(new THREE.CylinderGeometry(20, 20, 2.4, 22), h, 0, 76, 0);
    const netMat = new THREE.MeshStandardMaterial({ color: 0x6c7a8c, wireframe: true });
    const net = new THREE.Mesh(new THREE.ConeGeometry(10, 24, 10, 1, true), netMat);
    net.position.set(22, 18, 6);
    net.rotation.x = Math.PI;
    g.add(net);
    mats.push({ m: netMat, b: new THREE.Color(0x6c7a8c) });
  } else if (pi === 3) {
    const h = M(0x23b05f, 0.35);
    dome(17, 66, h, 1.02);
    add(new THREE.BoxGeometry(20, 5, 8), M(0x15202a, 0.2), 0, 66, 13);
    add(new THREE.BoxGeometry(30, 26, 20), M(0x23b05f, 0.5), 0, 40, -18);
  } else if (pi === 4) {
    const h = M(0x6b3a20, 0.7);
    dome(15.8, 66, h, 0.8);
    add(new THREE.CylinderGeometry(15.8, 15.8, 5, 18), h, 0, 69, 0);
    add(new THREE.SphereGeometry(5, 10, 8), h, 0, 68, -15);
    add(new THREE.BoxGeometry(3, 22, 3), M(0x8a8f96, 0.3), -18, 28, 10, 0, 0, 0.15);
  } else if (pi === 5) {
    dome(15.8, 66, hair, 0.92);
    add(new THREE.TorusGeometry(15.6, 2.4, 8, 24), M(0xcc2222), 0, 73, 0, Math.PI / 2);
    add(new THREE.BoxGeometry(14, 3, 2), M(0xcc2222), -14, 70, -8, 0, 0, -0.5);
    add(new THREE.TorusGeometry(12.2, 2.4, 8, 20), M(0x8a3a14), 0, 28, 0, Math.PI / 2);
  } else if (pi === 6) {
    const w = M(0xffffff, 0.8);
    add(new THREE.CylinderGeometry(14.5, 14.5, 11, 18), w, 0, 82, 0);
    add(new THREE.SphereGeometry(15, 14, 10), w, 0, 92, 0).scale.y = 0.65;
    add(new THREE.BoxGeometry(18, 26, 3), M(0x5a4bb5), 0, 34, 12);
    add(new THREE.CylinderGeometry(6, 4, 5, 12), M(0xf4f1ea), 30, 28, 8);
  } else {
    dome(16, 67, hair, 0.95, 1);
    add(new THREE.BoxGeometry(4, 17, 2.4), M(0xcc2244), 0, 40, 12.4);
    add(new THREE.BoxGeometry(18, 14, 6), M(0x6c7683, 0.5), 28, 16, 2);
  }
  return g;
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
      bb.add(model ? fitModel(model, 104, mats) : buildPerson(p.pawn, mats));
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
    });
  }
}
