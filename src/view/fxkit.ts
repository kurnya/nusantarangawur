/**
 * Perangkat bantu efek bencana yang lebih realistis:
 * - tekstur gumpalan asap (noise berlapis dengan bayangan arah cahaya),
 * - sistem gumpalan (sprite yang membesar, berputar, berubah warna dan memudar),
 * - corong puting beliung (shader garis-garis berputar yang menyempit ke bawah),
 * - petir bercabang.
 */
import * as THREE from 'three';
import { markShared } from './tiles';
import { TAU, canvas2d, clamp, fbm } from './util';

export type RGB3 = [number, number, number];

const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Gumpalan asap bertekstur, abu-abu dengan sisi terang di kiri atas agar tampak bervolume. */
export function makeSmokeTextures(count = 3, size = 128): THREE.CanvasTexture[] {
  const out: THREE.CanvasTexture[] = [];
  for (let k = 0; k < count; k++) {
    const { c, x } = canvas2d(size);
    const img = x.createImageData(size, size);
    const ox = k * 17.3 + 3.1;
    const oy = k * 9.7 + 1.7;
    const nz = (u: number, v: number) => fbm(u * 2.4 + ox, v * 2.4 + oy, 4);
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const u = (i / (size - 1)) * 2 - 1;
        const v = (j / (size - 1)) * 2 - 1;
        const r = Math.hypot(u, v);
        const edge = 1 - smooth(0.42, 1, r);
        const n = nz(u, v);
        const body = n * 0.95 + edge * 0.85 - 0.5;
        const a = smooth(0, 0.42, body) * Math.min(1, edge * 2.4);
        // cahaya dari kiri atas: selisih noise berarah
        const e = 0.05;
        const lit = (nz(u - e, v - e) - nz(u + e, v + e)) * 3.4;
        const sh = clamp(0.66 + lit + (1 - r) * 0.12, 0.28, 1);
        const p = (j * size + i) * 4;
        img.data[p] = sh * 255;
        img.data[p + 1] = sh * 252;
        img.data[p + 2] = sh * 246;
        img.data[p + 3] = a * 255;
      }
    }
    x.putImageData(img, 0, 0);
    out.push(markShared(new THREE.CanvasTexture(c)));
  }
  return out;
}

export interface PuffSpawn {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  /** ukuran awal dan akhir (sprite membesar seiring waktu) */
  s0: number;
  s1: number;
  c0: RGB3;
  c1: RGB3;
  /** opasitas puncak */
  op: number;
  /** kecepatan putar sprite (rad/detik) */
  spin?: number;
}

interface PuffP extends PuffSpawn {
  on: boolean;
  a: number;
  spr: THREE.Sprite;
}

/** Kolam sprite gumpalan. Setiap gumpalan punya material sendiri supaya warna dan opasitas bebas. */
export class Puffs {
  private readonly ps: PuffP[] = [];
  private cu = 0;
  constructor(group: THREE.Group, tex: THREE.Texture[], n: number, o: { additive?: boolean } = {}) {
    for (let i = 0; i < n; i++) {
      const spr = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: tex[i % tex.length]!,
          transparent: true,
          depthWrite: false,
          opacity: 0,
          blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
          rotation: Math.random() * TAU,
        }),
      );
      spr.visible = false;
      group.add(spr);
      this.ps.push({
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 1,
        s0: 1,
        s1: 1,
        c0: [1, 1, 1],
        c1: [1, 1, 1],
        op: 1,
        on: false,
        a: 0,
        spr,
      });
    }
  }

  spawn(o: PuffSpawn): void {
    const q = this.ps[this.cu]!;
    this.cu = (this.cu + 1) % this.ps.length;
    Object.assign(q, o, { on: true, a: 0 });
    q.spr.visible = true;
    q.spr.material.rotation = Math.random() * TAU;
  }

  /** `buoy`: percepatan naik (gumpalan panas), `wind`: kecepatan angin tambahan. */
  step(dt: number, drag = 0.4, buoy = 0, wind: [number, number] = [0, 0]): void {
    const dg = Math.exp(-drag * dt);
    for (const q of this.ps) {
      if (!q.on) continue;
      q.a += dt;
      if (q.a >= q.life) {
        q.on = false;
        q.spr.visible = false;
        continue;
      }
      const t = q.a / q.life;
      q.vy += buoy * dt;
      // hambatan udara relatif terhadap angin: gumpalan lama-lama ikut hanyut
      q.vx = wind[0] + (q.vx - wind[0]) * dg;
      q.vz = wind[1] + (q.vz - wind[1]) * dg;
      q.vy *= dg;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.z += q.vz * dt;
      // membesar cepat di awal lalu melambat, seperti gas yang mengembang
      const grow = 1 - (1 - t) * (1 - t);
      const s = q.s0 + (q.s1 - q.s0) * grow;
      const m = q.spr.material;
      q.spr.position.set(q.x, q.y, q.z);
      q.spr.scale.set(s, s, 1);
      m.rotation += (q.spin ?? 0.25) * dt;
      const ci = smooth(0, 0.38, t);
      m.color.setRGB(
        q.c0[0] + (q.c1[0] - q.c0[0]) * ci,
        q.c0[1] + (q.c1[1] - q.c0[1]) * ci,
        q.c0[2] + (q.c1[2] - q.c0[2]) * ci,
      );
      m.opacity = q.op * smooth(0, 0.1, t) * (1 - smooth(0.5, 1, t));
    }
  }
}

/* ---------------- corong puting beliung ---------------- */

const FUNNEL_VERT = /* glsl */ `
uniform float uTime;
uniform float uSway;
uniform float uHeight;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
varying float vH;
void main(){
  vUv = uv;
  vec3 p = position;
  float h = clamp(p.y / uHeight, 0.0, 1.0);
  p.x += sin(uTime*1.7 + h*5.0)*uSway*h*h + sin(uTime*0.9 + h*9.0)*uSway*0.35*h;
  p.z += cos(uTime*1.3 + h*4.0)*uSway*h*h;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  vH = h;
  gl_Position = projectionMatrix * mv;
}`;

const FUNNEL_FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uOpacity;
uniform float uSpin;
uniform float uGrow;
uniform float uScale;
uniform vec3 uColor;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
varying float vH;
float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p){ float s = 0.0, a = 0.5; for(int i=0;i<4;i++){ s += a*vn(p); p *= 2.03; a *= 0.5; } return s; }
void main(){
  // turun dari awan: bagian bawah baru tampak seiring uGrow
  if (vH < 1.0 - uGrow) discard;
  float a = vUv.x * 6.2831853 + uTime * uSpin * (1.0 + (1.0 - vH) * 1.6);
  vec2 ring = vec2(cos(a), sin(a)) * uScale;
  float n1 = fbm(ring + vec2(0.0, vH * 5.5 - uTime * 0.9));
  float n2 = fbm(ring * 2.1 + vec2(7.3, vH * 11.0 - uTime * 1.7));
  float streak = 0.35 + 0.65 * (n1 * 0.65 + n2 * 0.55);
  float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.25);
  float ground = smoothstep(0.0, 0.07, vH);
  float top = 1.0 - smoothstep(0.86, 1.0, vH);
  float tipFade = smoothstep(1.0 - uGrow, 1.0 - uGrow + 0.16, vH);
  float al = uOpacity * (0.22 + 0.78 * fres) * streak * ground * top * tipFade;
  // bagian bawah lebih gelap dan berdebu, atas lebih pucat
  vec3 col = mix(uColor * vec3(0.62, 0.55, 0.48), uColor * 1.12, smoothstep(0.0, 0.85, vH));
  col *= 0.7 + 0.5 * n1;
  gl_FragColor = vec4(col, clamp(al, 0.0, 1.0));
}`;

export interface FunnelOpts {
  height: number;
  rTop: number;
  rBot: number;
  opacity: number;
  spin: number;
  color: number;
  scale?: number;
  sway: number;
}

/** Jari-jari corong pada tinggi relatif t (0 dasar, 1 awan). */
export const funnelR = (t: number, rTop: number, rBot: number): number =>
  rBot + (rTop - rBot) * Math.pow(t, 2.2) + rTop * 0.1 * Math.sin(t * 9) * t;

export function makeFunnel(o: FunnelOpts): THREE.Mesh<THREE.LatheGeometry, THREE.ShaderMaterial> {
  const pts: THREE.Vector2[] = [];
  const N = 36;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    pts.push(new THREE.Vector2(funnelR(t, o.rTop, o.rBot), t * o.height));
  }
  const geo = new THREE.LatheGeometry(pts, 48);
  const mat = new THREE.ShaderMaterial({
    vertexShader: FUNNEL_VERT,
    fragmentShader: FUNNEL_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uSway: { value: o.sway },
      uHeight: { value: o.height },
      uOpacity: { value: o.opacity },
      uSpin: { value: o.spin },
      uGrow: { value: 0 },
      uScale: { value: o.scale ?? 2.4 },
      uColor: { value: new THREE.Color(o.color) },
    },
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  return m;
}

/** Pergeseran sumbu corong pada tinggi relatif t, sama dengan yang dihitung shader. */
export function funnelSway(t: number, time: number, sway: number): [number, number] {
  return [
    Math.sin(time * 1.7 + t * 5) * sway * t * t + Math.sin(time * 0.9 + t * 9) * sway * 0.35 * t,
    Math.cos(time * 1.3 + t * 4) * sway * t * t,
  ];
}

/* ---------------- petir bercabang ---------------- */

/** Isi `out` dengan segmen garis petir bercabang dari a ke b. Mengembalikan jumlah float terpakai. */
export function buildBolt(
  out: Float32Array,
  a: THREE.Vector3,
  b: THREE.Vector3,
  jitter: number,
  branches = 2,
): number {
  let n = 0;
  const push = (p: THREE.Vector3, q: THREE.Vector3) => {
    if (n + 6 > out.length) return;
    out[n++] = p.x;
    out[n++] = p.y;
    out[n++] = p.z;
    out[n++] = q.x;
    out[n++] = q.y;
    out[n++] = q.z;
  };
  const path = (from: THREE.Vector3, to: THREE.Vector3, segs: number, jt: number) => {
    const pts: THREE.Vector3[] = [from.clone()];
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      const p = from.clone().lerp(to, t);
      const k = jt * (1 - Math.abs(t - 0.5) * 0.6);
      p.x += (Math.random() - 0.5) * k;
      p.y += (Math.random() - 0.5) * k * 0.5;
      p.z += (Math.random() - 0.5) * k;
      pts.push(p);
    }
    pts.push(to.clone());
    for (let i = 0; i < pts.length - 1; i++) push(pts[i]!, pts[i + 1]!);
    return pts;
  };
  const main = path(a, b, 14, jitter);
  for (let k = 0; k < branches; k++) {
    const s = main[2 + Math.floor(Math.random() * (main.length - 5))]!;
    const e = s
      .clone()
      .add(
        new THREE.Vector3(
          (Math.random() - 0.5) * jitter * 5,
          -Math.random() * jitter * 3,
          (Math.random() - 0.5) * jitter * 5,
        ),
      );
    path(s, e, 6, jitter * 0.7);
  }
  return n;
}
