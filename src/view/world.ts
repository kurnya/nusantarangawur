/**
 * Dunia statis: cahaya, pulau gunung berapi, pulau kecil, baki kayu, laut (shader), daratan jalur, pohon.
 * Urutan pemakaian `rnd` sengaja sama dengan prototipe supaya tampilannya identik.
 */
import * as THREE from 'three';
import type { QualityProfile } from './quality';
import { BOUNDS, G, MID, PATH } from './layout';
import { MANIFEST, TAU, canvas2d, clamp, fbm, imgTex, mix3, type RGB } from './util';

export interface Island {
  cx: number;
  cz: number;
  R: number;
  H: number;
  seed: number;
  crater: boolean;
}

export const MARG = 1300 * G;
export const X0 = BOUNDS.minx - MARG;
export const X1 = BOUNDS.maxx + MARG;
export const Z0 = BOUNDS.miny - MARG;
export const Z1 = BOUNDS.maxy + MARG;
export const WW = X1 - X0;
export const HH = Z1 - Z0;
export const CXm = (X0 + X1) / 2;
export const CZm = (Z0 + Z1) / 2;
export const WATER_Y = -8;
export const TRAY_TOP = 40;
export const FW = 320 * G;
export const FOGC = 0xcfe8ef;

const dMin = Math.min(...PATH.map((p) => Math.hypot(p[0] - MID[0], p[1] - MID[1])));
const R0 = clamp(dMin - 780 * G, 900 * G, 2250 * G);
export const ISL: Island = { cx: MID[0], cz: MID[1], R: R0, H: R0 * 0.85, seed: 3.7, crater: true };

export function islandH(x: number, z: number, I: Island): number {
  const dx = x - I.cx;
  const dz = z - I.cz;
  const r0 = Math.hypot(dx, dz) / I.R;
  const n = fbm(x * 0.0016 + I.seed, z * 0.0016 + I.seed * 1.7, 4);
  const rr = r0 * (1 + (n - 0.5) * 0.34);
  const t = Math.max(0, (0.92 - rr) / 0.92);
  let h = I.H * Math.pow(t, 1.45);
  h *= 1 + 0.17 * Math.sin(Math.atan2(dz, dx) * 6 + n * 5) * Math.min(1, t * 2);
  h += (fbm(x * 0.004 + I.seed * 3, z * 0.004, 4) - 0.5) * I.H * 0.26 * Math.min(1, t * 3);
  if (rr > 0.92) h = -(rr - 0.92) * 900;
  if (I.crater) {
    const c = Math.max(0, 1 - r0 / 0.085);
    h -= I.H * 0.16 * c * c;
  }
  return h;
}

function terrainColor(h: number, sl: number, I: Island, x: number, z: number): RGB {
  const t = h / I.H;
  const n = fbm(x * 0.01, z * 0.01, 3);
  let c: RGB;
  if (h < 3) c = [0.8, 0.72, 0.52];
  else if (h < 24) c = mix3([0.9, 0.82, 0.6], [0.46, 0.6, 0.28], (h - 3) / 21);
  else if (t < 0.34) c = mix3([0.24, 0.54, 0.22], [0.13, 0.4, 0.16], n);
  else if (t < 0.7) c = mix3([0.14, 0.4, 0.17], [0.45, 0.4, 0.34], (t - 0.34) / 0.36);
  else if (t < 0.9) c = mix3([0.45, 0.4, 0.34], [0.6, 0.57, 0.54], (t - 0.7) / 0.2);
  else c = mix3([0.6, 0.57, 0.54], [0.92, 0.92, 0.94], clamp((t - 0.9) / 0.08, 0, 1));
  if (sl > 0.9 && h > 20) c = mix3(c, [0.42, 0.37, 0.33], clamp((sl - 0.9) / 0.8, 0, 1));
  if (I.crater && Math.hypot(x - I.cx, z - I.cz) < I.R * 0.1) c = mix3(c, [0.22, 0.18, 0.17], 0.7);
  const j = 0.93 + n * 0.14;
  return [c[0] * j, c[1] * j, c[2] * j];
}

function buildTerrain(scene: THREE.Scene, I: Island, seg: number, size: number): THREE.Mesh {
  const g = new THREE.PlaneGeometry(size, size, seg, seg);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k) + I.cx;
    const z = pos.getZ(k) + I.cz;
    const h = islandH(x, z, I);
    const e = 28;
    const sx = (islandH(x + e, z, I) - islandH(x - e, z, I)) / (2 * e);
    const sz = (islandH(x, z + e, I) - islandH(x, z - e, I)) / (2 * e);
    const c = terrainColor(h, Math.hypot(sx, sz), I, x, z);
    pos.setXYZ(k, x, Math.max(h, -150), z);
    col[k * 3] = c[0];
    col[k * 3 + 1] = c[1];
    col[k * 3 + 2] = c[2];
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(
    g,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, metalness: 0 }),
  );
  m.castShadow = true;
  m.receiveShadow = true;
  scene.add(m);
  return m;
}

export interface WorldOpts {
  scene: THREE.Scene;
  rnd: () => number;
  quality: QualityProfile;
}

export interface World {
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  waterMat: THREE.ShaderMaterial;
  ISLETS: Island[];
  treeDim: { value: number };
}

export function buildWorld({ scene, rnd, quality }: WorldOpts): World {
  /* ---- cahaya ---- */
  const hemi = new THREE.HemisphereLight(0xd6ecff, 0x6b5a40, 0.78);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1d2, 1.05);
  sun.castShadow = quality.shadowMap > 0;
  sun.shadow.mapSize.set(quality.shadowMap || 512, quality.shadowMap || 512);
  const sc = sun.shadow.camera;
  sc.left = -3400;
  sc.right = 3400;
  sc.top = 3400;
  sc.bottom = -3400;
  sc.near = 200;
  sc.far = 12000;
  sun.shadow.bias = -0.0007;
  scene.add(sun);
  scene.add(sun.target);

  /* ---- baki kayu ---- */
  const woodTex = (w: number, h: number, base: string, dark: string, rx: number, ry: number) => {
    const { c, x } = canvas2d(w, h);
    x.fillStyle = base;
    x.fillRect(0, 0, w, h);
    for (let i = 0; i < h; i += 2) {
      x.fillStyle = `rgba(${dark},${0.05 + rnd() * 0.16})`;
      x.fillRect(0, i, w, 1 + rnd() * 2.5);
    }
    for (let k = 0; k < 26; k++) {
      x.strokeStyle = `rgba(${dark},.22)`;
      x.lineWidth = 1 + rnd() * 2;
      x.beginPath();
      const y = rnd() * h;
      x.moveTo(0, y);
      x.bezierCurveTo(w * 0.3, y + rnd() * 14 - 7, w * 0.7, y + rnd() * 14 - 7, w, y);
      x.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    t.anisotropy = 4;
    return t;
  };
  const trayH = 300;
  const baseTop = -70;
  const woodMat = (rx: number, ry: number) =>
    new THREE.MeshStandardMaterial({
      map: woodTex(512, 128, '#7b5233', '60,36,18', rx, ry),
      roughness: 0.8,
    });
  const outerW = WW + 2 * FW;
  const outerH = HH + 2 * FW;
  const trayBase = new THREE.Mesh(
    new THREE.BoxGeometry(outerW, trayH + baseTop, outerH),
    woodMat(outerW / 900, 1),
  );
  trayBase.position.set(CXm, baseTop - (trayH + baseTop) / 2, CZm);
  scene.add(trayBase);
  const rimH = TRAY_TOP - baseTop;
  const rims: [number, number, number, number][] = [
    [outerW, FW, CXm, Z0 - FW / 2],
    [outerW, FW, CXm, Z1 + FW / 2],
    [FW, HH, X0 - FW / 2, CZm],
    [FW, HH, X1 + FW / 2, CZm],
  ];
  const capMat = new THREE.MeshStandardMaterial({
    color: 0xc9a15f,
    roughness: 0.5,
    metalness: 0.15,
  });
  rims.forEach(([w, d, x, z]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, rimH, d), woodMat(Math.max(w, d) / 700, 1));
    m.position.set(x, baseTop + rimH / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(w + (w > d ? 0 : 30), 10, d + (w > d ? 30 : 0)),
      capMat,
    );
    cap.position.set(x, TRAY_TOP + 4, z);
    scene.add(cap);
  });
  const table = new THREE.Mesh(
    new THREE.PlaneGeometry(90000, 90000),
    new THREE.MeshBasicMaterial({ color: 0x14303d }),
  );
  table.rotation.x = -Math.PI / 2;
  table.position.y = -trayH - baseTop - 2;
  scene.add(table);

  /* ---- peta dangkal untuk air (pantai turkuaz) ---- */
  const SW = 1024;
  const SH = Math.round((1024 * HH) / WW);
  const { c: shoreCv, x: shoreCtx } = canvas2d(SW, SH);
  const sx = SW / WW;
  shoreCtx.fillStyle = '#000';
  shoreCtx.fillRect(0, 0, SW, SH);
  try {
    shoreCtx.filter = 'blur(13px)';
  } catch {
    /* filter kanvas tidak didukung */
  }
  shoreCtx.strokeStyle = '#fff';
  shoreCtx.fillStyle = '#fff';
  shoreCtx.lineJoin = 'round';
  shoreCtx.lineWidth = 760 * G * sx;
  shoreCtx.beginPath();
  PATH.forEach((p, k) => {
    const X = (p[0] - X0) * sx;
    const Y = (p[1] - Z0) * sx;
    if (k) shoreCtx.lineTo(X, Y);
    else shoreCtx.moveTo(X, Y);
  });
  shoreCtx.closePath();
  shoreCtx.stroke();
  const discAt = (cx: number, cz: number, r: number) => {
    shoreCtx.beginPath();
    shoreCtx.arc((cx - X0) * sx, (cz - Z0) * sx, r * sx, 0, TAU);
    shoreCtx.fill();
  };
  discAt(ISL.cx, ISL.cz, ISL.R * 0.93);
  /* pulau kecil */
  const ISLETS: Island[] = [];
  for (let t = 0; t < 400 && ISLETS.length < 5; t++) {
    const x = X0 + 900 * G + rnd() * (WW - 1800 * G);
    const z = Z0 + 900 * G + rnd() * (HH - 1800 * G);
    const r = 390 * G + rnd() * 255 * G;
    if (PATH.some((p) => Math.hypot(p[0] - x, p[1] - z) < r + 1900 * G)) continue;
    if (Math.hypot(x - ISL.cx, z - ISL.cz) < ISL.R + r + 1000 * G) continue;
    if (ISLETS.some((q) => Math.hypot(q.cx - x, q.cz - z) < q.R + r + 700 * G)) continue;
    ISLETS.push({ cx: x, cz: z, R: r * 1.08, H: r * 0.55, seed: rnd() * 40, crater: false });
  }
  ISLETS.forEach((I) => discAt(I.cx, I.cz, I.R * 0.93));
  const shoreTex = new THREE.CanvasTexture(shoreCv);
  shoreTex.minFilter = THREE.LinearFilter;
  shoreTex.flipY = false;

  /* ---- air ---- */
  const waterMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uFl: { value: new THREE.Vector4(0, 0, 1500, 0) },
      uWv: { value: new THREE.Vector4(0, 0, 1, 0) },
      uWa: { value: new THREE.Vector2(0, 1800) },
      uMud: { value: new THREE.Vector4(0.45, 0.36, 0.22, 0) },
      uDark: { value: 1 },
      uShore: { value: shoreTex },
      uRect: { value: new THREE.Vector4(X0, Z0, WW, HH) },
      uFogColor: { value: new THREE.Color(FOGC) },
      uFogNear: { value: 14000 },
      uFogFar: { value: 50000 },
    },
    vertexShader: WATER_VS,
    fragmentShader: WATER_FS,
  });
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(WW, HH, quality.waterSeg[0], quality.waterSeg[1]),
    waterMat,
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(CXm, WATER_Y, CZm);
  scene.add(water);

  buildLandRibbon(scene);

  /* ---- pulau gunung dan pulau kecil ---- */
  buildTerrain(scene, ISL, quality.terrainSeg[0], ISL.R * 2.3);
  ISLETS.forEach((I) => buildTerrain(scene, I, quality.terrainSeg[1], I.R * 2.3));

  const treeDim = { value: 1 };
  buildTrees(scene, rnd, [ISL, ...ISLETS], treeDim, quality.treeDensity);

  return { hemi, sun, waterMat, ISLETS, treeDim };
}

/* ---- daratan jalur (pita tebal dengan pantai) ---- */
function buildLandRibbon(scene: THREE.Scene): void {
  /* offset, y, tipe warna */
  const sec: [number, number, number][] = [
    [-354 * G, -60, 0],
    [-354 * G, -6, 0],
    [-258 * G, 1, 1],
    [258 * G, 1, 1],
    [354 * G, -6, 0],
    [354 * G, -60, 0],
  ];
  const pts: [number, number][] = [];
  for (let i = 0; i < PATH.length; i += 2) pts.push(PATH[i]!);
  const n = pts.length;
  const pos: number[] = [];
  const col: number[] = [];
  const P: [number, number][] = [];
  const Nn: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n]!;
    const b = pts[(i + 1) % n]!;
    let tx = b[0] - a[0];
    let tz = b[1] - a[1];
    const l = Math.hypot(tx, tz) || 1;
    tx /= l;
    tz /= l;
    P.push(pts[i]!);
    Nn.push([-tz, tx]);
  }
  const sand: RGB = [0.9, 0.83, 0.62];
  const sandD: RGB = [0.62, 0.52, 0.38];
  const grass: RGB = [0.33, 0.62, 0.3];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    for (let k = 0; k < sec.length - 1; k++) {
      const a = sec[k]!;
      const b = sec[k + 1]!;
      const v: [[number, number], [number, number], [number, number, number]][] = [
        [P[i]!, Nn[i]!, a],
        [P[j]!, Nn[j]!, a],
        [P[j]!, Nn[j]!, b],
        [P[i]!, Nn[i]!, b],
      ];
      const xyz = v.map((q) => [q[0][0] + q[1][0] * q[2][0], q[2][1], q[0][1] + q[1][1] * q[2][0]]);
      [0, 1, 2, 0, 2, 3].forEach((ix) => {
        const p = xyz[ix]!;
        pos.push(p[0]!, p[1]!, p[2]!);
      });
      const kind =
        a[2] === 1 && b[2] === 1 ? 'top' : k === 0 || k === sec.length - 2 ? 'wall' : 'beach';
      const nz = fbm(P[i]![0] * 0.01, P[i]![1] * 0.01, 2);
      const c =
        kind === 'top'
          ? mix3(grass, [0.22, 0.52, 0.24], nz)
          : kind === 'beach'
            ? mix3(sand, [0.78, 0.7, 0.52], nz)
            : sandD;
      for (let q = 0; q < 6; q++) col.push(c[0], c[1], c[2]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(
    g,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }),
  );
  m.receiveShadow = true;
  scene.add(m);
}

/* ---- pohon (quad billboard ber-instance) ---- */
interface TreeSpot {
  x: number;
  y: number;
  z: number;
  s: number;
  ry?: number;
  rz?: number;
}
function buildTrees(
  scene: THREE.Scene,
  rnd: () => number,
  islands: Island[],
  treeDim: { value: number },
  density: number,
): void {
  const main = islands[0]!;
  const pines: TreeSpot[] = [];
  const palms: TreeSpot[] = [];
  const crowns: TreeSpot[] = [];
  const dummy = new THREE.Object3D();
  islands.forEach((I) => {
    const target = I === main ? 1700 : 150;
    for (let t = 0, n = 0; n < target && t < target * 30; t++) {
      const a = rnd() * TAU;
      const r = Math.sqrt(rnd()) * I.R * 0.95;
      const x = I.cx + Math.cos(a) * r;
      const z = I.cz + Math.sin(a) * r;
      const h = islandH(x, z, I);
      const e = 24;
      const sl = Math.hypot(
        (islandH(x + e, z, I) - islandH(x - e, z, I)) / (2 * e),
        (islandH(x, z + e, I) - islandH(x, z - e, I)) / (2 * e),
      );
      if (sl > 0.75) continue;
      if (h > 8 && h < 26) {
        const s = 0.9 + rnd() * 0.5;
        palms.push({ x, y: h, z, s, ry: rnd() * TAU, rz: (rnd() - 0.5) * 0.35 });
        crowns.push({ x, y: h, z, s, ry: rnd() * TAU, rz: 0 });
        n++;
      } else if (I === main && h > 30 && h < I.H * 0.55 && fbm(x * 0.006, z * 0.006, 2) > 0.42) {
        pines.push({ x, y: h - 3, z, s: 0.8 + rnd() * 0.9, ry: rnd() * TAU });
        n++;
      } else if (I !== main && h > 26 && h < I.H * 0.7 && rnd() < 0.5) {
        pines.push({ x, y: h - 3, z, s: 0.7 + rnd() * 0.6, ry: rnd() * TAU });
        n++;
      }
    }
  });
  /* kelapa di tepi pantai jalur */
  for (let i = 0; i < PATH.length; i += 5) {
    const a = PATH[(i - 1 + PATH.length) % PATH.length]!;
    const b = PATH[(i + 1) % PATH.length]!;
    let tx = b[0] - a[0];
    let tz = b[1] - a[1];
    const l = Math.hypot(tx, tz) || 1;
    tx /= l;
    tz /= l;
    [-1, 1].forEach((sd) => {
      if (rnd() < 0.55) {
        const off = (294 * G + rnd() * 45 * G) * sd;
        const x = PATH[i]![0] - tz * off;
        const z = PATH[i]![1] + tx * off;
        const s = 0.9 + rnd() * 0.5;
        palms.push({ x, y: 0, z, s, ry: rnd() * TAU, rz: (rnd() - 0.5) * 0.35 });
        crowns.push({ x, y: 0, z, s, ry: rnd() * TAU, rz: 0 });
      }
    });
  }
  const bh = 100 * G;
  const THF = [1, 0.95, 1, 0.8, 0.7, 1.1, 0.9, 0.8, 0.34, 0.32, 0.34, 0.42];
  const types: TreeSpot[][] = THF.map(() => []);
  const pickp = () => {
    const r = rnd();
    return r < 0.64 ? 0 : r < 0.84 ? 7 : 4;
  };
  const pickf = () => {
    const r = rnd();
    return r < 0.38 ? 1 : r < 0.62 ? 5 : r < 0.82 ? 6 : r < 0.9 ? 2 : 3;
  };
  palms.forEach((q) => {
    types[pickp()]!.push(q);
    if (rnd() < 0.35)
      types[rnd() < 0.5 ? 8 : 10]!.push({
        x: q.x + (rnd() - 0.5) * 160,
        y: q.y,
        z: q.z + (rnd() - 0.5) * 160,
        s: 0.8 + rnd() * 0.5,
      });
  });
  pines.forEach((q) => {
    types[pickf()]!.push({ x: q.x, y: q.y, z: q.z, s: (q.s || 1) * 0.72 });
    if (rnd() < 0.12)
      types[rnd() < 0.5 ? 8 : 11]!.push({
        x: q.x + (rnd() - 0.5) * 140,
        y: q.y,
        z: q.z + (rnd() - 0.5) * 140,
        s: 0.8 + rnd() * 0.5,
      });
  });
  const bg = new THREE.PlaneGeometry(1, 1);
  bg.translate(0, 0.5, 0);
  const vs =
    'uniform vec2 size;varying vec2 vUv;void main(){vUv=uv;vec4 c=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);float sc=length(instanceMatrix[0].xyz);c.xy+=position.xy*size*sc;gl_Position=projectionMatrix*c;}';
  const fs =
    'uniform sampler2D map;uniform float dim;varying vec2 vUv;void main(){vec4 t=texture2D(map,vUv);if(t.a<.5)discard;gl_FragColor=vec4(t.rgb*(.4+.6*dim),1.);}';
  const sh: { x: number; y: number; z: number; r: number }[] = [];
  types.forEach((all, ti) => {
    // mode kualitas rendah: ambil sebagian pohon saja (deterministik, tanpa rnd)
    const arr = density >= 1 ? all : all.filter((_, k) => (k * density) % 1 < density);
    if (!arr.length) return;
    const mt = MANIFEST.trees[ti]!;
    const hh = bh * THF[ti]!;
    const ww = (hh * mt[0]) / mt[1];
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: imgTex(`trees/t${ti}.webp`) },
        size: { value: new THREE.Vector2(ww, hh) },
        dim: treeDim,
      },
      vertexShader: vs,
      fragmentShader: fs,
    });
    const m = new THREE.InstancedMesh(bg, mat, arr.length);
    m.frustumCulled = false;
    arr.forEach((q, k) => {
      dummy.position.set(q.x, q.y - 2, q.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(q.s || 1);
      dummy.updateMatrix();
      m.setMatrixAt(k, dummy.matrix);
      sh.push({ x: q.x, y: q.y, z: q.z, r: ww * 0.34 * (q.s || 1) });
    });
    m.instanceMatrix.needsUpdate = true;
    scene.add(m);
  });
  const sm = new THREE.InstancedMesh(
    new THREE.CircleGeometry(1, 14),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
    sh.length,
  );
  sm.frustumCulled = false;
  sh.forEach((q, k) => {
    dummy.position.set(q.x, q.y + 1.5, q.z);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.scale.set(q.r, q.r * 0.55, 1);
    dummy.updateMatrix();
    sm.setMatrixAt(k, dummy.matrix);
  });
  sm.instanceMatrix.needsUpdate = true;
  scene.add(sm);
}

const WATER_VS = `
uniform float uTime;uniform vec4 uFl;uniform vec4 uWv;uniform vec2 uWa;varying vec3 vW;varying vec2 vFx;
float wh(vec2 p,float t){return 7.0*sin(dot(p,vec2(0.0042,0.0021))+t*0.9)+4.5*sin(dot(p,vec2(-0.0031,0.0058))+t*1.25)+2.4*sin(dot(p,vec2(0.011,-0.0085))+t*2.0);}
void main(){vec4 w=modelMatrix*vec4(position,1.0);w.y+=wh(w.xz,uTime);
  float on=step(0.001,uFl.w);float fk=(1.0-smoothstep(uFl.z*0.45,uFl.z,length(w.xz-uFl.xy)))*on;w.y+=uFl.w*fk;
  vec2 d=w.xz-uWv.xy;vec2 n=uWv.zw;vec2 tg=vec2(-n.y,n.x);float s=dot(d,n),l=dot(d,tg);
  float prof=s>0.0?exp(-(s*s)/(2.0*170.0*170.0)):exp(s/950.0);float lat=1.0-smoothstep(uWa.y*0.55,uWa.y,abs(l));
  float wv=uWa.x*prof*lat;w.y+=wv;vFx=vec2(fk,wv/max(uWa.x,1.0));vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;

const WATER_FS = `
uniform float uTime;uniform float uDark;uniform sampler2D uShore;uniform vec4 uRect;uniform vec3 uFogColor;uniform float uFogNear;uniform float uFogFar;uniform vec4 uMud;varying vec3 vW;varying vec2 vFx;
float wh(vec2 p,float t){return 7.0*sin(dot(p,vec2(0.0042,0.0021))+t*0.9)+4.5*sin(dot(p,vec2(-0.0031,0.0058))+t*1.25)+2.4*sin(dot(p,vec2(0.011,-0.0085))+t*2.0)+1.1*sin(dot(p,vec2(0.031,0.027))+t*3.1)+0.8*sin(dot(p,vec2(-0.043,0.019))+t*3.7);}
float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hs(i),hs(i+vec2(1.0,0.0)),f.x),mix(hs(i+vec2(0.0,1.0)),hs(i+vec2(1.0,1.0)),f.x),f.y);}
void main(){
  vec2 uv=(vW.xz-uRect.xy)/uRect.zw;float s=texture2D(uShore,uv).r;
  s=clamp(s+(vn(vW.xz*0.0021)*0.7+vn(vW.xz*0.0061)*0.3-0.5)*0.22*smoothstep(0.05,0.35,s),0.0,1.0);
  float e=6.0;float hx=(wh(vW.xz+vec2(e,0.0),uTime)-wh(vW.xz-vec2(e,0.0),uTime))/(2.0*e);float hz=(wh(vW.xz+vec2(0.0,e),uTime)-wh(vW.xz-vec2(0.0,e),uTime))/(2.0*e);
  vec3 N=normalize(vec3(-hx,1.0,-hz));vec3 V=normalize(cameraPosition-vW);vec3 L=normalize(vec3(-0.55,0.85,0.38));
  float fres=pow(1.0-max(dot(N,V),0.0),3.0);
  vec3 deep=vec3(0.015,0.19,0.32),mid=vec3(0.04,0.48,0.60),shal=vec3(0.32,0.82,0.76);
  vec3 col=mix(deep,mid,smoothstep(0.0,0.30,s));col=mix(col,shal,smoothstep(0.30,0.58,s));
  col=mix(col,vec3(0.62,0.83,0.93),fres*0.55);
  float spec=pow(max(dot(reflect(-L,N),V),0.0),120.0)*1.3;col+=vec3(1.0,0.95,0.8)*spec;
  float dcam=length(cameraPosition-vW);
  float band=smoothstep(0.40,0.52,s)*(1.0-smoothstep(0.56,0.70,s))*(1.0-smoothstep(6000.0,16000.0,dcam));
  float fn=clamp(0.5+0.17*(sin(vW.x*0.0095+uTime*0.6)+sin(vW.z*0.0112-uTime*0.5)+sin((vW.x+vW.z)*0.0061+uTime*0.4)),0.0,1.0);
  col=mix(col,vec3(1.0),band*(0.35+0.55*fn));
  col=mix(col,uMud.rgb*(0.8+0.4*fn),uMud.a*vFx.x);
  float eg=vFx.x*(1.0-vFx.x)*4.0;col=mix(col,vec3(1.0),clamp(eg*0.4*fn*uMud.a*2.0,0.0,1.0));
  col=mix(col,vec3(0.95,0.99,1.0),clamp(vFx.y*(0.55+0.45*fn)*1.1,0.0,1.0));
  col*=uDark;
  float d=length(cameraPosition-vW);col=mix(col,uFogColor,smoothstep(uFogNear,uFogFar,d));
  gl_FragColor=vec4(col,1.0);}`;
