/** Kapal-kapal 3D yang berlayar di dua rute (dalam dan luar), jauh dari daratan. */
import * as THREE from 'three';
import { G, MID, PATH, type V2 } from './layout';
import { TAU, canvas2d, clamp } from './util';
import { containerTex, facadeTex, hullDeck, loftHull, type HullOpts } from './texkit';
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
const bx = (
  g: THREE.Group,
  w: number,
  h: number,
  d: number,
  c: number | THREE.Material,
  x: number,
  y: number,
  z: number,
  o?: THREE.MeshStandardMaterialParameters,
) => {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    typeof c === 'number' ? mm(c, 0.6, o) : c,
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
};
const cy = (
  g: THREE.Group,
  r1: number,
  r2: number,
  h: number,
  c: number | THREE.Material,
  x: number,
  y: number,
  z: number,
  rz = 0,
  seg = 12,
) => {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(r1, r2, h, seg),
    typeof c === 'number' ? mm(c, 0.6) : c,
  );
  m.position.set(x, y, z);
  if (rz) m.rotation.z = rz;
  m.castShadow = true;
  g.add(m);
  return m;
};

/** lambung loft + geladak; keel di y0 */
function hullOf(g: THREE.Group, o: HullOpts, y0: number, deckCol: number, rough = 0.5): void {
  const h = new THREE.Mesh(
    loftHull(o),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: 0.1 }),
  );
  h.position.y = y0;
  h.castShadow = true;
  h.receiveShadow = true;
  g.add(h);
  const d = new THREE.Mesh(hullDeck(o), mm(deckCol, 0.85, { side: THREE.DoubleSide }));
  d.position.y = y0;
  d.receiveShadow = true;
  g.add(d);
}

/** blok bangunan atas dengan tekstur jendela di sisi */
function cabin(
  g: THREE.Group,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  kind: 'ship' | 'office' = 'ship',
  col = 0xf4f2ec,
): void {
  const t = facadeTex(kind).clone();
  t.needsUpdate = true;
  t.repeat.set(w / 90, Math.max(1, h / 30) / 4);
  const side = new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 });
  const plain = mm(col, 0.55);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [
    plain,
    plain,
    plain,
    plain,
    side,
    side,
  ]);
  m.position.set(x, y + h / 2, 0);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  // depan anjungan: jendela lebar gelap
  bx(g, 1.5, h * 0.32, d * 0.86, 0x1b2d3f, x + w / 2 + 0.6, y + h * 0.72, 0, {
    metalness: 0.4,
    roughness: 0.2,
  });
}

/** pagar pembatas tipis di sepanjang tepi */
function rail(g: THREE.Group, L: number, z: number, y: number, x = 0, col = 0xdedad0): void {
  bx(g, L, 1.2, 1.2, col, x, y + 7, z);
  for (let k = 0; k <= Math.floor(L / 14); k++)
    bx(g, 0.9, 7, 0.9, col, x - L / 2 + k * 14, y + 3.5, z);
}

function funnel(
  g: THREE.Group,
  x: number,
  y: number,
  h: number,
  band: number,
  base = 0x2a2d33,
): void {
  cy(g, 8, 10, h, base, x, y + h / 2, 0, 0, 14);
  cy(g, 8.3, 8.6, h * 0.22, band, x, y + h * 0.7, 0, 0, 14);
  cy(g, 7.6, 7.6, 2, 0x111111, x, y + h + 1, 0, 0, 14);
}

function lifeboat(g: THREE.Group, x: number, y: number, z: number): void {
  const m = new THREE.Mesh(new THREE.SphereGeometry(4.5, 12, 8), mm(0xf07a1a, 0.5));
  m.scale.set(3, 1, 0.85);
  m.position.set(x, y, z);
  m.castShadow = true;
  g.add(m);
}

function makeCargo(color: number): THREE.Group {
  const g = new THREE.Group();
  const L = 440;
  const o: HullOpts = { L, B: 96, D: 46, T: 18, top: color, fine: 0.35, transom: 0.85, sheer: 0.1 };
  hullOf(g, o, -24, 0x5d1e1a);
  const pal = ['#b8362e', '#2a63a8', '#d9a227', '#2f8a5a', '#d8d4c8', '#6f4fa8', '#c4602a'];
  const boxGeo = new THREE.BoxGeometry(40, 20, 24);
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 7; c++) {
      const hgt = 1 + ((r * 7 + c * 3) % 3);
      for (let h = 0; h < hgt; h++) {
        const tex = containerTex(pal[(r * 3 + c * 5 + h) % pal.length]!);
        const m = new THREE.Mesh(
          boxGeo,
          new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }),
        );
        m.position.set(-120 + c * 42, 32 + h * 20.5, -27 + r * 27);
        m.castShadow = true;
        m.receiveShadow = true;
        g.add(m);
      }
    }
  // derek kapal
  [-60, 40].forEach((x) => {
    cy(g, 3.2, 3.6, 70, 0xd8b03a, x, 56, 40, 0, 10);
    const arm = cy(g, 1.8, 1.8, 80, 0xd8b03a, x + 24, 86, 40, 0, 8);
    arm.rotation.z = -1.1;
  });
  cabin(g, 50, 58, 76, -184, 22);
  bx(g, 8, 4, 96, 0xf4f2ec, -170, 78, 0);
  funnel(g, -200, 80, 30, color);
  cy(g, 1.2, 1.2, 40, 0xdddddd, -178, 100, 0, 0, 6);
  rail(g, 340, 46, 22, 0);
  rail(g, 340, -46, 22, 0);
  return g;
}

function makePinisi(): THREE.Group {
  const g = new THREE.Group();
  const o: HullOpts = {
    L: 300,
    B: 72,
    D: 40,
    T: 16,
    top: 0x6a3d22,
    boot: 0x2a1a10,
    bottom: 0x3a2a1e,
    stripe: 0xd8b26a,
    fine: 0.9,
    transom: 0.55,
    sheer: 0.45,
  };
  hullOf(g, o, -20, 0x9a6f45, 0.85);
  // rumah buritan kayu
  const wood = mm(0x8a5a32, 0.85);
  bx(g, 70, 26, 50, wood, -95, 33, 0);
  bx(g, 78, 3, 58, mm(0x5a3a22, 0.9), -95, 47.5, 0);
  for (let k = 0; k < 4; k++)
    [-1, 1].forEach((sd) => bx(g, 8, 8, 1, 0x2a1a10, -120 + k * 17, 36, sd * 25.3));
  rail(g, 220, 33, 20, 10, 0x6a4428);
  rail(g, 220, -33, 20, 10, 0x6a4428);
  const mastM = mm(0x5b3b22, 0.9);
  const sailM = mm(0xf1e7cf, 0.95, { side: THREE.DoubleSide });
  const sails: THREE.Mesh[] = [];
  (
    [
      [-20, 230],
      [62, 190],
    ] as const
  ).forEach(([mx, mh]) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 4.2, mh, 10), mastM);
    m.position.set(mx, mh / 2 + 16, 0);
    m.castShadow = true;
    g.add(m);
    // layar gaff trapesium dengan lengkung angin
    const geo = new THREE.PlaneGeometry(1, 1, 8, 8);
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) + 0.5;
      const v = p.getY(i) + 0.5;
      const w = 100 - v * 30;
      p.setXYZ(
        i,
        -u * w,
        26 + v * (mh - 50) + u * v * 20,
        Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 9,
      );
    }
    geo.computeVertexNormals();
    const sail = new THREE.Mesh(geo, sailM);
    sail.position.set(mx - 3, 0, 0);
    sail.castShadow = true;
    g.add(sail);
    sails.push(sail);
    cy(g, 1.4, 1.4, 104, mastM, mx - 50, mh - 14, 0, Math.PI / 2 - 0.2, 6);
  });
  const jibG = new THREE.BufferGeometry();
  jibG.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0, 0, 150, 0, 90, 4, 6], 3),
  );
  jibG.computeVertexNormals();
  const j = new THREE.Mesh(jibG, sailM);
  j.position.set(80, 30, 0);
  j.castShadow = true;
  g.add(j);
  sails.push(j);
  const bs = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 90, 8), mastM);
  bs.rotation.z = -1.25;
  bs.position.set(176, 40, 0);
  g.add(bs);
  g.userData.sails = sails;
  return g;
}

function makeFerry(): THREE.Group {
  const g = new THREE.Group();
  const L = 360;
  const o: HullOpts = {
    L,
    B: 104,
    D: 44,
    T: 18,
    top: 0xf3f1ea,
    stripe: 0x1f5ea8,
    fine: 0.3,
    transom: 0.9,
    sheer: 0.08,
  };
  hullOf(g, o, -22, 0x6f7a80);
  cabin(g, 250, 30, 90, -20, 22);
  cabin(g, 180, 26, 78, -30, 52);
  cabin(g, 70, 20, 60, 20, 78);
  bx(g, 260, 2, 96, 0xe8e4da, -20, 52.5, 0);
  for (let k = 0; k < 4; k++) [-1, 1].forEach((sd) => lifeboat(g, -110 + k * 40, 60, sd * 42));
  rail(g, 250, 45, 52, -20);
  rail(g, 250, -45, 52, -20);
  funnel(g, -90, 78, 26, 0x1f5ea8, 0xf3f1ea);
  funnel(g, -60, 78, 26, 0x1f5ea8, 0xf3f1ea);
  cy(g, 1.2, 1.2, 34, 0xdddddd, 20, 112, 0, 0, 6);
  // pintu rampa kendaraan di buritan
  bx(g, 3, 30, 60, 0x55606a, -L / 2 + 2, 8, 0);
  return g;
}

function makeTanker(): THREE.Group {
  const g = new THREE.Group();
  const L = 480;
  const o: HullOpts = {
    L,
    B: 92,
    D: 44,
    T: 20,
    top: 0x23272d,
    stripe: 0xb8b8b8,
    fine: 0.3,
    transom: 0.85,
    sheer: 0.06,
  };
  hullOf(g, o, -24, 0x8a2f24);
  const pipe = mm(0x9aa0a6, 0.4, { metalness: 0.6 });
  for (let k = 0; k < 3; k++) cy(g, 2.4, 2.4, L - 210, pipe, 40, 24, -16 + k * 16, Math.PI / 2, 8);
  for (let k = 0; k < 5; k++) {
    cy(g, 6, 6, 8, 0xd8d3c4, -30 + k * 60, 25, 28, 0, 12);
    cy(g, 6, 6, 8, 0xd8d3c4, -30 + k * 60, 25, -28, 0, 12);
  }
  bx(g, 6, 16, 50, 0xd84a2a, 60, 28, 0);
  cy(g, 2.4, 3.2, 60, 0xe8e4da, 60, 52, 0, 0, 8);
  cabin(g, 60, 34, 74, -196, 20);
  cabin(g, 46, 22, 62, -200, 54);
  bx(g, 8, 3, 92, 0xf4f2ec, -178, 77, 0);
  funnel(g, -222, 54, 34, 0xd84a2a);
  cy(g, 1.2, 1.2, 36, 0xdddddd, -196, 92, 0, 0, 6);
  rail(g, 400, 44, 20, 20);
  rail(g, 400, -44, 20, 20);
  return g;
}

function makeJukung(sailCols: string[], hullCol: number): THREE.Group {
  const g = new THREE.Group();
  const L = 270;
  const o: HullOpts = {
    L,
    B: 36,
    D: 26,
    T: 10,
    top: hullCol,
    boot: 0xf2f2ee,
    bottom: 0x2c2c2c,
    stripe: 0xe8e2d0,
    fine: 1.1,
    transom: 0,
    sheer: 0.6,
    round: 0.7,
  };
  hullOf(g, o, -14, 0x6a4a2e, 0.8);
  // cadik bambu melengkung
  const bamboo = mm(0xcdb57a, 0.7);
  [-1, 1].forEach((sd) => {
    const fl = new THREE.Mesh(new THREE.SphereGeometry(4.2, 12, 8), bamboo);
    fl.scale.set((L * 0.31) / 4.2, 1, 1);
    fl.position.set(0, -6, sd * 78);
    fl.castShadow = true;
    g.add(fl);
    [-60, 60].forEach((x) => {
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(x, 12, 0),
        new THREE.Vector3(x, 26, sd * 40),
        new THREE.Vector3(x, -4, sd * 78),
      );
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 2.2, 6), bamboo);
      tube.castShadow = true;
      g.add(tube);
    });
  });
  cy(g, 2.4, 3.4, 190, 0x6b4a2a, 10, 84, 0, 0, 8);
  const { c: cv, x } = canvas2d(128);
  sailCols.forEach((c, k) => {
    x.fillStyle = c;
    x.fillRect(0, (k * 128) / sailCols.length, 128, 128 / sailCols.length + 1);
  });
  const geo = new THREE.PlaneGeometry(1, 1, 6, 8);
  const p = geo.attributes.position as THREE.BufferAttribute;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) + 0.5;
    const v = p.getY(i) + 0.5;
    // layar segitiga: sisi depan tiang, menyempit ke atas
    p.setXYZ(i, -u * 120 * (1 - v * 0.92), 14 + v * 166, Math.sin(u * Math.PI) * (1 - v) * 10);
    uv.setXY(i, 0, v);
  }
  geo.computeVertexNormals();
  const sail = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      map: new THREE.CanvasTexture(cv),
      side: THREE.DoubleSide,
      roughness: 0.9,
    }),
  );
  sail.position.set(8, 0, 0);
  sail.castShadow = true;
  g.add(sail);
  g.userData.sails = [sail];
  return g;
}

function makeSpeed(): THREE.Group {
  const g = new THREE.Group();
  const L = 220;
  const o: HullOpts = {
    L,
    B: 70,
    D: 30,
    T: 10,
    top: 0xf6f6f2,
    boot: 0x14365e,
    bottom: 0x14365e,
    stripe: 0xd8372c,
    fine: 0.6,
    transom: 0.95,
    sheer: 0.25,
    round: 0.25,
  };
  hullOf(g, o, -14, 0xd8c8a6);
  const glass = mm(0x2c4a5e, 0.1, { metalness: 0.5, transparent: true, opacity: 0.8 });
  const ws = bx(g, 4, 16, 54, glass, 10, 24, 0);
  ws.rotation.z = 0.6;
  bx(g, 50, 10, 50, 0xeeeae0, -30, 20, 0);
  bx(g, 30, 6, 46, 0x3a3a3a, -70, 18, 0);
  // mesin tempel
  bx(g, 18, 30, 22, 0x1d1f22, -L / 2 - 8, 8, 0);
  bx(g, 22, 10, 26, 0x2a2d33, -L / 2 - 8, 26, 0);
  rail(g, 80, 32, 16, 50, 0xc8ccd0);
  rail(g, 80, -32, 16, 50, 0xc8ccd0);
  return g;
}

function makeNavy(): THREE.Group {
  const g = new THREE.Group();
  const L = 400;
  const o: HullOpts = {
    L,
    B: 72,
    D: 40,
    T: 18,
    top: 0x8a9098,
    boot: 0x2a2d31,
    bottom: 0x4a2a28,
    fine: 0.8,
    transom: 0.8,
    sheer: 0.18,
  };
  hullOf(g, o, -22, 0x6a7078);
  const grey = mm(0x9aa1a9, 0.55);
  const grey2 = mm(0x868d95, 0.55);
  // bangunan atas bersudut (stealth)
  const sup = new THREE.Mesh(new THREE.CylinderGeometry(24, 30, 36, 4, 1), grey);
  sup.rotation.y = Math.PI / 4;
  sup.scale.set(2.4, 1, 1);
  sup.position.set(-30, 36, 0);
  sup.castShadow = true;
  g.add(sup);
  const brg = new THREE.Mesh(new THREE.CylinderGeometry(16, 22, 24, 4, 1), grey2);
  brg.rotation.y = Math.PI / 4;
  brg.scale.set(1.5, 1, 1);
  brg.position.set(-10, 66, 0);
  brg.castShadow = true;
  g.add(brg);
  bx(g, 2, 6, 30, 0x1b2d3f, 13, 70, 0);
  // tiang radar berkisi
  cy(g, 6, 9, 50, grey2, -20, 98, 0, 0, 4);
  bx(g, 30, 4, 4, 0xcfd3d8, -20, 122, 0);
  const radar = bx(g, 4, 10, 26, 0x3a3f45, -20, 130, 0);
  g.userData.radar = radar;
  // meriam haluan
  const tur = new THREE.Mesh(
    new THREE.SphereGeometry(12, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    grey,
  );
  tur.position.set(110, 22, 0);
  tur.scale.set(1.3, 0.9, 1);
  g.add(tur);
  cy(g, 2, 2.4, 44, 0x3a3f45, 136, 28, 0, Math.PI / 2 - 0.08, 8);
  bx(g, 40, 2, 52, 0x5a6068, -150, 19, 0);
  funnel(g, -70, 54, 18, 0x3a3f45, 0x8a9098);
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
      const radar = s.body.userData.radar as THREE.Mesh | undefined;
      if (radar) radar.rotation.y = clock * 1.6;
      const sails = s.body.userData.sails as THREE.Mesh[] | undefined;
      sails?.forEach((sl, k) => {
        sl.rotation.y = Math.sin(clock * 0.7 + k) * 0.06;
      });
    });
  }
}
