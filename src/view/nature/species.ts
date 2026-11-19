/**
 * Pustaka spesies dan bentang alam yang dipakai resep provinsi (recipes.ts).
 * Semua bentuk dibangun dengan NatureKit (low-poly, gradasi warna, goyang angin).
 * Anggaran: tiap fitur sengaja hemat titik (tajuk = gugus kecil, daun kecil = 'blade'/'dot').
 */
import { NatureKit, groundY, zone } from './kit';

export interface Item {
  f: string;
  /** zona sepanjang provinsi sebagai pecahan 0..1 */
  z?: [number, number];
  /** sisi: o = laut/luar, i = darat/dalam, b = keduanya acak */
  s?: 'o' | 'i' | 'b';
  n?: number;
  /** rentang menyamping (unit dunia) */
  v?: [number, number];
  c?: number;
  c2?: number;
  /** pengali tinggi/ukuran */
  h?: number;
  /** pilihan ragam bentuk */
  k?: number;
}

export interface Ctx {
  k: NatureKit;
  r: () => number;
  rr: (a: number, b: number) => number;
  density: number;
  T0: number;
  T1: number;
  outer: 1 | -1;
  out: (v: number) => number;
  inn: (v: number) => number;
  zr: (it: Item) => [number, number];
  cnt: (it: Item, def: number) => number;
  /** rad > 0: titik harus bebas dari area terpakai sejauh rad lalu menandainya terpakai */
  pt: (it: Item, vr: [number, number], def: 'o' | 'i' | 'b', rad?: number) => Pt | null;
  /** tandai area terpakai (lingkaran) agar fitur lain tidak menimpanya */
  claim: (x: number, z: number, r: number) => void;
  free: (x: number, z: number, r: number) => boolean;
}
export interface Pt {
  t: number;
  v: number;
  vv: number;
  x: number;
  z: number;
  gy: number;
  ry: number;
}

export function makeCtx(k: NatureKit, density: number, outer: 1 | -1, T0: number, T1: number): Ctx {
  const r = k.rnd;
  const rr = (a: number, b: number) => a + r() * (b - a);
  const out = (v: number) => v * outer;
  const inn = (v: number) => -v * outer;
  const zr = (it: Item): [number, number] => {
    const [a, b] = it.z ?? [0, 1];
    return [T0 + (T1 - T0) * a, T0 + (T1 - T0) * b];
  };
  const cnt = (it: Item, def: number) => Math.max(1, Math.round((it.n ?? def) * density));
  const occ: number[] = [];
  const claim = (x: number, z: number, rad: number) => {
    occ.push(x, z, rad);
  };
  const free = (x: number, z: number, rad: number) => {
    for (let i = 0; i < occ.length; i += 3) {
      const d = Math.hypot(x - occ[i]!, z - occ[i + 1]!);
      if (d < rad + occ[i + 2]!) return false;
    }
    return true;
  };
  // jejak bidang (sawah, kebun, danau, sungai) dicatat dari strip/pond yang digambar
  k.onArea = (x, z, rad) => claim(x, z, rad);
  const pt = (it: Item, vr: [number, number], def: 'o' | 'i' | 'b', rad = 0): Pt | null => {
    const [a, b] = zr(it);
    const [vmin, vmax] = it.v ?? vr;
    const tries = rad ? 90 : 40;
    for (let i = 0; i < tries; i++) {
      // bentang alam besar yang terhalang boleh bergeser sedikit menjauh dari jalan / ke samping
      const ext = rad && i >= 30 ? (i - 29) / 60 : 0;
      const ta = a - 0.2 - ext * 0.5;
      const tb = b + 0.2 + ext * 0.5;
      const t = rr(ta, tb);
      if (!ext && r() > zone(t, a, b, 0.2)) continue;
      const sd = it.s ?? def;
      const side = sd === 'b' ? (r() < 0.5 ? 'o' : 'i') : sd;
      const vv = rr(vmin, vmax + ext * 260);
      const v = side === 'o' ? out(vv) : inn(vv);
      const q = k.at(t, v);
      if (!free(q.x, q.z, rad ? rad * (1 - ext * 0.25) : 8)) continue;
      if (rad) claim(q.x, q.z, rad);
      return { t, v, vv, x: q.x, z: q.z, gy: groundY(v), ry: k.heading(t) };
    }
    return null;
  };
  return { k, r, rr, density, T0, T1, outer, out, inn, zr, cnt, pt, claim, free };
}

type F = (c: Ctx, it: Item) => void;
const off = (x: number, z: number, ry: number, dx: number, dz: number): [number, number] => [
  x + dx * Math.cos(ry) + dz * Math.sin(ry),
  z - dx * Math.sin(ry) + dz * Math.cos(ry),
];

const dim = (col: number, f: number): number => {
  const r = Math.round(((col >> 16) & 255) * f);
  const g = Math.round(((col >> 8) & 255) * f);
  const b = Math.round((col & 255) * f);
  return (r << 16) | (g << 8) | b;
};

/** pelepah palem melengkung: dua daun pipih, pangkal tegak lalu terkulai */
function frond(
  c: Ctx,
  x: number,
  y: number,
  z: number,
  a: number,
  len: number,
  col: number,
  top: number,
  droop = 1.0,
  wid = 0.17,
): void {
  const th1 = c.rr(0.75, 1.1);
  const l1 = len * 0.55;
  const l2 = len * 0.5;
  c.k.add('blade', col, x, y, z, {
    sx: len * 0.035,
    sy: l1,
    sz: len * wid,
    ry: -a,
    rz: -th1,
    top: dim(top, 0.9),
    sway: 3,
    mot: 0.35,
    ao: 0.1,
  });
  const th2 = th1 + droop;
  const ex = x + Math.cos(a) * Math.sin(th1) * l1;
  const ey = y + Math.cos(th1) * l1;
  const ez = z + Math.sin(a) * Math.sin(th1) * l1;
  c.k.add('blade', col, ex, ey, ez, {
    sx: len * 0.03,
    sy: l2,
    sz: len * wid * 0.85,
    ry: -a,
    rz: -th2,
    top,
    sway: 9,
    mot: 0.35,
    ao: 0.05,
  });
}

/** tajuk bercabang dari helai daun (lihat NatureKit.crown) */
function canopy(
  c: Ctx,
  x: number,
  y: number,
  z: number,
  rx: number,
  ry: number,
  base: number,
  top: number,
  clusters: number,
  sway = 4,
): void {
  c.k.crown(x, y, z, rx, Math.max(ry, rx * 0.45), base, top, clusters, { sway });
}

/** hutan kecil di lereng: gumpalan daun rendah tanpa batang terlihat */
function slopeForest(
  c: Ctx,
  x: number,
  z: number,
  w: number,
  h: number,
  zs: number,
  n: number,
  concave: boolean,
  base = 0x2c5a2e,
  top = 0x6a9a4c,
  maxH = 0.7,
): void {
  for (let q = 0; q < n; q++) {
    const a = c.r() * 6.28;
    const hf = c.r() * maxH;
    const rf = concave ? Math.pow(1 - hf, 1.35) : Math.pow(1 - hf, 0.72) * (1 - 0.12 * hf);
    const d = rf * 0.92;
    const s = c.rr(13, 22) * (1 - hf * 0.4);
    c.k.foliage(
      x + Math.cos(a) * w * d,
      h * hf + s * 0.4,
      z + Math.sin(a) * w * zs * d,
      s,
      s * 0.8,
      9,
      base,
      top,
      {
        sway: 1,
        leaf: 0.6,
      },
    );
  }
}

/* ============================ tanah ============================ */
const ground: F = (c, it) => {
  const [a, b] = c.zr(it);
  const sides = it.s === 'o' ? [c.out] : it.s === 'i' ? [c.inn] : [c.out, c.inn];
  for (let t = a; t < b; t += 0.2) {
    sides.forEach((sd, q) => {
      const col = (Math.floor(t * 5) + q) % 2 ? (it.c2 ?? it.c ?? 0x5d9b40) : (it.c ?? 0x5d9b40);
      c.k.strip(t, Math.min(b, t + 0.21), sd(272), sd(548), 2, col, { jit: 0.1 });
    });
  }
  const base = it.c ?? 0x5d9b40;
  const mix = (m: number, f: number) =>
    (Math.round(((base >> 16) & 255) * (1 - f) + ((m >> 16) & 255) * f) << 16) |
    (Math.round(((base >> 8) & 255) * (1 - f) + ((m >> 8) & 255) * f) << 8) |
    Math.round((base & 255) * (1 - f) + (m & 255) * f);
  const tones = [mix(0x7a6a3c, 0.38), mix(0x1d2a14, 0.22), mix(0xc8c06a, 0.2), mix(0x6a5436, 0.3)];
  const n = Math.round((b - a) * 14 * Math.min(1, c.density + 0.3));
  for (let i = 0; i < n; i++) {
    const sd = sides[Math.floor(c.r() * sides.length)]!;
    const t = a + c.r() * (b - a);
    const v = sd(c.rr(300, 520));
    const rs = c.rr(0.08, 0.3);
    const rv = c.rr(22, 70);
    const q = c.k.at(t, v);
    if (!c.free(q.x, q.z, Math.max(rs * 384, rv))) continue;
    c.k.pond(t, v, rs, rv, 2.6, tones[Math.floor(c.r() * tones.length)]!);
  }
};

const grass: F = (c, it) => {
  const pal = [it.c ?? 0x4f8f3a, it.c2 ?? 0x6aa046];
  for (let i = 0; i < c.cnt(it, 110); i++) {
    const p = c.pt(it, [275, 540], 'b');
    if (!p) continue;
    const dry = c.r() < 0.15;
    c.k.tuft(
      p.x,
      p.gy,
      p.z,
      dry ? 0xa8a45a : pal[Math.floor(c.r() * 2)]!,
      dry ? 0xd2c27a : 0x9acb62,
      c.rr(14, 26) * (it.h ?? 1),
      3,
    );
  }
};

const flowers: F = (c, it) => {
  const pal = [0xf7d84a, 0xffffff, 0xe86a92, 0xf29a3a, 0xb264d8, 0xe9503a];
  for (let i = 0; i < c.cnt(it, 120); i++) {
    const p = c.pt(it, [285, 540], 'b');
    if (!p) continue;
    const col = it.c ?? pal[Math.floor(c.r() * pal.length)]!;
    c.k.tuft(p.x, p.gy, p.z, 0x4a8a3a, 0x7dbb5a, 12, 2);
    c.k.add('dot', col, p.x, p.gy + 11, p.z, { sx: 4, sy: 3, sz: 4, mot: 0, ao: 0, sway: 3 });
  }
};

const rocks: F = (c, it) => {
  const col = dim(it.c ?? 0x6f6a5e, 0.82);
  const top = dim(it.c2 ?? 0x8b8576, 0.85);
  for (let i = 0; i < c.cnt(it, 30); i++) {
    const p = c.pt(it, [285, 560], 'b');
    if (!p) continue;
    const s = c.rr(6, 16) * (it.h ?? 1);
    const parts = 1 + Math.floor(c.r() * 3);
    for (let q = 0; q < parts; q++) {
      const k = q === 0 ? 1 : c.rr(0.35, 0.65);
      c.k.add(
        'dot',
        q % 2 ? dim(col, 0.85) : col,
        p.x + (q ? c.rr(-1, 1) * s : 0),
        p.gy - 1,
        p.z + (q ? c.rr(-1, 1) * s : 0),
        {
          sx: s * k * 1.2,
          sy: s * k * c.rr(0.55, 0.85),
          sz: s * k * c.rr(0.8, 1.2),
          rx: c.rr(-0.25, 0.25),
          ry: c.r() * 3,
          top,
          lump: 0.12,
          jit: 0.3,
          mot: 0.6,
          ao: 0.55,
        },
      );
    }
  }
};

/* ============================ pohon ============================ */
const pine: F = (c, it) => {
  const col = it.c ?? 0x1f4a2e;
  const top = it.c2 ?? 0x3f7048;
  for (let i = 0; i < c.cnt(it, 36); i++) {
    const p = c.pt(it, [440, 600], 'b');
    if (!p) continue;
    const h = c.rr(210, 330) * (it.h ?? 1);
    c.k.shadow(p.x, p.z, 46, 32);
    c.k.add('cone', 0x6a4a32, p.x, p.gy, p.z, { sx: 6, sy: h, sz: 6, top: 0x8a6448, sway: 1.5 });
    const whorls = 9;
    for (let w = 0; w < whorls; w++) {
      const f = w / whorls;
      const y = p.gy + h * (0.2 + f * 0.74);
      const reach = (1 - f) * 52 * c.rr(0.8, 1.15) + 10;
      const nb = 6 + Math.floor(c.r() * 2);
      for (let b = 0; b < nb; b++) {
        const a = (b / nb) * 6.28 + w * 0.9 + c.r() * 0.5;
        // dahan menjuntai: helai pipih memanjang ke luar lalu turun
        c.k.add('blade', c.r() < 0.5 ? col : top, p.x, y, p.z, {
          sx: reach * 0.16,
          sy: reach,
          sz: reach * 0.05,
          ry: -a,
          rz: -c.rr(1.75, 2.05),
          top: f > 0.5 ? top : col,
          sway: 2 + f * 5,
          mot: 0.35,
          ao: 0.25,
        });
      }
    }
  }
};

const cypress: F = (c, it) => {
  for (let i = 0; i < c.cnt(it, 30); i++) {
    const p = c.pt(it, [440, 600], 'b');
    if (!p) continue;
    const h = c.rr(250, 360) * (it.h ?? 1);
    c.k.shadow(p.x, p.z, 30, 22);
    c.k.add('cone', 0x6a4a30, p.x, p.gy, p.z, { sx: 5, sy: h * 0.3, sz: 5 });
    for (let t = 0; t < 4; t++) {
      const w = (1 - t * 0.2) * 26;
      c.k.add('cone', it.c ?? 0x23603a, p.x, p.gy + h * (0.12 + t * 0.2), p.z, {
        sx: w,
        sy: h * 0.34,
        sz: w,
        top: it.c2 ?? 0x4a9054,
        lump: 0.15,
        sway: 3,
        mot: 0.3,
      });
    }
  }
};

/** pohon hutan hujan bertajuk gugus */
const rain: F = (c, it) => {
  for (let i = 0; i < c.cnt(it, 30); i++) {
    const p = c.pt(it, [450, 625], 'b');
    if (!p) continue;
    const h = c.rr(130, 215) * (it.h ?? 1);
    c.k.shadow(p.x, p.z, 62, 48);
    c.k.add('cone', 0x6a4b30, p.x, p.gy, p.z, { sx: 11, sy: h * 0.88, sz: 11, top: 0x7d5c3d });
    canopy(
      c,
      p.x,
      p.gy + h * 0.95,
      p.z,
      c.rr(52, 72),
      c.rr(34, 46),
      it.c ?? 0x2a6a33,
      it.c2 ?? 0x6aae56,
      6,
    );
    if (c.r() < 0.5) c.k.tuft(p.x + 30, p.gy, p.z + 20, 0x3d8a3c, 0x7bc25a, 30, 4);
  }
};

const coco: F = (c, it) => {
  for (let i = 0; i < c.cnt(it, 30); i++) {
    const p = c.pt(it, [450, 640], 'b');
    if (!p) continue;
    const h = c.rr(200, 290) * (it.h ?? 1);
    const lx = c.rr(-0.18, 0.18) * h;
    const lz = c.rr(-0.1, 0.1) * h;
    c.k.shadow(p.x, p.z, 44, 30);
    let prev: [number, number, number] = [p.x, p.gy, p.z];
    for (let q = 1; q <= 4; q++) {
      const f = q / 4;
      const nx: [number, number, number] = [p.x + lx * f * f, p.gy + h * f, p.z + lz * f * f];
      c.k.limb(prev, nx, 4.4 - f * 1.4, 0x8a7457, { top: 0xa89874, mot: 0.25 });
      prev = nx;
    }
    for (let f = 0; f < 10; f++) {
      const a = (f / 10) * 6.28 + c.r() * 0.3;
      frond(c, prev[0], prev[1], prev[2], a, c.rr(92, 120), 0x3f7a3a, 0x7bb454, c.rr(0.8, 1.3));
    }
    for (let b = 0; b < 3; b++)
      c.k.add('dot', 0x6a8a2a, prev[0] + c.rr(-8, 8), prev[1] - 8, prev[2] + c.rr(-8, 8), {
        sx: 6,
        sy: 6,
        sz: 6,
      });
  }
};

/** kelapa sawit: batang pendek bersisik, pelepah berputar */
const sawit: F = (c, it) => {
  const rows = it.k === 1;
  for (let i = 0; i < c.cnt(it, 40); i++) {
    const p = c.pt(it, [300, 560], 'i');
    if (!p) continue;
    const h = c.rr(110, 160);
    c.k.add('cone', 0x6b5236, p.x, p.gy, p.z, { sx: 8, sy: h, sz: 8, top: 0x8a6e48, mot: 0.3 });
    for (let f = 0; f < 13; f++) {
      const a = (f / 13) * 6.28 + c.r() * 0.2;
      frond(c, p.x, p.gy + h, p.z, a, c.rr(80, 100), 0x37703a, 0x6aa957, f % 2 ? 1.2 : 0.7, 0.14);
    }
    if (!rows) c.k.shadow(p.x, p.z, 40, 30);
  }
};

const lontar: F = (c, it) => {
  for (let i = 0; i < c.cnt(it, 24); i++) {
    const p = c.pt(it, [300, 600], 'b');
    if (!p) continue;
    const h = c.rr(210, 300) * (it.h ?? 1);
    c.k.shadow(p.x, p.z, 36, 26);
    c.k.add('cone', 0x7a6a50, p.x, p.gy, p.z, {
      sx: 7.5,
      sy: h,
      sz: 7.5,
      top: 0x95866a,
      mot: 0.25,
    });
    for (let f = 0; f < 11; f++) {
      const a = (f / 11) * 6.28;
      frond(c, p.x, p.gy + h, p.z, a, c.rr(52, 66), it.c ?? 0x6b8f3f, it.c2 ?? 0x9bb85a, 0.6, 0.3);
    }
  }
};

const banana: F = (c, it) => {
  for (let i = 0; i < c.cnt(it, 24); i++) {
    const p = c.pt(it, [300, 560], 'b');
    if (!p) continue;
    c.k.limb([p.x, p.gy, p.z], [p.x, p.gy + 56, p.z], 4.5, 0x6f9a48, { top: 0x93bd5a });
    for (let f = 0; f < 6; f++) {
      const a = (f / 6) * 6.28;
      c.k.limb(
        [p.x, p.gy + 56, p.z],
        [p.x + Math.cos(a) * 56, p.gy + 40 - (f % 2) * 14, p.z + Math.sin(a) * 56],
        5,
        0x4c9a3e,
        { top: 0x86c85a, sway: 8, mot: 0.3 },
      );
    }
  }
};

const bamboo: F = (c, it) => {
  for (let i = 0; i < c.cnt(it, 22); i++) {
    const p = c.pt(it, [300, 600], 'b');
    if (!p) continue;
    c.k.shadow(p.x, p.z, 44, 36);
    for (let q = 0; q < 9; q++) {
      const a = c.r() * 6.28;
      const d = c.rr(0, 16);
      const h = c.rr(200, 310) * (it.h ?? 1);
      const lean = c.rr(40, 90);
      let prev: [number, number, number] = [p.x + Math.cos(a) * d, p.gy, p.z + Math.sin(a) * d];
      // batang melengkung keluar seperti rumpun bambu asli
      for (let sgm = 1; sgm <= 4; sgm++) {
        const f = sgm / 4;
        const nx: [number, number, number] = [
          p.x + Math.cos(a) * (d + lean * f * f),
          p.gy + h * (f - 0.12 * f * f * f),
          p.z + Math.sin(a) * (d + lean * f * f),
        ];
        c.k.limb(prev, nx, 2.6 - f * 0.9, sgm % 2 ? 0x8a9a42 : 0x9cae4a, {
          top: 0x7aa04a,
          sway: 3 + f * 8,
          mot: 0.3,
        });
        if (sgm >= 2)
          c.k.foliage(nx[0], nx[1] - 6, nx[2], 22 - sgm * 2, 12, 9, 0x3f7a36, 0x86b85a, {
            sway: 6 + f * 6,
            leaf: 0.75,
            flat: 0.7,
          });
        prev = nx;
      }
    }
  }
};

const acacia: F = (c, it) => {
  for (let i = 0; i < c.cnt(it, 20); i++) {
    const p = c.pt(it, [300, 600], 'b');
    if (!p) continue;
    const h = c.rr(110, 170) * (it.h ?? 1);
    c.k.shadow(p.x, p.z, 80, 60);
    c.k.limb([p.x, p.gy, p.z], [p.x + c.rr(-10, 10), p.gy + h, p.z], 5, 0x5a4530, {
      top: 0x6e5a40,
    });
    canopy(c, p.x, p.gy + h, p.z, c.rr(60, 90), 14, it.c ?? 0x6f8a3a, it.c2 ?? 0xa3b45a, 6, 3);
  }
};

const jati: F = (c, it) => {
  for (let i = 0; i < c.cnt(it, 28); i++) {
    const p = c.pt(it, [440, 620], 'b');
    if (!p) continue;
    const h = c.rr(170, 250);
    c.k.shadow(p.x, p.z, 50, 38);
    c.k.add('cone', 0x7a6a50, p.x, p.gy, p.z, { sx: 8, sy: h * 0.8, sz: 8, top: 0x9b8b6e });
    canopy(c, p.x, p.gy + h * 0.92, p.z, c.rr(46, 60), 26, it.c ?? 0x7c9a3a, it.c2 ?? 0xb4c85a, 5);
  }
};

const eucal: F = (c, it) => {
  for (let i = 0; i < c.cnt(it, 28); i++) {
    const p = c.pt(it, [300, 620], 'b');
    if (!p) continue;
    const h = c.rr(170, 260);
    c.k.shadow(p.x, p.z, 40, 30);
    c.k.add('cone', 0xe3dccb, p.x, p.gy, p.z, {
      sx: 6,
      sy: h * 0.85,
      sz: 6,
      rz: c.rr(-0.1, 0.1),
      top: 0xf4efe0,
      mot: 0.2,
    });
    canopy(c, p.x, p.gy + h * 0.9, p.z, 38, 38, it.c ?? 0x7fa070, it.c2 ?? 0xb8d0a4, 5, 7);
  }
};

/** cengkih/pala: tajuk kerucut padat */
const spice: F = (c, it) => {
  for (let i = 0; i < c.cnt(it, 34); i++) {
    const p = c.pt(it, [320, 600], 'b');
    if (!p) continue;
    const h = c.rr(120, 190);
    c.k.shadow(p.x, p.z, 42, 36);
    c.k.add('cone', 0x5a4128, p.x, p.gy, p.z, { sx: 5, sy: h * 0.4, sz: 5 });
    canopy(c, p.x, p.gy + h * 0.62, p.z, 34, h * 0.46, it.c ?? 0x2a6a38, it.c2 ?? 0x5ea24e, 5);
    for (let b = 0; b < 4; b++)
      c.k.add(
        'dot',
        it.k === 1 ? 0xd6902a : 0xb02a2a,
        p.x + c.rr(-28, 28),
        p.gy + h * c.rr(0.4, 0.8),
        p.z + c.rr(-28, 28),
        { sx: 3, sy: 3, sz: 3, mot: 0, ao: 0 },
      );
  }
};

const mangrove: F = (c, it) => {
  for (let t = c.zr(it)[0]; t < c.zr(it)[1]; t += 0.2) {
    c.k.strip(t, t + 0.21, c.out(430), c.out(625), 2.4, 0x65563f, { jit: 0.2 });
    c.k.strip(t, t + 0.21, c.out(535), c.out(655), 2.7, 0x4b8a78, { layer: 'glass', alpha: 0.6 });
  }
  for (let i = 0; i < c.cnt(it, 26); i++) {
    const p = c.pt({ ...it, s: 'o' }, [520, 720], 'o');
    if (!p) continue;
    const sc = c.rr(0.6, 1);
    const ch = 110 * sc;
    c.k.shadow(p.x, p.z, 80 * sc, 70 * sc, p.gy + 2.2);
    for (let b = 0; b < 8; b++) {
      const a = (b / 8) * 6.28 + c.r() * 0.4;
      const rad = c.rr(46, 78) * sc;
      const top: [number, number, number] = [
        p.x + Math.cos(a) * 10 * sc,
        p.gy + ch * c.rr(0.55, 0.85),
        p.z + Math.sin(a) * 10 * sc,
      ];
      const low: [number, number, number] = [
        p.x + Math.cos(a) * rad,
        p.gy - 4,
        p.z + Math.sin(a) * rad,
      ];
      c.k.limb(top, low, 2.2 * sc, 0x6a4a2e, { top: 0x84603f });
    }
    c.k.add('cone', 0x5b4128, p.x, p.gy, p.z, {
      sx: 8 * sc,
      sy: ch * 0.9,
      sz: 8 * sc,
      top: 0x6f5233,
    });
    canopy(c, p.x, p.gy + ch * 1.05, p.z, 52 * sc, 30 * sc, 0x27632f, 0x5aa24e, 6);
  }
};

const casuarina: F = (c, it) => {
  for (let i = 0; i < c.cnt(it, 30); i++) {
    const p = c.pt(it, [440, 600], 'o');
    if (!p) continue;
    const h = c.rr(190, 290);
    const lean = c.rr(-0.1, 0.1);
    c.k.shadow(p.x, p.z, 44, 30);
    c.k.add('cone', 0x6a4f36, p.x, p.gy, p.z, {
      sx: 6.5,
      sy: h * 0.92,
      sz: 6.5,
      rz: lean,
      top: 0x8a6b4c,
      sway: 1.5,
    });
    for (let w = 0; w < 5; w++) {
      const f = 0.34 + (w / 5) * 0.62;
      const cx = p.x + lean * h * f * 0.5;
      const cy = p.gy + h * f;
      const reach = (1 - f) * 56 + 14;
      for (let b = 0; b < 6; b++) {
        const a = (b / 6) * 6.28 + w * 0.7 + c.r() * 0.3;
        c.k.limb(
          [cx, cy, p.z],
          [cx + Math.cos(a) * reach, cy - 48, p.z + Math.sin(a) * reach],
          1.6,
          0x4f7f48,
          {
            top: 0x9cc58a,
            sway: 8,
            mot: 0.3,
            ao: 0.1,
          },
        );
      }
    }
  }
};

/* ============================ kebun & sawah ============================ */
const rice: F = (c, it) => {
  const pal: [number, number][] = [
    [0x7cb544, 0xb4dd6a],
    [0x8dc24c, 0xc6e27c],
    [0xb7c04d, 0xe3d27a],
    [0xcdb64a, 0xefd685],
  ];
  const [a, b] = c.zr(it);
  const sd = it.s === 'o' ? c.out : c.inn;
  let s = a;
  while (s < b - 0.2) {
    const len = c.rr(0.26, 0.45);
    const vw = c.rr(60, 90);
    const v0 = c.rr(300, 330);
    for (let q = 0; q < 2; q++) {
      const a0 = v0 + q * (vw + 12);
      const [bc, tc] = it.c ? [it.c, it.c2 ?? it.c] : pal[Math.floor(c.r() * pal.length)]!;
      c.k.strip(s, s + len, sd(a0 - 5), sd(a0 + vw + 5), 3.2, 0x7a6a45);
      c.k.strip(s + 0.012, s + len - 0.012, sd(a0), sd(a0 + vw), 3.9, 0x6f8a62, { jit: 0.12 });
      for (let w = 0; w < 4; w++) {
        const cnt = Math.floor(len / 0.03);
        for (let g = 0; g < cnt; g++) {
          if (c.r() < 0.12) continue;
          const q2 = c.k.at(s + 0.02 + (g / cnt) * (len - 0.04), sd(a0 + ((w + 0.5) * vw) / 4));
          c.k.tuft(q2.x, 4, q2.z, bc, tc, c.rr(15, 21), 2);
        }
      }
    }
    s += len + 0.08;
  }
};

/** sawah berundak mengikuti lereng */
const terrace: F = (c, it) => {
  const [a, b] = c.zr(it);
  const sd = it.s === 'o' ? c.out : c.inn;
  const STEPS = 5;
  const DT = 0.05;
  const ph = c.r() * 6;
  // garis kontur bergelombang: tepi depan undakan ke-i pada posisi t
  const edge = (i: number, t: number) =>
    292 +
    i * 52 +
    Math.sin(t * 5.1 + ph + i * 0.7) * 14 +
    Math.sin(t * 11.3 + ph * 2 + i) * 6 +
    (i ? Math.sin(t * 2.3 + i * 1.9) * 8 : 0);
  const bank = 0x56653a;
  const bankTop = 0x6d7d44;
  // undakan atas lebih pendek sehingga membentuk bukit berundak
  const span: [number, number][] = [];
  for (let i = 0; i < STEPS; i++) {
    const p0 = span[i - 1];
    const t0 = (p0 ? p0[0] : a) + (i ? 0.05 + c.rr(0, 0.05) : 0);
    const t1 = (p0 ? p0[1] : b) - (i ? 0.05 + c.rr(0, 0.05) : 0);
    span.push([t0, t1]);
  }
  const has = (i: number, t: number) => {
    const q = span[i];
    return !!q && q[1] - q[0] >= 0.15 && t >= q[0] && t <= q[1];
  };
  for (let i = 0; i < STEPS; i++) {
    const [t0, t1] = span[i]!;
    if (t1 - t0 < 0.15) continue;
    const y = 3 + i * 11;
    const yPrev = i ? y - 11 : 0;
    // petak-petak dipisah pematang miring tak beraturan
    let cell = t0;
    while (cell < t1 - 0.02) {
      const ce = Math.min(t1, cell + c.rr(0.14, 0.3));
      const roll = c.r();
      const kind = roll < 0.3 ? 'water' : roll < 0.85 ? 'green' : 'gold';
      for (let t = cell; t < ce - 1e-4; t += DT) {
        const tb = Math.min(ce, t + DT);
        const tm = (t + tb) / 2;
        const v0 = edge(i, tm);
        const v1 = has(i + 1, tm) || i < STEPS - 1 ? edge(i + 1, tm) : v0 + 58;
        // dinding depan (pematang berumput) dari undakan bawah
        c.k.wallS(t, tb, sd(v0), yPrev, y + 1.6, bank);
        c.k.strip(t, tb, sd(v0), sd(v0 + 5), y + 1.7, bankTop);
        if (kind === 'water') {
          c.k.strip(t, tb, sd(v0 + 4), sd(v1), y + 0.4, 0x3f5a3a);
          c.k.strip(t, tb, sd(v0 + 5), sd(v1 - 1), y + 1.0, 0x5f9fae, {
            layer: 'glass',
            alpha: 0.7,
          });
        } else {
          c.k.strip(t, tb, sd(v0 + 4), sd(v1), y + 0.6, kind === 'gold' ? 0x9a8a3c : 0x4f7a32, {
            jit: 0.08,
          });
        }
        // baris padi mengikuti kontur
        const rows = Math.max(1, Math.floor((v1 - v0 - 8) / 13));
        for (let r = 0; r < rows; r++) {
          for (let g = 0; g < 2; g++) {
            const q = c.k.at(t + DT * (0.25 + g * 0.5), sd(v0 + 10 + r * 13 + c.rr(-2, 2)));
            if (kind === 'water') {
              if (c.r() < 0.45) c.k.tuft(q.x, y + 0.8, q.z, 0x6aa848, 0xa8d870, c.rr(7, 10), 3);
            } else {
              const gold = kind === 'gold';
              c.k.tuft(
                q.x,
                y + 0.6,
                q.z,
                gold ? 0xa89a40 : 0x4f8a34,
                gold ? 0xd8c060 : 0x86bc4c,
                c.rr(13, 17),
                4,
              );
            }
          }
        }
        if (!has(i + 1, tm)) c.k.wallS(t, tb, sd(v1), 0, y + 1.6, bank);
      }
      // pematang melintang antar petak
      const vA = edge(i, ce);
      const vB = i === STEPS - 1 ? vA + 58 : edge(i + 1, ce);
      if (ce < t1 - 0.01) c.k.strip(ce - 0.006, ce + 0.006, sd(vA), sd(vB), y + 1.7, bankTop);
      cell = ce;
    }
    // ujung kiri/kanan undakan
    for (const te of [t0, t1]) {
      const vA = edge(i, te);
      const vB = i === STEPS - 1 ? vA + 58 : edge(i + 1, te);
      c.k.wallV(te, sd(vA), sd(vB), 0, y + 1.6, bank);
    }
  }
  for (let i = 0; i < c.cnt(it, 8); i++) {
    const p = c.pt(it, [560, 620], 'i', 120);
    if (!p) continue;
    c.k.add('hill', 0x3a6a36, p.x, 0, p.z, {
      sx: 150,
      sy: 150,
      sz: 110,
      top: 0x7a9e5c,
      mot: 0.45,
      ao: 0.4,
    });
    slopeForest(c, p.x, p.z, 150, 150, 0.73, 10, false);
  }
};

const tea: F = (c, it) => {
  const [a, b] = c.zr(it);
  const sd = it.s === 'o' ? c.out : c.inn;
  for (let t = a; t < b - 0.1; t += 0.26) {
    c.k.strip(t, t + 0.24, sd(296), sd(500), 3.2, 0x7a5a38, { jit: 0.1 });
    for (let row = 0; row < 6; row++) {
      for (let g = 0; g < 8; g++) {
        const q = c.k.at(t + 0.015 + g * 0.028, sd(310 + row * 32));
        c.k.add('blob', row % 2 ? 0x4f9a3a : 0x5aa642, q.x, 4, q.z, {
          sx: 15,
          sy: 9,
          sz: 13,
          top: 0x9ad06a,
          lump: 0.2,
          ao: 0.3,
          mot: 0.3,
        });
      }
    }
  }
  for (let i = 0; i < c.cnt(it, 6); i++) {
    const p = c.pt(it, [540, 600], it.s ?? 'i');
    if (!p) continue;
    canopy(c, p.x, p.gy + 110, p.z, 40, 10, 0x347f3c, 0x7fbe58, 4, 4);
    c.k.limb([p.x, p.gy, p.z], [p.x, p.gy + 110, p.z], 3.4, 0x6a4b30);
  }
};

const coffee: F = (c, it) => {
  const [a, b] = c.zr(it);
  const sd = it.s === 'o' ? c.out : c.inn;
  for (let t = a; t < b - 0.1; t += 0.28) {
    c.k.strip(t, t + 0.2, sd(294), sd(450), 3.4, 0x6e4528, { jit: 0.1 });
    for (let row = 0; row < 4; row++)
      for (let g = 0; g < 7; g++) {
        const q = c.k.at(t + 0.01 + g * 0.027, sd(310 + row * 32));
        c.k.foliage(q.x, 14, q.z, 16, 13, 14, 0x24552c, 0x4d8a44, { sway: 2, leaf: 0.5 });
        c.k.add('dot', 0xc01f2a, q.x + 6, 20, q.z + 5, { sx: 3, sy: 3, sz: 3, mot: 0, ao: 0 });
      }
    for (let g = 0; g < 2; g++) {
      const q = c.k.at(t + 0.05 + g * 0.09, sd(340 + g * 40));
      c.k.limb([q.x, 3, q.z], [q.x, 124, q.z], 3.6, 0x6a4b30);
      canopy(c, q.x, 126, q.z, 44, 10, 0x347f3c, 0x7fbe58, 4, 5);
    }
  }
};

const corn: F = (c, it) => {
  const [a, b] = c.zr(it);
  const sd = it.s === 'o' ? c.out : c.inn;
  for (let t = a; t < b - 0.1; t += 0.25) {
    c.k.strip(t, t + 0.22, sd(296), sd(430), 3.3, 0x866a40, { jit: 0.1 });
    for (let row = 0; row < 5; row++)
      for (let g = 0; g < 8; g++) {
        const q = c.k.at(t + 0.01 + g * 0.026, sd(306 + row * 26));
        c.k.add('blade', it.c ?? 0x7fb23a, q.x, 3.5, q.z, {
          sx: 5,
          sy: 40,
          sz: 3,
          top: it.c2 ?? 0xb7d85a,
          sway: 6,
          rz: c.rr(-0.1, 0.1),
        });
        c.k.add('dot', 0xf0cf3a, q.x + 3, 22, q.z, { sx: 2.4, sy: 5, sz: 2.4, mot: 0, ao: 0 });
      }
  }
};

/** kebun buah berbaris (jeruk, apel, nanas lewat k) */
const orchard: F = (c, it) => {
  const [a, b] = c.zr(it);
  const sd = it.s === 'o' ? c.out : c.inn;
  const fruit = it.c ?? 0xf08a1e;
  for (let t = a; t < b - 0.1; t += 0.26) {
    c.k.strip(t, t + 0.24, sd(296), sd(470), 3.3, 0x6f5a3a, { jit: 0.1 });
    for (let row = 0; row < 3; row++)
      for (let g = 0; g < 5; g++) {
        const q = c.k.at(t + 0.02 + g * 0.045, sd(320 + row * 56));
        c.k.shadow(q.x, q.z, 22, 18, 4);
        c.k.add('cone', 0x5a4128, q.x, 3, q.z, { sx: 3, sy: 22, sz: 3 });
        canopy(c, q.x, 38, q.z, 24, 16, 0x2f7a3a, 0x6cb454, 3, 2);
        for (let f = 0; f < 4; f++)
          c.k.add('dot', fruit, q.x + c.rr(-20, 20), 32 + c.rr(0, 22), q.z + c.rr(-20, 20), {
            sx: 3.2,
            sy: 3.2,
            sz: 3.2,
            mot: 0,
            ao: 0,
          });
      }
  }
};

const pineapple: F = (c, it) => {
  const [a, b] = c.zr(it);
  const sd = it.s === 'o' ? c.out : c.inn;
  for (let t = a; t < b - 0.1; t += 0.25) {
    c.k.strip(t, t + 0.22, sd(296), sd(440), 3.3, 0x8a5a38, { jit: 0.1 });
    for (let row = 0; row < 5; row++)
      for (let g = 0; g < 8; g++) {
        const q = c.k.at(t + 0.01 + g * 0.026, sd(306 + row * 26));
        for (let l = 0; l < 4; l++)
          c.k.add('blade', 0x4f8f3a, q.x, 3.5, q.z, {
            sx: 4,
            sy: 22,
            sz: 2,
            top: 0x8cc454,
            rx: c.rr(-0.5, 0.5),
            rz: c.rr(-0.5, 0.5),
            sway: 3,
          });
        c.k.add('dot', 0xe8b02a, q.x, 9, q.z, { sx: 4, sy: 5.5, sz: 4, mot: 0.1, ao: 0 });
      }
  }
};

/* ============================ bentang alam ============================ */
const volcano: F = (c, it) => {
  const n = c.cnt(it, 1);
  for (let i = 0; i < n; i++) {
    const w = c.rr(170, 220) * (it.h ?? 1);
    const p = c.pt(it, [610, 660], 'i', w * 0.95);
    if (!p) continue;
    const h = c.rr(230, 300) * (it.h ?? 1);
    c.k.add('mount', it.c ?? 0x3d6235, p.x, 0, p.z, {
      sx: w,
      sy: h,
      sz: w * 0.92,
      ry: c.r() * 3,
      top: it.c2 ?? 0x6b5e50,
      mot: 0.45,
      ao: 0.4,
    });
    c.k.add('cone', 0x4a423c, p.x, h * 0.74, p.z, {
      sx: w * 0.16,
      sy: h * 0.27,
      sz: w * 0.15,
      top: 0x2e2926,
      lump: 0.12,
      mot: 0.5,
    });
    slopeForest(c, p.x, p.z, w, h, 0.92, 22, true, 0x2a5530, 0x5f8f48, 0.55);
    if (it.k === 1) c.k.smoke(p.x, h * 0.98, p.z, w / 190);
  }
};

const hills: F = (c, it) => {
  for (let i = 0; i < c.cnt(it, 6); i++) {
    const h = c.rr(110, 190) * (it.h ?? 1);
    const sx = c.rr(120, 170);
    const p = c.pt(it, [590, 660], 'i', sx * 0.85);
    if (!p) continue;
    c.k.add('hill', it.c ?? 0x3a6a36, p.x, 0, p.z, {
      sx,
      sy: h,
      sz: c.rr(110, 150),
      top: it.c2 ?? 0x6a8a50,
      mot: 0.45,
      ao: 0.4,
    });
    slopeForest(c, p.x, p.z, sx, h, 0.85, 12, false, 0x2c5a2e, 0x6a9a4c, 0.8);
  }
};

/** gunung batu salju */
const peak: F = (c, it) => {
  for (let i = 0; i < c.cnt(it, 3); i++) {
    const w = c.rr(150, 210);
    const p = c.pt(it, [600, 680], 'i', w * 0.95);
    if (!p) continue;
    const h = c.rr(300, 420) * (it.h ?? 1);
    c.k.add('mount', it.c ?? 0x5f5b56, p.x, 0, p.z, {
      sx: w,
      sy: h,
      sz: w * 0.8,
      ry: c.r() * 3,
      top: it.c2 ?? 0xf4f6fa,
      lump: 0.2,
      ao: 0.4,
    });
    c.k.add('hill', 0x3f5a35, p.x, 0, p.z, {
      sx: w * 1.1,
      sy: h * 0.35,
      sz: w * 0.9,
      top: 0x7a8a60,
      lump: 0.1,
    });
  }
};

const karst: F = (c, it) => {
  const mush = it.k === 1;
  for (let i = 0; i < c.cnt(it, 10); i++) {
    const p = c.pt(it, mush ? [640, 860] : [450, 640], mush ? 'o' : 'i', 70);
    if (!p) continue;
    const h = c.rr(120, 260) * (it.h ?? 1);
    const w = c.rr(30, 52);
    if (mush) {
      c.k.pond(p.t, p.v, (w * 2.2) / 384, w * 2.2, p.gy + 1.4, 0xf2fbff, {
        layer: 'glass',
        alpha: 0.4,
      });
      c.k.add('cyl', 0x8a8470, p.x, p.gy - 7, p.z, {
        sx: w * 0.5,
        sy: h * 0.5,
        sz: w * 0.5,
        ao: 0.4,
      });
      c.k.add('blob', 0xa89f88, p.x, p.gy - 7 + h * 0.5, p.z, {
        sx: w * 1.5,
        sy: h * 0.22,
        sz: w * 1.5,
        top: 0xcfc6ac,
        lump: 0.2,
      });
      canopy(
        c,
        p.x,
        p.gy - 7 + h * 0.62,
        p.z,
        w * 1.2,
        12,
        it.c ?? 0x3f7a3a,
        it.c2 ?? 0x78a84e,
        3,
        2,
      );
    } else {
      c.k.add('blob', 0x9a9484, p.x, p.gy - 2, p.z, {
        sx: w,
        sy: h,
        sz: w * 0.85,
        ry: c.r() * 3,
        top: 0xcfc8b4,
        lump: 0.22,
        ao: 0.4,
      });
      canopy(c, p.x, p.gy + h * 0.92, p.z, w * 0.7, 18, it.c ?? 0x3f7a3a, it.c2 ?? 0x78a84e, 3, 2);
      for (let q = 0; q < 3; q++)
        c.k.tuft(p.x + c.rr(-w, w), p.gy, p.z + c.rr(-w, w), 0x3d7a38, 0x7bb85a, 26, 3);
    }
  }
};

const granite: F = (c, it) => {
  for (let i = 0; i < c.cnt(it, 8); i++) {
    const p = c.pt(it, [560, 760], 'o', 85);
    if (!p) continue;
    c.k.pond(p.t, p.v, 0.2, 80, p.gy + 1.4, 0x6fd0cf, { layer: 'glass', alpha: 0.4 });
    for (let q = 0; q < 4; q++) {
      const a = c.r() * 6.28;
      const d = c.rr(0, 46);
      const s = c.rr(30, 64) * (it.h ?? 1);
      c.k.add('blob', it.c ?? 0xbdb6a8, p.x + Math.cos(a) * d, p.gy - 4, p.z + Math.sin(a) * d, {
        sx: s,
        sy: s * 0.8,
        sz: s * 0.9,
        ry: c.r() * 3,
        top: it.c2 ?? 0xdcd6c8,
        lump: 0.24,
        mot: 0.5,
        jit: 0.2,
        ao: 0.4,
      });
    }
  }
};

const seastack: F = (c, it) => {
  for (let i = 0; i < c.cnt(it, 8); i++) {
    const p = c.pt(it, [640, 820], 'o', 75);
    if (!p) continue;
    const h = c.rr(80, 200) * (it.h ?? 1);
    const w = c.rr(36, 64);
    c.k.pond(p.t, p.v, (w * 2.1) / 384, w * 2.1, p.gy + 1.5, 0xffffff, {
      layer: 'glass',
      alpha: 0.45,
    });
    for (let l = 0; l < 3; l++) {
      const f = l / 3;
      c.k.add(
        'dot',
        l < 1 ? 0x4a4640 : 0x6e695f,
        p.x + c.rr(-8, 8),
        p.gy - 7 + h * f * 0.8,
        p.z + c.rr(-8, 8),
        {
          sx: w * (1 - f * 0.45),
          sy: h * 0.36,
          sz: w * (0.9 - f * 0.4),
          ry: c.r() * 6,
          top: 0x8f887a,
          lump: 0.1,
          mot: 0.6,
          ao: 0.35,
        },
      );
    }
    c.k.foliage(p.x, p.gy - 4 + h * 0.88, p.z, w * 0.55, 12, 16, 0x2f5a30, 0x6a9a48, {
      sway: 2,
      flat: 0.6,
    });
  }
};

const cliff: F = (c, it) => {
  for (let i = 0; i < c.cnt(it, 2); i++) {
    const p = c.pt(it, [560, 640], 'o', 190);
    if (!p) continue;
    const H = 135;
    // tebing/ngarai: dinding batu beralur dengan puncak berhutan
    c.k.add('hill', it.c ?? 0x7a6a52, p.x, p.gy - 6, p.z, {
      sx: 210,
      sy: H,
      sz: 95,
      ry: p.ry,
      top: 0x5a6e42,
      mot: 0.5,
      ao: 0.5,
    });
    for (let q = 0; q < 6; q++) {
      const ox = c.rr(-0.55, 0.55);
      const oz = c.rr(-0.3, 0.3);
      const r = Math.hypot(ox, oz);
      // tinggi permukaan bukit pada jarak r (profil 'hill')
      let hf = 0;
      while (hf < 1 && Math.pow(1 - hf, 0.72) * (1 - 0.12 * hf) > r) hf += 0.02;
      const [fx, fz] = off(p.x, p.z, p.ry, ox * 210, oz * 95);
      c.k.foliage(fx, p.gy - 6 + H * hf + 8, fz, c.rr(26, 38), 14, 16, 0x2f5a30, 0x6a9248, {
        sway: 1,
        flat: 0.6,
      });
    }
  }
};

const lake: F = (c, it) => {
  const [a, b] = c.zr(it);
  const t = (a + b) / 2;
  const sd = it.s === 'o' ? c.out : c.inn;
  const rs = Math.min(0.9, (b - a) * 0.45) * (it.h ?? 1);
  const rv = c.rr(150, 190) * (it.h ?? 1);
  const col = it.c ?? 0x3d92c4;
  c.k.pond(t, sd(470), rs * 1.05, rv * 1.05, 2.8, 0xa6cfc6);
  c.k.pond(t, sd(470), rs, rv, 3.3, col);
  c.k.pond(t, sd(470), rs * 0.55, rv * 0.55, 3.7, it.c2 ?? 0x2f78a8);
  for (let q = 0; q < 24; q++) {
    const ang = (q / 24) * 6.28;
    const e = c.k.at(t + Math.cos(ang) * rs * 0.98, sd(470 + Math.sin(ang) * rv * 0.98));
    c.k.tuft(e.x, 2.5, e.z, 0x6b8f3f, 0xb9c872, c.rr(24, 36), 3);
  }
  if (it.k === 1) {
    // pulau di tengah (Samosir)
    const q = c.k.at(t, sd(470));
    c.k.add('hill', 0x3f6a38, q.x, 3, q.z, {
      sx: rs * 384 * 0.4,
      sy: 70,
      sz: rv * 0.4,
      top: 0x7a9e5c,
      mot: 0.45,
    });
    canopy(c, q.x, 72, q.z, rs * 384 * 0.28, 16, 0x2f7a3a, 0x68b055, 4, 3);
  }
};

const trilake: F = (c, it) => {
  const [a, b] = c.zr(it);
  const t = (a + b) / 2;
  const sd = it.s === 'o' ? c.out : c.inn;
  const q = c.k.at(t, sd(470));
  c.k.add('mount', 0x5a6a48, q.x, 0, q.z, {
    sx: 220,
    sy: 160,
    sz: 200,
    top: 0x9a8f7c,
    mot: 0.45,
    ao: 0.4,
  });
  const cols = [0x2fd0c0, 0x7a2a22, 0x1c3a30];
  cols.forEach((col, i) => {
    const e = c.k.at(t + (i - 1) * 0.2, sd(470 + (i % 2) * 30));
    c.k.pond(t + (i - 1) * 0.2, sd(470 + (i % 2) * 30), 0.1, 56, 148, col);
    c.k.add('blob', 0x9a8f78, e.x, 138, e.z, { sx: 8, sy: 6, sz: 8, lump: 0.3 });
  });
};

const river: F = (c, it) => {
  const [a, b] = c.zr(it);
  const sd = it.s === 'o' ? c.out : c.inn;
  const col = it.c ?? 0x8a6f4a;
  const w = (it.h ?? 1) * 70;
  const vc = (t: number) => 360 + 40 * Math.sin(t * 5.5);
  for (let t = a; t < b; t += 0.1) {
    c.k.strip(t, t + 0.11, sd(vc(t) - w), sd(vc(t) + w), 3.0, col);
    c.k.strip(t, t + 0.11, sd(vc(t) - w * 1.18), sd(vc(t) - w), 2.8, 0x6a8a46);
    c.k.strip(t, t + 0.11, sd(vc(t) + w), sd(vc(t) + w * 1.18), 2.8, 0x6a8a46);
  }
  for (let t = a + 0.2; t < b - 0.1; t += 0.45) {
    const q = c.k.at(t, sd(vc(t) + c.rr(-20, 20)));
    const ry = c.k.heading(t);
    c.k.add('blobHi', it.c2 ?? 0x7a4a2a, q.x, 6, q.z, { sx: 38, sy: 8, sz: 11, ry, top: 0xd9b27a });
    c.k.add('blob', 0xe9dcc0, q.x, 14, q.z, { sx: 18, sy: 8, sz: 10, ry, ao: 0 });
  }
};

const swamp: F = (c, it) => {
  for (let i = 0; i < c.cnt(it, 6); i++) {
    const p = c.pt(it, [320, 520], 'i');
    if (!p) continue;
    c.k.pond(p.t, p.v, c.rr(0.15, 0.3), c.rr(60, 100), 2.8, 0x4a6a4a);
    for (let q = 0; q < 8; q++) {
      const a = c.r() * 6.28;
      const d = c.rr(10, 90);
      c.k.tuft(
        p.x + Math.cos(a) * d,
        3,
        p.z + Math.sin(a) * d,
        0x6b8f3f,
        0xb9c872,
        c.rr(28, 40),
        4,
      );
    }
    const h = c.rr(80, 140);
    c.k.limb([p.x, 3, p.z], [p.x + 10, 3 + h, p.z], 2.4, 0x5a5648, { top: 0x7a7664 });
    c.k.limb([p.x + 6, 3 + h * 0.6, p.z], [p.x + 30, 3 + h * 0.9, p.z + 12], 1.5, 0x5a5648);
  }
};

const minepit: F = (c, it) => {
  for (let i = 0; i < c.cnt(it, 1); i++) {
    const p = c.pt(it, [430, 480], 'i', 125);
    if (!p) continue;
    const cols = [it.c ?? 0xb08a58, 0x9a7448, 0x866238, 0x6a4a2a, it.c2 ?? 0x2a7f95];
    cols.forEach((col, q) => c.k.pond(p.t, p.v, 0.3 - q * 0.045, 120 - q * 18, 2.4 + q * 0.5, col));
    for (let q = 0; q < 5; q++) {
      const a = (q / 5) * 6.28;
      c.k.add('hemi', 0x7a6a50, p.x + Math.cos(a) * 150, 1, p.z + Math.sin(a) * 120, {
        sx: 40,
        sy: 36,
        sz: 40,
        top: 0xa89878,
        lump: 0.2,
      });
    }
  }
};

const megalith: F = (c, it) => {
  for (let i = 0; i < c.cnt(it, 2); i++) {
    const p = c.pt(it, [320, 480], 'i', 45);
    if (!p) continue;
    for (let q = 0; q < 6; q++) {
      const a = c.r() * 6.28;
      const d = c.rr(0, 50);
      const h = c.rr(30, 64);
      c.k.add('blob', 0x8a8780, p.x + Math.cos(a) * d, 0, p.z + Math.sin(a) * d, {
        sx: 14,
        sy: h,
        sz: 11,
        ry: c.r() * 3,
        top: 0xa8a59c,
        lump: 0.2,
        rz: c.rr(-0.15, 0.15),
      });
    }
  }
};

const rafflesia: F = (c, it) => {
  for (let i = 0; i < c.cnt(it, 5); i++) {
    const p = c.pt(it, [300, 480], 'i');
    if (!p) continue;
    const s = c.rr(0.9, 1.4);
    for (let q = 0; q < 5; q++) {
      const a = (q / 5) * 6.28;
      c.k.add('blob', 0xb3221f, p.x + Math.cos(a) * 20 * s, 5, p.z + Math.sin(a) * 20 * s, {
        sx: 22 * s,
        sy: 6 * s,
        sz: 18 * s,
        ry: -a,
        top: 0xd24a3a,
        lump: 0.1,
      });
      c.k.add('dot', 0xf1d9b8, p.x + Math.cos(a) * 26 * s, 9 * s, p.z + Math.sin(a) * 26 * s, {
        sx: 2.6,
        sy: 2,
        sz: 2.6,
        mot: 0,
        ao: 0,
      });
    }
    c.k.add('hemi', 0x6a1a18, p.x, 4, p.z, { sx: 12 * s, sy: 10 * s, sz: 12 * s, top: 0x9a3a2a });
  }
};

/* ============================ satwa ============================ */
const elephant: F = (c, it) => {
  for (let i = 0; i < c.cnt(it, 3); i++) {
    const p = c.pt(it, [310, 480], 'i');
    if (!p) continue;
    const ry = c.r() * 6.28;
    const g = 0x8a8a92;
    const o = (dx: number, dz: number) => off(p.x, p.z, ry, dx, dz);
    c.k.shadow(p.x, p.z, 50, 28, 3.4);
    c.k.add('blob', g, p.x, 44, p.z, { sx: 40, sy: 28, sz: 24, ry, top: 0xa5a5ad, lump: 0.05 });
    const [hx, hz] = o(38, 0);
    c.k.add('blob', g, hx, 52, hz, { sx: 18, sy: 18, sz: 16, ry, top: 0xa5a5ad });
    const [t0x, t0z] = o(52, 0);
    const [t1x, t1z] = o(66, 0);
    c.k.limb([t0x, 56, t0z], [t1x, 22, t1z], 4.4, g);
    const [e1x, e1z] = o(34, 14);
    const [e2x, e2z] = o(34, -14);
    c.k.add('blob', 0x9a9aa2, e1x, 56, e1z, { sx: 3, sy: 14, sz: 12, ry });
    c.k.add('blob', 0x9a9aa2, e2x, 56, e2z, { sx: 3, sy: 14, sz: 12, ry });
    for (const [dx, dz] of [
      [20, 12],
      [20, -12],
      [-20, 12],
      [-20, -12],
    ] as const) {
      const [lx, lz] = o(dx, dz);
      c.k.limb([lx, 36, lz], [lx, 3, lz], 6, g);
    }
    const [tx0, tz0] = o(48, 6);
    const [tx1, tz1] = o(58, 7);
    c.k.limb([tx0, 40, tz0], [tx1, 30, tz1], 1.3, 0xf2ecd8);
  }
};

const komodo: F = (c, it) => {
  for (let i = 0; i < c.cnt(it, 4); i++) {
    const p = c.pt(it, [300, 520], 'i');
    if (!p) continue;
    const ry = c.r() * 6.28;
    const o = (dx: number, dz: number) => off(p.x, p.z, ry, dx, dz);
    const col = 0x6b6a48;
    c.k.shadow(p.x, p.z, 38, 14, 3.4);
    c.k.add('blob', col, p.x, 12, p.z, { sx: 26, sy: 8, sz: 9, ry, top: 0x8a8962 });
    const [hx, hz] = o(28, 0);
    c.k.add('blob', col, hx, 11, hz, { sx: 9, sy: 5, sz: 5, ry });
    const [tx, tz] = o(-40, 0);
    c.k.add('cone', col, tx, 4, tz, { sx: 4, sy: 40, sz: 4, rz: Math.PI / 2, ry });
    for (const [dx, dz] of [
      [12, 9],
      [12, -9],
      [-12, 9],
      [-12, -9],
    ] as const) {
      const [lx, lz] = o(dx, dz);
      c.k.limb([lx, 8, lz], [lx + 3, 2, lz + dz * 0.4], 1.8, col);
    }
  }
};

const horse: F = (c, it) => {
  for (let i = 0; i < c.cnt(it, 4); i++) {
    const p = c.pt(it, [300, 520], 'i');
    if (!p) continue;
    const ry = c.r() * 6.28;
    const o = (dx: number, dz: number) => off(p.x, p.z, ry, dx, dz);
    const col = [0x6a4a30, 0x3a2a20, 0xc9a070, 0xe8e0d0][Math.floor(c.r() * 4)]!;
    c.k.shadow(p.x, p.z, 34, 14, 3.4);
    c.k.add('blob', col, p.x, 34, p.z, { sx: 22, sy: 12, sz: 9, ry, top: col });
    const [nx, nz] = o(18, 0);
    c.k.limb(
      [nx, 36, nz],
      [...o(26, 0).slice(0, 1), 56, o(26, 0)[1]] as [number, number, number],
      3.4,
      col,
    );
    const [hx, hz] = o(30, 0);
    c.k.add('blob', col, hx, 56, hz, { sx: 9, sy: 5, sz: 4, ry });
    for (const [dx, dz] of [
      [14, 5],
      [14, -5],
      [-14, 5],
      [-14, -5],
    ] as const) {
      const [lx, lz] = o(dx, dz);
      c.k.limb([lx, 26, lz], [lx, 3, lz], 1.8, col);
    }
    const [tx, tz] = o(-24, 0);
    c.k.limb([tx, 36, tz], [tx - 3, 14, tz], 1.6, 0x2a2018, { sway: 3 });
  }
};

const cow: F = (c, it) => {
  for (let i = 0; i < c.cnt(it, 5); i++) {
    const p = c.pt(it, [300, 520], 'i');
    if (!p) continue;
    const ry = c.r() * 6.28;
    const o = (dx: number, dz: number) => off(p.x, p.z, ry, dx, dz);
    const col = [0xc9a070, 0xe8e0d0, 0x6a4a30][Math.floor(c.r() * 3)]!;
    c.k.shadow(p.x, p.z, 30, 14, 3.4);
    c.k.add('blob', col, p.x, 28, p.z, { sx: 20, sy: 12, sz: 10, ry, top: col });
    const [hx, hz] = o(22, 0);
    c.k.add('blob', col, hx, 32, hz, { sx: 8, sy: 7, sz: 6, ry });
    for (const [dx, dz] of [
      [12, 5],
      [12, -5],
      [-12, 5],
      [-12, -5],
    ] as const) {
      const [lx, lz] = o(dx, dz);
      c.k.limb([lx, 22, lz], [lx, 3, lz], 2, col);
    }
  }
};

const orangutan: F = (c, it) => {
  for (let i = 0; i < c.cnt(it, 3); i++) {
    const p = c.pt(it, [450, 620], 'i');
    if (!p) continue;
    const h = c.rr(120, 160);
    c.k.add('cone', 0x6a4b30, p.x, p.gy, p.z, { sx: 10, sy: h, sz: 10, top: 0x7d5c3d });
    canopy(c, p.x, p.gy + h, p.z, 56, 30, 0x2a6a33, 0x6aae56, 5);
    c.k.add('blob', 0xc8581e, p.x + 18, p.gy + h - 20, p.z + 14, {
      sx: 9,
      sy: 12,
      sz: 8,
      top: 0xe07a30,
    });
    c.k.add('dot', 0xd8885a, p.x + 18, p.gy + h - 6, p.z + 14, { sx: 4.4, sy: 4.4, sz: 4.4 });
    c.k.limb([p.x + 18, p.gy + h - 12, p.z + 14], [p.x + 8, p.gy + h + 18, p.z + 8], 1.6, 0xc8581e);
  }
};

const turtle: F = (c, it) => {
  for (let i = 0; i < c.cnt(it, 4); i++) {
    const p = c.pt(it, [560, 640], 'o');
    if (!p) continue;
    const ry = c.r() * 6.28;
    const o = (dx: number, dz: number) => off(p.x, p.z, ry, dx, dz);
    c.k.add('hemi', 0x5a7a3a, p.x, p.gy, p.z, {
      sx: 15,
      sy: 8,
      sz: 12,
      ry,
      top: 0x8aa04a,
      lump: 0.1,
    });
    const [hx, hz] = o(16, 0);
    c.k.add('dot', 0x7a8a4a, hx, p.gy + 4, hz, { sx: 5, sy: 4, sz: 4 });
    for (const [dx, dz] of [
      [6, 12],
      [6, -12],
      [-8, 10],
      [-8, -10],
    ] as const) {
      const [lx, lz] = o(dx, dz);
      c.k.add('blob', 0x7a8a4a, lx, p.gy + 1, lz, { sx: 8, sy: 2, sz: 4, ry });
    }
  }
};

const honai: F = (c, it) => {
  for (let i = 0; i < c.cnt(it, 6); i++) {
    const p = c.pt(it, [300, 480], 'i');
    if (!p) continue;
    c.k.shadow(p.x, p.z, 36, 36, 3.4);
    c.k.add('cyl', 0x8a6a40, p.x, 3, p.z, { sx: 20, sy: 26, sz: 20, mot: 0.3 });
    c.k.add('cone', 0xc9a95f, p.x, 26, p.z, {
      sx: 28,
      sy: 36,
      sz: 28,
      top: 0xe3cc86,
      lump: 0.06,
      mot: 0.3,
    });
  }
};

const termite: F = (c, it) => {
  for (let i = 0; i < c.cnt(it, 12); i++) {
    const p = c.pt(it, [300, 560], 'b');
    if (!p) continue;
    const h = c.rr(40, 110);
    const parts = 2 + Math.floor(c.r() * 3);
    for (let q = 0; q < parts; q++) {
      const s = q === 0 ? 1 : c.rr(0.45, 0.75);
      const ox = q ? c.rr(-10, 10) : 0;
      const oz = q ? c.rr(-10, 10) : 0;
      c.k.limb(
        [p.x + ox, p.gy - 2, p.z + oz],
        [p.x + ox * 1.4, p.gy + h * s, p.z + oz * 1.4],
        c.rr(7, 12) * s,
        0x7a5a3e,
        {
          top: 0x9a7a58,
          lump: 0.35,
          mot: 0.55,
          jit: 0.2,
        },
      );
      c.k.add('dot', 0x8a6a4a, p.x + ox * 1.4, p.gy + h * s, p.z + oz * 1.4, {
        sx: c.rr(5, 8) * s,
        sy: 6 * s,
        sz: c.rr(5, 8) * s,
        lump: 0.3,
        mot: 0.5,
      });
    }
  }
};

const pinisi: F = (c, it) => {
  for (let i = 0; i < c.cnt(it, 3); i++) {
    const p = c.pt(it, [600, 680], 'o');
    if (!p) continue;
    c.k.shadow(p.x, p.z, 100, 36, p.gy + 1.6);
    c.k.add('blobHi', 0x6a4527, p.x, p.gy + 12, p.z, {
      sx: 96,
      sy: 22,
      sz: 24,
      ry: p.ry,
      top: 0xa9743c,
    });
    for (const dx of [-26, 20]) {
      const [mx, mz] = off(p.x, p.z, p.ry, dx, 0);
      c.k.limb([mx, p.gy + 20, mz], [mx, p.gy + 140, mz], 2.4, 0x5a4128);
      c.k.add('blade', 0xf3ecd8, mx, p.gy + 40, mz, {
        sx: 32,
        sy: 90,
        sz: 2.4,
        ry: p.ry,
        mot: 0.1,
        ao: 0,
        sway: 3,
      });
    }
  }
};

const beach: F = (c, it) => {
  const [a, b] = c.zr(it);
  for (let t = a; t < b; t += 0.2)
    c.k.strip(t, Math.min(b, t + 0.21), c.out(500), c.out(640), 2.6, it.c ?? 0xf1e3b8, {
      jit: 0.05,
    });
};

const reef: F = (c, it) => {
  const cols = [0xe0607f, 0xf0903a, 0x9d54c4, 0xe9c63a, 0x3fb7b4, 0xf2f0e6];
  for (let i = 0; i < c.cnt(it, 28); i++) {
    const p = c.pt(it, [585, 705], 'o');
    if (!p) continue;
    const col = cols[Math.floor(c.r() * cols.length)]!;
    if (c.r() < 0.5) {
      for (let b = 0; b < 5; b++) {
        const a = c.r() * 6.28;
        const d = c.rr(0, 18);
        c.k.add('blade', col, p.x + Math.cos(a) * d, p.gy - 2, p.z + Math.sin(a) * d, {
          sx: 4,
          sy: c.rr(18, 36),
          sz: 3,
          rx: c.rr(-0.5, 0.5),
          rz: c.rr(-0.5, 0.5),
          top: 0xfff2dc,
          ao: 0.4,
        });
      }
    } else
      c.k.add('hemi', col, p.x, p.gy - 3, p.z, {
        sx: c.rr(14, 22),
        sy: c.rr(9, 14),
        sz: c.rr(14, 22),
        lump: 0.14,
        top: 0xffe7c4,
        ao: 0.4,
      });
  }
};

const boat: F = (c, it) => {
  for (let i = 0; i < c.cnt(it, 3); i++) {
    const p = c.pt(it, [600, 650], 'o');
    if (!p) continue;
    const hullC = [0x2d6fb5, 0xc8402f, 0xf1efe8, 0x2f8f66][i % 4]!;
    c.k.shadow(p.x, p.z, 118, 42);
    c.k.add('blobHi', hullC, p.x, p.gy + 10, p.z, {
      sx: 104,
      sy: 22,
      sz: 27,
      ry: p.ry,
      top: 0xf6efe0,
      ao: 0.3,
    });
    c.k.limb([p.x, p.gy + 20, p.z], [p.x, p.gy + 118, p.z], 2.6, 0x6b4f35, { sway: 1 });
    c.k.add('blade', 0xeadfbf, p.x, p.gy + 40, p.z, {
      sx: 34,
      sy: 74,
      sz: 2.4,
      ry: p.ry,
      mot: 0.1,
      ao: 0,
      sway: 3,
    });
  }
};

const hotspring: F = (c, it) => {
  for (let i = 0; i < c.cnt(it, 2); i++) {
    const p = c.pt(it, [320, 480], 'i');
    if (!p) continue;
    c.k.pond(p.t, p.v, 0.1, 50, 2.8, 0xd8e8e0);
    c.k.pond(p.t, p.v, 0.08, 40, 3.3, 0x6ec2d4);
    for (let q = 0; q < 4; q++)
      c.k.add('blob', 0xffffff, p.x + c.rr(-12, 12), 30 + q * 22, p.z + c.rr(-8, 8), {
        sx: 20 + q * 6,
        sy: 12,
        sz: 20 + q * 6,
        layer: 'glass',
        alpha: 0.28,
        lump: 0.3,
        mot: 0,
        ao: 0,
      });
  }
};

const mist: F = (c, it) => {
  for (let i = 0; i < c.cnt(it, 6); i++) {
    const p = c.pt(it, [430, 600], 'i');
    if (!p) continue;
    c.k.mist(p.x, c.rr(90, 140), p.z, c.rr(130, 200), c.rr(45, 70), p.ry);
  }
};

const butterflies: F = (c, it) => {
  const cols = [0xf0903a, 0x5aa0e8, 0xf2d84a, 0xe8609a];
  for (let i = 0; i < c.cnt(it, 30); i++) {
    const p = c.pt(it, [300, 540], 'i');
    if (!p) continue;
    const col = cols[Math.floor(c.r() * cols.length)]!;
    const y = p.gy + c.rr(14, 60);
    c.k.add('blade', col, p.x - 3, y, p.z, {
      sx: 5,
      sy: 8,
      sz: 1,
      rz: 0.7,
      sway: 6,
      mot: 0,
      ao: 0,
    });
    c.k.add('blade', col, p.x + 3, y, p.z, {
      sx: 5,
      sy: 8,
      sz: 1,
      rz: -0.7,
      sway: 6,
      mot: 0,
      ao: 0,
    });
  }
};

export const FEATURES: Record<string, F> = {
  ground,
  grass,
  flowers,
  rocks,
  pine,
  cypress,
  rain,
  coco,
  sawit,
  lontar,
  banana,
  bamboo,
  acacia,
  jati,
  eucal,
  spice,
  mangrove,
  casuarina,
  rice,
  terrace,
  tea,
  coffee,
  corn,
  orchard,
  pineapple,
  volcano,
  hills,
  peak,
  karst,
  granite,
  seastack,
  cliff,
  lake,
  trilake,
  river,
  swamp,
  minepit,
  megalith,
  rafflesia,
  elephant,
  komodo,
  horse,
  cow,
  orangutan,
  turtle,
  honai,
  termite,
  pinisi,
  beach,
  reef,
  boat,
  hotspring,
  mist,
  butterflies,
};

export type { NatureKit };
