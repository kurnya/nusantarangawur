/**
 * Perkakas dekorasi alam per provinsi: bentuk low-poly (vertex color) yang digabung jadi
 * beberapa mesh saja. Koordinat memakai (s, v): s = jarak sepanjang jalur dalam satuan petak,
 * v = jarak menyamping dari tengah jalur (positif = sisi `cpt().n`).
 */
import * as THREE from 'three';
import { cpt } from '../tiles';
import { G, PITCH } from '../layout';

export const HALF_TOP = 258 * G;
export const HALF_BEACH = 354 * G;

export type Layer = 'solid' | 'flat' | 'glass';

export interface AddOpts {
  sx?: number;
  sy?: number;
  sz?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  /** warna puncak (gradasi bawah ke atas pada tinggi lokal bentuk) */
  top?: number;
  /** variasi warna acak 0..1 */
  jit?: number;
  layer?: Layer;
  alpha?: number;
  /** gelombang permukaan organik (0..0.4, relatif terhadap ukuran) */
  lump?: number;
  /** goyang angin di puncak bentuk (satuan dunia) */
  sway?: number;
  /** gelap di bagian bawah bentuk (0..1) */
  ao?: number;
  /** variasi warna bintik (0..1); bawaan 0.2 pada lapisan solid */
  mot?: number;
  /** pusat normal bola (dedaunan): normal diarahkan keluar dari titik ini agar tajuk diterangi lembut */
  nc?: [number, number, number];
}

/** derau nilai 3D halus untuk variasi warna dan bentuk */
export function noise3(x: number, y: number, z: number): number {
  const h = (a: number, b: number, c: number) => {
    const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const f = (t: number) => t * t * (3 - 2 * t);
  const xf = f(x - xi);
  const yf = f(y - yi);
  const zf = f(z - zi);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  return l(
    l(l(h(xi, yi, zi), h(xi + 1, yi, zi), xf), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), xf), yf),
    l(
      l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), xf),
      l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), xf),
      yf,
    ),
    zf,
  );
}

/** waktu bersama untuk goyang angin (diperbarui tiap frame oleh Scene) */
export const WIND = { value: 0 };

/** Tinggi daratan jalur pada jarak menyamping v (sama dengan buildLandRibbon). */
export function groundY(v: number): number {
  const a = Math.abs(v);
  if (a <= HALF_TOP) return 1;
  return 1 + (-7 * (a - HALF_TOP)) / (HALF_BEACH - HALF_TOP);
}

interface Acc {
  pos: number[];
  col: number[];
  nor: number[];
  sw: number[];
  ph: number[];
}
const mkAcc = (): Acc => ({ pos: [], col: [], nor: [], sw: [], ph: [] });

type BaseName =
  | 'cone'
  | 'cyl'
  | 'blob'
  | 'blobHi'
  | 'hemi'
  | 'box'
  | 'disc'
  | 'cone4'
  | 'blade'
  | 'dot'
  | 'leaf'
  | 'mount'
  | 'hill';
interface Base {
  pos: Float32Array;
  nor: Float32Array;
  /** peneduh per titik (alur erosi), opsional */
  sh?: Float32Array;
  ymin: number;
  ymax: number;
}

function makeBase(g: THREE.BufferGeometry): Base {
  const ng = g.index ? g.toNonIndexed() : g;
  const pos = ng.getAttribute('position').array as Float32Array;
  const nor = ng.getAttribute('normal').array as Float32Array;
  let ymin = 1e9;
  let ymax = -1e9;
  for (let i = 1; i < pos.length; i += 3) {
    ymin = Math.min(ymin, pos[i]!);
    ymax = Math.max(ymax, pos[i]!);
  }
  const sa = ng.getAttribute('shade');
  return {
    pos: Float32Array.from(pos),
    nor: Float32Array.from(nor),
    sh: sa ? Float32Array.from(sa.array as Float32Array) : undefined,
    ymin,
    ymax,
  };
}

/** helai daun: belah ketupat tipis dua sisi di bidang XZ */
function leafGeo(): THREE.BufferGeometry {
  const v = [
    [0, 0, -0.5],
    [0.5, 0.04, 0],
    [0, 0, 0.5],
    [-0.5, -0.04, 0],
  ];
  const tri = [0, 2, 1, 0, 3, 2];
  const pos: number[] = [];
  const nor: number[] = [];
  for (const side of [1, -1]) {
    for (let i = 0; i < tri.length; i += 3) {
      const ids =
        side > 0 ? [tri[i]!, tri[i + 1]!, tri[i + 2]!] : [tri[i]!, tri[i + 2]!, tri[i + 1]!];
      for (const id of ids) {
        pos.push(...v[id]!);
        nor.push(0, side, 0);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

/**
 * Gunung/bukit beresolusi cukup dengan alur erosi radial dan punggungan tak beraturan.
 * concave: lereng cekung khas gunung api; bila false, bukit membulat.
 */
function mountGeo(concave: boolean): THREE.BufferGeometry {
  const SEG = 30;
  const RINGS = 9;
  const pos: number[] = [];
  const sh: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= RINGS; j++) {
    const h = j / RINGS;
    const base = concave ? Math.pow(1 - h, 1.35) : Math.pow(1 - h, 0.72) * (1 - 0.12 * h);
    for (let i = 0; i <= SEG; i++) {
      const th = (i / SEG) * Math.PI * 2;
      const ci = Math.cos(th);
      const si = Math.sin(th);
      const n1 = noise3(ci * 1.6 + 5, si * 1.6, h * 2.2);
      const n2 = noise3(ci * 4 + 9, si * 4, h * 5);
      // alur sempit: lembah tajam di antara punggungan
      const k = concave ? 9 : 6;
      const g = Math.max(0, 1 - Math.abs(Math.sin(th * k * 0.5 + n1 * 3.2)) * 3.2);
      const mid = Math.sin(Math.min(1, h * 1.15) * Math.PI);
      const r =
        j === RINGS ? 0 : base * (1 + (n1 - 0.5) * 0.28 + (n2 - 0.5) * 0.1 - g * 0.09 * mid);
      const y = h + (j === RINGS ? 0 : (n2 - 0.5) * 0.05 * mid);
      pos.push(ci * r, y, si * r);
      sh.push(1 - g * 0.32 * mid - (n2 - 0.5) * 0.18);
    }
  }
  const W = SEG + 1;
  for (let j = 0; j < RINGS; j++)
    for (let i = 0; i < SEG; i++) {
      const a = j * W + i;
      idx.push(a, a + W, a + 1, a + 1, a + W, a + W + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('shade', new THREE.Float32BufferAttribute(sh, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const BASES: Record<BaseName, Base> = (() => {
  const cone = new THREE.ConeGeometry(1, 1, 6, 1, true);
  cone.translate(0, 0.5, 0);
  const cone4 = new THREE.ConeGeometry(1, 1, 4, 1, true);
  const blade = new THREE.ConeGeometry(1, 1, 3, 1, true);
  blade.translate(0, 0.5, 0);
  cone4.translate(0, 0.5, 0);
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true);
  cyl.translate(0, 0.5, 0);
  const box = new THREE.BoxGeometry(1, 1, 1);
  box.translate(0, 0.5, 0);
  const disc = new THREE.CircleGeometry(1, 12);
  disc.rotateX(-Math.PI / 2);
  return {
    cone: makeBase(cone),
    cone4: makeBase(cone4),
    blade: makeBase(blade),
    dot: makeBase(new THREE.IcosahedronGeometry(1, 0)),
    cyl: makeBase(cyl),
    box: makeBase(box),
    disc: makeBase(disc),
    blob: makeBase(new THREE.IcosahedronGeometry(1, 1)),
    blobHi: makeBase(new THREE.IcosahedronGeometry(1, 2)),
    hemi: makeBase(new THREE.SphereGeometry(1, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2)),
    leaf: makeBase(leafGeo()),
    mount: makeBase(mountGeo(true)),
    hill: makeBase(mountGeo(false)),
  };
})();

const c0 = new THREE.Color();
const c1 = new THREE.Color();
const m4 = new THREE.Matrix4();
const nm3 = new THREE.Matrix3();
const n3 = new THREE.Vector3();
const q4 = new THREE.Quaternion();
const e4 = new THREE.Euler();
const v3 = new THREE.Vector3();
const s3 = new THREE.Vector3();

const flat = (acc: Acc, p: THREE.Vector3) => {
  acc.pos.push(p.x, p.y, p.z);
  const m = (1 + (noise3(p.x * 0.0035, 3.1, p.z * 0.0035) - 0.5) * 0.22) * 0.9;
  const w = (noise3(p.x * 0.0021, 7.7, p.z * 0.0021) - 0.5) * 0.12;
  // tanah sedikit diredam supaya tidak hijau neon di bawah cahaya terang
  const l = 0.3 * c0.r + 0.59 * c0.g + 0.11 * c0.b;
  const d = 0.78;
  acc.col.push(
    (l + (c0.r - l) * d) * m * (1 + w),
    (l + (c0.g - l) * d) * m,
    (l + (c0.b - l) * d) * m * (1 - w),
  );
  acc.nor.push(0, 1, 0);
  acc.sw.push(0);
  acc.ph.push(0);
};

export class NatureKit {
  readonly group = new THREE.Group();
  private readonly acc: Record<Layer, Acc> = {
    solid: mkAcc(),
    flat: mkAcc(),
    glass: mkAcc(),
  };
  private readonly alphas: Record<string, Acc> = {};
  /** sumber asap bergerak: x, y, z, skala */
  private readonly smokes: number[] = [];
  /** kabut: x, y, z, rx, rz, arah */
  private readonly mists: number[] = [];
  /** bila true, strip/pond yang digambar dilaporkan ke onArea sebagai area terpakai */
  rec = false;
  onArea: ((x: number, z: number, r: number) => void) | null = null;

  constructor(readonly rnd: () => number) {}

  /** titik dunia dari koordinat jalur; t = petak (desimal), v = menyamping */
  at(t: number, v: number): { x: number; z: number; tx: number; tz: number } {
    const p = cpt(t * PITCH);
    return { x: p.x + p.nx * v, z: p.z + p.nz * v, tx: p.nz, tz: -p.nx };
  }

  /** sudut putar Y yang menyejajarkan sumbu x lokal dengan arah jalur */
  heading(t: number): number {
    const p = cpt(t * PITCH);
    return -Math.atan2(-p.nx, p.nz);
  }

  private push(acc: Acc, base: Base, m: THREE.Matrix4, col: number, o: AddOpts): void {
    c0.setHex(col);
    if (o.jit) c0.multiplyScalar(1 + (this.rnd() - 0.5) * o.jit);
    const span = base.ymax - base.ymin || 1;
    if (o.top !== undefined) c1.setHex(o.top);
    const solid = (o.layer ?? 'solid') === 'solid';
    const mot = o.mot ?? (solid ? 0.2 : 0);
    const ao = o.ao ?? (solid ? 0.18 : 0);
    const lump = o.lump ?? 0;
    const sway = o.sway ?? 0;
    const nm = nm3.getNormalMatrix(m);
    const sc = (s3.x + s3.y + s3.z) / 3;
    const ph = this.rnd();
    const p = base.pos;
    const bn = base.nor;
    for (let i = 0; i < p.length; i += 3) {
      v3.set(p[i]!, p[i + 1]!, p[i + 2]!).applyMatrix4(m);
      n3.set(bn[i]!, bn[i + 1]!, bn[i + 2]!)
        .applyMatrix3(nm)
        .normalize();
      if (o.nc) {
        const ex = v3.x - o.nc[0];
        const ey = (v3.y - o.nc[1]) * 1.3;
        const ez = v3.z - o.nc[2];
        const l = Math.hypot(ex, ey, ez) || 1;
        n3.set(ex / l, ey / l + 0.15, ez / l).normalize();
      }
      if (lump) {
        const d =
          (noise3(v3.x * 0.035, v3.y * 0.035, v3.z * 0.035) - 0.5) * 2 * lump * sc +
          (noise3(v3.x * 0.11, v3.y * 0.11, v3.z * 0.11) - 0.5) * lump * sc * 0.5;
        v3.addScaledVector(n3, d);
      }
      acc.pos.push(v3.x, v3.y, v3.z);
      acc.nor.push(n3.x, n3.y, n3.z);
      const f = (p[i + 1]! - base.ymin) / span;
      let r = c0.r;
      let g = c0.g;
      let b = c0.b;
      if (o.top !== undefined) {
        r += (c1.r - r) * f;
        g += (c1.g - g) * f;
        b += (c1.b - b) * f;
      }
      let k = base.sh ? base.sh[i / 3]! : 1;
      if (ao) k *= 1 - ao + ao * Math.min(1, f * 1.4);
      if (mot) {
        k *= 1 + (noise3(v3.x * 0.06, v3.y * 0.06, v3.z * 0.06) - 0.5) * mot * 2;
        k *= 1 + (noise3(v3.x * 0.19, v3.y * 0.19, v3.z * 0.19) - 0.5) * mot * 0.9;
      }
      if (solid) {
        // cahaya langit: sisi atas lebih terang, sisi bawah lebih redup
        k *= 0.82 + 0.2 * (n3.y * 0.5 + 0.5);
        // variasi hangat/dingin skala lebar supaya satu spesies tidak seragam
        const w = (noise3(v3.x * 0.009, 1.7, v3.z * 0.009) - 0.5) * 0.14;
        r *= 1 + w;
        b *= 1 - w;
        // kurangi kejenuhan agar tidak terkesan kartun
        const l = 0.3 * r + 0.59 * g + 0.11 * b;
        r = l + (r - l) * 0.86;
        g = l + (g - l) * 0.9;
        b = l + (b - l) * 0.86;
      }
      acc.col.push(r * k, g * k, b * k);
      acc.sw.push(sway * Math.pow(Math.max(0, f), 1.4));
      acc.ph.push(ph);
    }
  }

  private accFor(o: AddOpts): Acc {
    if (o.layer === 'glass' && o.alpha !== undefined && o.alpha !== 0.4) {
      const k = String(o.alpha);
      return (this.alphas[k] ??= mkAcc());
    }
    return this.acc[o.layer ?? 'solid'];
  }

  /** tambah bentuk dasar di posisi dunia (x, y, z) */
  add(name: BaseName, col: number, x: number, y: number, z: number, o: AddOpts = {}): void {
    e4.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0, 'YXZ');
    q4.setFromEuler(e4);
    m4.compose(v3.set(x, y, z), q4, s3.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1));
    this.push(this.accFor(o), BASES[name], m4, col, o);
  }

  /** batang/akar dari titik a ke b dengan jari-jari r (silinder) */
  limb(
    a: [number, number, number],
    b: [number, number, number],
    r: number,
    col: number,
    o: AddOpts = {},
  ): void {
    const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = dir.length() || 1;
    q4.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    m4.compose(v3.set(a[0], a[1], a[2]), q4, s3.set(r, len, r));
    this.push(this.accFor(o), BASES.cyl, m4, col, o);
  }

  /** bidang datar mengikuti jalur: s0..s1 (petak), v0..v1 (menyamping) */
  strip(
    s0: number,
    s1: number,
    v0: number,
    v1: number,
    y: number,
    col: number,
    o: AddOpts = {},
  ): void {
    const segs = Math.max(1, Math.ceil(Math.abs(s1 - s0) / 0.12));
    const acc = this.accFor({ layer: 'flat', ...o });
    c0.setHex(col);
    if (o.jit) c0.multiplyScalar(1 + (this.rnd() - 0.5) * o.jit);
    const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
      const nx = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
      if (nx < 0) [b, c] = [c, b];
      for (const p of [a, b, c]) flat(acc, p);
    };
    if (this.rec && this.onArea) {
      const hw = Math.abs(v1 - v0) / 2;
      const step = Math.max(0.04, Math.min(0.12, (hw * 1.4) / PITCH));
      for (let t = Math.min(s0, s1); t <= Math.max(s0, s1) + 1e-6; t += step) {
        const q = this.at(t, (v0 + v1) / 2);
        this.onArea(q.x, q.z, Math.max(hw, step * PITCH * 0.6));
      }
    }
    for (let i = 0; i < segs; i++) {
      const ta = s0 + ((s1 - s0) * i) / segs;
      const tb = s0 + ((s1 - s0) * (i + 1)) / segs;
      const a = this.at(ta, v0);
      const b = this.at(tb, v0);
      const c = this.at(tb, v1);
      const d = this.at(ta, v1);
      const A = new THREE.Vector3(a.x, y, a.z);
      const B = new THREE.Vector3(b.x, y, b.z);
      const C = new THREE.Vector3(c.x, y, c.z);
      const D = new THREE.Vector3(d.x, y, d.z);
      tri(A, B, C);
      tri(A, C, D);
    }
  }

  /** dinding tegak sepanjang jalur pada jarak menyamping v, dari tinggi y0 ke y1 */
  wallS(s0: number, s1: number, v: number, y0: number, y1: number, col: number): void {
    const segs = Math.max(1, Math.ceil(Math.abs(s1 - s0) / 0.12));
    const acc = this.accFor({ layer: 'flat' });
    for (let i = 0; i < segs; i++) {
      const a = this.at(s0 + ((s1 - s0) * i) / segs, v);
      const b = this.at(s0 + ((s1 - s0) * (i + 1)) / segs, v);
      this.quadV(acc, a.x, a.z, b.x, b.z, y0, y1, col);
    }
  }

  /** dinding tegak melintang jalur pada posisi s, dari v0 ke v1 */
  wallV(s: number, v0: number, v1: number, y0: number, y1: number, col: number): void {
    const a = this.at(s, v0);
    const b = this.at(s, v1);
    this.quadV(this.accFor({ layer: 'flat' }), a.x, a.z, b.x, b.z, y0, y1, col);
  }

  private quadV(
    acc: Acc,
    ax: number,
    az: number,
    bx: number,
    bz: number,
    y0: number,
    y1: number,
    col: number,
  ): void {
    let nx = bz - az;
    let nz = -(bx - ax);
    const l = Math.hypot(nx, nz) || 1;
    nx /= l;
    nz /= l;
    c0.setHex(col);
    const pts = [
      [ax, y0, az],
      [bx, y0, bz],
      [bx, y1, bz],
      [ax, y0, az],
      [bx, y1, bz],
      [ax, y1, az],
    ];
    for (const [x, y, z] of pts) {
      const k =
        (0.72 + 0.28 * ((y! - y0) / (y1 - y0 || 1))) *
        (0.9 + noise3(x! * 0.05, y! * 0.08, z! * 0.05) * 0.2);
      acc.pos.push(x!, y!, z!);
      acc.col.push(c0.r * k, c0.g * k, c0.b * k);
      acc.nor.push(nx, 0.25, nz);
      acc.sw.push(0);
      acc.ph.push(0);
    }
  }

  /** bidang datar bentuk blob (kolam, lumpur) dengan pusat dan radius s/v */
  pond(
    ts: number,
    v: number,
    rs: number,
    rv: number,
    y: number,
    col: number,
    o: AddOpts = {},
  ): void {
    const n = 14;
    if (this.rec && this.onArea) {
      const ctr = this.at(ts, v);
      this.onArea(ctr.x, ctr.z, Math.max(rs * PITCH, rv) * 1.05);
    }
    const acc = this.accFor({ layer: 'flat', ...o });
    c0.setHex(col);
    const pts: THREE.Vector3[] = [];
    const ph = this.rnd() * 6;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const w = 1 + 0.16 * Math.sin(a * 3 + ph) + 0.08 * Math.sin(a * 5 + ph * 2);
      const p = this.at(ts + Math.cos(a) * rs * w, v + Math.sin(a) * rv * w);
      pts.push(new THREE.Vector3(p.x, y, p.z));
    }
    const ctr = this.at(ts, v);
    const C = new THREE.Vector3(ctr.x, y, ctr.z);
    for (let k = 0; k < n; k++) {
      let a = pts[k]!;
      let b = pts[(k + 1) % n]!;
      const nx = (b.z - C.z) * (a.x - C.x) - (b.x - C.x) * (a.z - C.z);
      if (nx > 0) [a, b] = [b, a];
      for (const p of [C, a, b]) flat(acc, p);
    }
  }

  /** kabut/awan rendah: gumpalan lembut yang melayang pelan dan berubah bentuk (GPU) */
  mist(x: number, y: number, z: number, rx: number, rz: number, heading = 0): void {
    this.mists.push(x, y, z, rx, rz, heading);
  }

  private buildMist(): void {
    if (!this.mists.length) return;
    const pos: number[] = [];
    const off: number[] = [];
    const seed: number[] = [];
    const size: number[] = [];
    for (let i = 0; i < this.mists.length; i += 6) {
      const [x, y, z, rx, rz, hd] = this.mists.slice(i, i + 6) as [
        number,
        number,
        number,
        number,
        number,
        number,
      ];
      const n = Math.round(14 + rx / 6);
      for (let q = 0; q < n; q++) {
        pos.push(x, y, z);
        // sebaran memanjang searah jalur, lebih tebal di tengah
        const u = (this.rnd() - 0.5) * 2;
        const w = (this.rnd() - 0.5) * 2 * (1 - Math.abs(u) * 0.5);
        off.push(rx * Math.cos(hd), rz, -rx * Math.sin(hd));
        seed.push(this.rnd(), u, w);
        size.push(rx * (0.3 + this.rnd() * 0.28));
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aAx', new THREE.Float32BufferAttribute(off, 3));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 3));
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uT: WIND },
      transparent: true,
      depthWrite: false,
      vertexShader: `attribute vec3 aAx;attribute vec3 aSeed;attribute float aSize;uniform float uT;
varying float vA;varying vec2 vR;
void main(){
  // aAx.xz = sumbu panjang (rx), aAx.y = lebar (rz)
  vec2 ax=aAx.xz; float rz=aAx.y; vec2 nx=normalize(ax); vec2 side=vec2(-nx.y,nx.x);
  // tiap gumpalan bergeser pelan sepanjang sumbu lalu muncul lagi di ujung lain
  float life=fract(aSeed.x+uT*0.02);
  float u=aSeed.y*0.35+(life-0.5)*1.3;
  vec3 p=position;
  p.xz+=ax*u+side*aSeed.z*rz;
  p.y+=sin(uT*0.4+aSeed.x*30.0)*6.0+aSeed.z*8.0;
  vec4 mv=modelViewMatrix*vec4(p,1.0);
  gl_Position=projectionMatrix*mv;
  float breathe=0.85+0.15*sin(uT*0.5+aSeed.x*20.0);
  gl_PointSize=clamp(aSize*breathe*(1200.0/-mv.z),1.0,512.0);
  vA=sin(life*3.14159)*0.3;
  vR=vec2(aSeed.x*6.28,uT*0.15+aSeed.x*9.0);
}`,
      fragmentShader: `varying float vA;varying vec2 vR;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
void main(){
  vec2 c=gl_PointCoord-0.5;
  float cs=cos(vR.x),sn=sin(vR.x);
  vec2 q=vec2(c.x*cs-c.y*sn,c.x*sn+c.y*cs);
  // tepi berawan: falloff bulat diganggu derau yang bergerak pelan
  float nn=n2(q*5.0+vR.y)*0.6+n2(q*11.0-vR.y*1.3)*0.4;
  float d=length(c)*2.0+ (nn-0.5)*0.55;
  float a=smoothstep(1.0,0.15,d)*vA;
  if(a<0.006)discard;
  vec3 col=mix(vec3(0.86,0.89,0.93),vec3(1.0),smoothstep(0.3,-0.3,c.y));
  gl_FragColor=vec4(col,a);
}`,
    });
    const pts = new THREE.Points(g, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 4;
    pts.name = 'nature-mist';
    this.group.add(pts);
  }

  /** asap kawah yang terus mengepul dan terbawa angin (dianimasikan di GPU) */
  smoke(x: number, y: number, z: number, scale = 1): void {
    this.smokes.push(x, y, z, scale);
  }

  private buildSmoke(): void {
    if (!this.smokes.length) return;
    const N = 34;
    const pos: number[] = [];
    const seed: number[] = [];
    const sc: number[] = [];
    for (let i = 0; i < this.smokes.length; i += 4) {
      for (let q = 0; q < N; q++) {
        pos.push(
          this.smokes[i]! + (this.rnd() - 0.5) * 14,
          this.smokes[i + 1]!,
          this.smokes[i + 2]! + (this.rnd() - 0.5) * 14,
        );
        seed.push(q / N + this.rnd() * 0.02);
        sc.push(this.smokes[i + 3]! * (0.8 + this.rnd() * 0.4));
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
    g.setAttribute('aS', new THREE.Float32BufferAttribute(sc, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uT: WIND },
      transparent: true,
      depthWrite: false,
      vertexShader: `attribute float aSeed;attribute float aS;uniform float uT;varying float vA;varying float vL;
void main(){
  float life=fract(uT*0.06+aSeed);
  vec3 p=position;
  float sd=aSeed*91.7;
  p.y+=life*280.0*aS+sin(uT*0.9+sd)*4.0;
  // naik, melebar, lalu condong terbawa angin
  p.x+=(sin(sd+uT*0.35)*10.0+life*life*110.0)*aS+sin(uT*0.6+sd*1.3)*life*22.0*aS;
  p.z+=(cos(sd*0.7+uT*0.3)*10.0+life*life*40.0)*aS+cos(uT*0.5+sd)*life*18.0*aS;
  vec4 mv=modelViewMatrix*vec4(p,1.0);
  gl_Position=projectionMatrix*mv;
  gl_PointSize=clamp((26.0+life*120.0)*aS*(1100.0/-mv.z),1.0,256.0);
  vA=smoothstep(0.0,0.1,life)*pow(1.0-life,1.3)*0.6;
  vL=life;
}`,
      fragmentShader: `varying float vA;varying float vL;
void main(){
  vec2 c=gl_PointCoord-0.5;
  float d=length(c);
  float a=smoothstep(0.5,0.05,d)*vA;
  if(a<0.008)discard;
  vec3 col=mix(vec3(0.55,0.53,0.5),vec3(0.86,0.85,0.83),vL)*(0.9+0.25*(0.5-c.y));
  gl_FragColor=vec4(col,a);
}`,
    });
    const pts = new THREE.Points(g, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 3;
    pts.name = 'nature-smoke';
    this.group.add(pts);
  }

  /** gabungkan jadi mesh dan pasang ke `parent` */
  finish(parent: THREE.Object3D): void {
    const mk = (acc: Acc, mat: THREE.Material, name: string, order = 0, shadow = false) => {
      if (!acc.pos.length) return;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(acc.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(acc.nor, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(acc.col, 3));
      g.setAttribute('aSway', new THREE.Float32BufferAttribute(acc.sw, 1));
      g.setAttribute('aPh', new THREE.Float32BufferAttribute(acc.ph, 1));
      const m = new THREE.Mesh(g, mat);
      m.name = name;
      m.renderOrder = order;
      m.receiveShadow = true;
      m.castShadow = shadow;
      this.group.add(m);
    };
    const solid = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 });
    solid.onBeforeCompile = (sh) => {
      sh.uniforms.uWT = WIND;
      sh.vertexShader = sh.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
attribute float aSway;attribute float aPh;uniform float uWT;`,
        )
        .replace(
          '#include <begin_vertex>',
          `vec3 transformed=vec3(position);
if(aSway>0.0){
  vec3 wp=(modelMatrix*vec4(position,1.0)).xyz;
  float w=sin(uWT*1.4+aPh*6.283+wp.x*0.004)*0.65+sin(uWT*2.9+aPh*11.0+wp.z*0.006)*0.35;
  float g=0.5+0.5*sin(uWT*0.37+wp.x*0.0021+wp.z*0.0017);
  transformed.x+=w*aSway*(0.6+0.8*g);
  transformed.z+=w*aSway*0.55*(0.6+0.8*g);
}`,
        );
    };
    mk(this.acc.solid, solid, 'nature-solid', 0, true);
    mk(
      this.acc.flat,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.9,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
      }),
      'nature-flat',
      1,
    );
    const glassMat = (op: number) =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.5,
        transparent: true,
        opacity: op,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
      });
    mk(this.acc.glass, glassMat(0.4), 'nature-glass', 2);
    Object.entries(this.alphas).forEach(([k, a]) =>
      mk(a, glassMat(Number(k)), `nature-glass-${k}`, 2),
    );
    this.buildSmoke();
    this.buildMist();
    parent.add(this.group);
  }

  /**
   * Gumpalan daun dari helai-helai kecil (bukan bola): siluet bergerigi, cahaya lembut lewat
   * normal bola, bagian dalam dan bawah lebih gelap.
   */
  foliage(
    x: number,
    y: number,
    z: number,
    rx: number,
    ry: number,
    n: number,
    base: number,
    top: number,
    o: { sway?: number; leaf?: number; flat?: number } = {},
  ): void {
    const R = this.rnd;
    c0.setHex(base);
    c1.setHex(top);
    const dark = c0.clone().multiplyScalar(0.55);
    const sway = o.sway ?? 4;
    const lf = o.leaf ?? 0.6;
    const nc: [number, number, number] = [x, y - ry * 0.35, z];
    for (let i = 0; i < n; i++) {
      // arah acak, condong ke permukaan dan ke atas
      const th = R() * Math.PI * 2;
      const cy = R() * 1.7 - 0.7;
      const sr = Math.sqrt(Math.max(0, 1 - cy * cy));
      const u = 0.45 + 0.55 * Math.sqrt(R());
      const px = x + Math.cos(th) * sr * rx * u;
      const py = y + cy * ry * u * (o.flat ?? 1);
      const pz = z + Math.sin(th) * sr * rx * u;
      const hf = Math.min(1, Math.max(0, (cy * u + 1) / 2));
      const lit = hf * 0.75 + (u - 0.45) * 0.6;
      const cc = dark.clone().lerp(c0.clone().setHex(base), Math.min(1, lit * 1.6));
      if (lit > 0.55) cc.lerp(c1, Math.min(1, (lit - 0.55) * 2.2));
      cc.multiplyScalar(0.9 + R() * 0.22);
      const sz = Math.max(rx, ry) * lf * (0.65 + R() * 0.6);
      this.add('leaf', cc.getHex(), px, py, pz, {
        sx: sz,
        sy: sz,
        sz: sz * (0.45 + R() * 0.4),
        rx: (R() - 0.5) * 1.6,
        ry: R() * 6.28,
        rz: (R() - 0.5) * 1.6,
        nc,
        sway: sway * (0.6 + u * 0.6),
        mot: 0.15,
        ao: 0,
      });
    }
  }

  /**
   * Tajuk bercabang: beberapa gumpalan daun tak sama besar di ujung dahan, sehingga
   * siluet pohon tidak bulat seperti bola.
   */
  crown(
    x: number,
    y: number,
    z: number,
    rx: number,
    ry: number,
    base: number,
    top: number,
    density = 6,
    o: { sway?: number; bark?: number; flat?: number; from?: number } = {},
  ): void {
    const R = this.rnd;
    const parts = 3 + Math.floor(R() * 3);
    const leaves = Math.max(14, Math.round((density * 22) / parts));
    const fromY = y - ry * (o.from ?? 0.9);
    const bark = o.bark ?? 0x5a4330;
    for (let q = 0; q < parts; q++) {
      const a = (q / parts) * 6.28 + R() * 0.9;
      const d = q === 0 ? R() * 0.2 : 0.35 + R() * 0.4;
      const cx = x + Math.cos(a) * rx * d;
      const cz = z + Math.sin(a) * rx * d;
      const cy = y + (q === 0 ? ry * 0.25 : (R() - 0.35) * ry * 0.6);
      const s = q === 0 ? 0.62 : 0.4 + R() * 0.22;
      this.limb([x, fromY, z], [cx, cy - ry * s * 0.3, cz], Math.max(1.2, rx * 0.045), bark, {
        mot: 0.3,
      });
      this.foliage(cx, cy, cz, rx * s, ry * s * 1.1, leaves, base, top, {
        sway: o.sway,
        flat: o.flat,
      });
    }
  }

  /** bayangan kontak lembut di tanah */
  shadow(x: number, z: number, rx: number, rz = rx, y = 1.6, alpha = 0.3): void {
    this.add('disc', 0x000000, x, y, z, { sx: rx, sz: rz, layer: 'glass', alpha, mot: 0, ao: 0 });
  }

  /** rumpun rumput/padi: beberapa bilah tipis yang goyang */
  tuft(x: number, y: number, z: number, col: number, top: number, h: number, blades = 5): void {
    for (let b = 0; b < blades; b++) {
      const a = this.rnd() * 6.28;
      const d = this.rnd() * h * 0.28;
      this.add('blade', col, x + Math.cos(a) * d, y, z + Math.sin(a) * d, {
        sx: h * 0.09,
        sy: h * (0.7 + this.rnd() * 0.5),
        sz: h * 0.05,
        rx: (this.rnd() - 0.5) * 0.7,
        rz: (this.rnd() - 0.5) * 0.7,
        top,
        sway: h * 0.22,
        mot: 0.25,
        ao: 0.3,
      });
    }
  }

  /** jumlah titik semua mesh (untuk anggaran performa) */
  vertexCount(): number {
    let n = 0;
    (['solid', 'flat', 'glass'] as Layer[]).forEach((l) => (n += this.acc[l].pos.length / 3));
    Object.values(this.alphas).forEach((a) => (n += a.pos.length / 3));
    return n;
  }

  dispose(): void {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
    });
    this.group.parent?.remove(this.group);
  }
}

export const smooth = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
/** bobot zona [a,b] dengan tepi lunak selebar `fade` */
export const zone = (t: number, a: number, b: number, fade = 0.35): number =>
  smooth(a - fade, a, t) * (1 - smooth(b, b + fade, t));
