/**
 * Petak papan: potongan zig-zag yang saling menempel, label kanvas, bangunan milik pemain,
 * gerbang Titik Nol, serta label wilayah/provinsi.
 */
import * as THREE from 'three';
import { assetUrl } from '../assetUrl';
import { PAWNS, PROV, PROVINCES, REGIONS, SPECIAL, TILES, cityOf } from '../engine/board';
import { cityPrice, fmtMoney, rentOf } from '../engine/rules';
import type { GameState, SpecialKind } from '../engine/types';
import { ANG, G, MID, PATH, PITCH, POS, REGTILES, TILE_H, type V2 } from './layout';
import { WATER_Y } from './world';
import { facadeTex, gableGeo, tileTex } from './texkit';
import {
  BODY_FONT,
  DISP_FONT,
  MANIFEST,
  TAU,
  canvas2d,
  cityIcon,
  drawInitials,
  loadImg,
  provColor,
} from './util';

const N_T = TILES.length;
const TL = N_T * PITCH;
const H = TILE_H;

/* ---- titik pada jalur menurut jarak tempuh ---- */
const pcum = [0];
for (let i = 1; i <= PATH.length; i++) {
  const a0 = PATH[i - 1]!;
  const b0 = PATH[i % PATH.length]!;
  pcum.push(pcum[i - 1]! + Math.hypot(b0[0] - a0[0], b0[1] - a0[1]));
}
const PSC = TL / pcum[pcum.length - 1]!;

export interface PathPt {
  x: number;
  z: number;
  nx: number;
  nz: number;
}
export function cpt(sv: number): PathPt {
  const d = (((sv % TL) + TL) % TL) / PSC;
  let lo = 0;
  let hi = PATH.length;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (pcum[m]! <= d) lo = m;
    else hi = m;
  }
  const a0 = PATH[lo]!;
  const b0 = PATH[(lo + 1) % PATH.length]!;
  const f = (d - pcum[lo]!) / (pcum[lo + 1]! - pcum[lo]! || 1);
  const tx = b0[0] - a0[0];
  const tz = b0[1] - a0[1];
  const l = Math.hypot(tx, tz) || 1;
  return { x: a0[0] + tx * f, z: a0[1] + tz * f, nx: -tz / l, nz: tx / l };
}

const LATS = [-1, -0.5, 0, 0.5, 1];
const SPC: Record<SpecialKind, [number, number]> = {
  NASIB: [0x4a2c7a, 0x6a42a8],
  BENCANA: [0x8f2224, 0xc83a38],
  PAJAK: [0x3a3f4e, 0x626878],
  START: [0xa8213a, 0xe03650],
  JAIL: [0xb26217, 0xee9532],
  PARK: [0x5d3a20, 0x946239],
  RAZIA: [0x1f3f8c, 0x3d6ccc],
};
const CREAM = new THREE.Color(0xf4ead0);
const GRAYED = new THREE.Color(0x8a8f99);

function wrapText(ctx: CanvasRenderingContext2D, txt: string, maxW: number, maxLines: number) {
  const words = txt.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  lines.push(line);
  return lines.slice(0, maxLines);
}

export function textSprite(
  lines: { t: string; font: string; color: string; y: number; stroke?: number }[],
  opts: { w?: number; h?: number; sw: number },
): THREE.Sprite {
  const W = opts.w || 512;
  const Hh = opts.h || 128;
  const { c, x } = canvas2d(W, Hh);
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  lines.forEach((ln) => {
    x.font = ln.font;
    x.lineJoin = 'round';
    x.lineWidth = ln.stroke || 10;
    x.strokeStyle = 'rgba(8,20,30,.85)';
    x.strokeText(ln.t, W / 2, ln.y);
    x.fillStyle = ln.color;
    x.fillText(ln.t, W / 2, ln.y);
  });
  const t = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: true }),
  );
  s.scale.set(opts.sw, (opts.sw * Hh) / W, 1);
  return s;
}

export interface TilesOpts {
  root: THREE.Group;
  rnd: () => number;
  maxAniso: number;
  /** ukuran kanvas label petak (px); koordinat gambar tetap 256 */
  labelSize: number;
  getState: () => GameState | null;
}

export class Tiles {
  /** pusat tiap petak (x,z) */
  readonly TC: V2[] = [];
  readonly pickables: THREE.Mesh[] = [];
  private readonly cuts: { s: number; d: number[] }[] = [];
  private readonly tiles: { imat: THREE.MeshStandardMaterial }[] = [];
  private readonly labels: { cv: HTMLCanvasElement; tex: THREE.CanvasTexture }[] = [];
  readonly marks: (THREE.Group | null)[] = [];
  /** pemilik:level yang sedang digambar per petak */
  private readonly markKey: string[] = [];
  private readonly labelKeys: string[] = [];
  private labelSize = 512;
  private readonly atl: Record<string, HTMLImageElement> = {};
  private readonly specIm: Record<string, HTMLImageElement> = {};
  private readonly root: THREE.Group;
  private readonly getState: () => GameState | null;

  constructor(o: TilesOpts) {
    this.root = o.root;
    this.getState = o.getState;
    const relabel = () => this.relabel();
    MANIFEST.cityHave.forEach((L) => {
      this.atl[L] = loadImg(assetUrl(`cities/c${L}.webp`), relabel);
    });
    Object.entries(MANIFEST.specIdx).forEach(([k, i]) => {
      this.specIm[k] = loadImg(assetUrl(`spec/k${i}.webp`), relabel);
    });
    for (let i = 0; i < N_T; i++) {
      const sk = (o.rnd() - 0.5) * 0.44 * PITCH;
      const jt = (o.rnd() - 0.5) * 0.24 * PITCH;
      this.cuts.push({
        s: (i - 0.5) * PITCH + jt,
        d: LATS.map((t, k) => sk * t + (k === 0 || k === 4 ? 0 : (o.rnd() - 0.5) * 0.14 * PITCH)),
      });
    }
    this.labelSize = o.labelSize;
    this.makeTiles(o.maxAniso);
    this.addLabels();
  }

  private cutPts(ci: number): V2[] {
    const c = this.cuts[ci % N_T]!;
    const wrap = ci >= N_T ? TL : 0;
    return c.d
      .map((d) => cpt(c.s + wrap + d))
      .map((q, k) => [q.x + (q.nx * LATS[k]! * H) / 2, q.z + (q.nz * LATS[k]! * H) / 2] as V2);
  }

  private tilePoly(i: number): V2[] {
    const c0 = this.cuts[i]!;
    const c1 = this.cuts[(i + 1) % N_T]!;
    const w1 = i + 1 >= N_T ? TL : 0;
    const poly = this.cutPts(i).slice();
    const sa = c0.s + c0.d[4]!;
    const sb = c1.s + w1 + c1.d[4]!;
    for (let k = 1; k <= 6; k++) {
      const q = cpt(sa + ((sb - sa) * k) / 7);
      poly.push([q.x + (q.nx * H) / 2, q.z + (q.nz * H) / 2]);
    }
    this.cutPts(i + 1)
      .reverse()
      .forEach((q) => poly.push(q));
    const sc = c0.s + c0.d[0]!;
    const sd = c1.s + w1 + c1.d[0]!;
    for (let k = 6; k >= 1; k--) {
      const q = cpt(sc + ((sd - sc) * k) / 7);
      poly.push([q.x - (q.nx * H) / 2, q.z - (q.nz * H) / 2]);
    }
    return poly;
  }

  /** Kunci isi label: label hanya digambar ulang (dan diunggah ke GPU) jika kuncinya berubah. */
  private labelKey(i: number): string {
    const T = TILES[i]!;
    if (T.t !== 'city') return `sp:${this.specIm[T.k]?.naturalWidth ? 1 : 0}`;
    const s = this.getState();
    const o = s?.owners[i] ?? null;
    const ic = cityIcon(T.p, T.ci);
    const atlas = ic ? (this.atl[ic.L]?.naturalWidth ? 1 : 0) : 2;
    return o && s ? `${o.p}:${o.lv}:${o.m ? 'g' : rentOf(s, i)}:${atlas}` : `-:${atlas}`;
  }

  private drawLabel(i: number, force = false): void {
    const T = TILES[i]!;
    const L0 = this.labels[i];
    if (!L0) return;
    const key = this.labelKey(i);
    if (!force && this.labelKeys[i] === key) return;
    this.labelKeys[i] = key;
    const ctx = L0.cv.getContext('2d');
    if (!ctx) return;
    const k = this.labelSize / 256;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, 256, 256);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (T.t === 'city') {
      const s = this.getState();
      const o = s?.owners[i] ?? null;
      const info = cityOf(i)!;
      ctx.fillStyle = 'rgba(20,30,50,.72)';
      ctx.font = `800 20px ${BODY_FONT}`;
      ctx.fillText(`${info.prov.code} · ${T.ci + 1}/5`, 128, 22);
      const ic = cityIcon(T.p, T.ci);
      const at = ic && this.atl[ic.L];
      if (ic) {
        if (at && at.naturalWidth)
          ctx.drawImage(at, ic.col * 256, ic.row * 256, 256, 256, 66, 32, 124, 124);
      } else drawInitials(ctx, 128, 94, 52, info.name, provColor(info.prov.hue));
      ctx.fillStyle = '#1d2338';
      ctx.font = `800 26px ${BODY_FONT}`;
      const lines = wrapText(ctx, info.name, 206, 2);
      lines.forEach((l, k) => ctx.fillText(l, 128, (lines.length > 1 ? 156 : 168) + k * 29));
      ctx.font = `800 27px ${BODY_FONT}`;
      if (o?.m) {
        ctx.fillStyle = '#b3263a';
        ctx.fillText('TERGADAI', 128, 232);
      } else {
        ctx.fillStyle = o ? '#1d2338' : '#6a4f12';
        const amount = o && s ? rentOf(s, i) : cityPrice(info.prov);
        ctx.fillText((o ? 'Sewa ' : '') + fmtMoney(amount), 128, 232);
      }
    } else {
      const sp = SPECIAL.find((x) => x.k === T.k)!;
      ctx.fillStyle = '#fff';
      const si = this.specIm[T.k];
      if (si && si.naturalWidth) {
        const k = Math.min(124 / si.naturalWidth, 124 / si.naturalHeight);
        const w = si.naturalWidth * k;
        const h = si.naturalHeight * k;
        ctx.drawImage(si, 128 - w / 2, 96 - h / 2, w, h);
      }
      ctx.font = `400 29px ${DISP_FONT}`;
      ctx.shadowColor = 'rgba(0,0,0,.45)';
      ctx.shadowBlur = 4;
      const nm = T.k === 'START' ? 'TITIK NOL ➜' : sp.label;
      const lines = wrapText(ctx, nm, 206, 2);
      lines.forEach((l, k) => ctx.fillText(l, 128, (lines.length > 1 ? 184 : 196) + k * 32));
      ctx.shadowBlur = 0;
    }
    L0.tex.needsUpdate = true;
  }

  /** Gambar ulang semua label (font atau atlas selesai dimuat). */
  relabel(): void {
    TILES.forEach((_, i) => this.drawLabel(i, true));
  }

  private makeTiles(maxAniso: number): void {
    const outerMats: Record<string, THREE.MeshStandardMaterial> = {};
    const labelGeo = new THREE.PlaneGeometry(310, 310);
    labelGeo.rotateX(-Math.PI / 2);
    const shapeOf = (poly: V2[]) => {
      const sh = new THREE.Shape();
      poly.forEach((p, k) => (k ? sh.lineTo(p[0], -p[1]) : sh.moveTo(p[0], -p[1])));
      sh.closePath();
      return sh;
    };
    const shrink = (poly: V2[], inset: number): V2[] => {
      const cx = poly.reduce((u, q) => u + q[0], 0) / poly.length;
      const cz = poly.reduce((u, q) => u + q[1], 0) / poly.length;
      const av = poly.reduce((u, q) => u + Math.hypot(q[0] - cx, q[1] - cz), 0) / poly.length;
      const f = 1 - inset / av;
      return poly.map((q) => [cx + (q[0] - cx) * f, cz + (q[1] - cz) * f]);
    };
    TILES.forEach((T, i) => {
      const poly = this.tilePoly(i);
      const cx = poly.reduce((u, q) => u + q[0], 0) / poly.length;
      const cz = poly.reduce((u, q) => u + q[1], 0) / poly.length;
      this.TC[i] = [cx, cz];
      let outer: THREE.MeshStandardMaterial;
      let innerC: THREE.Color;
      if (T.t === 'city') {
        const pr = PROV[T.p]!;
        outer = outerMats[T.p] ??= new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(pr.hue / 360, 0.6, 0.4),
          roughness: 0.6,
        });
        innerC = CREAM.clone();
      } else {
        outer = new THREE.MeshStandardMaterial({ color: SPC[T.k][0], roughness: 0.6 });
        innerC = new THREE.Color(SPC[T.k][1]);
      }
      const g = new THREE.Group();
      g.position.set(0, 2, 0);
      const og = new THREE.ExtrudeGeometry(shapeOf(poly), { depth: 10, bevelEnabled: false });
      og.rotateX(-Math.PI / 2);
      const om = new THREE.Mesh(og, outer);
      om.receiveShadow = true;
      om.userData.i = i;
      g.add(om);
      const imat = new THREE.MeshStandardMaterial({
        color: innerC,
        roughness: 0.75,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      const ig = new THREE.ShapeGeometry(shapeOf(shrink(poly, 26)));
      ig.rotateX(-Math.PI / 2);
      const im = new THREE.Mesh(ig, imat);
      im.position.y = 10.2;
      im.receiveShadow = true;
      im.userData.i = i;
      g.add(im);
      this.root.add(g);
      this.pickables.push(om, im);
      const { c: cvs } = canvas2d(this.labelSize);
      const tex = new THREE.CanvasTexture(cvs);
      tex.anisotropy = Math.min(8, maxAniso);
      const lm = new THREE.Mesh(
        labelGeo,
        new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        }),
      );
      lm.position.set(cx, 12.6, cz);
      this.root.add(lm);
      this.tiles[i] = { imat };
      this.labels[i] = { cv: cvs, tex };
      this.marks[i] = null;
      this.drawLabel(i);
    });
    this.makeGate();
  }

  /** gerbang Titik Nol */
  private makeGate(): void {
    const q = POS[0]!;
    const a = (ANG[0]! * Math.PI) / 180;
    const gate = new THREE.Group();
    gate.position.set(q[0], 12, q[1]);
    gate.rotation.y = -a;
    gate.scale.setScalar(0.65 * G);
    const red = new THREE.MeshStandardMaterial({ color: 0xd8304a, roughness: 0.5 });
    const gold = new THREE.MeshStandardMaterial({
      color: 0xf2b632,
      roughness: 0.4,
      metalness: 0.3,
    });
    [-84, 84].forEach((z) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(16, 170, 16), red);
      p.position.set(-26, 85, z);
      p.castShadow = true;
      gate.add(p);
    });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(34, 20, 196), red);
    beam.position.set(-26, 172, 0);
    beam.castShadow = true;
    gate.add(beam);
    const top = new THREE.Mesh(new THREE.BoxGeometry(44, 8, 214), gold);
    top.position.set(-26, 188, 0);
    top.castShadow = true;
    gate.add(top);
    const sign = textSprite(
      [{ t: 'TITIK NOL', font: `400 78px ${DISP_FONT}`, color: '#f6ecd6', y: 64, stroke: 14 }],
      { w: 512, h: 128, sw: 230 },
    );
    sign.position.set(-26, 244, 0);
    gate.add(sign);
    this.root.add(gate);
  }

  private badgeSprite(color: string, size: number, tile: number): THREE.Sprite {
    const { c, x } = canvas2d(128);
    x.beginPath();
    x.arc(64, 64, 58, 0, TAU);
    x.fillStyle = '#fffaf0';
    x.fill();
    x.lineWidth = 9;
    x.strokeStyle = color;
    x.stroke();
    const T = TILES[tile];
    if (T && T.t === 'city') {
      const ic = cityIcon(T.p, T.ci);
      const at = ic && this.atl[ic.L];
      if (ic) {
        if (at && at.naturalWidth)
          x.drawImage(at, ic.col * 256, ic.row * 256, 256, 256, 14, 14, 100, 100);
      } else {
        const info = cityOf(tile)!;
        drawInitials(x, 64, 64, 46, info.name, provColor(info.prov.hue));
      }
    }
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(c),
        transparent: true,
        depthWrite: false,
      }),
    );
    s.scale.set(size, size, 1);
    return s;
  }

  /* ---- bangunan milik pemain ---- */
  /** front: arah z lokal yang menghadap jalan (+1 / -1) */
  private makeBuilding(lv: number, oc: string, tile: number, front = -1): THREE.Group {
    const g = new THREE.Group();
    const own = new THREE.Color(oc);
    const F = front;
    const add = (
      geo: THREE.BufferGeometry,
      mat: THREE.Material | THREE.Material[],
      x: number,
      y: number,
      z: number,
      ry?: number,
    ) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      if (ry) m.rotation.y = ry;
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      return m;
    };
    const std = (c: number | THREE.Color, r = 0.75, o: THREE.MeshStandardMaterialParameters = {}) =>
      new THREE.MeshStandardMaterial({ color: c, roughness: r, ...o });
    /** material bertekstur fasad, diulang rx x ry */
    const fac = (kind: Parameters<typeof facadeTex>[0], rx: number, ry: number, o = {}) => {
      const t = facadeTex(kind).clone();
      t.needsUpdate = true;
      t.repeat.set(rx, ry);
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, ...o });
    };
    const concrete = std(0xcfc9bd, 0.9);
    const trim = std(own, 0.55);
    let top: number;
    if (lv === 0) {
      // rumah tinggal: dinding plester, atap genteng pelana, teras bertiang
      const W = 54;
      const D = 40;
      const H = 28;
      add(new THREE.BoxGeometry(W + 6, 4, D + 6), concrete, 0, 2, 0);
      const wallTex = fac('house', 1, 1);
      const wallSide = std(0xefe6d2, 0.9);
      add(
        new THREE.BoxGeometry(W, H, D),
        [wallSide, wallSide, wallSide, wallSide, wallTex, wallTex],
        0,
        4 + H / 2,
        0,
      );
      const gev = new THREE.Mesh(gableGeo(W, D, 18, 0, true), wallSide);
      gev.position.set(0, 4 + H, 0);
      g.add(gev);
      const rt = tileTex().clone();
      rt.needsUpdate = true;
      const roof = new THREE.MeshStandardMaterial({
        map: rt,
        roughness: 0.8,
        side: THREE.DoubleSide,
      });
      add(gableGeo(W, D, 19, 7), roof, 0, 4 + H + 0.8, 0);
      add(new THREE.BoxGeometry(W + 14, 2, 2), std(0x7a3a22), 0, 4 + H + 20, 0);
      // pintu dan kusen berwarna pemilik
      add(new THREE.BoxGeometry(12, 20, 1.2), trim, 0, 14, F * (D / 2 + 0.7));
      add(new THREE.BoxGeometry(14, 2, 1.6), std(0x6b4a2e), 0, 25, F * (D / 2 + 0.8));
      // teras: lantai, dua tiang, atap kecil
      add(new THREE.BoxGeometry(34, 2, 14), concrete, 0, 5, F * (D / 2 + 7));
      [-14, 14].forEach((x) =>
        add(new THREE.CylinderGeometry(1.4, 1.4, 22, 8), std(0xf4efe4), x, 15, F * (D / 2 + 12)),
      );
      const pr = add(new THREE.BoxGeometry(40, 2, 18), roof, 0, 27, F * (D / 2 + 8));
      pr.rotation.x = F * 0.22;
      // pagar rendah dan tanaman pot
      for (let k = -3; k <= 3; k++)
        if (k) add(new THREE.BoxGeometry(1.4, 8, 1.4), std(0xf4efe4), k * 8, 6, F * (D / 2 + 22));
      add(new THREE.BoxGeometry(50, 1.4, 1.4), std(0xf4efe4), 0, 9, F * (D / 2 + 22));
      add(new THREE.SphereGeometry(5, 8, 6), std(0x3f7a36, 0.9), -26, 8, F * (D / 2 + 16));
      add(new THREE.SphereGeometry(5, 8, 6), std(0x3f7a36, 0.9), 26, 8, F * (D / 2 + 16));
      top = 54;
    } else if (lv === 1) {
      // ruko dua lantai: deret toko dengan kanopi warna pemilik dan toren air di atap
      const W = 88;
      const D = 50;
      const H = 46;
      add(new THREE.BoxGeometry(W + 4, 3, D + 4), concrete, 0, 1.5, 0);
      const front = fac('ruko', 2, 1);
      const side = std(0xe6dcc6, 0.9);
      const mats = [side, side, side, side, front, front];
      add(new THREE.BoxGeometry(W, H, D), mats, 0, 3 + H / 2, 0);
      add(new THREE.BoxGeometry(W + 2, 6, D + 2), std(0xd8cfba, 0.85), 0, 3 + H + 3, 0);
      // kanopi toko
      const can = add(new THREE.BoxGeometry(W, 1.6, 12), trim, 0, 26, F * (D / 2 + 5));
      can.rotation.x = F * 0.25;
      for (let k = 0; k < 4; k++)
        add(
          new THREE.BoxGeometry(18, 5, 0.8),
          std(0xffffff, 0.6),
          -33 + k * 22,
          40,
          F * (D / 2 + 0.5),
        );
      // toren air dan kerangka
      add(new THREE.CylinderGeometry(6, 6, 12, 12), std(0x3a6ab8, 0.5), 28, 3 + H + 16, -8);
      add(new THREE.BoxGeometry(16, 6, 16), std(0x777777, 0.8), 28, 3 + H + 7, -8);
      add(new THREE.BoxGeometry(10, 8, 8), std(0xbfbfbf, 0.6), -28, 3 + H + 10, 6);
      top = 72;
    } else if (lv === 2) {
      // gedung kantor: podium lobi kaca, menara beton-kaca, peralatan atap
      add(
        new THREE.BoxGeometry(86, 16, 70),
        fac('glass', 3, 0.5, { metalness: 0.3, roughness: 0.25 }),
        0,
        8,
        0,
      );
      add(new THREE.BoxGeometry(90, 3, 74), concrete, 0, 17.5, 0);
      add(new THREE.BoxGeometry(66, 96, 54), fac('office', 1, 1.3), 0, 19 + 48, 0);
      add(new THREE.BoxGeometry(68, 6, 56), concrete, 0, 19 + 96 + 3, 0);
      // pita logo warna pemilik
      add(new THREE.BoxGeometry(40, 8, 1.2), trim, 0, 19 + 88, F * 27.6);
      // kanopi lobi
      add(new THREE.BoxGeometry(36, 2, 14), concrete, 0, 15, F * 42);
      [-14, 14].forEach((x) =>
        add(
          new THREE.CylinderGeometry(1.2, 1.2, 14, 8),
          std(0xaaaaaa, 0.4, { metalness: 0.6 }),
          x,
          8,
          F * 47,
        ),
      );
      for (let k = 0; k < 3; k++)
        add(new THREE.BoxGeometry(12, 7, 10), std(0xb8b8b8, 0.6), -20 + k * 18, 125, -10);
      add(new THREE.CylinderGeometry(1, 1, 30, 6), std(0xdddddd), 22, 136, 12);
      top = 150;
    } else {
      // pencakar langit: tiga menara kaca bertingkat mundur dengan mahkota dan antena
      const glass = (rx: number, ry: number) =>
        fac('glass', rx, ry, { metalness: 0.45, roughness: 0.18 });
      add(new THREE.BoxGeometry(96, 20, 80), glass(3, 0.6), 0, 10, 0);
      add(new THREE.BoxGeometry(100, 3, 84), concrete, 0, 21.5, 0);
      add(new THREE.BoxGeometry(40, 150, 40), glass(1.2, 4.5), -26, 23 + 75, 10);
      add(new THREE.BoxGeometry(42, 4, 42), concrete, -26, 23 + 152, 10);
      add(new THREE.BoxGeometry(44, 170, 44), glass(1.3, 5), 18, 23 + 85, -12);
      add(new THREE.BoxGeometry(36, 50, 36), glass(1.1, 1.5), 18, 23 + 170 + 25, -12);
      add(new THREE.BoxGeometry(26, 26, 26), glass(0.8, 0.8), 18, 23 + 220 + 13, -12);
      add(new THREE.BoxGeometry(46, 4, 46), trim, 18, 23 + 170 + 2, -12);
      add(
        new THREE.CylinderGeometry(0.8, 2, 46, 6),
        std(0xdddddd, 0.4, { metalness: 0.7 }),
        18,
        23 + 246 + 23,
        -12,
      );
      add(new THREE.BoxGeometry(32, 100, 32), glass(1, 3), 32, 23 + 50, 26);
      add(new THREE.BoxGeometry(34, 4, 34), trim, 32, 23 + 101, 26);
      top = 300;
    }
    add(
      new THREE.CylinderGeometry(1.4, 1.4, 76, 6),
      std(0xe8e8e8, 0.4, { metalness: 0.5 }),
      -50,
      38,
      -F * 30,
    );
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(32, 20, 6, 1),
      new THREE.MeshStandardMaterial({ color: own, side: THREE.DoubleSide, roughness: 0.7 }),
    );
    const fp = flag.geometry.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < fp.count; k++) fp.setZ(k, Math.sin((fp.getX(k) + 16) * 0.2) * 2);
    flag.geometry.computeVertexNormals();
    flag.position.set(-33, 66, -F * 30);
    flag.castShadow = true;
    g.add(flag);
    const b = this.badgeSprite(oc, 58, tile);
    b.position.set(0, top + 44, 0);
    g.add(b);
    return g;
  }

  /** Perbarui warna petak, bangunan, dan label sesuai pemilik. */
  updateTile(i: number): void {
    const T = TILES[i];
    const tile = this.tiles[i];
    if (!T || T.t !== 'city' || !tile) return;
    const s = this.getState();
    const o = s?.owners[i] ?? null;
    const pawn = o && s ? (s.players[o.p]?.pawn ?? o.p) : -1;
    const key = o ? `${pawn}:${o.lv}:${o.m ? 'g' : ''}` : '';
    if (this.markKey[i] === key) {
      this.drawLabel(i);
      return;
    }
    this.markKey[i] = key;
    const old = this.marks[i];
    if (old) {
      this.root.remove(old);
      disposeTree(old);
      this.marks[i] = null;
    }
    if (o && s) {
      const oc = PAWNS[pawn]?.color ?? '#ffffff';
      tile.imat.color.copy(CREAM).lerp(new THREE.Color(oc), 0.55);
      // kota tergadai: petak diredupkan
      if (o.m) tile.imat.color.lerp(GRAYED, 0.6);
      const q = POS[i]!;
      const a = (ANG[i]! * Math.PI) / 180;
      let nx = -Math.sin(a);
      let nz = Math.cos(a);
      // jalan berada di sisi berlawanan dari arah dorong bangunan
      let front = -1;
      if (nx * (q[0] - MID[0]) + nz * (q[1] - MID[1]) < 0) {
        nx = -nx;
        nz = -nz;
        front = 1;
      }
      const b = this.makeBuilding(o.lv, oc, i, front);
      b.position.set(q[0] + nx * 192 * G, 1, q[1] + nz * 192 * G);
      b.rotation.y = -a;
      b.scale.setScalar(0.01);
      b.userData.grow = 0;
      this.root.add(b);
      this.marks[i] = b;
    } else tile.imat.color.copy(CREAM);
    this.drawLabel(i);
  }

  /** animasi bangunan tumbuh */
  step(dt: number): void {
    this.marks.forEach((b) => {
      if (b && b.userData.grow < 1) {
        b.userData.grow = Math.min(1, b.userData.grow + dt * 3);
        const e = 1 - Math.pow(1 - b.userData.grow, 3);
        b.scale.setScalar(Math.max(0.01, e * 1.35 * G));
      }
    });
  }

  /* ---- label wilayah dan provinsi ---- */
  private addLabels(): void {
    const pushToMid = (pts: V2[], push: number): V2 => {
      const cx = pts.reduce((a, q) => a + q[0], 0) / pts.length;
      const cz = pts.reduce((a, q) => a + q[1], 0) / pts.length;
      const dx = MID[0] - cx;
      const dz = MID[1] - cz;
      const len = Math.hypot(dx, dz) || 1;
      const m = Math.min(len, push);
      return [cx + (dx / len) * m, cz + (dz / len) * m];
    };
    const regName = (code: string) => REGIONS.find((r) => r.code === code)?.name ?? code;
    Object.keys(REGTILES).forEach((rg) => {
      const c = pushToMid(
        REGTILES[rg]!.map((i) => POS[i]!),
        1450 * G,
      );
      const { c: cvs, x } = canvas2d(1024, 256);
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.font = `400 150px ${DISP_FONT}`;
      x.fillStyle = 'rgba(255,255,255,.55)';
      x.fillText(regName(rg).toUpperCase(), 512, 128);
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(2200 * G, 550 * G),
        new THREE.MeshBasicMaterial({
          map: new THREE.CanvasTexture(cvs),
          transparent: true,
          depthWrite: false,
          fog: true,
        }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set(c[0], WATER_Y + 26, c[1]);
      m.renderOrder = 2;
      this.root.add(m);
    });
    PROVINCES.forEach((pr) => {
      const c = pushToMid(
        pr.tiles.map((i) => POS[i]!),
        500 * G,
      );
      const col = new THREE.Color().setHSL(pr.hue / 360, 0.75, 0.72).getStyle();
      const s = textSprite(
        [
          {
            t: pr.name.toUpperCase(),
            font: `400 62px ${DISP_FONT}`,
            color: col,
            y: 54,
            stroke: 14,
          },
          {
            t: regName(pr.reg).toUpperCase(),
            font: `800 24px ${BODY_FONT}`,
            color: '#e5f2f7',
            y: 106,
            stroke: 8,
          },
        ],
        { w: 768, h: 140, sw: 640 * G },
      );
      s.position.set(c[0], 90 * G, c[1]);
      this.root.add(s);
    });
  }
}

/** Tekstur yang dipakai bersama (jangan dibuang saat efek selesai). */
const SHARED_TEX = new WeakSet<THREE.Texture>();
export function markShared<T extends THREE.Texture>(t: T): T {
  SHARED_TEX.add(t);
  return t;
}

/** Buang geometri, material, dan tekstur kanvas sementara milik objek beserta anaknya. */
export function disposeTree(o: THREE.Object3D): void {
  o.traverse((n) => {
    const m = n as THREE.Mesh;
    if (m.geometry && !m.geometry.userData.keep) m.geometry.dispose();
    const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [];
    mats.forEach((mt) => {
      const map = (mt as THREE.MeshBasicMaterial).map;
      if (map && map instanceof THREE.CanvasTexture && !SHARED_TEX.has(map)) map.dispose();
      mt.dispose();
    });
  });
}
