/** Kapal-kapal 3D yang berlayar di dua rute (dalam dan luar), jauh dari daratan. */
import * as THREE from 'three';
import { G, MID, PATH, type V2 } from './layout';
import { TAU, canvas2d, clamp } from './util';
import { ISL, WATER_Y, X0, X1, Z0, Z1 } from './world';

interface Route {
  pts: V2[];
  cum: number[];
  L: number;
  n: number;
}
function makeRoute(raw: V2[]): Route {
  let pts = raw.slice();
  const n = pts.length;
  for (let it = 0; it < 3; it++) {
    const out: V2[] = [];
    for (let i = 0; i < n; i++) {
      let sx = 0;
      let sz = 0;
      for (let k = -8; k <= 8; k++) {
        const q = pts[(i + k + n) % n]!;
        sx += q[0];
        sz += q[1];
      }
      out.push([sx / 17, sz / 17]);
    }
    pts = out;
  }
  const cum = [0];
  for (let i = 1; i <= n; i++) {
    const a = pts[i - 1]!;
    const b = pts[i % n]!;
    cum.push(cum[i - 1]! + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  return { pts, cum, L: cum[n]!, n };
}
function sampleRoute(r: Route, s: number) {
  s = ((s % r.L) + r.L) % r.L;
  let lo = 0;
  let hi = r.n;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (r.cum[m]! <= s) lo = m;
    else hi = m;
  }
  const a = r.pts[lo]!;
  const b = r.pts[(lo + 1) % r.n]!;
  const f = (s - r.cum[lo]!) / (r.cum[lo + 1]! - r.cum[lo]! || 1);
  return {
    x: a[0] + (b[0] - a[0]) * f,
    z: a[1] + (b[1] - a[1]) * f,
    ang: Math.atan2(b[1] - a[1], b[0] - a[0]),
  };
}

const mm = (c: number, r?: number, o?: THREE.MeshStandardMaterialParameters) =>
  new THREE.MeshStandardMaterial({ color: c, roughness: r ?? 0.6, ...o });
function hullGeo(pts: V2[], depth: number) {
  const s = new THREE.Shape();
  pts.forEach((p, k) => (k ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])));
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  return g;
}
const bx = (
  g: THREE.Group,
  w: number,
  h: number,
  d: number,
  c: number,
  x: number,
  y: number,
  z: number,
  o?: THREE.MeshStandardMaterialParameters,
) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mm(c, 0.6, o));
  m.position.set(x, y, z);
  m.castShadow = true;
  g.add(m);
  return m;
};
const cy = (
  g: THREE.Group,
  r1: number,
  r2: number,
  h: number,
  c: number,
  x: number,
  y: number,
  z: number,
  rz = 0,
  seg = 10,
) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mm(c, 0.6));
  m.position.set(x, y, z);
  if (rz) m.rotation.z = rz;
  m.castShadow = true;
  g.add(m);
  return m;
};
function hull(g: THREE.Group, pts: V2[], dep: number, c: number, y: number, rough?: number) {
  const m = new THREE.Mesh(hullGeo(pts, dep), mm(c, rough ?? 0.55));
  m.position.y = y;
  m.castShadow = true;
  g.add(m);
  return m;
}
const bow = (L: number, W: number, cut: number): V2[] => [
  [-L / 2, -W / 2],
  [L / 2 - cut, -W / 2],
  [L / 2, 0],
  [L / 2 - cut, W / 2],
  [-L / 2, W / 2],
];

function makeCargo(color: number): THREE.Group {
  const g = new THREE.Group();
  const LEN = 440;
  const W = 96;
  hull(g, bow(LEN, W, 90), 44, color, -24);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(LEN - 110, 3, W - 10), mm(0x4a5260, 0.8));
  deck.position.set(-20, 21, 0);
  g.add(deck);
  const pal = [0xd8473a, 0x2f7dd1, 0xf0b429, 0x3aa86b, 0xe4e0d6, 0x8a5bd0];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 7; c++)
      for (let h = 0; h < 1 + ((r + c) % 2); h++) {
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(40, 22, 24),
          mm(pal[(r * 3 + c * 5 + h) % pal.length]!, 0.7),
        );
        m.position.set(-140 + c * 44, 34 + h * 23, -28 + r * 28);
        m.castShadow = true;
        g.add(m);
      }
  bx(g, 62, 72, 78, 0xf4f1e8, -178, 58, 0);
  const win = new THREE.Mesh(new THREE.BoxGeometry(4, 16, 70), mm(0x1d3550));
  win.position.set(-146, 76, 0);
  g.add(win);
  cy(g, 9, 10, 38, 0xd8473a, -190, 112, 0);
  return g;
}

function makePinisi(): THREE.Group {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(-130, -30);
  s.lineTo(60, -38);
  s.quadraticCurveTo(150, -30, 178, 0);
  s.quadraticCurveTo(150, 30, 60, 38);
  s.lineTo(-130, 30);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 36, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  const hl = new THREE.Mesh(geo, mm(0x7d4a28, 0.8));
  hl.position.y = -18;
  hl.castShadow = true;
  g.add(hl);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(250, 6, 70), mm(0xc9a15f, 0.8));
  stripe.position.set(0, 17, 0);
  g.add(stripe);
  bx(g, 70, 30, 46, 0xe7d3a8, -85, 32, 0, { roughness: 0.8 });
  const mastM = mm(0x5b3b22, 0.9);
  const sailM = mm(0xf3ead6, 0.9, { side: THREE.DoubleSide });
  const sailR = mm(0xc4382f, 0.9, { side: THREE.DoubleSide });
  const sails: THREE.Mesh[] = [];
  (
    [
      [-20, 230, 1],
      [62, 190, 0],
    ] as const
  ).forEach(([mx, mh, red]) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.6, mh, 8), mastM);
    m.position.set(mx, mh / 2 + 16, 0);
    m.castShadow = true;
    g.add(m);
    const t = new THREE.Shape();
    t.moveTo(0, 0);
    t.lineTo(0, mh - 24);
    t.lineTo(-110, 6);
    t.closePath();
    const sail = new THREE.Mesh(new THREE.ShapeGeometry(t), red ? sailR : sailM);
    sail.position.set(mx - 3, 24, 0);
    sail.castShadow = true;
    g.add(sail);
    sails.push(sail);
  });
  const jib = new THREE.Shape();
  jib.moveTo(0, 0);
  jib.lineTo(0, 150);
  jib.lineTo(80, 10);
  jib.closePath();
  const j = new THREE.Mesh(new THREE.ShapeGeometry(jib), sailM);
  j.position.set(82, 26, 0);
  j.rotation.y = 0.1;
  j.castShadow = true;
  g.add(j);
  sails.push(j);
  const bs = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 90, 6), mastM);
  bs.rotation.z = -1.2;
  bs.position.set(190, 28, 0);
  g.add(bs);
  g.userData.sails = sails;
  return g;
}

function makeFerry(): THREE.Group {
  const g = new THREE.Group();
  const L = 360;
  const W = 104;
  hull(g, bow(L, W, 50), 40, 0xf3f1ea, -22);
  bx(g, L - 40, 9, W + 2, 0xe8741e, -6, -10, 0);
  bx(g, 250, 30, 86, 0xfafaf5, -24, 32, 0);
  bx(g, 160, 24, 72, 0xfafaf5, -34, 58, 0);
  bx(g, 170, 6, 80, 0xe8741e, -34, 72, 0);
  for (let k = 0; k < 7; k++)
    [-1, 1].forEach((sd) => bx(g, 14, 10, 2, 0x23364a, -110 + k * 28, 34, sd * 43.5));
  for (let k = 0; k < 5; k++)
    [-1, 1].forEach((sd) => bx(g, 14, 9, 2, 0x23364a, -90 + k * 26, 59, sd * 36.5));
  cy(g, 9, 10, 30, 0xe8741e, -70, 90, 0);
  cy(g, 9, 10, 30, 0xe8741e, -30, 90, 0);
  cy(g, 1.6, 1.6, 34, 0xdddddd, -10, 92, 0);
  return g;
}
function makeTanker(): THREE.Group {
  const g = new THREE.Group();
  const L = 480;
  const W = 92;
  hull(g, bow(L, W, 70), 42, 0xb23a2c, -24);
  bx(g, L - 170, 3, W - 6, 0x2c3036, 30, 19, 0);
  for (let k = 0; k < 3; k++) cy(g, 3, 3, L - 200, 0x8a8f96, 30, 26, -22 + k * 22, Math.PI / 2, 8);
  for (let k = 0; k < 4; k++) cy(g, 7, 7, 10, 0xdcd8cc, 10 + k * 70, 28, 0, 0, 10);
  bx(g, 64, 46, 72, 0xf4f1ea, -190, 44, 0);
  bx(g, 50, 26, 62, 0xf4f1ea, -196, 76, 0);
  bx(g, 4, 10, 60, 0x1d3550, -163, 80, 0);
  cy(g, 9, 10, 34, 0x2a2d33, -215, 76, 0);
  cy(g, 1.4, 1.4, 36, 0xdddddd, -190, 106, 0);
  return g;
}
function makeJukung(sailCols: string[], hullCol: number): THREE.Group {
  const g = new THREE.Group();
  const L = 270;
  const W = 34;
  hull(g, bow(L, W, 50), 24, hullCol, -14, 0.75);
  [-1, 1].forEach((sd) => {
    cy(g, 5, 5, L * 0.8, 0xd9bf82, 0, -6, sd * 74, Math.PI / 2, 8);
    [-70, 0, 70].forEach((x) => {
      const a = cy(g, 2.6, 2.6, 76, 0xc9a15f, x, 0, sd * 38, 0, 6);
      a.rotation.x = Math.PI / 2;
    });
  });
  cy(g, 3, 4, 200, 0x6b4a2a, 10, 86, 0, 0, 8);
  const { c: cv, x } = canvas2d(128);
  sailCols.forEach((c, k) => {
    x.fillStyle = c;
    x.fillRect(0, (k * 128) / sailCols.length, 128, 128 / sailCols.length + 1);
  });
  const t = new THREE.Shape();
  t.moveTo(0, 0);
  t.lineTo(0, 176);
  t.lineTo(-120, 10);
  t.closePath();
  const sg = new THREE.ShapeGeometry(t);
  const pa = sg.attributes.position as THREE.BufferAttribute;
  const uv = sg.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pa.count; i++) uv.setXY(i, 0, pa.getY(i) / 176);
  const sail = new THREE.Mesh(
    sg,
    new THREE.MeshStandardMaterial({
      map: new THREE.CanvasTexture(cv),
      side: THREE.DoubleSide,
      roughness: 0.9,
    }),
  );
  sail.position.set(8, 14, 0);
  sail.castShadow = true;
  g.add(sail);
  g.userData.sails = [sail];
  return g;
}
function makeSpeed(): THREE.Group {
  const g = new THREE.Group();
  const L = 220;
  const W = 72;
  hull(g, bow(L, W, 70), 28, 0xf4f4f0, -18, 0.4);
  bx(g, L - 30, 5, W + 1, 0xd8372c, -6, -6, 0);
  bx(g, 64, 16, 52, 0x9ec6d8, -10, 20, 0, { transparent: true, opacity: 0.75 });
  bx(g, 30, 6, 48, 0xe9e4d6, -50, 12, 0);
  bx(g, 26, 36, 30, 0x2a2d33, -L / 2 - 6, 2, 0);
  return g;
}
function makeNavy(): THREE.Group {
  const g = new THREE.Group();
  const L = 400;
  const W = 72;
  hull(g, bow(L, W, 80), 38, 0x8f959d, -22);
  bx(g, L - 60, 4, W - 6, 0x6d737b, 0, 17, 0);
  bx(g, 130, 36, 52, 0xb9bec4, -20, 38, 0);
  bx(g, 64, 28, 42, 0xb9bec4, 0, 70, 0);
  cy(g, 2, 2, 60, 0xcfd3d8, 0, 112, 0);
  const r = new THREE.Mesh(new THREE.SphereGeometry(10, 10, 8), mm(0xdfe3e6));
  r.position.set(-30, 96, 0);
  g.add(r);
  cy(g, 14, 16, 14, 0x6d737b, 120, 26, 0, 0, 12);
  cy(g, 2.6, 2.6, 50, 0x2e3238, 146, 30, 0, Math.PI / 2, 8);
  cy(g, 10, 12, 10, 0x6d737b, -110, 48, 0, 0, 10);
  cy(g, 1.8, 1.8, 40, 0xcfd3d8, -120, 70, 0);
  return g;
}

const SHIPL = [300, 270, 360, 440, 480, 270, 220, 400];

interface Ship {
  holder: THREE.Group;
  body: THREE.Group;
  ti: number;
  route: Route;
  s: number;
  speed: number;
  dir: number;
  ph: number;
}

export class Ships {
  private readonly ships: Ship[] = [];

  constructor(
    private readonly root: THREE.Group,
    rnd: () => number,
  ) {
    const dec: V2[] = [];
    for (let i = 0; i < PATH.length; i += 5) dec.push(PATH[i]!);
    const inner = makeRoute(
      dec.map((p) => {
        const dx = MID[0] - p[0];
        const dz = MID[1] - p[1];
        const l = Math.hypot(dx, dz) || 1;
        let x = p[0] + (dx / l) * 1350 * G;
        let z = p[1] + (dz / l) * 1350 * G;
        const mx = x - MID[0];
        const mz = z - MID[1];
        const ml = Math.hypot(mx, mz);
        const minR = ISL.R + 500 * G;
        if (ml < minR) {
          x = MID[0] + (mx / ml) * minR;
          z = MID[1] + (mz / ml) * minR;
        }
        return [x, z] as V2;
      }),
    );
    const outer = makeRoute(
      dec.map((p) => {
        const dx = MID[0] - p[0];
        const dz = MID[1] - p[1];
        const l = Math.hypot(dx, dz) || 1;
        return [
          clamp(p[0] - (dx / l) * 1080 * G, X0 + 420 * G, X1 - 420 * G),
          clamp(p[1] - (dz / l) * 1080 * G, Z0 + 420 * G, Z1 - 420 * G),
        ] as V2;
      }),
    );
    const wakeTex = (() => {
      const { c, x } = canvas2d(256, 128);
      const gr = x.createLinearGradient(0, 0, 256, 0);
      gr.addColorStop(0, 'rgba(255,255,255,.0)');
      gr.addColorStop(1, 'rgba(255,255,255,.85)');
      x.fillStyle = gr;
      x.beginPath();
      x.moveTo(256, 64);
      x.lineTo(0, 2);
      x.lineTo(0, 126);
      x.closePath();
      x.fill();
      return new THREE.CanvasTexture(c);
    })();
    const make = (ti: number): THREE.Group => {
      switch (ti) {
        case 0:
          return makePinisi();
        case 1:
          return makeJukung(['#d7141a', '#ffffff'], 0x8a5a33);
        case 2:
          return makeFerry();
        case 3:
          return makeCargo([0x9c2f2a, 0x23496e, 0x2d6a4f][this.ships.length % 3]!);
        case 4:
          return makeTanker();
        case 5:
          return makeJukung(['#d7141a', '#ffffff'], 0xb98a55);
        case 6:
          return makeSpeed();
        default:
          return makeNavy();
      }
    };
    const addShip = (ti: number, route: Route, off: number, speed: number, dir: number) => {
      const holder = new THREE.Group();
      const body = make(ti);
      const L = SHIPL[ti]!;
      holder.add(body);
      const wake = new THREE.Mesh(
        new THREE.PlaneGeometry(L * 0.95, L * 0.26),
        new THREE.MeshBasicMaterial({
          map: wakeTex,
          transparent: true,
          depthWrite: false,
          fog: true,
        }),
      );
      wake.rotation.x = -Math.PI / 2;
      wake.position.set(-L * 0.9, -6.6, 0);
      holder.add(wake);
      holder.scale.setScalar(1.4 * G);
      this.root.add(holder);
      this.ships.push({
        holder,
        body,
        ti,
        route,
        s: off,
        speed: speed * dir,
        dir,
        ph: rnd() * TAU,
      });
    };
    addShip(3, inner, 0, 62, 1);
    addShip(0, inner, inner.L * 0.25, 50, 1);
    addShip(4, inner, inner.L * 0.5, 58, -1);
    addShip(2, inner, inner.L * 0.75, 46, -1);
    addShip(5, outer, 0, 52, 1);
    addShip(7, outer, outer.L * 0.25, 56, 1);
    addShip(1, outer, outer.L * 0.5, 44, -1);
    addShip(6, outer, outer.L * 0.75, 70, -1);
  }

  /** Ganti model kapal jenis `ti` dengan model GLB. */
  swap(ti: number, src: THREE.Object3D): void {
    const L = SHIPL[ti];
    if (!L) return;
    this.ships.forEach((s) => {
      if (s.ti !== ti) return;
      const o = src.clone(true);
      const bb = new THREE.Box3().setFromObject(o);
      const sz = bb.getSize(new THREE.Vector3());
      const c = bb.getCenter(new THREE.Vector3());
      const w = new THREE.Group();
      const sc = new THREE.Group();
      o.position.set(-c.x, -bb.min.y, -c.z);
      sc.add(o);
      if (sz.z > sz.x) sc.rotation.y = Math.PI / 2;
      sc.scale.setScalar(L / Math.max(sz.x, sz.z));
      w.add(sc);
      w.position.y = -16;
      o.traverse((n) => {
        if ((n as THREE.Mesh).isMesh) n.castShadow = true;
      });
      s.holder.remove(s.body);
      s.body = w;
      s.holder.add(w);
    });
  }

  step(dt: number, clock: number): void {
    this.ships.forEach((s) => {
      s.s += s.speed * dt;
      const p = sampleRoute(s.route, s.s);
      s.holder.position.set(p.x, WATER_Y + 4 + Math.sin(clock * 1.3 + s.ph) * 3, p.z);
      s.holder.rotation.y = -(p.ang + (s.dir < 0 ? Math.PI : 0));
      s.holder.rotation.z = Math.sin(clock * 0.9 + s.ph) * 0.022;
      s.holder.rotation.x = Math.sin(clock * 1.1 + s.ph) * 0.015;
      const sails = s.body.userData.sails as THREE.Mesh[] | undefined;
      sails?.forEach((sl, k) => {
        sl.rotation.y = Math.sin(clock * 0.7 + k) * 0.06;
      });
    });
  }
}
