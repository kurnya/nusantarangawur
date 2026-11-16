/**
 * Awan, hujan lokal, asap gunung, lava, serta tampilan cuaca global (mendung, hujan yang mengikuti
 * kamera, kilat badai, kabut, overlay warna). Semua hanya tampilan; aturan cuaca ada di mesin.
 */
import * as THREE from 'three';
import type { WeatherKey } from '../engine/types';
import type { Cam } from './camera';
import { G } from './layout';
import { TAU, canvas2d, clamp, lerp } from './util';
import { FOGC, HH, ISL, WATER_Y, WW, X0, X1, Z0, Z1, islandH } from './world';

interface WxVis {
  lt: number;
  hemi: number;
  sun: number;
  warm: number;
  oc: number;
  ocd: number;
  cwhite: number;
  crain: number;
  rain: number;
  storm: number;
  fc: number;
  an: number;
  af: number;
  rn: number;
  rf: number;
  bg: string;
  ovop: number;
}

const WXV: Record<WeatherKey | 'off', WxVis> = {
  off: {
    lt: 1,
    hemi: 1,
    sun: 1,
    warm: 0,
    oc: 0,
    ocd: 0,
    cwhite: 1,
    crain: 1,
    rain: 0,
    storm: 0,
    fc: 0xcfe8ef,
    an: 14000,
    af: 50000,
    rn: 0,
    rf: 0,
    bg: '',
    ovop: 0,
  },
  cerah: {
    lt: 1,
    hemi: 1.05,
    sun: 1.25,
    warm: 0.08,
    oc: 0,
    ocd: 0,
    cwhite: 0.35,
    crain: 0,
    rain: 0,
    storm: 0,
    fc: 0xcfe8ef,
    an: 14000,
    af: 50000,
    rn: 0,
    rf: 0,
    bg: 'radial-gradient(ellipse at 85% 0%,#fff3b8aa 0%,#fff3b800 55%)',
    ovop: 0.7,
  },
  berawan: {
    lt: 0.92,
    hemi: 1,
    sun: 0.55,
    warm: 0,
    oc: 0.5,
    ocd: 0,
    cwhite: 1,
    crain: 0,
    rain: 0,
    storm: 0,
    fc: 0xd3dde3,
    an: 12000,
    af: 44000,
    rn: 0,
    rf: 0,
    bg: 'linear-gradient(#ffffff22,#ffffff00 60%)',
    ovop: 0.5,
  },
  hujan: {
    lt: 0.66,
    hemi: 0.7,
    sun: 0.2,
    warm: 0,
    oc: 0.8,
    ocd: 0.75,
    cwhite: 0,
    crain: 0.7,
    rain: 1,
    storm: 0,
    fc: 0x9fb0ba,
    an: 7000,
    af: 26000,
    rn: 0,
    rf: 0,
    bg: 'linear-gradient(#2a3a4a55,#3a4a5a22)',
    ovop: 1,
  },
  badai: {
    lt: 0.6,
    hemi: 0.8,
    sun: 0.15,
    warm: 0,
    oc: 0.95,
    ocd: 1,
    cwhite: 0,
    crain: 1,
    rain: 1.7,
    storm: 1,
    fc: 0x7c8896,
    an: 4800,
    af: 20000,
    rn: 0,
    rf: 0,
    bg: 'linear-gradient(#0a121f77,#1a253633 60%)',
    ovop: 1,
  },
  panas: {
    lt: 1,
    hemi: 1.05,
    sun: 1.7,
    warm: 0.55,
    oc: 0,
    ocd: 0,
    cwhite: 0,
    crain: 0,
    rain: 0,
    storm: 0,
    fc: 0xf6e0b2,
    an: 11000,
    af: 38000,
    rn: 0,
    rf: 0,
    bg: 'radial-gradient(ellipse at 80% -5%,#fff2a0cc 0%,#ffb03a44 38%,#ff7a1a14 75%)',
    ovop: 1,
  },
  kabut: {
    lt: 0.9,
    hemi: 0.95,
    sun: 0.4,
    warm: 0,
    oc: 0.1,
    ocd: 0,
    cwhite: 0.5,
    crain: 0,
    rain: 0,
    storm: 0,
    fc: 0xdfe6ea,
    an: 0,
    af: 0,
    rn: 0.75,
    rf: 2.7,
    bg: 'linear-gradient(#f1f5f7aa,#e6ecefbb)',
    ovop: 0.55,
  },
  asap: {
    lt: 0.74,
    hemi: 0.8,
    sun: 0.3,
    warm: 0.3,
    oc: 0.25,
    ocd: 0.5,
    cwhite: 0,
    crain: 0,
    rain: 0,
    storm: 0,
    fc: 0xb8a38b,
    an: 0,
    af: 0,
    rn: 0.5,
    rf: 2.0,
    bg: 'linear-gradient(#8a6a4a88,#9c8467aa)',
    ovop: 0.85,
  },
};

/** Nilai cuaca yang sedang berlaku (berpindah halus ke target). */
export interface WxNow {
  lt: number;
  hemi: number;
  sun: number;
  warm: number;
  oc: number;
  ocd: number;
  cwhite: number;
  crain: number;
  rain: number;
  storm: number;
  fogc: THREE.Color;
  near: number;
  far: number;
}

interface Cloud {
  g: THREE.Group;
  sprites: THREE.Sprite[];
  rain: boolean;
  vx: number;
  vz: number;
  alt: number;
  shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  rainGeo?: THREE.BufferGeometry;
  drops?: { x: number; z: number; y: number; v: number }[];
}

export interface SkyDeps {
  scene: THREE.Scene;
  root: THREE.Group;
  stage: HTMLElement;
  rnd: () => number;
  cam: Cam;
  waterMat: THREE.ShaderMaterial;
  flash: (op: number, col?: string) => void;
  rainDrops: number;
}

const KEYS = [
  'lt',
  'hemi',
  'sun',
  'warm',
  'oc',
  'ocd',
  'cwhite',
  'crain',
  'rain',
  'storm',
] as const;

export class Sky {
  readonly W: WxNow;
  readonly craterY: number;
  private target: WxVis = WXV.cerah;
  private readonly cloudTex: THREE.CanvasTexture;
  private readonly clouds: Cloud[] = [];
  private readonly smoke: THREE.Sprite[] = [];
  private readonly lavaLight: THREE.PointLight;
  private readonly ocS: THREE.Sprite[] = [];
  private readonly wxov: HTMLDivElement;
  private wxTimer = 0;
  private readonly RN: number;
  private readonly rpos: Float32Array;
  private readonly rdr: { x: number; z: number; y: number; v: number }[] = [];
  private readonly rgeo: THREE.BufferGeometry;
  private readonly rainAll: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private readonly stBolt: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private stNext = 2;
  private stBoltT = 0;
  private readonly tmpC = new THREE.Color();
  private readonly tmp = new THREE.Vector3();

  constructor(private readonly d: SkyDeps) {
    const { root, rnd } = d;
    this.W = {
      ...pickNums(WXV.cerah),
      fogc: new THREE.Color(FOGC),
      near: 14000,
      far: 50000,
    };
    this.cloudTex = (() => {
      const { c, x } = canvas2d(256);
      for (let k = 0; k < 30; k++) {
        const r = 26 + rnd() * 54;
        const px = 128 + (rnd() - 0.5) * 120;
        const py = 128 + (rnd() - 0.5) * 70;
        const g = x.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, 'rgba(255,255,255,.55)');
        g.addColorStop(0.6, 'rgba(255,255,255,.22)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g;
        x.beginPath();
        x.arc(px, py, r, 0, TAU);
        x.fill();
      }
      return new THREE.CanvasTexture(c);
    })();
    const shadowTex = (() => {
      const { c, x } = canvas2d(128);
      const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(0,10,20,.55)');
      g.addColorStop(1, 'rgba(0,10,20,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    })();
    const makeCloud = (rain: boolean, x: number, z: number, alt: number) => {
      const g = new THREE.Group();
      const sprites: THREE.Sprite[] = [];
      const n = rain ? 20 : 11;
      for (let k = 0; k < n; k++) {
        const col = rain
          ? new THREE.Color().setHSL(0.6, 0.12, 0.32 + rnd() * 0.14)
          : new THREE.Color(0xffffff);
        const m = new THREE.SpriteMaterial({
          map: this.cloudTex,
          color: col,
          transparent: true,
          opacity: rain ? 0.8 : 0.7,
          depthWrite: false,
          rotation: rnd() * TAU,
          fog: false,
        });
        const s = new THREE.Sprite(m);
        const sz = (rain ? 640 : 520) * (0.7 + rnd() * 0.7);
        s.scale.set(sz, sz * 0.62, 1);
        s.position.set(
          (rnd() - 0.5) * (rain ? 760 : 600),
          (rnd() - 0.3) * (rain ? 150 : 90),
          (rnd() - 0.5) * (rain ? 520 : 400),
        );
        g.add(s);
        sprites.push(s);
      }
      g.position.set(x, alt, z);
      root.add(g);
      const vx = 20 + rnd() * 22;
      const vz = (rnd() - 0.5) * 10;
      const sh = new THREE.Mesh(
        new THREE.PlaneGeometry(rain ? 980 : 720, rain ? 720 : 520),
        new THREE.MeshBasicMaterial({
          map: shadowTex,
          transparent: true,
          depthWrite: false,
          opacity: rain ? 0.55 : 0.32,
        }),
      );
      sh.rotation.x = -Math.PI / 2;
      sh.position.y = -alt + WATER_Y + 1.5;
      g.add(sh);
      const c: Cloud = { g, sprites, rain, vx, vz, alt, shadow: sh };
      if (rain) {
        const N = 520;
        const pos = new Float32Array(N * 6);
        const dr: Cloud['drops'] = [];
        for (let k = 0; k < N; k++)
          dr.push({
            x: (rnd() - 0.5) * 700,
            z: (rnd() - 0.5) * 460,
            y: rnd() * alt,
            v: 780 + rnd() * 300,
          });
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const ls = new THREE.LineSegments(
          geo,
          new THREE.LineBasicMaterial({
            color: 0xcfe4f4,
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
          }),
        );
        ls.frustumCulled = false;
        g.add(ls);
        c.rainGeo = geo;
        c.drops = dr;
      }
      this.clouds.push(c);
    };
    for (let k = 0; k < 3; k++)
      makeCloud(
        true,
        X0 + (WW * (k + 0.5)) / 3 + (rnd() - 0.5) * 400,
        Z0 + HH * (0.25 + 0.5 * rnd()),
        760 + rnd() * 120,
      );
    for (let k = 0; k < 7; k++)
      makeCloud(false, X0 + rnd() * WW, Z0 + rnd() * HH, 1150 + rnd() * 260);

    /* asap gunung */
    this.craterY = islandH(ISL.cx, ISL.cz, ISL) + 30;
    for (let k = 0; k < 12; k++) {
      const m = new THREE.SpriteMaterial({
        map: this.cloudTex,
        color: 0x4a4644,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        rotation: rnd() * TAU,
      });
      const s = new THREE.Sprite(m);
      s.userData = { t: k / 12 };
      root.add(s);
      this.smoke.push(s);
    }
    const lava = new THREE.Mesh(
      new THREE.SphereGeometry(ISL.R * 0.055, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xff6a2a }),
    );
    lava.scale.y = 0.4;
    lava.position.set(ISL.cx, this.craterY - ISL.H * 0.06, ISL.cz);
    d.scene.add(lava);
    this.lavaLight = new THREE.PointLight(0xff7733, 1.4, 700);
    this.lavaLight.position.set(ISL.cx, this.craterY + 10, ISL.cz);
    d.scene.add(this.lavaLight);

    /* overlay warna cuaca di atas kanvas */
    this.wxov = document.createElement('div');
    this.wxov.className = 'wxov';
    d.stage.appendChild(this.wxov);

    /* lapisan mendung di atas seluruh peta */
    const nx = 7;
    const nz = 5;
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < nz; j++) {
        const m = new THREE.SpriteMaterial({
          map: this.cloudTex,
          color: 0xffffff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          rotation: rnd() * TAU,
          fog: false,
        });
        const sp = new THREE.Sprite(m);
        const sz = (WW / nx) * (1.7 + rnd() * 0.7);
        sp.scale.set(sz, sz * 0.7, 1);
        sp.position.set(
          X0 + (WW * (i + 0.5)) / nx + (((rnd() - 0.5) * WW) / nx) * 0.6,
          1380 + rnd() * 120,
          Z0 + (HH * (j + 0.5)) / nz + (((rnd() - 0.5) * HH) / nz) * 0.6,
        );
        root.add(sp);
        this.ocS.push(sp);
      }

    /* hujan global yang mengikuti kamera */
    this.RN = 2600;
    for (let k = 0; k < this.RN; k++)
      this.rdr.push({ x: rnd() - 0.5, z: rnd() - 0.5, y: rnd(), v: 0.75 + rnd() * 0.5 });
    this.RN = Math.min(this.RN, d.rainDrops);
    this.rpos = new Float32Array(this.RN * 6);
    this.rgeo = new THREE.BufferGeometry();
    this.rgeo.setAttribute('position', new THREE.BufferAttribute(this.rpos, 3));
    this.rgeo.setDrawRange(0, 0);
    this.rainAll = new THREE.LineSegments(
      this.rgeo,
      new THREE.LineBasicMaterial({
        color: 0xcfe4f4,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    );
    this.rainAll.frustumCulled = false;
    root.add(this.rainAll);
    /* kilat badai */
    this.stBolt = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: 0xe8f0ff,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      }),
    );
    this.stBolt.frustumCulled = false;
    this.stBolt.visible = false;
    root.add(this.stBolt);
  }

  setWeather(k: WeatherKey, immediate = false): void {
    this.target = WXV[k] ?? WXV.cerah;
    const ov = this.wxov;
    ov.style.opacity = '0';
    clearTimeout(this.wxTimer);
    const apply = () => {
      ov.style.background = this.target.bg;
      ov.style.opacity = String(this.d.cam.weather ? this.target.ovop : 0);
    };
    if (immediate) {
      ov.style.transition = 'none';
      apply();
      void ov.offsetWidth;
      ov.style.transition = '';
    } else this.wxTimer = window.setTimeout(apply, 700);
  }

  /** dipanggil saat tombol "Cuaca: hidup/mati" ditekan */
  refreshOverlay(): void {
    this.wxov.style.opacity = String(this.d.cam.weather ? this.target.ovop : 0);
  }

  private stormBolt(): void {
    const cam = this.d.cam;
    const sp = clamp(cam.dist * 0.5, 700, 3600);
    const bx = cam.fx + (Math.random() - 0.5) * sp * 1.3;
    const bz = cam.fz + (Math.random() - 0.5) * sp * 1.3;
    const top = 1500;
    const pts: number[] = [];
    let x = bx + (Math.random() - 0.5) * 300;
    let y = top;
    let z = bz;
    const n = 16;
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const nx = bx + (x - bx) * (1 - t) + (Math.random() - 0.5) * 110 * (1 - t);
      const ny = top * (1 - t) + 14 * t;
      const nz = bz + (Math.random() - 0.5) * 80 * (1 - t);
      pts.push(x, y, z, nx, ny, nz);
      if (Math.random() < 0.25)
        pts.push(
          nx,
          ny,
          nz,
          nx + (Math.random() - 0.5) * 260,
          ny - 140 - Math.random() * 160,
          nz + (Math.random() - 0.5) * 200,
        );
      x = nx;
      y = ny;
      z = nz;
    }
    this.stBolt.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.stBoltT = 0.22;
    this.stBolt.visible = true;
  }

  step(dt: number, camera: THREE.Camera, scene: THREE.Scene): void {
    const { cam, waterMat, flash } = this.d;
    const W = this.W;
    const T = cam.weather ? this.target : WXV.off;
    const k = 1 - Math.exp(-dt * 1.3);
    KEYS.forEach((f) => {
      W[f] += (T[f] - W[f]) * k;
    });
    W.fogc.lerp(this.tmpC.setHex(T.fc), k);
    const tn = T.rn ? Math.max(300, cam.dist * T.rn) : Math.max(T.an, cam.dist * 1.15);
    const tf = T.rf ? Math.max(1500, cam.dist * T.rf) : Math.max(T.af, cam.dist * 3.2);
    W.near += (tn - W.near) * k;
    W.far += (tf - W.far) * k;
    const fog = scene.fog as THREE.Fog;
    fog.color.copy(W.fogc);
    fog.near = W.near;
    fog.far = W.far;
    const wu = waterMat.uniforms;
    (wu.uFogColor!.value as THREE.Color).copy(W.fogc);
    wu.uFogNear!.value = W.near;
    wu.uFogFar!.value = W.far;
    wu.uDark!.value = Math.min(1, 0.35 + 0.65 * W.lt);
    /* mendung */
    const above =
      camera.position.y > 1450 ? Math.max(0.3, 1 - (camera.position.y - 1450) / 3500) : 1;
    this.ocS.forEach((sp) => {
      const dd = camera.position.distanceTo(sp.position);
      const f = clamp((dd - 500) / 1100, 0, 1);
      sp.material.color.setRGB(
        lerp(0.95, 0.27, W.ocd),
        lerp(0.96, 0.3, W.ocd),
        lerp(0.98, 0.35, W.ocd),
      );
      sp.material.opacity = clamp(W.oc * 0.8 * f * above, 0, 0.95);
      sp.visible = sp.material.opacity > 0.01;
    });
    /* hujan */
    const ra = clamp(W.rain / 1.7, 0, 1);
    if (ra > 0.02 && cam.weather) {
      const sp = clamp(cam.dist * 0.6, 900, 5200);
      const Hh = clamp(cam.dist * 0.55, 800, 2800);
      const ln = clamp(cam.dist * 0.04, 44, 190);
      const cnt = Math.floor((this.RN * clamp(W.rain, 0, 1.7)) / 1.7);
      const rp = this.rpos;
      for (let i = 0; i < cnt; i++) {
        const dr = this.rdr[i]!;
        dr.y -= dr.v * dt * (0.9 + W.storm * 0.5) * (1100 / Hh);
        if (dr.y < 0) dr.y += 1;
        const yy = dr.y * Hh;
        const xx = cam.fx + dr.x * sp * 2;
        const zz = cam.fz + dr.z * sp * 2;
        rp[i * 6] = xx;
        rp[i * 6 + 1] = yy;
        rp[i * 6 + 2] = zz;
        rp[i * 6 + 3] = xx - ln * 0.06;
        rp[i * 6 + 4] = yy - ln;
        rp[i * 6 + 5] = zz;
      }
      (this.rgeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      this.rgeo.setDrawRange(0, cnt * 2);
      this.rainAll.visible = true;
      this.rainAll.material.opacity = 0.22 + 0.38 * ra;
    } else this.rainAll.visible = false;
    /* petir */
    if (W.storm > 0.5 && cam.weather) {
      this.stNext -= dt;
      if (this.stNext <= 0) {
        this.stNext = 1.6 + Math.random() * 4.5;
        this.stormBolt();
        flash(0.4 + Math.random() * 0.25, '#dfe8ff');
        window.setTimeout(() => flash(0.25, '#dfe8ff'), 130);
        cam.shake = Math.max(cam.shake, 5);
      }
    }
    if (this.stBolt.visible) {
      this.stBoltT -= dt;
      this.stBolt.visible = this.stBoltT > 0 && Math.random() > 0.18;
    }
  }

  /** awan, asap, lava per frame */
  stepDecor(dt: number, camera: THREE.Camera, clock: number): void {
    const { cam, rnd } = this.d;
    const W = this.W;
    this.clouds.forEach((c) => {
      const wa = cam.weather ? (c.rain ? W.crain : W.cwhite) : 0;
      c.g.visible = wa > 0.02;
      if (!c.g.visible) return;
      c.g.position.x += c.vx * dt;
      c.g.position.z += c.vz * dt;
      if (c.g.position.x > X1 + 1300) {
        c.g.position.x = X0 - 1300;
        c.g.position.z = Z0 + rnd() * HH;
      }
      if (c.g.position.z < Z0 - 300) c.g.position.z = Z1;
      if (c.g.position.z > Z1 + 300) c.g.position.z = Z0;
      const dd = camera.position.distanceTo(this.tmp.copy(c.g.position));
      const fade = clamp((dd - c.alt * 0.9) / (c.alt * 0.8), 0, 1);
      c.sprites.forEach((s) => {
        s.material.opacity = (c.rain ? 0.82 : 0.7) * fade * wa;
      });
      c.shadow.material.opacity = (c.rain ? 0.55 : 0.32) * (0.4 + 0.6 * fade) * wa;
      if (c.rainGeo && c.drops) {
        const pa = (c.rainGeo.attributes.position as THREE.BufferAttribute).array as Float32Array;
        c.drops.forEach((d2, k) => {
          d2.y -= d2.v * dt;
          if (d2.y < 0) d2.y += c.alt;
          const y = d2.y - c.alt + WATER_Y;
          pa[k * 6] = d2.x;
          pa[k * 6 + 1] = y;
          pa[k * 6 + 2] = d2.z;
          pa[k * 6 + 3] = d2.x - 3;
          pa[k * 6 + 4] = y - 46;
          pa[k * 6 + 5] = d2.z;
        });
        (c.rainGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      }
    });
    this.smoke.forEach((s) => {
      const u = s.userData;
      u.t = (u.t + dt * 0.045) % 1;
      const y = this.craterY + u.t * 1350 * G;
      s.position.set(ISL.cx + u.t * 390 * G + Math.sin(u.t * 9 + u.t) * 45, y, ISL.cz + u.t * 90);
      const sz = (270 + u.t * 780) * G;
      s.scale.set(sz, sz * 0.8, 1);
      s.material.opacity = 0.62 * (1 - u.t) * (cam.weather ? 1 : 0.9);
    });
    this.lavaLight.intensity = 1.2 + 0.4 * Math.sin(clock * 3);
  }
}

function pickNums(v: WxVis): Pick<WxNow, (typeof KEYS)[number]> {
  return {
    lt: v.lt,
    hemi: v.hemi,
    sun: v.sun,
    warm: v.warm,
    oc: v.oc,
    ocd: v.ocd,
    cwhite: v.cwhite,
    crain: v.crain,
    rain: v.rain,
    storm: v.storm,
  };
}
