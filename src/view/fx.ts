/**
 * Animasi 3D kartu Bencana dan kejadian cuaca. Diportir dari blok "EFEK KARTU" prototipe.
 * Hanya 12 efek Bencana yang dipakai (kartu Nasib tidak punya animasi besar).
 * Tidak ada emoji yang digambar di peta: ikon efek memakai gambar fx/e*.webp.
 */
import * as THREE from 'three';
import { assetUrl } from '../assetUrl';
import { camArrived, type Cam } from './camera';
import { Puffs, buildBolt, funnelR, funnelSway, makeFunnel, makeSmokeTextures } from './fxkit';
import { MID, PITCH, POS, type V2 } from './layout';
import type { Pawns } from './pawns';
import { makeVictim } from './victim';
import { emi } from './pawns';
import type { Sky } from './sky';
import { cpt, disposeTree, markShared } from './tiles';
import { MANIFEST, TAU, canvas2d, ez, loadImg } from './util';
import { ISL, islandH } from './world';

const R = Math.random;
type RGB3 = [number, number, number];

/** Konteks posisi efek: titik petak, normal ke luar, tangen jalur, indeks petak, id pemain. */
export interface FxCtx {
  x: number;
  z: number;
  nx: number;
  nz: number;
  tx: number;
  tz: number;
  i: number;
  pi: number;
}

interface Emitter {
  P: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  spawn(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    c: RGB3,
  ): void;
  step(dt: number, grav?: number, drag?: number): void;
}

interface Knocker {
  pw: THREE.Group | null;
  grab(): void;
  launch(
    vx: number,
    vy: number,
    vz: number,
    sx: number,
    sz: number,
    burn: boolean,
    sm?: Emitter,
  ): void;
  step(dt: number): void;
  end(): void;
}

export interface FxDeps {
  root: THREE.Group;
  stage: HTMLElement;
  cam: Cam;
  pawns: Pawns;
  sky: Sky;
  waterMat: THREE.ShaderMaterial;
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  TC: V2[];
  /** prefers-reduced-motion: redam kilatan layar */
  reducedMotion?: boolean;
}

export const FX_KEYS = [
  'banjir',
  'rob',
  'merapi',
  'gempa',
  'tsunami',
  'kebakaran',
  'longsor',
  'kering',
  'puting',
  'meteor',
  'meteorstorm',
  'petir',
] as const;
export type FxKey = (typeof FX_KEYS)[number];

export class Fx {
  private readonly fxG = new THREE.Group();
  private readonly list: {
    el: number;
    dur: number;
    fn: (p: number, dt: number, el: number) => void;
    res: () => void;
  }[] = [];
  /** penggelapan, kehangatan, cahaya tambahan dari efek */
  readonly fxS = { dim: 1, warm: 0, glow: 0 };
  private readonly ov: HTMLDivElement;
  private ovO = 0;
  private ovBase = 0;
  private readonly tmpC = new THREE.Color();
  private readonly fxTex: THREE.Texture[];
  private readonly dotTex: THREE.CanvasTexture;
  private readonly ringTex: THREE.CanvasTexture;
  private readonly smokeTex: THREE.Texture[];
  private readonly U: Record<string, THREE.IUniform>;

  constructor(private readonly d: FxDeps) {
    d.root.add(this.fxG);
    this.ov = document.createElement('div');
    this.ov.className = 'fxflash';
    d.stage.appendChild(this.ov);
    this.fxTex = MANIFEST.fx.map((_, i) => {
      const t = new THREE.Texture();
      loadImg(assetUrl(`fx/e${i}.webp`), (im) => {
        t.image = im;
        t.needsUpdate = true;
      });
      return t;
    });
    this.dotTex = markShared(
      mkTex((x, s) => {
        const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.35, 'rgba(255,255,255,.55)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g;
        x.fillRect(0, 0, s, s);
      }, 64),
    );
    this.ringTex = markShared(
      mkTex((x, s) => {
        x.strokeStyle = '#fff';
        x.lineWidth = s * 0.07;
        x.beginPath();
        x.arc(s / 2, s / 2, s * 0.44, 0, TAU);
        x.stroke();
      }, 128),
    );
    this.smokeTex = makeSmokeTextures(3);
    this.U = d.waterMat.uniforms;
  }

  /** kolam gumpalan asap (sprite membesar dan memudar) */
  private puffs(n: number, o: { additive?: boolean } = {}): Puffs {
    return new Puffs(this.fxG, this.smokeTex, n, o);
  }

  /* ---------- infrastruktur ---------- */

  flash = (op: number, col?: string): void => {
    if (col) this.ov.style.background = col;
    this.ovO = Math.max(this.ovO, this.d.reducedMotion ? Math.min(op, 0.12) : op);
  };
  private hold(op: number, col?: string): void {
    if (col) this.ov.style.background = col;
    this.ovBase = op;
  }
  private run(dur: number, fn: (p: number, dt: number, el: number) => void): Promise<void> {
    return new Promise((res) => this.list.push({ el: 0, dur, fn, res }));
  }

  update(dt: number): void {
    for (let k = this.list.length - 1; k >= 0; k--) {
      const f = this.list[k]!;
      f.el += dt;
      const p = Math.min(1, f.el / f.dur);
      f.fn(p, dt, f.el);
      if (f.el >= f.dur) {
        this.list.splice(k, 1);
        f.res();
      }
    }
    this.ovO += (this.ovBase - this.ovO) * (1 - Math.exp(-dt * 5));
    this.ov.style.opacity = this.ovO.toFixed(3);
    const { hemi, sun, sky, cam } = this.d;
    const W = sky.W;
    const fxS = this.fxS;
    const wm = Math.min(1, W.warm + fxS.warm);
    hemi.intensity = 0.78 * fxS.dim * W.hemi + fxS.glow * 0.35;
    sun.intensity = 1.05 * fxS.dim * W.sun * (1 + 0.35 * fxS.warm) + fxS.glow * 0.5;
    sun.color.setRGB(1, 0.945 - 0.3 * wm, 0.82 - 0.45 * wm);
    hemi.color.setHex(0xd6ecff).lerp(this.tmpC.setHex(0xe8d2b0), W.warm);
    if (cam.shake > 0.5) cam.shake *= Math.exp(-dt * 2.6);
    else cam.shake = 0;
  }

  /** Buang semua objek efek dan kembalikan keadaan normal. */
  clear(): void {
    const fxG = this.fxG;
    while (fxG.children.length) {
      const o = fxG.children[0]!;
      fxG.remove(o);
      disposeTree(o);
    }
    this.fxS.dim = 1;
    this.fxS.warm = 0;
    this.fxS.glow = 0;
    this.ovBase = 0;
    this.d.root.position.set(0, 0, 0);
    this.d.pawns.resetFx();
    (this.U.uFl!.value as THREE.Vector4).w = 0;
    (this.U.uWa!.value as THREE.Vector2).x = 0;
    (this.U.uMud!.value as THREE.Vector4).w = 0;
    this.d.cam.ty = 0;
    this.d.cam.rate = 5;
  }

  /** gambar ikon efek (bukan emoji). Kunci emoji hanya pengenal di manifest. */
  private emo(e: string, size: number, op = 1): THREE.Sprite {
    const fi = MANIFEST.fxIdx[e];
    const m = fi != null ? MANIFEST.fx[fi] : undefined;
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: fi != null ? this.fxTex[fi]! : null,
        transparent: true,
        depthWrite: false,
        opacity: op,
      }),
    );
    if (fi == null || !m) s.visible = false;
    else {
      const k = Math.max(m[0], m[1]);
      s.scale.set((size * m[0]) / k, (size * m[1]) / k, 1);
    }
    this.fxG.add(s);
    return s;
  }
  private glow(col: number, size: number, op = 1): THREE.Sprite {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.dotTex,
        color: col,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: op,
      }),
    );
    s.scale.set(size, size, 1);
    this.fxG.add(s);
    return s;
  }
  private ringSp(col: number, op = 1): THREE.Sprite {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.ringTex,
        color: col,
        transparent: true,
        depthWrite: false,
        opacity: op,
      }),
    );
    this.fxG.add(s);
    return s;
  }
  private mk<G extends THREE.BufferGeometry>(
    geo: G,
    col: number,
    o?: THREE.MeshStandardMaterialParameters,
  ): THREE.Mesh<G, THREE.MeshStandardMaterial> {
    const m = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.7, ...o }),
    );
    m.castShadow = true;
    this.fxG.add(m);
    return m;
  }
  private lite(
    col: number,
    I: number,
    dist: number,
    x: number,
    y: number,
    z: number,
  ): THREE.PointLight {
    const l = new THREE.PointLight(col, I, dist);
    l.position.set(x, y, z);
    this.fxG.add(l);
    return l;
  }
  private rock(r: number) {
    return this.mk(new THREE.DodecahedronGeometry(r, 0), 0x6e655c, {
      roughness: 1,
    });
  }
  private lineSeg(color: number, opacity = 1) {
    const l = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
    );
    this.fxG.add(l);
    return l;
  }

  private emitter(n: number, o: { size?: number; additive?: boolean; opacity?: number }): Emitter {
    const g = new THREE.BufferGeometry();
    const pa = new Float32Array(n * 3).fill(-9999);
    const ca = new Float32Array(n * 3);
    g.setAttribute('position', new THREE.BufferAttribute(pa, 3));
    g.setAttribute('color', new THREE.BufferAttribute(ca, 3));
    const add = o.additive !== false;
    const P = new THREE.Points(
      g,
      new THREE.PointsMaterial({
        map: this.dotTex,
        size: o.size || 40,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: o.opacity ?? 1,
        depthWrite: false,
        blending: add ? THREE.AdditiveBlending : THREE.NormalBlending,
      }),
    );
    P.frustumCulled = false;
    this.fxG.add(P);
    interface Part {
      on: boolean;
      x: number;
      y: number;
      z: number;
      vx: number;
      vy: number;
      vz: number;
      l: number;
      a: number;
      c: RGB3;
    }
    const ps: Part[] = [];
    for (let i = 0; i < n; i++)
      ps.push({
        on: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        l: 1,
        a: 0,
        c: [1, 1, 1],
      });
    let cu = 0;
    return {
      P,
      spawn(x, y, z, vx, vy, vz, life, c) {
        const q = ps[cu]!;
        cu = (cu + 1) % n;
        Object.assign(q, { x, y, z, vx, vy, vz, l: life, a: 0, c, on: true });
      },
      step(dt, grav = 0, drag = 0) {
        const dg = Math.exp(-drag * dt);
        for (let i = 0; i < n; i++) {
          const q = ps[i]!;
          if (!q.on) continue;
          q.a += dt;
          if (q.a >= q.l) {
            q.on = false;
            pa[i * 3 + 1] = -9999;
            continue;
          }
          q.vy -= grav * dt;
          q.vx *= dg;
          q.vz *= dg;
          q.x += q.vx * dt;
          q.y += q.vy * dt;
          q.z += q.vz * dt;
          const f = 1 - q.a / q.l;
          pa[i * 3] = q.x;
          pa[i * 3 + 1] = q.y;
          pa[i * 3 + 2] = q.z;
          if (add) {
            ca[i * 3] = q.c[0] * f;
            ca[i * 3 + 1] = q.c[1] * f;
            ca[i * 3 + 2] = q.c[2] * f;
          } else {
            ca[i * 3] = q.c[0] * f + 0.8 * (1 - f);
            ca[i * 3 + 1] = q.c[1] * f + 0.9 * (1 - f);
            ca[i * 3 + 2] = q.c[2] * f + 0.95 * (1 - f);
          }
        }
        (g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        (g.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      },
    };
  }

  /** Bidak terpental, berguling, lalu bangkit lagi (opsional gosong). */
  private knocker(C: FxCtx): Knocker {
    const pw = this.d.pawns.list[C.pi] ?? null;
    const pmat = this.d.pawns.ctlMat(C.pi);
    if (!pw || !pmat) return { pw: null, grab() {}, launch() {}, step() {}, end() {} };
    const cam = this.d.cam;
    const porig = new THREE.Color(0xffffff);
    const th = {
      on: false,
      ph: 0,
      b: 0,
      t2: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      sx: 0,
      sz: 0,
      burn: false,
      sm: null as Emitter | null,
    };
    const reset = () => {
      th.on = false;
      pw.userData.fx = false;
      pw.rotation.set(0, 0, 0);
      pmat.color.copy(porig);
      emi(pmat).setRGB(0, 0, 0);
    };
    return {
      pw,
      grab() {
        th.on = false;
        pw.userData.fx = true;
      },
      launch(vx, vy, vz, sx, sz, burn, sm) {
        Object.assign(th, {
          on: true,
          ph: 0,
          b: 0,
          t2: 0,
          vx,
          vy,
          vz,
          sx,
          sz,
          burn: !!burn,
          sm: sm ?? null,
        });
        pw.userData.fx = true;
        if (burn) {
          pmat.color.setHex(0x151515);
          emi(pmat).setRGB(0.5, 0.14, 0);
        }
      },
      step(dt) {
        if (!th.on) return;
        if (th.ph === 0) {
          th.vy -= 1500 * dt;
          pw.position.x += th.vx * dt;
          pw.position.y += th.vy * dt;
          pw.position.z += th.vz * dt;
          pw.rotation.x += th.sx * dt;
          pw.rotation.z += th.sz * dt;
          if (th.burn && th.sm && Math.random() < 0.7)
            th.sm.spawn(
              pw.position.x,
              pw.position.y + 30,
              pw.position.z,
              (R() - 0.5) * 40,
              60,
              (R() - 0.5) * 40,
              1.2,
              [0.12, 0.11, 0.1],
            );
          if (pw.position.y < 13) {
            pw.position.y = 13;
            if (th.vy < -300 && th.b < 3) {
              th.vy *= -0.5;
              th.vx *= 0.6;
              th.vz *= 0.6;
              th.sx *= 0.6;
              th.sz *= 0.6;
              th.b++;
              cam.shake = Math.max(cam.shake, 22);
            } else {
              th.ph = 1;
              th.t2 = 0;
              th.vy = 0;
            }
          }
        } else {
          th.t2 += dt;
          if (th.t2 < 0.5) {
            pw.position.x += th.vx * dt;
            pw.position.z += th.vz * dt;
            th.vx *= 0.9;
            th.vz *= 0.9;
          }
          const lie = ez(Math.min(1, th.t2 / 0.4));
          const up = th.t2 > 1.1 ? ez(Math.min(1, (th.t2 - 1.1) / 0.8)) : 0;
          pw.rotation.x = 0;
          pw.rotation.z = 1.45 * lie * (1 - up);
          if (th.burn) {
            const back = Math.max(0, Math.min(1, (th.t2 - 1.3) / 0.9));
            pmat.color.copy(new THREE.Color(0x151515).lerp(porig, back));
            const on = th.t2 < 1 ? 1 : 0;
            emi(pmat).setRGB(0.4 * (1 - back) * on, 0.1 * (1 - back) * on, 0);
            if (th.sm && th.t2 > 0.3 && th.t2 < 1.9 && Math.random() < 0.5)
              th.sm.spawn(
                pw.position.x + (R() - 0.5) * 30,
                50,
                pw.position.z + (R() - 0.5) * 30,
                (R() - 0.5) * 20,
                100,
                (R() - 0.5) * 20,
                1.5,
                [0.14, 0.13, 0.12],
              );
          }
          if (th.t2 > 2.2) reset();
        }
      },
      end: reset,
    };
  }

  /* ---------- pemutar ---------- */

  /** Putar satu efek di petak `tile` untuk pemain `pi`. Kamera kembali seperti semula sesudahnya. */
  async play(key: string, tile: number, pi: number): Promise<void> {
    const f = this.effect(key as FxKey);
    if (!f) return;
    const q = this.d.TC[tile] ?? POS[tile];
    if (!q) return;
    const c = cpt(tile * PITCH);
    let nx = c.nx;
    let nz = c.nz;
    if (nx * (q[0] - MID[0]) + nz * (q[1] - MID[1]) < 0) {
      nx = -nx;
      nz = -nz;
    }
    const C: FxCtx = { x: q[0], z: q[1], nx, nz, tx: nz, tz: -nx, i: tile, pi };
    const cam = this.d.cam;
    const old = { f: cam.follow, t: cam.tilt, d: cam.dist };
    const vol = key === 'merapi';
    cam.follow = false;
    if (!vol) {
      cam.tx = C.x;
      cam.tz = C.z;
      cam.tilt = Math.min(cam.tilt, 44);
      cam.dist = Math.min(Math.max(cam.dist, 1500), 1900);
      // tunggu kamera benar-benar tiba (perjalanan jauh butuh lebih lama), maks 3,5 detik
      const t0 = performance.now();
      await new Promise<void>((r) => {
        const tick = () => {
          const el = performance.now() - t0;
          if ((el > 450 && camArrived(cam, 60)) || el > 3500) r();
          else requestAnimationFrame(tick);
        };
        tick();
      });
    }
    try {
      await f(C);
    } catch (err) {
      console.warn('fx', key, err);
    }
    this.clear();
    cam.shake = 0;
    cam.follow = old.f;
    cam.tilt = old.t;
    cam.dist = Math.min(old.d, 2200);
  }

  private effect(key: FxKey): ((C: FxCtx) => Promise<void>) | null {
    switch (key) {
      case 'banjir':
        return (C) => this.banjir(C);
      case 'rob':
        return (C) => this.banjir(C, { h: 80 });
      case 'merapi':
        return (C) => this.merapi(C);
      case 'gempa':
        return (C) => this.gempa(C);
      case 'tsunami':
        return (C) => this.tsunami(C);
      case 'kebakaran':
        return (C) => this.kebakaran(C);
      case 'longsor':
        return (C) => this.longsor(C);
      case 'kering':
        return (C) => this.kering(C);
      case 'puting':
        return (C) => this.puting(C);
      case 'meteor':
        return (C) => this.meteor(C, 1);
      case 'meteorstorm':
        return (C) => this.meteor(C, 7);
      case 'petir':
        return (C) => this.petir(C);
      default:
        return null;
    }
  }

  /* ---------- efek ---------- */

  private async banjir(
    C: FxCtx,
    o: { h?: number; mud?: [number, number, number, number] } = {},
  ): Promise<void> {
    const h = o.h || 18;
    const mud = o.mud || [0.5, 0.4, 0.24, 0.6];
    const U = this.U;
    const uFl = U.uFl!.value as THREE.Vector4;
    const uMud = U.uMud!.value as THREE.Vector4;
    uFl.set(C.x, C.z, 2300, 0);
    uMud.set(mud[0], mud[1], mud[2], mud[3]);
    const rg = [0, 1, 2].map(() => this.ringSp(0xffffff, 0));
    const rain = this.lineSeg(0xcfe4f4, 0.55);
    const N = 420;
    const rp = new Float32Array(N * 6);
    const dr: { x: number; z: number; y: number; v: number }[] = [];
    for (let i = 0; i < N; i++)
      dr.push({
        x: (R() - 0.5) * 1100,
        z: (R() - 0.5) * 1100,
        y: R() * 800,
        v: 900 + R() * 400,
      });
    rain.geometry.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    rain.frustumCulled = false;
    const wv = this.emo('🌊', 150, 0);
    this.fxS.dim = 0.78;
    const splash = this.emitter(160, { size: 14, opacity: 0.8 });
    let wlNow = -8;
    const vic = makeVictim(this.d.pawns, C.pi, o.h ? 'rob' : 'flood', {
      total: 4.2,
      dir: [C.tx, C.tz],
      water: () => wlNow,
      emit: (...a) => splash.spawn(...a),
    });
    await this.run(4.2, (p, dt, el) => {
      const k = p < 0.35 ? ez(p / 0.35) : p > 0.75 ? 1 - ez((p - 0.75) / 0.25) : 1;
      uFl.w = h * k;
      uMud.w = mud[3] * Math.min(1, k * 1.4);
      const wl = -8 + h * k;
      wlNow = wl;
      vic.step(dt, el);
      splash.step(dt, -500, 0.4);
      dr.forEach((d, i) => {
        d.y -= d.v * dt;
        if (d.y < wl) d.y += 800;
        rp[i * 6] = C.x + d.x;
        rp[i * 6 + 1] = d.y;
        rp[i * 6 + 2] = C.z + d.z;
        rp[i * 6 + 3] = C.x + d.x;
        rp[i * 6 + 4] = d.y - 40;
        rp[i * 6 + 5] = C.z + d.z;
      });
      (rain.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      rg.forEach((r, i) => {
        const q = (el * 0.8 + i / 3) % 1;
        r.position.set(C.x + Math.sin(i * 2) * 130, wl + 6, C.z + Math.cos(i * 2) * 130);
        r.material.opacity = 0.7 * (1 - q) * k;
        const sz = 80 + q * 380;
        r.scale.set(sz, sz, 1);
      });
      wv.position.set(C.x, 360, C.z);
      wv.material.opacity = Math.min(1, el) * (p > 0.8 ? (1 - p) * 5 : 1);
      this.d.cam.shake = Math.max(this.d.cam.shake, 2);
    });
    uFl.w = 0;
    vic.end();
  }

  private async merapi(C: FxCtx, o: { big?: boolean } = {}): Promise<void> {
    const big = !!o.big;
    const cam = this.d.cam;
    const cx = ISL.cx;
    const cz = ISL.cz;
    const cy = this.d.sky.craterY + 30;
    const lv = this.emitter(900, { size: big ? 120 : 90 });
    const ash = this.emitter(360, {
      size: 330,
      additive: false,
      opacity: 0.78,
    });
    const tr = this.emitter(900, { size: 70 });
    const sm = this.emitter(200, { size: 150, additive: false, opacity: 0.7 });
    const lt = this.lite(0xff7a2a, 0, 4000, cx, cy + 200, cz);
    /* lapisan realisme: tiang abu, payung abu, awan panas, petir gunung, hujan bara */
    const H = ISL.H;
    const plume = this.puffs(170);
    const umbrella = this.puffs(80);
    const pdc = this.puffs(170);
    const trailSmoke = this.puffs(90);
    const ember = this.emitter(520, { size: 30 });
    const vent = this.glow(0xff8a2a, H, 0);
    vent.position.set(cx, cy + 20, cz);
    const bolt = this.lineSeg(0xdfe9ff, 0);
    const boltPos = new Float32Array(3 * 2 * 80);
    bolt.geometry.setAttribute('position', new THREE.BufferAttribute(boltPos, 3));
    bolt.frustumCulled = false;
    const boltGlow = this.glow(0xbcd0ff, H * 0.55, 0);
    let boltT = 0;
    let boltNext = 1.1;
    let accP = 0;
    let accC = 0;
    let accE = 0;
    const wind: [number, number] = [H * 0.17, H * 0.05];
    const base = Math.atan2(C.z - cz, C.x - cx);
    const streams: {
      cv: THREE.CatmullRomCurve3;
      m1: THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial>;
      m2: THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial>;
      hd: THREE.Sprite;
      dl: number;
      sp: number;
    }[] = [];
    [0, -0.55, 0.5, Math.PI * 0.75, -Math.PI * 0.7, Math.PI * 0.3].forEach((da, si) => {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 30; k++) {
        const t = k / 30;
        const r = ISL.R * (0.06 + t * 0.84);
        const a = base + da + Math.sin(t * 6 + da * 3) * 0.2;
        const x = cx + Math.cos(a) * r;
        const z = cz + Math.sin(a) * r;
        pts.push(new THREE.Vector3(x, Math.max(islandH(x, z, ISL), 3) + 5, z));
      }
      const cv = new THREE.CatmullRomCurve3(pts);
      const g1 = new THREE.TubeGeometry(cv, 90, big ? 30 : 24, 6, false);
      const g2 = new THREE.TubeGeometry(cv, 90, big ? 13 : 10, 6, false);
      g1.setDrawRange(0, 0);
      g2.setDrawRange(0, 0);
      const m1 = new THREE.Mesh(
        g1,
        new THREE.MeshBasicMaterial({ color: 0xe8420e, transparent: true }),
      );
      const m2 = new THREE.Mesh(
        g2,
        new THREE.MeshBasicMaterial({ color: 0xffc24a, transparent: true }),
      );
      m2.position.y = 6;
      this.fxG.add(m1);
      this.fxG.add(m2);
      const hd = this.glow(0xff7a20, 300, 0.9);
      streams.push({
        cv,
        m1,
        m2,
        hd,
        dl: 0.5 + si * 0.12,
        sp: 1 / (1.6 + si * 0.25),
      });
    });
    const rocksN = big ? 11 : 8;
    const pw = this.d.pawns.list[C.pi] ?? null;
    const pmat = this.d.pawns.ctlMat(C.pi);
    const PX = pw ? pw.position.x : C.x;
    const PZ = pw ? pw.position.z : C.z;
    const porig = new THREE.Color(0xffffff);
    const th = {
      on: false,
      ph: 0,
      t: 0,
      b: 0,
      t2: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      sx: 0,
      sz: 0,
    };
    const bombs: {
      m: THREE.Mesh;
      g: THREE.Sprite;
      r: number;
      t0: number;
      dur: number;
      ox: number;
      oz: number;
      hitP?: boolean;
      b?: number;
    }[] = [];
    for (let i = 0; i < rocksN; i++) {
      const r = 44 + R() * (big ? 46 : 34);
      const m = this.mk(new THREE.DodecahedronGeometry(r, 1), 0x2e2420, {
        emissive: 0xff4a0a,
        emissiveIntensity: 1.0,
        roughness: 0.9,
      });
      m.visible = false;
      const g = this.glow(0xff7a20, r * 6, 0.9);
      g.visible = false;
      bombs.push({
        m,
        g,
        r,
        t0: 1.5 + R() * 1.3,
        dur: 1.5 + R() * 0.4,
        ox: (R() - 0.5) * 260,
        oz: (R() - 0.5) * 260,
      });
    }
    const shock = this.ringSp(0xffddaa, 0);
    const az0 = cam.az;
    const azT = (Math.atan2(C.x - cx, C.z - cz) * 180) / Math.PI;
    const dz = ((azT - az0 + 540) % 360) - 180;
    const b0 = bombs[0];
    if (b0) Object.assign(b0, { ox: 0, oz: 0, t0: 1.7, dur: 1.6, hitP: true });
    const rings: { r: THREE.Sprite; t: number; l: THREE.PointLight }[] = [];
    const scorch: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>[] = [];
    const deb: { m: THREE.Mesh; v: number[] }[] = [];
    const tot = big ? 9.4 : 9;
    cam.follow = false;
    cam.rate = 9;
    await this.run(tot, (p, dt, el) => {
      if (el < 3.0) {
        cam.tx = cx;
        cam.tz = cz;
        // sudut lebih rendah dan menjauh supaya seluruh tiang abu terlihat
        cam.ty = cy + H * 0.85;
        cam.tilt += (64 - cam.tilt) * Math.min(1, dt * 5);
        cam.dist += (H * 4.3 - cam.dist) * Math.min(1, dt * 5);
        cam.az += (az0 + dz - cam.az) * Math.min(1, dt * 7);
      } else {
        cam.tx = C.x;
        cam.tz = C.z;
        cam.ty = 0;
        cam.tilt += (46 - cam.tilt) * Math.min(1, dt * 6);
        cam.dist += (1750 - cam.dist) * Math.min(1, dt * 6);
        cam.az += (0 - cam.az) * Math.min(1, dt * 3);
      }
      if (el > 0.35 && el < 3.1) {
        cam.shake = Math.max(cam.shake, big ? 30 : 16);
        for (let k = 0; k < (big ? 16 : 10); k++) {
          const a = R() * TAU;
          const sp = 80 + R() * 220;
          lv.spawn(
            cx,
            cy,
            cz,
            Math.cos(a) * sp,
            700 + R() * (big ? 1300 : 900),
            Math.sin(a) * sp,
            2.4 + R(),
            [1, 0.5 + R() * 0.3, 0.12],
          );
        }
        for (let k = 0; k < 4; k++)
          ash.spawn(
            cx + (R() - 0.5) * 100,
            cy + 120,
            cz + (R() - 0.5) * 100,
            60 + R() * 50,
            320 + R() * 220,
            (R() - 0.5) * 70,
            4,
            [0.2, 0.19, 0.18],
          );
      }
      /* ---- tiang abu yang membumbung dan mengembang ---- */
      const power = el < 1.2 ? 1 : Math.max(0.3, 1 - (el - 1.2) / 3.4);
      if (el > 0.35 && el < 3.9) {
        accP += dt * 75 * (el < 3 ? 1 : 0.4);
        while (accP >= 1) {
          accP--;
          const a = R() * TAU;
          const rr = R() * H * 0.05;
          plume.spawn({
            x: cx + Math.cos(a) * rr,
            y: cy + 10,
            z: cz + Math.sin(a) * rr,
            vx: Math.cos(a) * H * 0.22 * R(),
            vy: H * (1.0 + R() * 0.5) * power,
            vz: Math.sin(a) * H * 0.22 * R(),
            life: 3.8 + R() * 1.2,
            s0: H * 0.12,
            s1: H * (0.55 + R() * 0.3),
            c0: [0.62, 0.32, 0.15],
            c1: [0.25, 0.225, 0.21],
            op: 0.85,
            spin: (R() - 0.5) * 0.8,
          });
        }
      }
      /* payung abu di puncak: menyebar mendatar lalu hanyut searah angin */
      if (el > 1.3 && el < 4.4) {
        accC += dt * 45;
        while (accC >= 1) {
          accC--;
          const a = R() * TAU;
          const sp = H * (0.2 + R() * 0.42);
          umbrella.spawn({
            x: cx + Math.cos(a) * H * 0.12 + wind[0] * 0.7,
            y: cy + H * (1.75 + R() * 0.55),
            z: cz + Math.sin(a) * H * 0.12 + wind[1] * 0.7,
            vx: Math.cos(a) * sp,
            vy: H * 0.04 * R(),
            vz: Math.sin(a) * sp,
            life: 3.6,
            s0: H * 0.28,
            s1: H * (0.62 + R() * 0.3),
            c0: [0.48, 0.42, 0.37],
            c1: [0.3, 0.28, 0.27],
            op: 0.7,
            spin: (R() - 0.5) * 0.4,
          });
        }
      }
      /* petir vulkanik di dalam awan abu */
      boltT -= dt;
      if (el > boltNext && el < 4.6) {
        boltNext = el + 0.22 + R() * 0.5;
        const sx = cx + (R() - 0.5) * H * 0.3;
        const sy = cy + H * (0.8 + R() * 1.1);
        const sz = cz + (R() - 0.5) * H * 0.3;
        const a0 = new THREE.Vector3(sx, sy, sz);
        const b0v = new THREE.Vector3(
          sx + (R() - 0.5) * H * 0.7,
          sy - H * (0.45 + R() * 0.6),
          sz + (R() - 0.5) * H * 0.7,
        );
        const nf = buildBolt(boltPos, a0, b0v, H * 0.07, 2);
        bolt.geometry.setDrawRange(0, nf / 3);
        (bolt.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        boltT = 0.13;
        boltGlow.position.copy(a0.clone().lerp(b0v, 0.5));
        this.flash(0.14, '#dfe8ff');
      }
      const bo = boltT > 0 ? 0.55 + 0.45 * Math.random() : 0;
      bolt.material.opacity = bo;
      boltGlow.material.opacity = bo * 0.85;
      /* kawah menyala, langit menggelap oleh abu */
      const ventK = el < 0.35 ? 0 : el < 0.8 ? (el - 0.35) / 0.45 : 1;
      const ventFade = p > 0.78 ? Math.max(0, (1 - p) / 0.22) : 1;
      vent.material.opacity =
        ventK * ventFade * (0.5 + 0.12 * Math.sin(el * 9) + (el < 0.8 ? 0.4 : 0));
      const vs = H * (0.8 + 0.2 * Math.sin(el * 11 + 1)) * (el < 0.8 ? 1.5 - (el - 0.35) : 1);
      vent.scale.set(vs, vs, 1);
      const dk = Math.min(1, Math.max(0, (el - 0.4) / 2.2)) * ventFade;
      this.fxS.dim = 1 - 0.5 * dk;
      this.fxS.warm = 0.75 * dk;
      /* hujan bara berpijar */
      if (el > 0.7 && el < 6) {
        accE += dt * 55;
        while (accE >= 1) {
          accE--;
          ember.spawn(
            cx + wind[0] * 0.8 + (R() - 0.5) * H * 1.6,
            cy + H * (0.3 + R() * 1.9),
            cz + wind[1] * 0.8 + (R() - 0.5) * H * 1.6,
            wind[0] * 0.3,
            -40 - R() * 110,
            wind[1] * 0.3,
            2.6,
            [1, 0.45 + R() * 0.25, 0.1],
          );
        }
      }
      streams.forEach((st) => {
        const u = Math.max(0, Math.min(1, (el - st.dl) * st.sp));
        const cnt = Math.floor(u * 90) * 36;
        st.m1.geometry.setDrawRange(0, cnt);
        st.m2.geometry.setDrawRange(0, cnt);
        const fl = 0.5 + 0.5 * Math.sin(el * 9 + st.dl * 7);
        st.m1.material.color.setRGB(0.9, 0.22 + 0.12 * fl, 0.05);
        st.m2.material.color.setRGB(1, 0.65 + 0.2 * fl, 0.2);
        const fade = p > 0.8 ? (1 - p) * 5 : 1;
        st.m1.material.opacity = st.m2.material.opacity = fade;
        if (u > 0 && u < 1) {
          const pt = st.cv.getPoint(u);
          st.hd.position.copy(pt);
          st.hd.material.opacity = 0.9 * fade;
          st.hd.visible = true;
          if (Math.random() < dt * 12)
            pdc.spawn({
              x: pt.x + (R() - 0.5) * 50,
              y: pt.y + 20,
              z: pt.z + (R() - 0.5) * 50,
              vx: (R() - 0.5) * 70,
              vy: 40 + R() * 80,
              vz: (R() - 0.5) * 70,
              life: 2.4,
              s0: 90,
              s1: 300 + R() * 160,
              c0: [0.34, 0.29, 0.25],
              c1: [0.2, 0.19, 0.18],
              op: 0.72,
              spin: (R() - 0.5) * 0.6,
            });
          if (Math.random() < 0.6)
            sm.spawn(
              pt.x,
              pt.y + 20,
              pt.z,
              (R() - 0.5) * 40,
              80,
              (R() - 0.5) * 40,
              1.8,
              [0.3, 0.27, 0.24],
            );
        } else st.hd.visible = false;
      });
      lt.intensity = el > 0.35 && el < 3.4 ? 3 + Math.sin(el * 20) : 0;
      lv.step(dt, 640, 0.2);
      ash.step(dt, -30, 0.5);
      tr.step(dt, -30, 0.6);
      sm.step(dt, -30, 0.6);
      plume.step(dt, 0.45, 30, wind);
      umbrella.step(dt, 0.6, 0, wind);
      pdc.step(dt, 0.7, 22, [wind[0] * 0.12, wind[1] * 0.12]);
      trailSmoke.step(dt, 0.8, 0);
      ember.step(dt, 25, 0.3);
      if (big && el > 0.35 && el < 0.5) this.flash(0.8, '#ffd9a0');
      else if (el > 0.35 && el < 0.45) this.flash(0.4, '#ffd9a0');
      const su = el - 0.35;
      shock.position.set(cx, 20, cz);
      const ss = su > 0 ? 240 + su * 1700 : 1;
      shock.scale.set(ss, ss, 1);
      shock.material.opacity = su > 0 && su < 1.6 ? (big ? 0.5 : 0.32) * (1 - su / 1.6) : 0;
      bombs.forEach((b) => {
        const u = (el - b.t0) / b.dur;
        if (u < 0 || u >= 1) {
          b.m.visible = b.g.visible = false;
          if (u >= 1 && !b.b) {
            b.b = 1;
            const X = PX + b.ox;
            const Z = PZ + b.oz;
            this.flash(0.4, '#ff9a40');
            cam.shake = Math.max(cam.shake, 36);
            if (b.hitP && pw && pmat) {
              th.on = true;
              pw.userData.fx = true;
              const dx = PX - cx;
              const dz2 = PZ - cz;
              const l = Math.hypot(dx, dz2) || 1;
              th.vx = (dx / l) * 520 + (R() - 0.5) * 160;
              th.vz = (dz2 / l) * 520 + (R() - 0.5) * 160;
              th.vy = 1150;
              th.sx = 9;
              th.sz = 7;
              pmat.color.setHex(0x151515);
              emi(pmat).setRGB(0.5, 0.14, 0);
              for (let k = 0; k < 30; k++)
                sm.spawn(
                  PX,
                  40,
                  PZ,
                  (R() - 0.5) * 300,
                  200 + R() * 200,
                  (R() - 0.5) * 300,
                  1.6,
                  [0.12, 0.11, 0.1],
                );
            }
            for (let k = 0; k < 40; k++) {
              const a = R() * TAU;
              const sp = 140 + R() * 420;
              lv.spawn(
                X,
                24,
                Z,
                Math.cos(a) * sp,
                260 + R() * 480,
                Math.sin(a) * sp,
                1.2 + R() * 0.5,
                [1, 0.55, 0.15],
              );
            }
            for (let k = 0; k < 14; k++) {
              const a = R() * TAU;
              const sp = 40 + R() * 130;
              sm.spawn(
                X + Math.cos(a) * 30,
                30,
                Z + Math.sin(a) * 30,
                Math.cos(a) * sp,
                120 + R() * 160,
                Math.sin(a) * sp,
                2.4,
                [0.16, 0.14, 0.13],
              );
            }
            const r = this.ringSp(0xffcc88, 0.9);
            r.position.set(X, 26, Z);
            const l = this.lite(0xffa040, 7, 1500, X, 150, Z);
            rings.push({ r, t: 0, l });
            for (let k = 0; k < 5; k++) {
              const m = this.rock(8 + R() * 12);
              m.position.set(X, 22, Z);
              const a = R() * TAU;
              const sp = 140 + R() * 260;
              deb.push({
                m,
                v: [Math.cos(a) * sp, 300 + R() * 320, Math.sin(a) * sp],
              });
            }
            const sc = new THREE.Mesh(
              new THREE.CircleGeometry(b.r * 2.2, 24),
              new THREE.MeshBasicMaterial({
                color: 0x140c08,
                transparent: true,
                opacity: 0.6,
                depthWrite: false,
              }),
            );
            sc.rotation.x = -Math.PI / 2;
            sc.position.set(X, 13.0, Z);
            this.fxG.add(sc);
            scorch.push(sc);
          }
          return;
        }
        b.m.visible = b.g.visible = true;
        const tx = PX + b.ox;
        const tz = PZ + b.oz;
        const x = cx + (tx - cx) * u;
        const z = cz + (tz - cz) * u;
        const y = cy + (14 - cy) * u + Math.sin(u * Math.PI) * 1200;
        b.m.position.set(x, y, z);
        b.g.position.set(x, y, z);
        b.m.rotation.x += dt * 6;
        b.m.rotation.z += dt * 4;
        if (Math.random() < dt * 34)
          trailSmoke.spawn({
            x,
            y,
            z,
            vx: (R() - 0.5) * 40,
            vy: (R() - 0.3) * 30,
            vz: (R() - 0.5) * 40,
            life: 1.7,
            s0: b.r * 0.9,
            s1: b.r * 3.6,
            c0: [0.55, 0.3, 0.18],
            c1: [0.22, 0.2, 0.19],
            op: 0.6,
            spin: (R() - 0.5) * 1.2,
          });
        for (let k = 0; k < 7; k++)
          tr.spawn(
            x + (R() - 0.5) * b.r,
            y + (R() - 0.5) * b.r,
            z + (R() - 0.5) * b.r,
            (R() - 0.5) * 70,
            (R() - 0.4) * 70,
            (R() - 0.5) * 70,
            0.8,
            [1, 0.5 + R() * 0.3, 0.1],
          );
      });
      if (th.on && pw && pmat) {
        th.t += dt;
        if (th.ph === 0) {
          th.vy -= 1500 * dt;
          pw.position.x += th.vx * dt;
          pw.position.y += th.vy * dt;
          pw.position.z += th.vz * dt;
          pw.rotation.x += th.sx * dt;
          pw.rotation.z += th.sz * dt;
          if (Math.random() < 0.7)
            sm.spawn(
              pw.position.x,
              pw.position.y + 30,
              pw.position.z,
              (R() - 0.5) * 40,
              60,
              (R() - 0.5) * 40,
              1.2,
              [0.12, 0.11, 0.1],
            );
          if (pw.position.y < 13) {
            pw.position.y = 13;
            if (th.vy < -300 && th.b < 3) {
              th.vy *= -0.5;
              th.vx *= 0.6;
              th.vz *= 0.6;
              th.sx *= 0.6;
              th.sz *= 0.6;
              th.b++;
              cam.shake = Math.max(cam.shake, 22);
            } else {
              th.ph = 1;
              th.t2 = 0;
              th.vy = 0;
            }
          }
        } else {
          th.t2 += dt;
          if (th.t2 < 0.5) {
            pw.position.x += th.vx * dt;
            pw.position.z += th.vz * dt;
            th.vx *= 0.9;
            th.vz *= 0.9;
          }
          const lie = ez(Math.min(1, th.t2 / 0.4));
          const up = th.t2 > 1.1 ? ez(Math.min(1, (th.t2 - 1.1) / 0.8)) : 0;
          pw.rotation.x = 0;
          pw.rotation.z = 1.45 * lie * (1 - up);
          if (th.t2 > 0.3 && th.t2 < 1.9 && Math.random() < 0.5)
            sm.spawn(
              pw.position.x + (R() - 0.5) * 30,
              50,
              pw.position.z + (R() - 0.5) * 30,
              (R() - 0.5) * 20,
              100,
              (R() - 0.5) * 20,
              1.5,
              [0.14, 0.13, 0.12],
            );
          const back = Math.max(0, Math.min(1, (th.t2 - 1.3) / 0.9));
          pmat.color.copy(new THREE.Color(0x151515).lerp(porig, back));
          const on = th.t2 < 1 ? 1 : 0;
          emi(pmat).setRGB(0.4 * (1 - back) * on, 0.1 * (1 - back) * on, 0);
          if (th.t2 > 2.2) {
            th.on = false;
            pw.userData.fx = false;
            pw.rotation.set(0, 0, 0);
            pmat.color.copy(porig);
            emi(pmat).setRGB(0, 0, 0);
          }
        }
      }
      rings.forEach((o2) => {
        o2.t += dt;
        const sz = 80 + o2.t * 1500;
        o2.r.scale.set(sz, sz, 1);
        o2.r.material.opacity = Math.max(0, 0.9 * (1 - o2.t));
        o2.l.intensity = Math.max(0, 7 * (1 - o2.t / 0.7));
      });
      deb.forEach((d) => {
        d.v[1]! -= 900 * dt;
        const m = d.m;
        m.position.x += d.v[0]! * dt;
        m.position.y += d.v[1]! * dt;
        m.position.z += d.v[2]! * dt;
        m.rotation.x += dt * 7;
        if (m.position.y < 14) {
          m.position.y = 14;
          d.v[1]! *= -0.3;
          d.v[0]! *= 0.6;
          d.v[2]! *= 0.6;
        }
      });
      if (el > 3.6 && el < 5.8)
        for (let k = 0; k < 4; k++)
          ash.spawn(
            C.x + (R() - 0.5) * 700,
            650 + R() * 150,
            C.z + (R() - 0.5) * 700,
            (R() - 0.5) * 20,
            -160 - R() * 60,
            (R() - 0.5) * 20,
            3.2,
            [0.24, 0.22, 0.21],
          );
      if (p > 0.88) scorch.forEach((s2) => (s2.material.opacity = (0.6 * (1 - p)) / 0.12));
    });
    if (pw && pmat) {
      pw.userData.fx = false;
      pw.rotation.set(0, 0, 0);
      pmat.color.copy(porig);
      emi(pmat).setRGB(0, 0, 0);
    }
    cam.ty = 0;
  }

  private async gempa(C: FxCtx): Promise<void> {
    const cam = this.d.cam;
    const root = this.d.root;
    const cracks = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0x1c1208 }),
    );
    cracks.frustumCulled = false;
    this.fxG.add(cracks);
    const segs: number[][] = [];
    for (let a = 0; a < 7; a++) {
      let ang = (a / 7) * TAU + R() * 0.5;
      let x = C.x;
      let z = C.z;
      for (let k = 0; k < 7; k++) {
        const l = 60 + R() * 70;
        const na = ang + (R() - 0.5) * 0.8;
        const nx = x + Math.cos(na) * l;
        const nz = z + Math.sin(na) * l;
        segs.push([x, 13.2, z, nx, 13.2, nz]);
        x = nx;
        z = nz;
        ang = na;
      }
    }
    const dust = this.emitter(260, {
      size: 110,
      additive: false,
      opacity: 0.6,
    });
    const stuff: {
      s: THREE.Object3D;
      t0: number;
      a: number;
      v: number;
      vy: number;
      x: number;
      y: number;
      z: number;
      vx: number;
      vz: number;
      live: boolean;
    }[] = [];
    for (let i = 0; i < 8; i++) {
      const s = this.rock(14 + R() * 14);
      s.visible = false;
      stuff.push({
        s,
        t0: 0.4 + R() * 1.4,
        a: R() * TAU,
        v: 150 + R() * 200,
        vy: 420 + R() * 300,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vz: 0,
        live: false,
      });
    }
    const hd = this.emo('🏚️', 150, 0);
    const gdust = this.emitter(260, {
      size: 130,
      additive: false,
      opacity: 0.55,
    });
    const vic = makeVictim(this.d.pawns, C.pi, 'gempa', {
      total: 3.6,
      dir: [C.nx, C.nz],
      emit: (...a) => gdust.spawn(...a),
      thud: () => {
        cam.shake = Math.max(cam.shake, 26);
      },
    });
    await this.run(3.6, (_p, dt, el) => {
      vic.step(dt, el);
      gdust.step(dt, -40, 0.7);
      const amp = el < 2.7 ? 1 : (3.6 - el) / 0.9;
      cam.shake = Math.max(cam.shake, 22 * amp);
      root.position.set((R() - 0.5) * 7 * amp, (R() - 0.5) * 3 * amp, (R() - 0.5) * 7 * amp);
      const n = Math.floor(Math.min(1, el / 1.6) * segs.length);
      cracks.geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(segs.slice(0, n).flat(), 3),
      );
      if (Math.random() < 0.7)
        dust.spawn(
          C.x + (R() - 0.5) * 500,
          16,
          C.z + (R() - 0.5) * 500,
          (R() - 0.5) * 60,
          50 + R() * 60,
          (R() - 0.5) * 60,
          1.8,
          [0.5, 0.45, 0.38],
        );
      dust.step(dt, -15, 1);
      stuff.forEach((o2) => {
        if (el < o2.t0) return;
        if (!o2.live) {
          o2.live = true;
          o2.s.visible = true;
          o2.x = C.x;
          o2.y = 40;
          o2.z = C.z;
          o2.vx = Math.cos(o2.a) * o2.v;
          o2.vz = Math.sin(o2.a) * o2.v;
        }
        o2.vy -= 900 * dt;
        o2.x += o2.vx * dt;
        o2.z += o2.vz * dt;
        o2.y += o2.vy * dt;
        if (o2.y < 14) {
          o2.y = 14;
          o2.vy *= -0.35;
          o2.vx *= 0.7;
          o2.vz *= 0.7;
        }
        o2.s.position.set(o2.x, o2.y, o2.z);
      });
      hd.position.set(C.x, 250, C.z);
      hd.material.opacity = Math.min(1, el);
    });
    root.position.set(0, 0, 0);
    vic.end();
  }

  private async tsunami(C: FxCtx): Promise<void> {
    const U = this.U;
    const uWv = U.uWv!.value as THREE.Vector4;
    const uWa = U.uWa!.value as THREE.Vector2;
    const uFl = U.uFl!.value as THREE.Vector4;
    const uMud = U.uMud!.value as THREE.Vector4;
    const fo = this.emitter(500, { size: 110 });
    const wv = this.emo('🌊', 170, 0);
    this.fxS.dim = 0.8;
    const nx = -C.nx;
    const nz = -C.nz;
    const S0 = 3000;
    const S1 = -2000;
    uWv.set(C.x + C.nx * S0, C.z + C.nz * S0, nx, nz);
    uMud.set(0.45, 0.38, 0.26, 0.6);
    uFl.set(C.x, C.z, 2300, 0);
    const AMP = 190;
    const vic = makeVictim(this.d.pawns, C.pi, 'tsunami', {
      total: 5.2,
      dir: [nx, nz],
      hit: 2.0,
      emit: (...a) => fo.spawn(...a),
    });
    await this.run(5.2, (p, dt, el) => {
      vic.step(dt, el);
      const e = Math.min(1, el / 3.4);
      const sp = S0 + (S1 - S0) * e;
      const cx = C.x + C.nx * sp;
      const cz = C.z + C.nz * sp;
      uWv.set(cx, cz, nx, nz);
      const rise = Math.min(1, el / 1.3);
      const fall = el > 3.4 ? Math.max(0, 1 - (el - 3.4) / 1.2) : 1;
      uWa.x = AMP * rise * fall;
      uFl.w =
        (el > 2.2
          ? el < 4
            ? Math.min(1, (el - 2.2) / 0.8)
            : Math.max(0, 1 - (el - 4) / 1.2)
          : 0) * 20;
      uMud.w = 0.6 * Math.min(1, el / 1.5);
      if (e < 1 && el > 0.4)
        for (let k = 0; k < 10; k++) {
          const t = (R() - 0.5) * 3200;
          const q = uWa.x;
          fo.spawn(
            cx + C.tx * t + nx * (R() * 80),
            -8 + q * 0.8,
            cz + C.tz * t + nz * (R() * 80),
            nx * 120 + (R() - 0.5) * 80,
            60 + R() * 180,
            nz * 120 + (R() - 0.5) * 80,
            1.1,
            [0.95, 0.99, 1],
          );
        }
      fo.step(dt, 300, 0.3);
      this.d.cam.shake = Math.max(this.d.cam.shake, Math.abs(sp) < 900 ? 24 : 4);
      wv.position.set(C.x, 380, C.z);
      wv.material.opacity = Math.min(1, el) * (p > 0.85 ? (1 - p) * 6 : 1);
    });
    uWa.x = 0;
    uFl.w = 0;
    this.d.cam.shake = 0;
    vic.end();
  }

  private async kebakaran(C: FxCtx): Promise<void> {
    const H = 100;
    const flame = this.puffs(300, { additive: true });
    const smoke = this.puffs(220);
    const spark = this.emitter(360, { size: 16 });
    const T = 4.6;
    const vic = makeVictim(this.d.pawns, C.pi, 'burn', {
      total: T,
      dir: [C.nx, C.nz],
      emit: (x, y, z, vx, vy, vz, life, c) =>
        flame.spawn({
          x,
          y,
          z,
          vx,
          vy,
          vz,
          life: life + 0.3,
          s0: 26,
          s1: 60,
          c0: [1, 0.78, 0.3],
          c1: [c[0], c[1] * 0.5, 0.02],
          op: 0.45,
          spin: 0.5,
        }),
      smoke: (x, y, z, vx, vy, vz, life) =>
        smoke.spawn({
          x,
          y,
          z,
          vx,
          vy,
          vz,
          life: life + 1,
          s0: 40,
          s1: 170,
          c0: [0.2, 0.18, 0.16],
          c1: [0.1, 0.1, 0.1],
          op: 0.5,
          spin: 0.2,
        }),
    });
    /* pohon: menyala bergiliran dari tengah ke luar, lalu menghitam */
    const tr: {
      g: THREE.Group;
      c: THREE.Mesh<THREE.ConeGeometry, THREE.MeshStandardMaterial>;
      t: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>;
      at: number;
      x: number;
      z: number;
    }[] = [];
    const N = 15;
    for (let i = 0; i < N; i++) {
      const g = new THREE.Group();
      const t = this.mk(new THREE.CylinderGeometry(5, 7, 40, 6), 0x5b3b22);
      t.position.y = 20;
      const c = this.mk(new THREE.ConeGeometry(30, 90, 8), 0x1f6f2f);
      c.position.y = 85;
      this.fxG.remove(t);
      this.fxG.remove(c);
      g.add(t, c);
      const a = (i / N) * TAU + R() * 0.3;
      const r = 120 + R() * 280;
      const x = C.x + Math.cos(a) * r;
      const z = C.z + Math.sin(a) * r;
      g.position.set(x, 12, z);
      g.scale.setScalar(0.9 + R() * 0.5);
      this.fxG.add(g);
      tr.push({ g, c, t, at: 0.2 + (r / 400) * 1.8 + R() * 0.3, x, z });
    }
    const lt = this.lite(0xff7a22, 3, 1500, C.x, 200, C.z);
    const wind: [number, number] = [H * 0.5, H * 0.15];
    let accG = 0;
    this.fxS.warm = 0.2;
    await this.run(T, (p, dt, el) => {
      vic.step(dt, el);
      const st = p > 0.78 ? Math.max(0, (1 - p) / 0.22) : 1;
      this.fxS.dim = 1 - 0.3 * Math.min(1, el / 1.5) * st;
      this.fxS.warm = 0.15 + 0.5 * Math.min(1, el / 1.5) * st;
      /* api tanah yang merambat keluar */
      accG += dt * 90 * st;
      while (accG >= 1) {
        accG--;
        const a = R() * TAU;
        const r = Math.sqrt(R()) * (80 + 340 * Math.min(1, el / 1.6));
        flame.spawn({
          x: C.x + Math.cos(a) * r,
          y: 14,
          z: C.z + Math.sin(a) * r,
          vx: (R() - 0.5) * 40,
          vy: 180 + R() * 220,
          vz: (R() - 0.5) * 40,
          life: 0.6 + R() * 0.6,
          s0: 36,
          s1: 56 + R() * 30,
          c0: [1, 0.8, 0.35],
          c1: [0.95, 0.2, 0.02],
          op: 0.4,
          spin: (R() - 0.5) * 1.2,
        });
        if (R() < 0.3)
          smoke.spawn({
            x: C.x + Math.cos(a) * r,
            y: 60,
            z: C.z + Math.sin(a) * r,
            vx: 20,
            vy: 150 + R() * 100,
            vz: (R() - 0.5) * 30,
            life: 3.2,
            s0: 50,
            s1: 220 + R() * 90,
            c0: [0.3, 0.26, 0.22],
            c1: [0.11, 0.11, 0.11],
            op: 0.4,
            spin: (R() - 0.5) * 0.4,
          });
      }
      /* pohon terbakar: lidah api tinggi, asap pekat, percikan */
      tr.forEach((o) => {
        const b = Math.min(1, Math.max(0, (el - o.at) / 0.9));
        if (b <= 0) return;
        o.c.material.color.setRGB(
          0.12 * (1 - b) + 0.05,
          0.43 * (1 - b) + 0.04,
          0.18 * (1 - b) + 0.03,
        );
        o.t.material.color.setRGB(
          0.36 * (1 - b) + 0.05,
          0.23 * (1 - b) + 0.04,
          0.13 * (1 - b) + 0.03,
        );
        o.c.scale.y = 1 - 0.28 * b;
        if (R() < dt * 26 * st)
          flame.spawn({
            x: o.x + (R() - 0.5) * 24,
            y: 40 + R() * 80,
            z: o.z + (R() - 0.5) * 24,
            vx: (R() - 0.5) * 30,
            vy: 220 + R() * 260,
            vz: (R() - 0.5) * 30,
            life: 0.7 + R() * 0.5,
            s0: 40,
            s1: 76 + R() * 34,
            c0: [1, 0.85, 0.4],
            c1: [0.95, 0.22, 0.02],
            op: 0.45,
            spin: R() - 0.5,
          });
        if (R() < dt * 9 * st)
          smoke.spawn({
            x: o.x,
            y: 120,
            z: o.z,
            vx: 10,
            vy: 170 + R() * 120,
            vz: (R() - 0.5) * 20,
            life: 3.4,
            s0: 50,
            s1: 240 + R() * 100,
            c0: [0.28, 0.25, 0.22],
            c1: [0.1, 0.1, 0.1],
            op: 0.42,
            spin: (R() - 0.5) * 0.4,
          });
        if (R() < dt * 14 * st)
          spark.spawn(
            o.x + (R() - 0.5) * 30,
            100 + R() * 60,
            o.z + (R() - 0.5) * 30,
            (R() - 0.5) * 90 + wind[0] * 0.6,
            160 + R() * 200,
            (R() - 0.5) * 90,
            1.6 + R(),
            [1, 0.55 + R() * 0.3, 0.1],
          );
      });
      flame.step(dt, 0.3, 90, [wind[0] * 0.25, wind[1] * 0.25]);
      smoke.step(dt, 0.5, 40, wind);
      spark.step(dt, -60, 0.4);
      lt.intensity = (2.4 + Math.random() * 1.6) * Math.min(1, el / 0.8) * st;
    });
    vic.end();
  }

  private async longsor(C: FxCtx): Promise<void> {
    const cam = this.d.cam;
    const dust = this.emitter(500, {
      size: 200,
      additive: false,
      opacity: 0.7,
    });
    const mud: {
      m: THREE.Mesh;
      tx: number;
      ty: number;
      tz: number;
      d: number;
      rot: number;
      drift: number;
    }[] = [];
    for (let i = 0; i < 22; i++) {
      const m = this.mk(new THREE.SphereGeometry(1, 14, 10), i % 3 ? 0x5e4128 : 0x4e3620, {
        roughness: 1,
      });
      m.castShadow = false;
      const t = R();
      const lat = (R() - 0.5) * 600;
      const off = 430 - t * 520 + (R() - 0.5) * 80;
      m.position.set(C.x + C.nx * off + C.tx * lat, 0, C.z + C.nz * off + C.tz * lat);
      m.scale.set(0.01, 0.01, 0.01);
      mud.push({
        m,
        tx: 70 + R() * 120,
        ty: 9 + R() * 13,
        tz: 60 + R() * 110,
        d: (1 - t) * 0.9 + R() * 0.3,
        rot: R() * 3,
        drift: 60 + R() * 90,
      });
    }
    const N = 11;
    const ch: {
      m: THREE.Mesh;
      r: number;
      h: number;
      dl: number;
      vy: number;
      vx: number;
      vz: number;
      rot: number;
    }[] = [];
    for (let i = 0; i < N; i++) {
      const r = 70 + R() * 50;
      const m = this.mk(new THREE.DodecahedronGeometry(r, 1), i % 3 ? 0x7b6a58 : 0x8a7a68, {
        roughness: 1,
      });
      const lat = (i / (N - 1) - 0.5) * 620 + (R() - 0.5) * 60;
      const off = 420 + R() * 100;
      m.position.set(C.x + C.nx * off + C.tx * lat, 0, C.z + C.nz * off + C.tz * lat);
      m.scale.y = 0.01;
      ch.push({
        m,
        r,
        h: 1.5 + R() * 1.3,
        dl: R() * 0.45,
        vy: 0,
        vx: 0,
        vz: 0,
        rot: R() * 3,
      });
    }
    const bits: {
      m: THREE.Mesh;
      live: boolean;
      vx: number;
      vy: number;
      vz: number;
    }[] = [];
    for (let i = 0; i < 26; i++) {
      const m = this.rock(14 + R() * 22);
      m.visible = false;
      bits.push({ m, live: false, vx: 0, vy: 0, vz: 0 });
    }
    const em = this.emo('⛰️', 170, 0);
    let col = false;
    const vic = makeVictim(this.d.pawns, C.pi, 'slide', {
      total: 4.8,
      dir: [-C.nx, -C.nz],
      emit: (...a) => dust.spawn(...a),
    });
    await this.run(4.8, (p, dt, el) => {
      vic.step(dt, el);
      if (el < 1.4) {
        cam.shake = Math.max(cam.shake, el < 1.2 ? 16 : 6);
        ch.forEach((c) => {
          const u = ez(Math.max(0, Math.min(1, (el - c.dl) / 0.8)));
          c.m.scale.set(1, Math.max(0.01, u * c.h), 1);
          c.m.position.y = c.r * u * c.h * 0.9;
          c.m.rotation.y = c.rot;
        });
        if (Math.random() < 0.9)
          dust.spawn(
            C.x + C.nx * (300 + R() * 160) + C.tx * (R() - 0.5) * 600,
            30,
            C.z + C.nz * (300 + R() * 160) + C.tz * (R() - 0.5) * 600,
            C.nx * 60,
            70 + R() * 80,
            C.nz * 60,
            1.8,
            [0.6, 0.5, 0.4],
          );
      } else if (el < 2.0) {
        cam.shake = Math.max(cam.shake, 10);
        ch.forEach((c) => {
          c.m.rotation.z = Math.sin(el * 40 + c.rot) * 0.05;
          c.m.rotation.x = Math.cos(el * 35 + c.rot) * 0.04;
        });
      } else {
        if (!col) {
          col = true;
          this.flash(0.2, '#c9a070');
          ch.forEach((c) => {
            c.vx = -C.nx * (180 + R() * 220) + (R() - 0.5) * 120;
            c.vz = -C.nz * (180 + R() * 220) + (R() - 0.5) * 120;
            c.vy = 60;
          });
          bits.forEach((b) => {
            b.live = true;
            b.m.visible = true;
            b.m.position.set(
              C.x + C.nx * (300 + R() * 160) + C.tx * (R() - 0.5) * 600,
              200 + R() * 500,
              C.z + C.nz * (300 + R() * 160) + C.tz * (R() - 0.5) * 600,
            );
            b.vx = -C.nx * (120 + R() * 260) + (R() - 0.5) * 100;
            b.vz = -C.nz * (120 + R() * 260) + (R() - 0.5) * 100;
          });
        }
        cam.shake = Math.max(cam.shake, 22);
        ch.forEach((c) => {
          const m = c.m;
          if (m.scale.y > c.h * 0.3) m.scale.y = Math.max(c.h * 0.28, m.scale.y - dt * c.h * 0.9);
          c.vy -= 1100 * dt;
          m.position.x += c.vx * dt;
          m.position.z += c.vz * dt;
          m.position.y += c.vy * dt;
          const floor = c.r * m.scale.y * 0.55;
          if (m.position.y < floor) {
            m.position.y = floor;
            c.vy *= -0.2;
            c.vx *= 0.92;
            c.vz *= 0.92;
            if (Math.random() < 0.2)
              dust.spawn(
                m.position.x,
                40,
                m.position.z,
                (R() - 0.5) * 160,
                60 + R() * 80,
                (R() - 0.5) * 160,
                2,
                [0.58, 0.46, 0.34],
              );
          }
          m.rotation.x += dt * c.vz * 0.004;
          m.rotation.z -= dt * c.vx * 0.004;
        });
        bits.forEach((b) => {
          if (!b.live) return;
          b.vy -= 1100 * dt;
          const m = b.m;
          m.position.x += b.vx * dt;
          m.position.y += b.vy * dt;
          m.position.z += b.vz * dt;
          if (m.position.y < 20) {
            m.position.y = 20;
            b.vy *= -0.3;
            b.vx *= 0.8;
            b.vz *= 0.8;
            if (Math.random() < 0.15)
              dust.spawn(
                m.position.x,
                30,
                m.position.z,
                (R() - 0.5) * 100,
                50,
                (R() - 0.5) * 100,
                1.6,
                [0.58, 0.46, 0.34],
              );
          }
          m.rotation.x += dt * 4;
        });
        mud.forEach((q) => {
          const u = ez(Math.max(0, Math.min(1, (el - 2.0 - q.d) / 1.3)));
          q.m.scale.set(
            Math.max(0.01, q.tx * u),
            Math.max(0.01, q.ty * u),
            Math.max(0.01, q.tz * u),
          );
          q.m.rotation.y = q.rot;
          q.m.position.y = q.ty * u * 0.6 + 1;
          q.m.position.x -= C.nx * q.drift * dt * (1 - u * 0.8);
          q.m.position.z -= C.nz * q.drift * dt * (1 - u * 0.8);
        });
      }
      dust.step(dt, -25, 0.8);
      em.position.set(C.x, 340, C.z);
      em.material.opacity = Math.min(1, el) * (p > 0.9 ? (1 - p) * 10 : 1);
    });
    vic.end();
  }

  private async petir(C: FxCtx): Promise<void> {
    const pw = this.d.pawns.list[C.pi];
    const mat = this.d.pawns.ctlMat(C.pi);
    if (!pw || !mat) return;
    const cam = this.d.cam;
    const px = pw.position.x;
    const pz = pw.position.z;
    const orig = new THREE.Color(0xffffff);
    const bolt = this.lineSeg(0xe8f0ff, 1);
    const bolt2 = this.lineSeg(0x7aa8ff, 0.7);
    let boltPts: number[] = [];
    const mkBolt = () => {
      const pts: number[] = [];
      const pts2: number[] = [];
      let x = px + (R() - 0.5) * 500;
      let y = 1100;
      let z = pz + (R() - 0.5) * 500;
      const n = 14;
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        const nx = px + (x - px) * (1 - t) + (R() - 0.5) * 130 * (1 - t);
        const ny = 1100 * (1 - t) + 40 * t;
        const nz = pz + (z - pz) * (1 - t) + (R() - 0.5) * 130 * (1 - t);
        pts.push(x, y, z, nx, ny, nz);
        if (R() < 0.3)
          pts2.push(
            nx,
            ny,
            nz,
            nx + (R() - 0.5) * 300,
            ny - 120 - R() * 160,
            nz + (R() - 0.5) * 300,
          );
        x = nx;
        y = ny;
        z = nz;
      }
      boltPts = pts;
      bolt.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      bolt2.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts2, 3));
    };
    const lt = this.lite(0xaac4ff, 0, 2500, px, 420, pz);
    const sp = this.emitter(400, { size: 40 });
    const sm = this.emitter(160, { size: 90, additive: false, opacity: 0.6 });
    // cahaya tebal kanal petir, busur listrik di tubuh, dan bekas hangus di tanah
    const glow = this.emitter(900, { size: 46 });
    const arcs = this.lineSeg(0xbfe0ff, 0.95);
    const arcs2 = this.lineSeg(0x6aa8ff, 0.7);
    arcs.visible = arcs2.visible = false;
    const scorch = new THREE.Mesh(
      new THREE.CircleGeometry(46, 24),
      new THREE.MeshBasicMaterial({
        color: 0x0a0806,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    scorch.rotation.x = -Math.PI / 2;
    scorch.position.set(px, 13.6, pz);
    scorch.renderOrder = 2;
    this.fxG.add(scorch);
    const ring = this.ringSp(0xcfe4ff, 0);
    ring.position.set(px, 16, pz);
    const mkArcs = () => {
      const a1: number[] = [];
      const a2: number[] = [];
      const S = 1.55;
      for (let q = 0; q < 7; q++) {
        let x = px + (R() - 0.5) * 30 * S;
        let y = 13 + R() * 110 * S;
        let z = pz + (R() - 0.5) * 30 * S;
        const segs = 3 + Math.floor(R() * 4);
        for (let k = 0; k < segs; k++) {
          const nx = x + (R() - 0.5) * 34;
          const ny = y + (R() - 0.5) * 34;
          const nz = z + (R() - 0.5) * 34;
          (q % 2 ? a2 : a1).push(x, y, z, nx, ny, nz);
          x = nx;
          y = ny;
          z = nz;
        }
      }
      arcs.geometry.setAttribute('position', new THREE.Float32BufferAttribute(a1, 3));
      arcs2.geometry.setAttribute('position', new THREE.Float32BufferAttribute(a2, 3));
    };
    cam.tx = px;
    cam.tz = pz;
    cam.dist = Math.min(cam.dist, 1250);
    cam.tilt = 36;
    this.fxS.dim = 0.5;
    this.hold(0.35, '#06091a');
    let hit = 0;
    const rain = this.emitter(300, { size: 30 });
    mkBolt();
    bolt.visible = bolt2.visible = false;
    await this.run(6, (_p, dt, el) => {
      const t1 = 1.1;
      if (el < t1) {
        if (Math.sin(el * 30) > 0.8) {
          bolt.visible = bolt2.visible = false;
          this.flash(0.12);
        }
      }
      for (let k = 0; k < 5; k++)
        rain.spawn(
          px + (R() - 0.5) * 900,
          900,
          pz + (R() - 0.5) * 900,
          0,
          -1300,
          0,
          0.7,
          [0.7, 0.8, 1],
        );
      rain.step(dt, 0, 0);
      if (el >= t1 && el < t1 + 0.3) {
        bolt.visible = bolt2.visible = Math.random() > 0.2;
        if (!hit) {
          hit = 1;
          mkBolt();
          this.flash(0.9, '#e6efff');
          cam.shake = 50;
          lt.intensity = 12;
          mat.color.setHex(0x151515);
          emi(mat).setHex(0x331100);
          scorch.material.opacity = 0.75;
          ring.material.opacity = 1;
          for (let k = 0; k < 120; k++) {
            const a = R() * TAU;
            const s2 = 150 + R() * 420;
            sp.spawn(
              px,
              40,
              pz,
              Math.cos(a) * s2,
              200 + R() * 500,
              Math.sin(a) * s2,
              0.9,
              [0.8, 0.9, 1],
            );
          }
        }
      } else if (el >= t1 + 0.3) {
        bolt.visible = bolt2.visible = el < t1 + 0.55 && Math.random() > 0.5;
        lt.intensity = Math.max(0, lt.intensity - dt * 40);
      }
      if (bolt.visible && boltPts.length)
        for (let i = 0; i < boltPts.length; i += 6) {
          const f = R();
          glow.spawn(
            boltPts[i]! + (boltPts[i + 3]! - boltPts[i]!) * f,
            boltPts[i + 1]! + (boltPts[i + 4]! - boltPts[i + 1]!) * f,
            boltPts[i + 2]! + (boltPts[i + 5]! - boltPts[i + 2]!) * f,
            0,
            0,
            0,
            0.09,
            [0.75, 0.85, 1],
          );
        }
      glow.step(dt, 0, 0);
      if (hit) {
        const u = el - t1;
        // gelombang kejut di tanah
        const rq = Math.min(1, u / 0.5);
        ring.scale.set(60 + rq * 420, 60 + rq * 420, 1);
        ring.material.opacity = Math.max(0, 1 - rq);
        // kesetrum: tubuh berpendar biru berkedip dengan busur listrik
        const zap = u < 1.1;
        arcs.visible = arcs2.visible = zap && Math.random() > 0.25;
        if (zap) {
          if (Math.random() < 0.6) mkArcs();
          const f = Math.random() > 0.35 ? 1 : 0.2;
          emi(mat).setRGB(0.35 * f, 0.55 * f, 1.0 * f);
          if (Math.random() < 0.5)
            sp.spawn(
              px + (R() - 0.5) * 40,
              20 + R() * 150,
              pz + (R() - 0.5) * 40,
              (R() - 0.5) * 260,
              80 + R() * 200,
              (R() - 0.5) * 260,
              0.45,
              [0.7, 0.85, 1],
            );
        }
        // bekas hangus memudar perlahan di akhir
        scorch.material.opacity = 0.75 * Math.max(0, Math.min(1, (6 - el) / 1.4));
      }
      sp.step(dt, 700, 0.4);
      if (el > t1) {
        const u = el - t1;
        if (u < 0.35) {
          pw.rotation.z = Math.sin(u * 90) * 0.18;
          pw.rotation.x = Math.cos(u * 80) * 0.12;
        } else if (u < 1.3) {
          const k = ez(Math.min(1, (u - 0.35) / 0.5));
          pw.rotation.z = 1.45 * k;
          pw.rotation.x = 0;
        } else if (u < 2.6) {
          pw.rotation.z = 1.45;
          pw.rotation.x = 0;
        } else {
          const k = ez(Math.min(1, (u - 2.6) / 0.7));
          pw.rotation.z = 1.45 * (1 - k);
          if (u > 3.3) pw.rotation.z = 0;
        }
        if (u > 0.3 && u < 3.2 && Math.random() < 0.8)
          sm.spawn(
            px + (R() - 0.5) * 30,
            50,
            pz + (R() - 0.5) * 30,
            (R() - 0.5) * 20,
            110,
            (R() - 0.5) * 20,
            1.6,
            [0.14, 0.14, 0.14],
          );
        const back = Math.max(0, Math.min(1, (u - 3.0) / 1.0));
        if (u > 1.1) {
          mat.color.copy(new THREE.Color(0x151515).lerp(orig, back));
          emi(mat).setRGB(0.2 * (1 - back), 0.07 * (1 - back), 0);
        }
      }
      sm.step(dt, -40, 0.6);
    });
    this.fxG.remove(scorch);
    scorch.geometry.dispose();
    scorch.material.dispose();
    pw.rotation.set(0, 0, 0);
    mat.color.copy(orig);
    emi(mat).setRGB(0, 0, 0);
    lt.intensity = 0;
  }

  private async kering(C: FxCtx): Promise<void> {
    const mkCrack = (inner: boolean) =>
      mkTex((x, S) => {
        const n = inner ? 46 : 60;
        const pts: [number, number][] = [];
        const cols: [number, number, number][] = [];
        for (let i = 0; i < n; i++) {
          pts.push([R() * S, R() * S]);
          const b = 0.78 + R() * 0.22;
          cols.push([Math.floor(150 * b + 20), Math.floor(112 * b + 10), Math.floor(70 * b)]);
        }
        const im = x.createImageData(S, S);
        const dd = im.data;
        const cell = (S / Math.sqrt(n)) * 1.5;
        for (let py = 0; py < S; py++)
          for (let px = 0; px < S; px++) {
            let d1 = 1e9;
            let d2 = 1e9;
            let k1 = 0;
            for (let i = 0; i < n; i++) {
              const q = pts[i]!;
              const dx = Math.min(Math.abs(px - q[0]), S - Math.abs(px - q[0]));
              const dy = Math.min(Math.abs(py - q[1]), S - Math.abs(py - q[1]));
              const d = dx * dx + dy * dy;
              if (d < d1) {
                d2 = d1;
                d1 = d;
                k1 = i;
              } else if (d < d2) d2 = d;
            }
            const e = Math.sqrt(d2) - Math.sqrt(d1);
            const cr = e < 2.2 ? 1 : e < 5 ? (5 - e) / 2.8 : 0;
            const c = cols[k1]!;
            const sh = 0.88 + 0.12 * Math.min(1, (e / cell) * 3);
            const q = (py * S + px) * 4;
            const dx2 = px / S - 0.5;
            const dy2 = py / S - 0.5;
            const rr = Math.sqrt(dx2 * dx2 + dy2 * dy2) * 2;
            const nz =
              Math.sin(px * 0.07 + py * 0.05) * 0.07 + Math.sin(px * 0.19 - py * 0.11) * 0.04;
            const al = Math.max(0, Math.min(1, (1 - (rr + nz)) / 0.42));
            dd[q] = c[0] * sh * (1 - cr * 0.88);
            dd[q + 1] = c[1] * sh * (1 - cr * 0.9);
            dd[q + 2] = c[2] * sh * (1 - cr * 0.9);
            dd[q + 3] = 255 * al * (cr > 0.4 ? 1 : 0.92);
          }
        x.putImageData(im, 0, 0);
      }, 256);
    const big = new THREE.Mesh(
      new THREE.CircleGeometry(900, 40),
      new THREE.MeshBasicMaterial({
        map: mkCrack(false),
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    big.rotation.x = -Math.PI / 2;
    big.position.set(C.x, 3, C.z);
    this.fxG.add(big);
    const sm = new THREE.Mesh(
      new THREE.CircleGeometry(400, 36),
      new THREE.MeshBasicMaterial({
        map: mkCrack(true),
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    sm.rotation.x = -Math.PI / 2;
    sm.position.set(C.x, 12.4, C.z);
    this.fxG.add(sm);
    const sun = this.mk(new THREE.SphereGeometry(110, 24, 16), 0xffd24a, {
      emissive: 0xffb020,
      emissiveIntensity: 1.5,
    });
    sun.castShadow = false;
    const gl = this.glow(0xffa030, 900, 0.7);
    const cac = this.emo('🌵', 120, 0);
    const wil = this.emo('🥀', 90, 0);
    const dust = this.emitter(220, {
      size: 150,
      additive: false,
      opacity: 0.5,
    });
    const heat = this.emitter(80, { size: 120, opacity: 0.2 });
    const tw = new THREE.Mesh(
      new THREE.IcosahedronGeometry(46, 1),
      new THREE.MeshBasicMaterial({ color: 0x7a5a30, wireframe: true }),
    );
    this.fxG.add(tw);
    const kdust = this.emitter(120, {
      size: 50,
      additive: false,
      opacity: 0.3,
    });
    const vic = makeVictim(this.d.pawns, C.pi, 'dry', {
      total: 4.2,
      dir: [C.tx, C.tz],
      emit: (...a) => kdust.spawn(...a),
    });
    await this.run(4.2, (p, dt, el) => {
      vic.step(dt, el);
      kdust.step(dt, 10, 0.8);
      const u = ez(Math.min(1, el / 1.6));
      const d = p > 0.82 ? (1 - p) * 5.5 : 1;
      this.fxS.warm = u * 0.9 * d;
      this.fxS.glow = 0.4 * u * d;
      this.hold(0.2 * u * d, '#ff9a30');
      sun.position.set(C.x + 300, 850 + Math.sin(el) * 10, C.z + 100);
      sun.scale.setScalar(0.6 + u * 0.6);
      gl.position.copy(sun.position);
      gl.material.opacity = 0.7 * u * d;
      big.material.opacity = Math.min(0.9, u) * d;
      sm.material.opacity = Math.min(0.95, Math.max(0, (el - 0.4) / 1.2)) * d;
      const sc = 0.55 + 0.45 * u;
      big.scale.set(sc, sc, 1);
      sm.scale.set(sc, sc, 1);
      cac.position.set(C.x - 130, 100, C.z);
      cac.material.opacity = u * d;
      wil.position.set(C.x + 140, 90 + Math.sin(el * 3) * 6, C.z + 60);
      wil.material.opacity = u * d;
      const tt = -900 + el * 500;
      tw.position.set(C.x + C.tx * tt, 46 + Math.abs(Math.sin(el * 5)) * 26, C.z + C.tz * tt);
      tw.rotation.x += dt * 5;
      tw.rotation.z += dt * 3;
      tw.visible = Math.abs(tt) < 1000;
      if (Math.random() < 0.7)
        dust.spawn(
          C.x + (R() - 0.5) * 800,
          20,
          C.z + (R() - 0.5) * 800,
          C.tx * 90,
          40 + R() * 60,
          C.tz * 90,
          2.2,
          [0.8, 0.65, 0.42],
        );
      dust.step(dt, -15, 0.5);
      if (Math.random() < 0.5)
        heat.spawn(
          C.x + (R() - 0.5) * 700,
          20,
          C.z + (R() - 0.5) * 700,
          0,
          90,
          0,
          1.4,
          [1, 0.85, 0.6],
        );
      heat.step(dt, -40, 0.5);
    });
    vic.end();
  }

  private async puting(C: FxCtx): Promise<void> {
    const cam = this.d.cam;
    const HT = 880;
    const RT = 330;
    const RB = 24;
    const SW = 90;
    const kn = this.knocker(C);
    const pw = kn.pw;
    const T = 4.9;
    // kamera mundur supaya seluruh corong sampai awan induk terlihat
    cam.dist = 3000;
    cam.tilt = 62;
    cam.ty = HT * 0.42;
    /* corong: tiga lapis bersarang dengan kecepatan putar dan kegelapan berbeda */
    const layers = [
      {
        o: 0.5,
        m: makeFunnel({
          height: HT,
          rTop: RT * 1.2,
          rBot: RB * 1.6,
          opacity: 0.8,
          spin: 1.4,
          color: 0xc4bfb2,
          scale: 2.2,
          sway: SW,
        }),
      },
      {
        o: 0.66,
        m: makeFunnel({
          height: HT,
          rTop: RT,
          rBot: RB,
          opacity: 0.9,
          spin: 2.2,
          color: 0x948e82,
          scale: 3.1,
          sway: SW,
        }),
      },
      {
        o: 0.6,
        m: makeFunnel({
          height: HT,
          rTop: RT * 0.55,
          rBot: RB * 0.6,
          opacity: 0.85,
          spin: 3.2,
          color: 0x4b453e,
          scale: 3.9,
          sway: SW,
        }),
      },
    ];
    layers.forEach((l) => this.fxG.add(l.m));
    /* awan induk gelap di puncak corong */
    const wall = Array.from({ length: 30 }, (_, i) => {
      const spr = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.smokeTex[i % this.smokeTex.length]!,
          transparent: true,
          depthWrite: false,
          opacity: 0,
        }),
      );
      const shade = 0.27 + R() * 0.2;
      spr.material.color.setRGB(shade * 0.95, shade, shade * 1.1);
      this.fxG.add(spr);
      const r = R() * RT * 1.7;
      return {
        spr,
        a: R() * TAU,
        r,
        y: HT - 70 + R() * 140 - r * 0.06,
        size: 380 + R() * 320,
        w: 0.3 + R() * 0.35,
      };
    });
    const dust = this.puffs(120);
    const mid = this.puffs(90);
    const deb: { m: THREE.Mesh; h: number; a: number; w: number }[] = [];
    for (let i = 0; i < 34; i++) {
      const m = this.mk(
        i % 3 === 0 ? new THREE.BoxGeometry(56, 8, 36) : new THREE.BoxGeometry(40, 6, 26),
        i % 3 === 0 ? 0x6a4a34 : 0x9c5a3a,
      );
      deb.push({ m, h: 50 + R() * 700, a: R() * TAU, w: 2.5 + R() * 3.5 });
    }
    const stuff = ['🌴', '🏠', '🪑', '🛵', '📦', '🌳'].map((e) => ({
      s: this.emo(e, 150, 1),
      h: 120 + R() * 500,
      a: R() * TAU,
      w: 2 + R() * 2,
    }));
    const dz = this.emo('😵', 130, 0);
    this.fxS.dim = 0.74;
    this.fxS.warm = 0;
    const lt = this.lite(0xaabbcc, 1.6, 1600, C.x, 260, C.z);
    let cap = 0;
    let rel = 0;
    let ang = 0;
    let t0 = 0;
    let sx0 = 0;
    let sz0 = 0;
    let accD = 0;
    let accM = 0;
    const orbit = (h: number) => funnelR(h / HT, RT, RB) + 55;
    await this.run(T + 3.4, (_p, dt, el) => {
      const q = Math.min(1, el / T);
      const u = -760 + 1520 * ez(q);
      const cx = C.x + C.tx * u;
      const cz = C.z + C.tz * u;
      const st = q < 0.1 ? q * 10 : q > 0.9 ? (1 - q) * 10 : el > T ? 0 : 1;
      const grow = Math.min(1, el / 1.4);
      layers.forEach((l, i) => {
        const un = l.m.material.uniforms;
        un.uTime!.value = el + i * 3.7;
        un.uGrow!.value = grow;
        un.uOpacity!.value = l.o * Math.min(1, st * 1.4);
        const k = 0.3 + 0.7 * st;
        l.m.scale.set(k, 1, k);
        l.m.position.set(cx, 4, cz);
        l.m.visible = st > 0.01;
      });
      wall.forEach((o) => {
        o.a += o.w * dt;
        const [sx, sz] = funnelSway(1, el, SW);
        o.spr.position.set(cx + sx + Math.cos(o.a) * o.r, o.y, cz + sz + Math.sin(o.a) * o.r);
        o.spr.scale.set(o.size, o.size * 0.7, 1);
        o.spr.material.rotation += dt * 0.08;
        o.spr.material.opacity = 0.8 * Math.min(1, el / 0.7) * Math.min(1, st * 1.3);
      });
      /* debu tebal di dasar dan serpihan di sepanjang corong */
      if (st > 0.2) {
        accD += dt * 46;
        while (accD >= 1) {
          accD--;
          const a = R() * TAU;
          const r = 40 + R() * 200;
          dust.spawn({
            x: cx + Math.cos(a) * r,
            y: 14,
            z: cz + Math.sin(a) * r,
            vx: -Math.sin(a) * 340 + Math.cos(a) * 110,
            vy: 40 + R() * 110,
            vz: Math.cos(a) * 340 + Math.sin(a) * 110,
            life: 1.9,
            s0: 130,
            s1: 360 + R() * 140,
            c0: [0.66, 0.56, 0.44],
            c1: [0.5, 0.45, 0.4],
            op: 0.5,
            spin: (R() - 0.5) * 1.4,
          });
        }
        accM += dt * 38;
        while (accM >= 1) {
          accM--;
          const h = R() * HT * 0.62;
          const a = R() * TAU;
          const r = funnelR(h / HT, RT, RB) * (0.85 + R() * 0.3);
          const [sx, sz] = funnelSway(h / HT, el, SW);
          mid.spawn({
            x: cx + sx + Math.cos(a) * r,
            y: h,
            z: cz + sz + Math.sin(a) * r,
            vx: -Math.sin(a) * (300 + R() * 160),
            vy: 90 + R() * 140,
            vz: Math.cos(a) * (300 + R() * 160),
            life: 1.3,
            s0: 70,
            s1: 190 + R() * 90,
            c0: [0.5, 0.43, 0.36],
            c1: [0.4, 0.37, 0.34],
            op: 0.32,
            spin: (R() - 0.5) * 2,
          });
        }
      }
      dust.step(dt, 0.8, 0);
      mid.step(dt, 0.6, 0);
      deb.forEach((d) => {
        d.a += d.w * dt;
        const r = orbit(d.h) * st + 10;
        const [sx, sz] = funnelSway(d.h / HT, el, SW);
        d.m.position.set(
          cx + sx * st + Math.cos(d.a) * r,
          d.h * st + 20,
          cz + sz * st + Math.sin(d.a) * r,
        );
        d.m.rotation.x += dt * 8;
        d.m.rotation.y += dt * 5;
        d.m.visible = st > 0.02;
      });
      stuff.forEach((o) => {
        o.a += o.w * dt;
        const r = (orbit(o.h) + 25) * st + 10;
        const [sx, sz] = funnelSway(o.h / HT, el, SW);
        o.s.position.set(
          cx + sx * st + Math.cos(o.a) * r,
          o.h * st + 40,
          cz + sz * st + Math.sin(o.a) * r,
        );
        o.s.material.opacity = Math.min(1, st * 1.5);
      });
      lt.position.set(cx, 260, cz);
      lt.intensity = 1.6 + (Math.random() < 0.08 ? 5 : 0);
      if (Math.random() < 0.025) this.flash(0.16, '#dfe8ff');
      cam.shake = Math.max(cam.shake, 18 * st);
      if (pw) {
        if (!cap && el < T * 0.85 && Math.hypot(pw.position.x - cx, pw.position.z - cz) < 300) {
          cap = 1;
          kn.grab();
          t0 = el;
          ang = Math.atan2(pw.position.z - cz, pw.position.x - cx);
          sx0 = pw.position.x - cx;
          sz0 = pw.position.z - cz;
        }
        if (cap && !rel) {
          const ti = el - t0;
          const k = ez(Math.min(1, ti / 1.1));
          ang += (5.5 + k * 2.5) * dt;
          const r = (1 - k) * Math.hypot(sx0, sz0) + k * (90 + ti * 18);
          pw.position.set(
            cx + Math.cos(ang) * r,
            13 + k * 430 + Math.sin(ti * 3) * 50,
            cz + Math.sin(ang) * r,
          );
          pw.rotation.x += dt * (5 + k * 4);
          pw.rotation.z += dt * (3 + k * 5);
          pw.rotation.y += dt * 7;
          dz.position.set(pw.position.x, pw.position.y + 130, pw.position.z);
          dz.material.opacity = k > 0.3 ? 0.9 : 0;
          if (el > T * 0.86) {
            rel = 1;
            dz.material.opacity = 0;
            const sp = Math.hypot(Math.cos(ang), Math.sin(ang)) * (r * 7.5);
            kn.launch(
              -Math.sin(ang) * sp + C.tx * 260,
              260,
              Math.cos(ang) * sp + C.tz * 260,
              9,
              7,
              false,
            );
          }
        }
      }
      kn.step(dt);
    });
    kn.end();
  }

  private async meteor(C: FxCtx, count: number): Promise<void> {
    const cam = this.d.cam;
    const tr = this.emitter(900, { size: 50 });
    const sm = this.emitter(260, { size: 140, additive: false, opacity: 0.75 });
    const sk = this.emitter(300, { size: 40 });
    const big = count > 1;
    const kn = this.knocker(C);
    const bl: {
      a0: number;
      m: THREE.Mesh;
      g: THREE.Sprite;
      sx: number;
      sz: number;
      tx: number;
      tz: number;
      t0: number;
      dur: number;
      hit: boolean;
      sc: number;
    }[] = [];
    for (let k = 0; k < count; k++) {
      const a = R() * TAU;
      const aim = kn.pw && k === (big ? 1 : 0);
      const tx = aim && kn.pw ? kn.pw.position.x : C.x + (big ? (R() - 0.5) * 340 : 0);
      const tz = aim && kn.pw ? kn.pw.position.z : C.z + (big ? (R() - 0.5) * 340 : 0);
      const last = big && k === count - 1;
      const m = this.mk(new THREE.IcosahedronGeometry(last ? 54 : 30, 1), 0x2a1c14, {
        emissive: 0xff5a10,
        emissiveIntensity: 1.3,
      });
      const g = this.glow(0xff7a20, last ? 340 : 220, 0.9);
      bl.push({
        a0: a,
        m,
        g,
        sx: tx + Math.cos(a) * 1500,
        sz: tz + Math.sin(a) * 1500,
        tx,
        tz,
        t0: k * 0.3 + (big ? 0.2 : 0),
        dur: 1.05,
        hit: false,
        sc: last ? 1.4 : 1,
      });
    }
    const rings: { r: THREE.Sprite; t: number; l: THREE.PointLight }[] = [];
    const deb: { m: THREE.Mesh; v: number[] }[] = [];
    const scorch: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>[] = [];
    const ft = (big ? count * 0.3 + 0.9 + 2.2 : 3.3) + (kn.pw ? 3.4 : 0);
    await this.run(ft, (p, dt, el) => {
      bl.forEach((b) => {
        const u = (el - b.t0) / b.dur;
        if (u < 0) {
          b.m.visible = b.g.visible = false;
          return;
        }
        if (u < 1) {
          b.m.visible = b.g.visible = true;
          const e = Math.pow(u, 1.5);
          const x = b.sx + (b.tx - b.sx) * e;
          const z = b.sz + (b.tz - b.sz) * e;
          const y = 2000 * (1 - e) + 16;
          b.m.position.set(x, y, z);
          b.g.position.set(x, y, z);
          b.m.rotation.x += dt * 5;
          for (let k = 0; k < 6; k++)
            tr.spawn(
              x + (R() - 0.5) * 30,
              y + (R() - 0.5) * 30,
              z + (R() - 0.5) * 30,
              (R() - 0.5) * 60 + (b.sx - b.tx) * 0.12,
              (R() - 0.3) * 60,
              (R() - 0.5) * 60 + (b.sz - b.tz) * 0.12,
              0.7,
              [1, 0.5 + R() * 0.4, 0.1],
            );
          if (u > 0.55) cam.shake = Math.max(cam.shake, 8 * (u - 0.5) * 2);
        } else if (!b.hit) {
          b.hit = true;
          b.m.visible = b.g.visible = false;
          const X = b.tx;
          const Z = b.tz;
          const s = b.sc;
          this.flash(big ? 0.55 : 0.8, '#fff0c0');
          cam.shake = Math.max(cam.shake, 60 * s);
          if (kn.pw) {
            const dx = kn.pw.position.x - X;
            const dz = kn.pw.position.z - Z;
            const d0 = Math.hypot(dx, dz);
            if (d0 < 340) {
              const l = d0 < 25 ? 1 : d0;
              const ux = d0 < 25 ? Math.cos(b.a0) : dx / l;
              const uz = d0 < 25 ? Math.sin(b.a0) : dz / l;
              const pw2 = (640 + R() * 220) * (s > 1 ? 1.25 : 1);
              kn.launch(ux * pw2, 1050 * (s > 1 ? 1.2 : 1), uz * pw2, 11, 8, true, sm);
            }
          }
          const l = this.lite(0xffa040, 8, 1800, X, 160, Z);
          const r = this.ringSp(0xffcc88, 0.9);
          r.position.set(X, 30, Z);
          rings.push({ r, t: 0, l });
          for (let i = 0; i < 34; i++) {
            const a = R() * TAU;
            const sp = 160 + R() * 520;
            sk.spawn(
              X,
              24,
              Z,
              Math.cos(a) * sp,
              300 + R() * 520,
              Math.sin(a) * sp,
              1.2 + R() * 0.6,
              [1, 0.6, 0.15],
            );
          }
          for (let i = 0; i < 8; i++) {
            const m = this.rock((8 + R() * 14) * s);
            m.position.set(X, 24, Z);
            const a = R() * TAU;
            const sp = 160 + R() * 320;
            deb.push({
              m,
              v: [Math.cos(a) * sp, 380 + R() * 380, Math.sin(a) * sp],
            });
          }
          for (let i = 0; i < 22; i++) {
            const a = R() * TAU;
            const sp = 40 + R() * 140;
            sm.spawn(
              X + Math.cos(a) * 40,
              30,
              Z + Math.sin(a) * 40,
              Math.cos(a) * sp,
              120 + R() * 190,
              Math.sin(a) * sp,
              2.8,
              [0.16, 0.14, 0.13],
            );
          }
          const sc = new THREE.Mesh(
            new THREE.CircleGeometry(150 * s, 28),
            new THREE.MeshBasicMaterial({
              color: 0x140c08,
              transparent: true,
              opacity: 0.65,
              depthWrite: false,
              polygonOffset: true,
              polygonOffsetFactor: -5,
            }),
          );
          sc.rotation.x = -Math.PI / 2;
          sc.position.set(X, 13.1, Z);
          this.fxG.add(sc);
          scorch.push(sc);
        }
      });
      rings.forEach((o) => {
        o.t += dt;
        const s = 60 + o.t * 1500;
        o.r.scale.set(s, s, 1);
        o.r.material.opacity = Math.max(0, 0.9 * (1 - o.t / 1));
        o.l.intensity = Math.max(0, 8 * (1 - o.t / 0.7));
      });
      deb.forEach((d) => {
        d.v[1]! -= 900 * dt;
        const m = d.m;
        m.position.x += d.v[0]! * dt;
        m.position.y += d.v[1]! * dt;
        m.position.z += d.v[2]! * dt;
        m.rotation.x += dt * 7;
        if (m.position.y < 14) {
          m.position.y = 14;
          d.v[1]! *= -0.3;
          d.v[0]! *= 0.6;
          d.v[2]! *= 0.6;
        }
      });
      kn.step(dt);
      tr.step(dt, -40, 1);
      sm.step(dt, -50, 0.6);
      sk.step(dt, 500, 0.2);
      if (p > 0.85) scorch.forEach((s) => (s.material.opacity = (0.65 * (1 - p)) / 0.15));
    });
    kn.end();
  }
}

function mkTex(
  draw: (x: CanvasRenderingContext2D, s: number) => void,
  s = 64,
): THREE.CanvasTexture {
  const { c, x } = canvas2d(s);
  draw(x, c.width);
  return new THREE.CanvasTexture(c);
}
