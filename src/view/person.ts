/**
 * Model orang semi-realistis untuk bidak: proporsi tubuh manusia (kepala ±1/5 tinggi),
 * sendi bahu/siku/lutut, wajah (mata, alis, hidung, telinga, bibir), rambut, dan pakaian
 * serta perlengkapan khas tiap profesi. Semua material dicatat di `mats` supaya efek
 * bencana (gosong, basah, dll.) bisa mewarnai seluruh tubuh.
 */
import * as THREE from 'three';
import { canvas2d } from './util';

export interface MatRef {
  m: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
  b: THREE.Color;
}

type V3 = [number, number, number];

/* ---------------- tekstur kain (di-cache) ---------------- */
const TEX = new Map<string, THREE.CanvasTexture>();
function clothTex(
  kind: 'batik' | 'lurik' | 'camo' | 'kotak' | 'songket' | 'batik2',
): THREE.CanvasTexture {
  let t = TEX.get(kind);
  if (t) return t;
  const { c, x } = canvas2d(128, 128);
  const R = Math.random;
  if (kind === 'batik' || kind === 'batik2') {
    const [bg, fg, ac] =
      kind === 'batik' ? ['#6b3a1a', '#e8c88a', '#2a1a0e'] : ['#1f3a5f', '#d8c08a', '#0f1f33'];
    x.fillStyle = bg;
    x.fillRect(0, 0, 128, 128);
    // motif kawung: lingkaran empat kelopak berulang
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) {
        const cx = k * 32 + 16;
        const cy = r * 32 + 16;
        x.fillStyle = fg;
        for (const [dx, dy] of [
          [-7, 0],
          [7, 0],
          [0, -7],
          [0, 7],
        ]) {
          x.beginPath();
          x.ellipse(cx + dx!, cy + dy!, dx ? 6 : 3.5, dy ? 6 : 3.5, 0, 0, Math.PI * 2);
          x.fill();
        }
        x.fillStyle = ac;
        x.beginPath();
        x.arc(cx, cy, 2.2, 0, Math.PI * 2);
        x.fill();
      }
  } else if (kind === 'lurik') {
    x.fillStyle = '#5a4630';
    x.fillRect(0, 0, 128, 128);
    for (let k = 0; k < 128; k += 4) {
      x.fillStyle = k % 12 === 0 ? '#2a2018' : k % 8 === 0 ? '#8a7050' : '#4a3a28';
      x.fillRect(k, 0, 2, 128);
    }
  } else if (kind === 'camo') {
    x.fillStyle = '#5a6a3a';
    x.fillRect(0, 0, 128, 128);
    const cols = ['#3a4a28', '#7a7a4a', '#2a2a1e', '#4a5a30'];
    for (let i = 0; i < 70; i++) {
      x.fillStyle = cols[i % 4]!;
      x.beginPath();
      x.ellipse(R() * 128, R() * 128, 4 + R() * 10, 3 + R() * 6, R() * 3, 0, Math.PI * 2);
      x.fill();
    }
  } else if (kind === 'songket') {
    x.fillStyle = '#7a1022';
    x.fillRect(0, 0, 128, 128);
    x.strokeStyle = '#e6b84a';
    x.lineWidth = 2;
    for (let r = 0; r < 8; r++)
      for (let k = 0; k < 8; k++) {
        x.beginPath();
        x.moveTo(k * 16 + 8, r * 16 + 2);
        x.lineTo(k * 16 + 14, r * 16 + 8);
        x.lineTo(k * 16 + 8, r * 16 + 14);
        x.lineTo(k * 16 + 2, r * 16 + 8);
        x.closePath();
        x.stroke();
      }
  } else {
    x.fillStyle = '#c8302a';
    x.fillRect(0, 0, 128, 128);
    for (let k = 0; k < 128; k += 16) {
      x.fillStyle = 'rgba(20,20,20,.35)';
      x.fillRect(k, 0, 6, 128);
      x.fillRect(0, k, 128, 6);
    }
  }
  t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.encoding = THREE.sRGBEncoding;
  TEX.set(kind, t);
  return t;
}
/** tekstur bersama tidak boleh dibuang saat bidak dibangun ulang */
export const PERSON_TEX = TEX;

const SKIN = [
  0xc68a5e, 0xd9a274, 0xb47a4c, 0xc89068, 0xd6a07a, 0xbf8558, 0xa86c42, 0xd4a07c, 0xc9926a,
  0xb98256, 0xd2a07a, 0xa87048, 0xc58d63, 0xd8a67e, 0xb57d50, 0xc08a60,
];

/** Profesi: urutan sama dengan pawns.json */
export const N_PERSON = 16;

export function buildPerson(pi: number, mats: MatRef[], ownColor = '#ffffff'): THREE.Group {
  const g = new THREE.Group();
  const M = (hex: number | string, r = 0.7, o: THREE.MeshStandardMaterialParameters = {}) => {
    // warna ditulis dalam sRGB; ubah ke linear agar tidak pucat setelah koreksi gamma
    const col = new THREE.Color(hex).convertSRGBToLinear();
    const m = new THREE.MeshStandardMaterial({ color: col, roughness: r, ...o });
    mats.push({ m, b: col.clone() });
    return m;
  };
  const MT = (kind: Parameters<typeof clothTex>[0], rep = 1, r = 0.85) => {
    const t = clothTex(kind);
    const m = new THREE.MeshStandardMaterial({ map: t, roughness: r });
    if (rep !== 1) {
      const tt = t.clone();
      tt.needsUpdate = true;
      tt.repeat.set(rep, rep);
      m.map = tt;
    }
    mats.push({ m, b: new THREE.Color(0xffffff) });
    return m;
  };
  const mesh = (geo: THREE.BufferGeometry, m: THREE.Material, p: V3, rot?: V3, sc?: V3) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(p[0], p[1], p[2]);
    if (rot) o.rotation.set(rot[0], rot[1], rot[2]);
    if (sc) o.scale.set(sc[0], sc[1], sc[2]);
    o.castShadow = true;
    g.add(o);
    return o;
  };
  const sph = (r: number, m: THREE.Material, p: V3, sc?: V3, seg = 12) =>
    mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 4)), m, p, undefined, sc);
  const box = (w: number, h: number, d: number, m: THREE.Material, p: V3, rot?: V3) =>
    mesh(new THREE.BoxGeometry(w, h, d), m, p, rot);
  /** silinder meruncing dari a ke b */
  const limb = (a: V3, b: V3, ra: number, rb: number, m: THREE.Material, seg = 10) => {
    const A = new THREE.Vector3(...a);
    const B = new THREE.Vector3(...b);
    const d = B.clone().sub(A);
    const len = d.length() || 1;
    const geo = new THREE.CylinderGeometry(rb, ra, len, seg);
    const o = new THREE.Mesh(geo, m);
    o.position.copy(A).addScaledVector(d, 0.5);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    o.castShadow = true;
    g.add(o);
    return o;
  };
  /** badan berbentuk (lathe) dari daftar [jari-jari, y] */
  const lathe = (prof: [number, number][], m: THREE.Material, zs = 0.72, seg = 18) => {
    const geo = new THREE.LatheGeometry(
      prof.map(([r, y]) => new THREE.Vector2(r, y)),
      seg,
    );
    const o = mesh(geo, m, [0, 0, 0], undefined, [1, 1, zs]);
    return o;
  };

  const skin = M(SKIN[pi] ?? 0xc68a5e, 0.65);
  const hairM = M(0x17110d, 0.75);
  const white = M(0xf4f2ee, 0.5);
  const iris = M(0x1a120c, 0.3);
  const lip = M(0x9a5a4a, 0.6);
  const shoeM = M(0x1d1b1a, 0.45);

  /* ---- alas bidak: cincin warna pemilik ---- */
  mesh(
    new THREE.CylinderGeometry(19, 21, 5, 28),
    M(ownColor, 0.35, { metalness: 0.15 }),
    [0, 2.5, 0],
  );
  mesh(new THREE.CylinderGeometry(16.5, 17, 1.2, 28), M(0x2a2826, 0.6), [0, 5.4, 0]);

  /* ---- parameter pakaian per profesi ---- */
  interface Look {
    shirt: THREE.Material;
    pants: THREE.Material;
    /** rok/sarung panjang menutup kaki */
    skirt?: THREE.Material;
    /** jas/mantel panjang (sampai paha) */
    coat?: THREE.Material;
    shoes?: THREE.Material | 'bare';
    sleeve?: 'long' | 'short';
    hair?: 'short' | 'long' | 'bun' | 'none';
    /** pose lengan: [kiri, kanan] -> titik siku & pergelangan relatif bahu */
    armL?: [V3, V3];
    armR?: [V3, V3];
  }
  const lk: Look = { shirt: M(0xf4f2ee), pants: M(0x2b2f3a), sleeve: 'long', hair: 'short' };
  const k = pi;
  if (k === 0) {
    lk.shirt = MT('lurik', 1.5);
    lk.pants = M(0x3a3226, 0.9);
    lk.shoes = 'bare';
    lk.armR = [
      [4, -14, 6],
      [2, -22, 14],
    ];
  } else if (k === 1) {
    lk.shirt = M(0xc8304a, 0.55);
    lk.skirt = MT('batik', 1.5);
    lk.hair = 'bun';
    lk.armL = [
      [-12, -6, 6],
      [-20, 6, 10],
    ];
    lk.armR = [
      [12, -12, 8],
      [16, -24, 16],
    ];
  } else if (k === 2) {
    lk.shirt = M(0x3f6f8a, 0.85);
    lk.pants = M(0x4a4a46, 0.9);
    lk.shoes = 'bare';
    lk.sleeve = 'short';
  } else if (k === 3) {
    lk.shirt = M(0x1f9a52, 0.55);
    lk.pants = M(0x2a2d33, 0.8);
    lk.hair = 'none';
  } else if (k === 4) {
    lk.shirt = M(0x1c1f2a, 0.5);
    lk.skirt = MT('batik', 1.2);
    lk.shoes = M(0x2a1a10, 0.4);
  } else if (k === 5) {
    lk.shirt = M(0x181818, 0.85);
    lk.pants = M(0x181818, 0.85);
    lk.shoes = 'bare';
    lk.armL = [
      [-10, -10, 12],
      [-6, -2, 22],
    ];
    lk.armR = [
      [14, -4, 4],
      [24, 6, 6],
    ];
  } else if (k === 6) {
    lk.shirt = M(0xe8e4dc, 0.8);
    lk.pants = M(0x3a3f4a, 0.85);
    lk.sleeve = 'short';
  } else if (k === 7) {
    lk.shirt = M(0xf2f4f6, 0.55);
    lk.pants = M(0x22262e, 0.6);
    lk.shoes = M(0x1a1410, 0.3);
  } else if (k === 8) {
    lk.shirt = M(0x5a9ab0, 0.7);
    lk.pants = M(0x5a9ab0, 0.7);
    lk.coat = M(0xf6f6f4, 0.6);
    lk.hair = 'long';
  } else if (k === 9) {
    lk.shirt = M(0x8a6a44, 0.65);
    lk.pants = M(0x5a4430, 0.7);
    lk.shoes = M(0x111111, 0.25);
  } else if (k === 10) {
    lk.shirt = MT('batik2', 1.4);
    lk.pants = M(0x2e3440, 0.8);
    lk.hair = 'bun';
    lk.armL = [
      [-14, -12, 8],
      [-10, -18, 18],
    ];
  } else if (k === 11) {
    lk.shirt = MT('camo', 1.3);
    lk.pants = MT('camo', 1.3);
    lk.shoes = M(0x1a1a14, 0.5);
  } else if (k === 12) {
    lk.shirt = M(0x1b2340, 0.55);
    lk.pants = M(0x1b2340, 0.6);
    lk.shoes = M(0x0e0e0e, 0.25);
  } else if (k === 13) {
    lk.shirt = M(0xf7f6f2, 0.6);
    lk.pants = MT('kotak', 2.2);
    lk.armR = [
      [12, -12, 10],
      [14, -16, 22],
    ];
  } else if (k === 14) {
    lk.shirt = M(0xc29a3a, 0.8);
    lk.pants = M(0xc29a3a, 0.8);
    lk.coat = M(0xc29a3a, 0.8);
    lk.shoes = M(0x1a1a1a, 0.5);
    lk.hair = 'none';
  } else {
    lk.shirt = M(0x2a4a8a, 0.8);
    lk.pants = M(0x2a4a8a, 0.8);
    lk.sleeve = 'long';
  }

  /* ---- kaki ---- */
  const HIP = 50;
  const KNEE = 29;
  const ANK = 9;
  const legSp = 5.2;
  const shoes = lk.shoes === 'bare' ? skin : (lk.shoes ?? shoeM);
  [-1, 1].forEach((sd) => {
    const sx = sd * legSp;
    if (!lk.skirt) {
      limb([sx, HIP, 0], [sx * 0.95, KNEE, 0.6], 5.4, 4.3, lk.pants);
      sph(4.4, lk.pants, [sx * 0.95, KNEE, 0.6]);
      limb(
        [sx * 0.95, KNEE, 0.6],
        [sx * 0.9, ANK + 2, -0.4],
        4.3,
        3.1,
        k === 0 || k === 2 ? skin : lk.pants,
      );
    } else {
      limb([sx * 0.8, 22, 0], [sx * 0.85, ANK + 2, 0], 3.4, 3, skin);
    }
    // sepatu/telapak
    sph(4, shoes, [sx * 0.9, 8.6, 2.6], [1, 0.62, 1.9]);
  });
  if (k === 0 || k === 2) {
    // celana digulung sampai betis
    [-1, 1].forEach((sd) =>
      mesh(new THREE.CylinderGeometry(4.7, 4.7, 3, 10), lk.pants, [
        sd * legSp * 0.95,
        KNEE - 2,
        0.6,
      ]),
    );
  }
  /* ---- panggul & badan ---- */
  sph(10, lk.pants, [0, HIP + 2, 0], [1, 0.5, 0.72]);
  if (lk.skirt) {
    lathe(
      [
        [7, ANK + 1],
        [9.6, 14],
        [10.6, 30],
        [11, 46],
        [10.6, HIP + 4],
        [0.1, HIP + 4.1],
      ],
      lk.skirt,
      0.78,
    );
  }
  const shirt = lk.shirt;
  lathe(
    [
      [0.1, HIP - 3],
      [10.6, HIP - 3],
      [10.3, HIP + 6],
      [9.6, 60],
      [11.6, 70],
      [12.8, 77],
      [11, 81.5],
      [5, 84],
      [0.1, 84.2],
    ],
    shirt,
  );
  if (lk.coat) {
    // jas/jaket panjang terbuka di depan
    const prof: [number, number][] = [
      [11.6, 36],
      [11.2, 46],
      [10.9, HIP + 2],
      [10.3, 60],
      [12.2, 70],
      [13.4, 77],
      [11.6, 82],
      [5.6, 84.6],
    ];
    const geo = new THREE.LatheGeometry(
      prof.map(([r, y]) => new THREE.Vector2(r, y)),
      18,
      Math.PI * 0.12,
      Math.PI * 1.76,
    );
    (lk.coat as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    mesh(geo, lk.coat, [0, 0, 0], undefined, [1, 1, 0.76]);
  }
  /* ---- lengan ---- */
  const SH = 78;
  const sleeveM = lk.coat ?? shirt;
  const arm = (sd: number, pose?: [V3, V3]) => {
    const s: V3 = [sd * 12.6, SH, 0];
    const e: V3 = pose
      ? [s[0] + pose[0][0], SH + pose[0][1], pose[0][2]]
      : [sd * 14.6, SH - 16, -1.2];
    const w: V3 = pose
      ? [s[0] + pose[1][0], SH + pose[1][1], pose[1][2]]
      : [sd * 15.4, SH - 31, 1.6];
    sph(4.8, sleeveM, s);
    limb(s, e, 4.4, 3.7, sleeveM);
    const short = lk.sleeve === 'short';
    sph(3.6, short ? skin : sleeveM, e);
    limb(e, w, 3.5, 2.8, short ? skin : sleeveM);
    if (short)
      limb(
        s,
        [s[0] + (e[0] - s[0]) * 0.55, s[1] + (e[1] - s[1]) * 0.55, e[2] * 0.55],
        4.7,
        4.3,
        sleeveM,
      );
    // tangan
    const h = sph(3, skin, [w[0], w[1] - 2.6, w[2]], [0.85, 1.25, 0.6]);
    return { s, e, w, h };
  };
  const L = arm(-1, lk.armL);
  const R = arm(1, lk.armR);
  /* ---- leher & kepala ---- */
  limb([0, 82, 0], [0, 87.5, 0.4], 3.9, 3.6, skin);
  const HY = 95;
  sph(8.2, skin, [0, HY, 0.4], [0.88, 1.12, 0.98], 18);
  // rahang dan dagu
  sph(3.3, skin, [0, HY - 6.2, 2.2], [1.25, 0.75, 1], 10);
  // telinga
  [-1, 1].forEach((sd) => sph(1.9, skin, [sd * 7.4, HY, 0], [0.5, 1, 0.8], 8));
  // mata, alis, hidung, bibir
  [-1, 1].forEach((sd) => {
    sph(1.05, white, [sd * 2.8, HY + 0.6, 7.45], [1.25, 0.7, 0.5], 10);
    sph(0.78, iris, [sd * 2.8, HY + 0.6, 7.85], [1, 1, 0.5], 8);
    box(3.2, 0.7, 1, hairM, [sd * 2.9, HY + 2.9, 7.2], [0, 0, sd * -0.12]);
  });
  mesh(new THREE.ConeGeometry(1.3, 3.6, 8), skin, [0, HY - 1.2, 8.2], [Math.PI / 2 - 0.35, 0, 0]);
  box(3.6, 0.8, 1, lip, [0, HY - 4.4, 7.6]);
  /* ---- rambut ---- */
  const hairCap = (sy = 1) =>
    mesh(
      new THREE.SphereGeometry(8.9, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
      hairM,
      [0, HY + 1.2, -0.6],
      [-0.42, 0, 0],
      [0.94, 1.05 * sy, 1.04],
    );
  if (lk.hair === 'short') hairCap();
  else if (lk.hair === 'long') {
    hairCap();
    lathe(
      [
        [7.6, HY + 4],
        [8.4, HY - 4],
        [8, HY - 12],
        [6.5, HY - 16],
      ],
      hairM,
      0.9,
    ).position.z = -1.6;
  } else if (lk.hair === 'bun') {
    hairCap();
    sph(4.2, hairM, [0, HY + 2, -8.6]);
  }

  /* ---- perlengkapan profesi ---- */
  const wood = M(0x6b4a2a, 0.85);
  const metal = M(0x9aa0a6, 0.3, { metalness: 0.7 });
  const gold = M(0xd9b04a, 0.3, { metalness: 0.7 });
  if (k === 0) {
    // caping bambu dan cangkul
    mesh(new THREE.ConeGeometry(17, 9, 24), M(0xd2b26a, 0.9), [0, HY + 10, 0]);
    mesh(
      new THREE.TorusGeometry(16.6, 0.6, 6, 24),
      M(0xa88a4a),
      [0, HY + 5.6, 0],
      [Math.PI / 2, 0, 0],
    );
    limb([R.w[0], R.w[1] - 30, R.w[2] + 4], [R.w[0], R.w[1] + 26, R.w[2] - 2], 1.3, 1.3, wood, 6);
    box(10, 7, 1.2, metal, [R.w[0], R.w[1] - 32, R.w[2] + 8], [0.6, 0, 0]);
  } else if (k === 1) {
    // siger emas, selendang, dan kipas
    for (let q = -3; q <= 3; q++)
      mesh(
        new THREE.ConeGeometry(1.8, 9 - Math.abs(q) * 1.2, 6),
        gold,
        [q * 2.6, HY + 10 - Math.abs(q) * 0.6, 3.6 - Math.abs(q) * 0.5],
        [0.2, 0, -q * 0.12],
      );
    mesh(new THREE.TorusGeometry(8.6, 0.9, 6, 20, Math.PI), gold, [0, HY + 5, 0.6], [0, 0, 0]);
    mesh(
      new THREE.TorusGeometry(10, 1.6, 6, 16, Math.PI * 1.2),
      M(0xf2c14a, 0.6),
      [0, 58, 6],
      [0.3, 0, Math.PI * 0.9],
    );
    mesh(
      new THREE.CylinderGeometry(7, 0.5, 0.6, 12, 1, false, 0, Math.PI),
      M(0xe8c070, 0.6, { side: THREE.DoubleSide }),
      [L.w[0] - 2, L.w[1] + 2, L.w[2] + 2],
      [Math.PI / 2, 0, 0.4],
    );
  } else if (k === 2) {
    // topi rimba, joran, dan ikan
    mesh(new THREE.CylinderGeometry(8.4, 9, 6, 16), M(0xb8a77a, 0.9), [0, HY + 7, 0]);
    mesh(new THREE.CylinderGeometry(13.5, 13.5, 0.8, 20), M(0xb8a77a, 0.9), [0, HY + 4.4, 0]);
    limb([R.w[0], R.w[1] - 3, R.w[2]], [R.w[0] + 26, R.w[1] + 52, R.w[2] + 4], 1, 0.4, wood, 6);
    const fish = sph(
      3.4,
      M(0x9ab0b8, 0.3, { metalness: 0.4 }),
      [L.w[0], L.w[1] - 10, L.w[2] + 2],
      [0.6, 2.4, 0.4],
    );
    fish.rotation.z = 0.1;
    mesh(
      new THREE.ConeGeometry(2.6, 4, 4),
      M(0x7a909a, 0.4),
      [L.w[0], L.w[1] - 19.5, L.w[2] + 2],
      [Math.PI, 0, 0],
    );
  } else if (k === 3) {
    // helm dengan kaca, tas kotak hijau, jaket bergaris
    mesh(
      new THREE.SphereGeometry(10.4, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.66),
      M(0x1f9a52, 0.3),
      [0, HY + 1.6, -1],
      [-0.6, 0, 0],
    );
    box(15, 1.2, 6, M(0x1a2630, 0.1, { metalness: 0.5 }), [0, HY + 7.4, 6.4], [-0.35, 0, 0]);
    box(26, 24, 18, M(0x1f9a52, 0.5), [0, 70, -16]);
    box(26.4, 2, 18.4, M(0xf2f2f2, 0.5), [0, 76, -16]);
    box(1, 32, 1, M(0xdddddd, 0.4), [0, 66, 9.4]);
  } else if (k === 4) {
    // blangkon, beskap dengan kancing emas, keris
    mesh(
      new THREE.SphereGeometry(9, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
      MT('batik', 0.6),
      [0, HY + 1.6, -0.2],
      [-0.2, 0, 0],
      [1, 0.8, 1.05],
    );
    sph(3.4, MT('batik', 0.6), [0, HY - 1, -8.6]);
    for (let q = 0; q < 4; q++) sph(0.9, gold, [-3, 74 - q * 5, 9.4]);
    limb([4, 48, -8], [12, 70, -10], 1.4, 1, M(0x3a2414, 0.5), 6);
    sph(2.4, gold, [12, 71, -10]);
  } else if (k === 5) {
    // ikat kepala merah, sabuk, kuda-kuda
    mesh(
      new THREE.TorusGeometry(8.6, 1.4, 8, 22),
      M(0xcc2222, 0.7),
      [0, HY + 3, -0.2],
      [Math.PI / 2 - 0.2, 0, 0],
    );
    box(1.6, 8, 1, M(0xcc2222), [-3, HY + 1, -9], [0, 0, 0.5]);
    mesh(
      new THREE.TorusGeometry(10.6, 1.8, 8, 22),
      M(0xb8202a, 0.7),
      [0, HIP + 3, 0],
      [Math.PI / 2, 0, 0],
      [1, 0.74, 1],
    );
  } else if (k === 6) {
    // peci putih, celemek, mangkuk bakso
    mesh(new THREE.CylinderGeometry(8, 8.4, 5, 16), M(0xf4f2ee, 0.8), [0, HY + 7.4, -0.4]);
    box(18, 26, 1, M(0x5a4bb5, 0.8), [0, 58, 9.6]);
    mesh(
      new THREE.SphereGeometry(5.4, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      M(0xf4f1ea, 0.4, { side: THREE.DoubleSide }),
      [R.w[0] + 1, R.w[1] - 1, R.w[2] + 7],
    );
    sph(4.8, M(0xb8742e, 0.6), [R.w[0] + 1, R.w[1] - 2, R.w[2] + 7], [1, 0.3, 1]);
  } else if (k === 7) {
    // dasi, tali ID, tas kerja
    box(2.6, 18, 0.8, M(0xb02a3a, 0.5), [0, 70, 9.3]);
    box(3.6, 3, 1, M(0xb02a3a, 0.5), [0, 79, 9.2]);
    box(3.6, 5, 0.6, white, [0, 61, 9.8]);
    box(18, 13, 5, M(0x3a2618, 0.4), [R.w[0] + 1, R.w[1] - 10, R.w[2]]);
    box(6, 2, 1, metal, [R.w[0] + 1, R.w[1] - 3, R.w[2]]);
  } else if (k === 8) {
    // stetoskop dan papan catatan
    mesh(
      new THREE.TorusGeometry(6.8, 0.7, 6, 18, Math.PI * 1.3),
      M(0x222222, 0.4),
      [0, 76, 6.6],
      [0.3, 0, Math.PI * 1.15],
    );
    sph(1.6, metal, [3.4, 69, 9.6]);
    box(12, 15, 1, M(0x7a5a3a), [L.w[0] + 3, L.w[1] - 6, L.w[2] + 6], [0.2, 0, 0.1]);
    box(10, 12, 1.2, white, [L.w[0] + 3, L.w[1] - 6, L.w[2] + 6.4], [0.2, 0, 0.1]);
  } else if (k === 9) {
    // topi dinas, sabuk, pangkat
    mesh(new THREE.CylinderGeometry(9.6, 8.6, 5, 18), M(0x5a4430, 0.6), [0, HY + 7, 0]);
    mesh(
      new THREE.SphereGeometry(5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      M(0x111111, 0.2),
      [0, HY + 4.4, 5.5],
      [0, 0, 0],
      [1.2, 0.3, 1],
    );
    sph(1.4, gold, [0, HY + 7.6, 9.4]);
    mesh(
      new THREE.TorusGeometry(10.4, 1.3, 6, 20),
      M(0x161616, 0.3),
      [0, HIP + 2, 0],
      [Math.PI / 2, 0, 0],
      [1, 0.74, 1],
    );
    [-1, 1].forEach((sd) => box(5, 1.4, 4, gold, [sd * 10.5, 80, 0]));
  } else if (k === 10) {
    // kacamata, buku
    [-1, 1].forEach((sd) =>
      mesh(new THREE.TorusGeometry(1.9, 0.35, 6, 12), M(0x222222, 0.3), [sd * 2.9, HY + 0.8, 8.4]),
    );
    box(2, 0.4, 0.4, M(0x222222), [0, HY + 1, 8.6]);
    box(11, 14, 3, M(0x2a6ab8, 0.6), [L.w[0] + 3, L.w[1] - 4, L.w[2] + 2], [0.3, 0.2, 0]);
  } else if (k === 11) {
    // baret, sepatu bot, ransel
    mesh(
      new THREE.SphereGeometry(9.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      M(0x2a3a1e, 0.8),
      [0.6, HY + 3.4, 0],
      [0, 0, -0.25],
      [1.05, 0.45, 1.05],
    );
    sph(1.3, gold, [-4.6, HY + 4.6, 7]);
    [-1, 1].forEach((sd) =>
      limb([sd * legSp * 0.9, 9, 0], [sd * legSp * 0.92, 18, 0], 3.8, 3.8, M(0x1a1a14, 0.5)),
    );
    box(18, 22, 9, MT('camo', 0.8), [0, 68, -12]);
  } else if (k === 12) {
    // topi pilot, garis emas di manset, kacamata hitam
    mesh(new THREE.CylinderGeometry(10, 8.8, 5, 18), M(0x1b2340, 0.5), [0, HY + 7, 0]);
    mesh(new THREE.CylinderGeometry(10, 10, 1, 18), white, [0, HY + 9.4, 0]);
    mesh(
      new THREE.SphereGeometry(5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      M(0x111111, 0.2),
      [0, HY + 4.4, 5.5],
      [0, 0, 0],
      [1.2, 0.3, 1],
    );
    box(4, 1.6, 1, gold, [0, HY + 7, 9.4]);
    [L, R].forEach((a) =>
      mesh(new THREE.CylinderGeometry(3, 3, 1.4, 10), gold, [a.w[0], a.w[1] + 2.4, a.w[2]]),
    );
    [-1, 1].forEach((sd) =>
      box(2.8, 1.5, 0.6, M(0x111111, 0.1, { metalness: 0.5 }), [sd * 2.8, HY + 0.6, 8.3]),
    );
    box(10, 5, 1, white, [0, 77, 9]);
    box(2, 12, 0.8, M(0x1b2340), [0, 72, 9.5]);
  } else if (k === 13) {
    // topi koki tinggi, celemek, wajan
    mesh(new THREE.CylinderGeometry(7.8, 7, 7, 16), white, [0, HY + 9, 0]);
    sph(9, white, [0, HY + 16, 0], [1, 0.75, 1]);
    box(17, 30, 1, white, [0, 56, 9.8]);
    [-1, 1].forEach((sd) => sph(0.9, M(0x222222), [sd * 3, 74, 9.9]));
    mesh(new THREE.CylinderGeometry(7, 6, 2, 16), M(0x2a2a2a, 0.3, { metalness: 0.6 }), [
      R.w[0] + 2,
      R.w[1] - 3,
      R.w[2] + 10,
    ]);
    limb([R.w[0], R.w[1] - 3, R.w[2]], [R.w[0] + 1, R.w[1] - 3, R.w[2] + 4], 0.9, 0.9, wood, 6);
  } else if (k === 14) {
    // helm pemadam, garis reflektif, kapak
    mesh(
      new THREE.SphereGeometry(10, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      M(0xc0201a, 0.35),
      [0, HY + 2, 0],
      [0, 0, 0],
      [1, 0.95, 1.08],
    );
    mesh(
      new THREE.CylinderGeometry(13, 13, 0.8, 22),
      M(0xc0201a, 0.35),
      [0, HY + 2.2, -1.6],
      [0.12, 0, 0],
    );
    const refl = M(0xe8f060, 0.2, { emissive: new THREE.Color(0x444400) });
    for (const y of [56, 70])
      mesh(new THREE.CylinderGeometry(12.7, 12.7, 2, 18), refl, [0, y, 0], undefined, [1, 1, 0.74]);
    [-1, 1].forEach((sd) =>
      mesh(new THREE.CylinderGeometry(4.6, 4.6, 2, 10), refl, [sd * legSp * 0.95, 20, 0.2]),
    );
    limb(
      [R.w[0], R.w[1] - 18, R.w[2]],
      [R.w[0], R.w[1] + 10, R.w[2]],
      1.2,
      1.2,
      M(0xc0201a, 0.5),
      6,
    );
    box(1, 6, 8, metal, [R.w[0], R.w[1] + 10, R.w[2] + 3]);
  } else {
    // montir: topi, kunci inggris, noda oli
    mesh(
      new THREE.SphereGeometry(8.9, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      M(0x2a4a8a, 0.7),
      [0, HY + 2.4, -0.8],
      [-0.42, 0, 0],
    );
    mesh(
      new THREE.SphereGeometry(5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      M(0x2a4a8a, 0.6),
      [0, HY + 2.6, 6],
      [0, 0, 0],
      [1.1, 0.25, 1],
    );
    box(1.6, 16, 1.2, metal, [R.w[0] + 1, R.w[1] - 10, R.w[2] + 2]);
    mesh(new THREE.TorusGeometry(2.2, 0.8, 6, 10, Math.PI * 1.5), metal, [
      R.w[0] + 1,
      R.w[1] - 18.5,
      R.w[2] + 2,
    ]);
    sph(2.4, M(0x1a1a1a, 0.9), [5, 62, 9], [1.6, 1, 0.3]);
    box(8, 1, 1, white, [-6, 76, 9.4]);
  }
  return g;
}
