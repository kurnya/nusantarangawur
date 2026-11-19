/**
 * Alam khas Aceh di sepanjang jalur petak 1..6:
 *  - Banda Aceh dan Sabang: pantai berkarang, batu karang Pulau Weh, cemara laut, hutan hujan Leuser
 *  - Lhokseumawe: sawah tergenang dengan rumpun padi, pinang, gubuk pematang
 *  - Langsa: hutan mangrove berakar tunjang dan nipah di lumpur pasang
 *  - Takengon: dataran tinggi Gayo dengan pinus, kebun kopi berpohon penaung, Danau Laut Tawar
 */
import { NatureKit, groundY, zone } from './kit';

export const ACEH_RANGE: [number, number] = [0.55, 6.6];

type Side = 'o' | 'i';

export function buildAceh(k: NatureKit, density: number, outer: 1 | -1): void {
  const r = k.rnd;
  const rr = (a: number, b: number) => a + r() * (b - a);
  const n = (x: number) => Math.max(1, Math.round(x * density));
  const [T0, T1] = ACEH_RANGE;
  const out = (v: number) => v * outer;
  const inn = (v: number) => -v * outer;
  const place = (t: number, v: number) => k.at(t, v);
  /** titik acak dalam zona [a,b] (petak) dan rentang menyamping minV..maxV di sisi o/i */
  const pick = (a: number, b: number, fade: number, minV: number, maxV: number, side: Side) => {
    for (let i = 0; i < 40; i++) {
      const t = rr(T0, T1);
      if (r() > zone(t, a, b, fade)) continue;
      const vv = rr(minV, maxV);
      return { t, v: side === 'o' ? out(vv) : inn(vv), vv };
    }
    return null;
  };
  const pickOf = (c: number) => (c < 0.5 ? 0 : 1);
  /** tajuk dari banyak gugus daun kecil bergelombang (bukan satu bola halus) */
  const canopy = (
    x: number,
    y: number,
    z: number,
    rx: number,
    ry: number,
    base: number,
    top: number,
    clusters: number,
    sway = 4,
  ) => {
    k.crown(x, y, z, rx, Math.max(ry, rx * 0.45), base, top, clusters * 0.7, { sway });
  };

  /* ======================= tanah: rumput, batu kecil, bunga ======================= */
  const grassG = [0x4f8f3a, 0x5d9b40, 0x477f35, 0x6aa046];
  const grassD = [0xa8a45a, 0x93914d];
  for (let i = 0; i < n(300); i++) {
    const side: Side = r() < 0.5 ? 'o' : 'i';
    const t = rr(T0, T1);
    const vv = rr(272, 540);
    const v = side === 'o' ? out(vv) : inn(vv);
    const { x, z } = place(t, v);
    const dry = r() < 0.16;
    const pal = dry ? grassD : grassG;
    k.tuft(
      x,
      groundY(v),
      z,
      pal[Math.floor(r() * pal.length)]!,
      dry ? 0xd2c27a : 0x9acb62,
      rr(14, 26),
      4,
    );
  }
  for (let i = 0; i < n(70); i++) {
    const t = rr(T0, T1);
    const v = r() < 0.5 ? out(rr(280, 560)) : inn(rr(280, 560));
    const { x, z } = place(t, v);
    const s = rr(5, 14);
    k.add('dot', r() < 0.5 ? 0x6f6c66 : 0x5f5c56, x, groundY(v) - 1, z, {
      sx: s * 1.2,
      sy: s * 0.6,
      sz: s * rr(0.8, 1.2),
      rx: rr(-0.2, 0.2),
      ry: r() * 3,
      top: 0x86847c,
      lump: 0.12,
      mot: 0.6,
      ao: 0.55,
    });
  }
  const flowerC = [0xf7d84a, 0xffffff, 0xe86a92, 0xf29a3a];
  for (let i = 0; i < n(40); i++) {
    const t = rr(T0, T1);
    const v = r() < 0.5 ? out(rr(280, 540)) : inn(rr(280, 540));
    const { x, z } = place(t, v);
    const c = flowerC[Math.floor(r() * flowerC.length)]!;
    for (let q = 0; q < 2; q++)
      k.add('dot', c, x + rr(-8, 8), groundY(v) + 6, z + rr(-8, 8), {
        sx: 2.4,
        sy: 2.4,
        sz: 2.4,
        mot: 0,
        ao: 0,
        sway: 2,
      });
  }

  /* ======================= Weh dan Banda Aceh (0.5 - 3) ======================= */
  // batu karang pulau Weh: berlapis, bertebing, berlumut di atas
  for (let i = 0; i < n(12); i++) {
    const p = pick(0.5, 2.9, 0.4, 640, 820, 'o');
    if (!p) continue;
    const { x, z } = place(p.t, p.v);
    const gy = groundY(p.v);
    const h = rr(80, 200);
    const w = rr(36, 66);
    k.pond(p.t, p.v, (w * 2.1) / 384, w * 2.1, gy + 1.4, 0xf2fbff, { layer: 'glass', alpha: 0.45 });
    k.pond(p.t, p.v, (w * 1.4) / 384, w * 1.4, gy + 1.6, 0xffffff, { layer: 'glass', alpha: 0.5 });
    for (let l = 0; l < 4; l++) {
      const f = l / 4;
      k.add(
        'dot',
        l < 1 ? 0x4a4640 : 0x6e695f,
        x + rr(-8, 8),
        gy - 7 + h * f * 0.78,
        z + rr(-8, 8),
        {
          sx: w * (1 - f * 0.45),
          sy: h * 0.32,
          sz: w * (0.9 - f * 0.4),
          ry: r() * 6,
          top: l === 3 ? 0x8f887a : 0x7d776b,
          lump: 0.1,
          mot: 0.6,
          ao: 0.35,
        },
      );
    }
    k.foliage(x, gy - 4 + h * 0.88, z, w * 0.55, 13, 16, 0x2f5a30, 0x6a9a48, {
      sway: 2,
      flat: 0.6,
    });
    for (let q = 0; q < 3; q++) {
      const a = r() * 6.28;
      const s = rr(8, 18);
      k.add('blob', 0x6f695c, x + Math.cos(a) * w * 1.1, gy - 4, z + Math.sin(a) * w * 1.1, {
        sx: s,
        sy: s * 0.7,
        sz: s,
        lump: 0.2,
        top: 0x9a9380,
      });
    }
  }
  // terumbu karang di cekungan pantai
  const coralCols = [0xe0607f, 0xf0903a, 0x9d54c4, 0xe9c63a, 0x3fb7b4, 0xf2f0e6];
  for (let i = 0; i < n(36); i++) {
    const p = pick(0.5, 2.9, 0.4, 585, 705, 'o');
    if (!p) continue;
    const { x, z } = place(p.t, p.v);
    const gy = groundY(p.v);
    const col = coralCols[Math.floor(r() * coralCols.length)]!;
    const type = pickOf(r());
    if (type === 0) {
      // karang tanduk bercabang
      for (let b = 0; b < 7; b++) {
        const a = r() * 6.28;
        const d = rr(0, 18);
        k.add('cone', col, x + Math.cos(a) * d, gy - 2, z + Math.sin(a) * d, {
          sx: rr(2.4, 4.4),
          sy: rr(18, 36),
          sz: rr(2.4, 4.4),
          rx: rr(-0.55, 0.55),
          rz: rr(-0.55, 0.55),
          top: 0xfff2dc,
          ao: 0.4,
        });
      }
    } else {
      // karang otak: kubah berpola
      k.add('hemi', col, x, gy - 3, z, {
        sx: rr(14, 24),
        sy: rr(9, 15),
        sz: rr(14, 24),
        lump: 0.14,
        top: 0xffe7c4,
        ao: 0.4,
      });
    }
  }
  // cemara laut (Casuarina): batang ramping, ranting jarum menjuntai kelabu-hijau
  for (let i = 0; i < n(30); i++) {
    const p = pick(0.5, 3.2, 0.5, 440, 600, 'o');
    if (!p) continue;
    const { x, z } = place(p.t, p.v);
    const gy = groundY(p.v);
    const h = rr(190, 290);
    const lean = rr(-0.1, 0.1);
    k.shadow(x, z, 44, 30);
    k.add('cone', 0x6a4f36, x, gy, z, {
      sx: 6.5,
      sy: h * 0.92,
      sz: 6.5,
      rz: lean,
      top: 0x8a6b4c,
      sway: 1.5,
      mot: 0.15,
    });
    for (let w = 0; w < 5; w++) {
      const f = 0.3 + (w / 7) * 0.68;
      const cx = x + lean * h * f * 0.5;
      const cy = gy + h * f;
      const reach = (1 - f) * 56 + 14;
      for (let b = 0; b < 6; b++) {
        const a = (b / 9) * 6.28 + w * 0.7 + r() * 0.3;
        const tip: [number, number, number] = [
          cx + Math.cos(a) * reach,
          cy - 30 - r() * 22,
          z + Math.sin(a) * reach,
        ];
        k.limb([cx, cy, z], tip, 1.5, 0x4f7f48, { top: 0x9cc58a, sway: 6, mot: 0.35, ao: 0.1 });
        k.limb(
          tip,
          [tip[0] + Math.cos(a) * 6, tip[1] - 26, tip[2] + Math.sin(a) * 6],
          1.1,
          0x5d8f55,
          { top: 0xaed49b, sway: 9, mot: 0.3, ao: 0 },
        );
      }
    }
  }
  // perahu nelayan terparkir di pasir
  for (let i = 0; i < n(4); i++) {
    const t = rr(0.8, 3.0);
    const v = out(rr(605, 650));
    const { x, z } = place(t, v);
    const gy = groundY(v);
    const ry = k.heading(t) + rr(-0.5, 0.5);
    const hullC = [0x2d6fb5, 0xc8402f, 0xf1efe8, 0x2f8f66][i % 4]!;
    k.shadow(x, z, 118, 42);
    k.add('blob', hullC, x, gy + 10, z, { sx: 104, sy: 22, sz: 27, ry, top: 0xf6efe0, ao: 0.3 });
    k.add('blob', 0x6a4a2a, x, gy + 22, z, { sx: 82, sy: 8, sz: 19, ry });
    const ca = Math.cos(ry);
    const sa = Math.sin(ry);
    for (const sg of [-1, 1])
      k.limb(
        [x + ca * 98 * sg, gy + 16, z - sa * 98 * sg],
        [x + ca * 128 * sg, gy + 52, z - sa * 128 * sg],
        4.2,
        hullC,
      );
    k.limb([x, gy + 20, z], [x, gy + 118, z], 2.6, 0x6b4f35, { sway: 1 });
    // cadik penyeimbang
    k.limb([x - sa * 20, gy + 28, z - ca * 20], [x - sa * 62, gy + 12, z - ca * 62], 1.6, 0x6b4f35);
    k.add('blob', hullC, x - sa * 64, gy + 8, z - ca * 64, { sx: 70, sy: 6, sz: 6, ry });
    k.add('blob', 0xeadfbf, x + ca * 5, gy + 74, z - sa * 5, {
      sx: 36,
      sy: 44,
      sz: 3,
      ry,
      mot: 0.1,
      ao: 0.1,
      sway: 3,
    });
  }

  /* ======================= hutan hujan Leuser & Seulawah ======================= */
  for (const t of [0.95, 1.65]) {
    const v = inn(rr(615, 655));
    const { x, z } = place(t, v);
    k.add('mount', 0x3a6434, x, 0, z, {
      sx: 175,
      sy: 245,
      sz: 165,
      ry: r() * 3,
      top: 0x6a7a52,
      mot: 0.45,
      ao: 0.4,
    });
    for (let q = 0; q < 26; q++) {
      const a = r() * 6.28;
      const hf = r() * 0.75;
      const d = Math.pow(1 - hf, 1.35) * 0.92;
      const s0 = rr(14, 22) * (1 - hf * 0.4);
      k.foliage(
        x + Math.cos(a) * 175 * d,
        245 * hf + s0 * 0.4,
        z + Math.sin(a) * 165 * d,
        s0,
        s0 * 0.8,
        9,
        0x264f2c,
        0x5c8a46,
        { sway: 1, leaf: 0.6 },
      );
    }
  }
  for (let i = 0; i < n(28); i++) {
    const p = pick(0.5, 2.9, 0.4, 450, 625, 'i');
    if (!p) continue;
    const { x, z } = place(p.t, p.v);
    const gy = groundY(p.v);
    const h = rr(130, 210);
    k.shadow(x, z, 62, 48);
    k.add('cone', 0x6a4b30, x, gy, z, { sx: 11, sy: h * 0.85, sz: 11, top: 0x7d5c3d, mot: 0.2 });
    canopy(x, gy + h * 0.95, z, rr(52, 72), rr(34, 46), 0x2a6a33, 0x6aae56, 9);
    canopy(x + rr(-20, 20), gy + h * 0.7, z + rr(-20, 20), 42, 26, 0x2f7437, 0x74b95d, 5);
    // pakis dan rumpun di bawahnya
    for (let q = 0; q < 3; q++)
      k.tuft(x + rr(-40, 40), gy, z + rr(-40, 40), 0x3d8a3c, 0x7bc25a, 30, 6);
  }

  /* ======================= sawah Lhokseumawe (2.5 - 5.7) ======================= */
  const paddy: [number, number][] = [
    [0x7cb544, 0xb4dd6a],
    [0x8dc24c, 0xc6e27c],
    [0xb7c04d, 0xe3d27a],
    [0xcdb64a, 0xefd685],
  ];
  let sCursor = 2.55;
  while (sCursor < 5.7) {
    const len = rr(0.28, 0.5);
    const vw = rr(60, 95);
    const v0 = rr(300, 330);
    for (let q = 0; q < 2; q++) {
      const a0 = v0 + q * (vw + 12);
      const [bc, tc] = paddy[Math.floor(r() * paddy.length)]!;
      // pematang tanah dan air genangan di bawah rumpun
      k.strip(sCursor, sCursor + len, inn(a0 - 5), inn(a0 + vw + 5), 3.2, 0x7a6a45);
      k.strip(sCursor + 0.012, sCursor + len - 0.012, inn(a0), inn(a0 + vw), 3.9, 0x6f8a62, {
        jit: 0.12,
      });
      const rowsN = 5;
      for (let w = 0; w < rowsN; w++) {
        const v = a0 + ((w + 0.5) * vw) / rowsN;
        const cnt = Math.floor(len / 0.022);
        for (let c = 0; c < cnt; c++) {
          if (r() < 0.12) continue;
          const t = sCursor + 0.02 + (c / cnt) * (len - 0.04);
          const { x, z } = place(t, inn(v + rr(-2, 2)));
          k.tuft(x, 4, z, bc, tc, rr(15, 21), 3);
        }
      }
    }
    sCursor += len + 0.08;
  }
  // pinang: batang ramping melengkung, pelepah menjuntai
  for (let i = 0; i < n(30); i++) {
    const p = pick(2.5, 5.6, 0.4, 470, 560, 'i');
    if (!p) continue;
    const { x, z } = place(p.t, p.v);
    const gy = groundY(p.v);
    const h = rr(200, 270);
    const lean = rr(-0.1, 0.1);
    const lz = rr(-0.1, 0.1);
    k.shadow(x, z, 38, 26);
    const seg = 5;
    let prev: [number, number, number] = [x, gy, z];
    for (let q = 1; q <= seg; q++) {
      const f = q / seg;
      const nxt: [number, number, number] = [x + h * lean * f * f, gy + h * f, z + h * lz * f * f];
      k.limb(prev, nxt, 3.6 - f * 1.2, q % 2 ? 0x9b9070 : 0x8a7f62, { top: 0xb6b78a, mot: 0.25 });
      prev = nxt;
    }
    k.limb([prev[0], prev[1] - 28, prev[2]], prev, 4.2, 0x6ea04a);
    for (let f = 0; f < 8; f++) {
      const a = (f / 8) * 6.28 + r() * 0.3;
      const mid: [number, number, number] = [
        prev[0] + Math.cos(a) * 38,
        prev[1] + 18,
        prev[2] + Math.sin(a) * 38,
      ];
      const end: [number, number, number] = [
        prev[0] + Math.cos(a) * 78,
        prev[1] - 24,
        prev[2] + Math.sin(a) * 78,
      ];
      k.limb(prev, mid, 2, 0x4c8f46, { top: 0x6aa957, sway: 4 });
      k.limb(mid, end, 1.6, 0x4c8f46, { top: 0x78b862, sway: 9 });
    }
  }
  // gubuk pematang berpanggung beratap rumbia
  for (let i = 0; i < n(5); i++) {
    const p = pick(2.7, 5.4, 0.3, 300, 330, 'i');
    if (!p) continue;
    const { x, z } = place(p.t, p.v);
    const ry = k.heading(p.t);
    k.shadow(x, z, 40, 36);
    for (const [dx, dz] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const)
      k.add('cyl', 0x6b4f35, x + dx * 18, 3, z + dz * 18, { sx: 2.6, sy: 36, sz: 2.6, mot: 0.2 });
    k.add('box', 0xb8975f, x, 38, z, { sx: 48, sy: 4, sz: 48, ry });
    k.add('cone4', 0xc9a95f, x, 44, z, {
      sx: 46,
      sy: 32,
      sz: 46,
      ry: ry + Math.PI / 4,
      top: 0xe3cc86,
      lump: 0.08,
      mot: 0.3,
    });
  }
  for (let i = 0; i < n(4); i++) {
    const p = pick(2.7, 5.4, 0.3, 330, 385, 'i');
    if (!p) continue;
    const { x, z } = place(p.t, p.v);
    k.limb([x, 3, z], [x, 66, z], 1.8, 0x6b4f35);
    k.limb([x - 22, 46, z], [x + 22, 46, z], 1.4, 0x6b4f35);
    k.add('blob', 0xa5483a, x, 48, z, { sx: 11, sy: 17, sz: 7, ry: 0.5, sway: 3 });
    k.add('cone', 0xe3cf8d, x, 66, z, { sx: 15, sy: 12, sz: 15 });
  }

  /* ======================= mangrove Langsa (4.5 - 5.7) ======================= */
  for (let t = 4.3; t < 5.9; t += 0.2) {
    if (zone(t, 4.55, 5.55, 0.35) < 0.3) continue;
    k.strip(t, t + 0.21, out(430), out(625), 2.4, 0x65563f, { jit: 0.2 });
    k.strip(t, t + 0.21, out(535), out(655), 2.7, 0x4b8a78, { layer: 'glass', alpha: 0.6 });
  }
  for (let i = 0; i < n(28); i++) {
    const p = pick(4.55, 5.55, 0.35, 520, 720, 'o');
    if (!p) continue;
    const { x, z } = place(p.t, p.v);
    const gy = groundY(p.v);
    const sc = rr(0.6, 1);
    const ch = 110 * sc;
    k.shadow(x, z, 80 * sc, 70 * sc, gy + 2.2);
    // akar tunjang melengkung
    for (let b = 0; b < 8; b++) {
      const a = (b / 11) * 6.28 + r() * 0.4;
      const rad = rr(46, 78) * sc;
      const top: [number, number, number] = [
        x + Math.cos(a) * 10 * sc,
        gy + ch * rr(0.55, 0.85),
        z + Math.sin(a) * 10 * sc,
      ];
      const mid: [number, number, number] = [
        x + Math.cos(a) * rad * 0.55,
        gy + ch * 0.38,
        z + Math.sin(a) * rad * 0.55,
      ];
      const low: [number, number, number] = [x + Math.cos(a) * rad, gy - 4, z + Math.sin(a) * rad];
      k.limb(top, mid, 2.4 * sc, 0x6a4a2e, { top: 0x84603f });
      k.limb(mid, low, 1.9 * sc, 0x5b3f27, { top: 0x6e4d30 });
    }
    k.add('cone', 0x5b4128, x, gy, z, {
      sx: 8 * sc,
      sy: ch * 0.9,
      sz: 8 * sc,
      top: 0x6f5233,
      lump: 0.1,
    });
    canopy(x, gy + ch * 1.05, z, 52 * sc, 30 * sc, 0x27632f, 0x5aa24e, 10);
    // propagul menggantung
    for (let b = 0; b < 4; b++)
      k.limb(
        [x + rr(-26, 26) * sc, gy + ch * 0.9, z + rr(-26, 26) * sc],
        [x + rr(-26, 26) * sc, gy + ch * 0.58, z + rr(-26, 26) * sc],
        1,
        0x7a8a3a,
        { sway: 2 },
      );
  }
  // nipah: pelepah besar berdiri dari rumpun
  for (let i = 0; i < n(30); i++) {
    const p = pick(4.5, 5.6, 0.3, 560, 740, 'o');
    if (!p) continue;
    const { x, z } = place(p.t, p.v);
    const gy = groundY(p.v);
    for (let f = 0; f < 8; f++) {
      const a = (f / 8) * 6.28 + r() * 0.4;
      const mid: [number, number, number] = [x + Math.cos(a) * 18, gy + 62, z + Math.sin(a) * 18];
      const end: [number, number, number] = [
        x + Math.cos(a) * 58,
        gy + rr(70, 100),
        z + Math.sin(a) * 58,
      ];
      k.limb([x, gy, z], mid, 2.4, 0x4a7f3a, { top: 0x6fa24c });
      k.limb(mid, end, 1.7, 0x4a7f3a, { top: 0x86bf5d, sway: 6 });
    }
  }

  /* ======================= dataran tinggi Gayo / Takengon (5.3 - 6.6) ======================= */
  const gayo = (t: number) => zone(t, 5.45, 6.6, 0.45);
  // Danau Laut Tawar: air berlapis, tepi alang-alang, perahu
  {
    const ts = 6.12;
    const vv = 470;
    k.pond(ts, inn(vv), 0.57, 180, 2.8, 0xa6cfc6);
    k.pond(ts, inn(vv), 0.5, 156, 3.3, 0x5fa6b8);
    k.pond(ts, inn(vv), 0.3, 96, 3.7, 0x2f78a8);
    for (let q = 0; q < 26; q++) {
      const a = (q / 26) * 6.28;
      const { x, z } = place(ts + Math.cos(a) * 0.55, inn(vv + Math.sin(a) * 172));
      k.tuft(x, 2.5, z, 0x6b8f3f, 0xb9c872, rr(26, 38), 5);
    }
    for (const dt of [-0.12, 0.1]) {
      const { x, z } = place(ts + dt, inn(vv + rr(-20, 20)));
      k.add('blob', 0xf2e6c8, x, 6, z, {
        sx: 34,
        sy: 7,
        sz: 10,
        ry: k.heading(ts),
        top: 0xffffff,
      });
    }
  }
  // bukit berundak ditutupi hutan
  for (let i = 0; i < n(9); i++) {
    const p = pick(5.4, 6.6, 0.45, 590, 660, 'i');
    if (!p) continue;
    const { x, z } = place(p.t, p.v);
    const h = rr(120, 190);
    const sx = rr(120, 170);
    k.add('hill', 0x3a6a36, x, 0, z, {
      sx,
      sy: h,
      sz: rr(110, 150),
      top: 0x6a8a50,
      mot: 0.45,
      ao: 0.4,
    });
    for (let q = 0; q < 12; q++) {
      const a = r() * 6.28;
      const hf = r() * 0.8;
      const d = Math.pow(1 - hf, 0.72) * (1 - 0.12 * hf) * 0.9;
      const s0 = rr(13, 20);
      k.foliage(
        x + Math.cos(a) * sx * d,
        h * hf + s0 * 0.4,
        z + Math.sin(a) * sx * 0.85 * d,
        s0,
        s0 * 0.8,
        9,
        0x2c5a2e,
        0x6a9a4c,
        { sway: 1, leaf: 0.6 },
      );
    }
  }
  // pinus merkusii: batang jingga-cokelat lurus, tajuk berlapis tak beraturan
  for (let i = 0; i < n(70); i++) {
    const side: Side = r() < 0.55 ? 'i' : 'o';
    const p = pick(5.45, 6.6, 0.45, side === 'i' ? 440 : 460, side === 'i' ? 600 : 620, side);
    if (!p) continue;
    if (side === 'i' && p.vv < 560 && Math.abs(p.t - 6.12) < 0.62) continue;
    const { x, z } = place(p.t, p.v);
    const gy = groundY(p.v);
    const h = rr(220, 340);
    const lean = rr(-0.04, 0.04);
    k.shadow(x, z, 48, 34);
    k.add('cone', 0x7a4a2c, x, gy, z, {
      sx: 7,
      sy: h * 0.62,
      sz: 7,
      rz: lean,
      top: 0x9a6a44,
      sway: 1.2,
      mot: 0.2,
    });
    for (let t = 0; t < 7; t++) {
      const f = t / 7;
      const w = (1 - f * 0.7) * 50 * rr(0.85, 1.1);
      k.add('cone', 0x1d5233, x + lean * h * f * 0.5, gy + h * (0.2 + f * 0.17), z, {
        sx: w,
        sy: h * 0.22,
        sz: w,
        ry: r() * 3,
        top: 0x3f8650,
        lump: 0.2,
        sway: 3 + f * 4,
        mot: 0.3,
        ao: 0.35,
      });
    }
  }
  // kebun kopi arabika Gayo: baris semak berbuah di bawah pohon penaung
  [5.55, 5.8, 6.4].forEach((ts) => {
    const v0 = 300;
    k.strip(ts - 0.02, ts + 0.2, inn(v0 - 6), inn(v0 + 150), 3.4, 0x6e4528, { jit: 0.1 });
    for (let row = 0; row < 5; row++) {
      for (let c = 0; c < 9; c++) {
        const t = ts + (c / 9) * 0.18;
        const { x, z } = place(t, inn(v0 + 12 + row * 30));
        k.shadow(x, z, 17, 15, 4);
        k.foliage(x, 15, z, 16, 13, 14, 0x24552c, 0x4d8a44, { sway: 2, leaf: 0.5 });
        for (let b = 0; b < 6; b++) {
          const a = r() * 6.28;
          k.add(
            'blob',
            r() < 0.7 ? 0xc01f2a : 0xe9b73a,
            x + Math.cos(a) * 14,
            8 + r() * 18,
            z + Math.sin(a) * 14,
            { sx: 2.4, sy: 2.4, sz: 2.4, mot: 0, ao: 0 },
          );
        }
      }
    }
    for (let q = 0; q < 3; q++) {
      const { x, z } = place(ts + 0.03 + q * 0.07, inn(v0 + 25 + (q % 2) * 60));
      k.shadow(x, z, 52, 46, 4);
      k.limb([x, 3, z], [x + rr(-6, 6), 124, z], 3.8, 0x6a4b30, { top: 0x7c5a3c });
      canopy(x, 126, z, 46, 10, 0x347f3c, 0x7fbe58, 7, 5);
      for (let b = 0; b < 6; b++) {
        const a = r() * 6.28;
        k.add('dot', 0xdb4a2e, x + Math.cos(a) * 32, 132, z + Math.sin(a) * 32, {
          sx: 3.6,
          sy: 3.6,
          sz: 3.6,
          mot: 0,
          ao: 0,
        });
      }
    }
  });
  // kabut pagi menggantung di lereng
  for (let i = 0; i < n(8); i++) {
    const t = rr(5.6, 6.6);
    if (r() > gayo(t)) continue;
    const { x, z } = place(t, inn(rr(430, 600)));
    k.mist(x, rr(90, 140), z, rr(130, 200), rr(45, 70), k.heading(t));
  }
}
