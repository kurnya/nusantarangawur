/**
 * Perkakas bentuk dan tekstur prosedural untuk kapal dan bangunan:
 * lambung kapal hasil loft (bukan kotak), tekstur jendela/kontainer dari kanvas,
 * dan atap pelana. Tekstur di-cache supaya tidak dibuat berulang.
 */
import * as THREE from 'three';
import { canvas2d } from './util';

const texCache = new Map<string, THREE.CanvasTexture>();

function cached(key: string, make: () => HTMLCanvasElement): THREE.CanvasTexture {
  let t = texCache.get(key);
  if (!t) {
    t = new THREE.CanvasTexture(make());
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    texCache.set(key, t);
  }
  return t;
}

/** Fasad berjendela. kind: office (beton+kaca), glass (dinding kaca), ship (jendela kapal), house. */
export function facadeTex(
  kind: 'office' | 'glass' | 'ship' | 'house' | 'ruko',
): THREE.CanvasTexture {
  return cached(`f:${kind}`, () => {
    const { c, x } = canvas2d(256, 256);
    const R = (a: number, b: number) => a + Math.random() * (b - a);
    if (kind === 'glass') {
      const g = x.createLinearGradient(0, 0, 256, 256);
      g.addColorStop(0, '#5f87a3');
      g.addColorStop(0.5, '#9dc0d6');
      g.addColorStop(1, '#4a6f8c');
      x.fillStyle = g;
      x.fillRect(0, 0, 256, 256);
      for (let r = 0; r < 16; r++)
        for (let k = 0; k < 8; k++) {
          x.fillStyle = `rgba(${R(20, 60)},${R(40, 80)},${R(70, 110)},${R(0.15, 0.45)})`;
          x.fillRect(k * 32 + 1, r * 16 + 1, 30, 14);
        }
      x.fillStyle = 'rgba(220,230,238,.9)';
      for (let r = 0; r <= 16; r++) x.fillRect(0, r * 16 - 1, 256, 2);
      x.fillStyle = 'rgba(160,175,188,.8)';
      for (let k = 0; k <= 8; k++) x.fillRect(k * 32 - 1, 0, 2, 256);
    } else if (kind === 'office') {
      x.fillStyle = '#d9d4c8';
      x.fillRect(0, 0, 256, 256);
      for (let r = 0; r < 8; r++) {
        x.fillStyle = '#c4beb0';
        x.fillRect(0, r * 32 + 26, 256, 6);
        for (let k = 0; k < 8; k++) {
          const lit = Math.random() < 0.07;
          x.fillStyle = lit ? '#c9bf98' : `rgb(${R(40, 70)},${R(70, 95)},${R(100, 125)})`;
          x.fillRect(k * 32 + 4, r * 32 + 5, 24, 19);
          x.fillStyle = 'rgba(255,255,255,.22)';
          x.fillRect(k * 32 + 4, r * 32 + 5, 24, 5);
        }
      }
    } else if (kind === 'ship') {
      x.fillStyle = '#f4f2ec';
      x.fillRect(0, 0, 256, 256);
      for (let r = 0; r < 4; r++)
        for (let k = 0; k < 10; k++) {
          x.fillStyle = '#1f3448';
          x.fillRect(k * 25.6 + 5, r * 64 + 22, 15, 16);
          x.fillStyle = 'rgba(255,255,255,.25)';
          x.fillRect(k * 25.6 + 5, r * 64 + 22, 15, 4);
        }
      x.fillStyle = 'rgba(0,0,0,.08)';
      for (let r = 0; r < 4; r++) x.fillRect(0, r * 64 + 60, 256, 4);
    } else if (kind === 'ruko') {
      x.fillStyle = '#ece3cf';
      x.fillRect(0, 0, 256, 256);
      // lantai atas: jendela berkusen, lantai bawah: rolling door toko
      x.fillStyle = '#6b5640';
      x.fillRect(30, 30, 70, 80);
      x.fillRect(156, 30, 70, 80);
      x.fillStyle = '#2f4a5c';
      x.fillRect(36, 36, 58, 68);
      x.fillRect(162, 36, 58, 68);
      x.fillStyle = 'rgba(255,255,255,.25)';
      x.fillRect(36, 36, 58, 18);
      x.fillRect(162, 36, 58, 18);
      x.fillStyle = '#b9b2a4';
      x.fillRect(0, 128, 256, 10);
      x.fillStyle = '#9aa0a6';
      x.fillRect(16, 146, 224, 110);
      x.fillStyle = 'rgba(0,0,0,.18)';
      for (let y = 150; y < 256; y += 7) x.fillRect(16, y, 224, 2);
    } else {
      // rumah: plester kapur dengan jendela berdaun dan pintu
      x.fillStyle = '#efe6d2';
      x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 900; i++) {
        x.fillStyle = `rgba(120,100,70,${R(0.02, 0.06)})`;
        x.fillRect(R(0, 256), R(0, 256), R(2, 8), R(2, 8));
      }
      const win = (wx: number) => {
        x.fillStyle = '#7a5a3a';
        x.fillRect(wx - 4, 70, 64, 92);
        x.fillStyle = '#26394a';
        x.fillRect(wx, 74, 56, 84);
        x.fillStyle = '#7a5a3a';
        x.fillRect(wx + 26, 74, 4, 84);
        x.fillRect(wx, 112, 56, 4);
        x.fillStyle = 'rgba(255,255,255,.22)';
        x.fillRect(wx, 74, 26, 30);
      };
      win(28);
      win(172);
      x.fillStyle = 'rgba(0,0,0,.12)';
      x.fillRect(0, 230, 256, 26);
    }
    return c;
  });
}

/** Kontainer berusuk (corrugated) dengan warna dasar dan pintu. */
export function containerTex(col: string): THREE.CanvasTexture {
  return cached(`c:${col}`, () => {
    const { c, x } = canvas2d(128, 64);
    x.fillStyle = col;
    x.fillRect(0, 0, 128, 64);
    for (let k = 0; k < 128; k += 6) {
      x.fillStyle = 'rgba(0,0,0,.16)';
      x.fillRect(k, 0, 2, 64);
      x.fillStyle = 'rgba(255,255,255,.12)';
      x.fillRect(k + 2, 0, 1, 64);
    }
    x.fillStyle = 'rgba(0,0,0,.25)';
    x.fillRect(0, 0, 128, 3);
    x.fillRect(0, 61, 128, 3);
    x.fillStyle = 'rgba(255,255,255,.55)';
    x.font = 'bold 12px sans-serif';
    x.fillText('NSTR', 8, 38);
    return c;
  });
}

/** Genteng tanah liat untuk atap rumah. */
export function tileTex(): THREE.CanvasTexture {
  return cached('roof', () => {
    const { c, x } = canvas2d(128, 128);
    x.fillStyle = '#a24e2e';
    x.fillRect(0, 0, 128, 128);
    for (let r = 0; r < 8; r++)
      for (let k = 0; k < 8; k++) {
        const off = r % 2 ? 8 : 0;
        const g = x.createLinearGradient(0, r * 16, 0, r * 16 + 16);
        g.addColorStop(0, '#b8603a');
        g.addColorStop(1, '#7c3a22');
        x.fillStyle = g;
        x.fillRect(k * 16 + off - 7, r * 16 + 1, 14, 15);
        x.fillStyle = `rgba(40,20,10,${0.05 + Math.random() * 0.12})`;
        x.fillRect(k * 16 + off - 7, r * 16 + 1, 14, 15);
      }
    return c;
  });
}

export interface HullOpts {
  L: number;
  B: number;
  /** tinggi geladak di atas lunas */
  D: number;
  /** kedalaman garis air dari lunas */
  T: number;
  /** warna lambung, garis air (boot-top), dan bawah air */
  top: number;
  boot?: number;
  bottom?: number;
  /** garis hias sejajar geladak (opsional) */
  stripe?: number;
  /** 0..1: seberapa runcing haluan (besar = ramping) */
  fine?: number;
  /** lebar buritan relatif (0 = runcing seperti perahu, 1 = buritan transom penuh) */
  transom?: number;
  /** kenaikan geladak di haluan (sheer) relatif D */
  sheer?: number;
  /** penampang: 1 = membulat (kapal niaga), 0.3 = V tajam (speedboat) */
  round?: number;
}

/**
 * Lambung kapal hasil loft: penampang U/V yang menyempit ke haluan,
 * dengan garis lengkung geladak, cat antifouling di bawah air, dan geladak tertutup.
 * Titik asal: tengah kapal, y = 0 di lunas. Sumbu +x = haluan.
 */
export function loftHull(o: HullOpts): THREE.BufferGeometry {
  const NS = 22;
  const NK = 9;
  const fine = o.fine ?? 0.5;
  const tr = o.transom ?? 0.8;
  const sheer = o.sheer ?? 0.12;
  const round = o.round ?? 1;
  const cTop = new THREE.Color(o.top);
  const cBoot = new THREE.Color(o.boot ?? 0x1c1d20);
  const cBot = new THREE.Color(o.bottom ?? 0x8e2f25);
  const cStr = o.stripe !== undefined ? new THREE.Color(o.stripe) : null;
  const halfB = (s: number) => {
    // s: 0 buritan .. 1 haluan
    const bow = s > 0.55 ? Math.pow(Math.max(0, 1 - (s - 0.55) / 0.45), 0.5 + fine) : 1;
    const stern = s < 0.12 ? tr + (1 - tr) * Math.sin((s / 0.12) * Math.PI * 0.5) : 1;
    return (o.B / 2) * bow * stern;
  };
  const keelY = (s: number) => (s > 0.7 ? o.T * 0.9 * Math.pow((s - 0.7) / 0.3, 2) : 0);
  const deckY = (s: number) => o.D * (1 + sheer * Math.pow(Math.max(0, s - 0.45) / 0.55, 2));
  const ring: THREE.Vector3[][] = [];
  for (let i = 0; i <= NS; i++) {
    const s = i / NS;
    const x = (s - 0.5) * o.L;
    const hb = halfB(s);
    const ky = keelY(s);
    const dy = deckY(s);
    const pts: THREE.Vector3[] = [];
    for (let k = -NK; k <= NK; k++) {
      const u = Math.abs(k) / NK;
      const lat = hb * Math.pow(Math.sin((u * Math.PI) / 2), round * 0.55 + 0.15);
      // sedikit melebar ke atas (flare)
      const y = ky + (dy - ky) * Math.pow(u, 1.25 + (1 - round) * 0.4);
      pts.push(new THREE.Vector3(x, y, Math.sign(k) * lat * (0.94 + 0.06 * u)));
    }
    ring.push(pts);
  }
  const pos: number[] = [];
  const col: number[] = [];
  const colorAt = (y: number, s: number) => {
    const wl = o.T;
    if (y < wl - 1.2) return cBot;
    if (y < wl + 1.6) return cBoot;
    if (cStr) {
      const dy = deckY(s);
      if (y > dy - o.D * 0.16 && y < dy - o.D * 0.08) return cStr;
    }
    return cTop;
  };
  const tri = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    sa: number,
    sb: number,
    sc: number,
  ) => {
    for (const [p, s] of [
      [a, sa],
      [b, sb],
      [c, sc],
    ] as [THREE.Vector3, number][]) {
      pos.push(p.x, p.y, p.z);
      const cc = colorAt(p.y, s);
      col.push(cc.r, cc.g, cc.b);
    }
  };
  for (let i = 0; i < NS; i++) {
    const A = ring[i]!;
    const B = ring[i + 1]!;
    const sa = i / NS;
    const sb = (i + 1) / NS;
    for (let k = 0; k < A.length - 1; k++) {
      tri(A[k]!, B[k + 1]!, A[k + 1]!, sa, sb, sa);
      tri(A[k]!, B[k]!, B[k + 1]!, sa, sb, sb);
    }
  }
  // buritan (transom)
  const S = ring[0]!;
  const sc = new THREE.Vector3(S[0]!.x, (S[0]!.y + S[NK]!.y) / 2, 0);
  for (let k = 0; k < S.length - 1; k++) tri(sc, S[k]!, S[k + 1]!, 0, 0, 0);
  tri(sc, S[S.length - 1]!, S[0]!, 0, 0, 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/** Geladak datar mengikuti tepi lambung. */
export function hullDeck(o: HullOpts, inset = 1.5): THREE.BufferGeometry {
  const NS = 22;
  const fine = o.fine ?? 0.5;
  const tr = o.transom ?? 0.8;
  const sheer = o.sheer ?? 0.12;
  const shape = new THREE.Shape();
  const pts: [number, number][] = [];
  for (let i = 0; i <= NS; i++) {
    const s = i / NS;
    const bow = s > 0.55 ? Math.pow(Math.max(0, 1 - (s - 0.55) / 0.45), 0.5 + fine) : 1;
    const stern = s < 0.12 ? tr + (1 - tr) * Math.sin((s / 0.12) * Math.PI * 0.5) : 1;
    pts.push([(s - 0.5) * o.L, Math.max(0, (o.B / 2) * bow * stern - inset)]);
  }
  pts.forEach(([x, z], i) => (i ? shape.lineTo(x, z) : shape.moveTo(x, z)));
  for (let i = pts.length - 1; i >= 0; i--) shape.lineTo(pts[i]![0], -pts[i]![1]);
  const g = new THREE.ShapeGeometry(shape);
  g.rotateX(Math.PI / 2);
  // ikuti kenaikan sheer
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const s = p.getX(i) / o.L + 0.5;
    p.setY(i, o.D * (1 + sheer * Math.pow(Math.max(0, s - 0.45) / 0.55, 2)) - 0.6);
  }
  g.computeVertexNormals();
  return g;
}

/** Atap pelana (prisma segitiga) w x d, tinggi h, dengan teritis. Bubungan sejajar sumbu x. */
export function gableGeo(
  w: number,
  d: number,
  h: number,
  over = 6,
  ends = false,
): THREE.BufferGeometry {
  const W = w / 2 + over;
  const D = d / 2 + over;
  const v = [
    // dua sisi miring
    [-W, 0, -D, W, 0, -D, W, h, 0, -W, h, 0],
    [W, 0, D, -W, 0, D, -W, h, 0, W, h, 0],
  ];
  const pos: number[] = [];
  const uv: number[] = [];
  for (const q of v) {
    const P = [0, 1, 2, 0, 2, 3];
    const U = [
      [0, 0],
      [w / 40, 0],
      [w / 40, d / 60],
      [0, d / 60],
    ];
    for (const i of P) {
      pos.push(q[i * 3]!, q[i * 3 + 1]!, q[i * 3 + 2]!);
      uv.push(U[i]![0]!, U[i]![1]!);
    }
  }
  // segitiga ujung (gevel) sedikit masuk
  const gw = w / 2;
  const gd = d / 2;
  for (const sx of ends ? [-1, 1] : []) {
    const a = [sx * gw, 0, -gd];
    const b = [sx * gw, 0, gd];
    const c = [sx * gw, h, 0];
    const tri = sx > 0 ? [a, c, b] : [a, b, c];
    for (const p of tri) {
      pos.push(p[0]!, p[1]!, p[2]!);
      uv.push(0, 0);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}
