/**
 * Dadu 3D sungguhan (Three.js): kubus bersudut membulat dengan lubang titik, bahan PBR,
 * bayangan lembut, dan lemparan memantul yang berhenti tepat di angka hasil.
 * Dirender di kanvas kecil sendiri (latar transparan) dan hanya saat ada gerakan.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

interface SkinDef {
  base: string;
  base2: string;
  pip: string;
  pip1: string;
  rough: number;
  metal: number;
  glow?: number;
  opacity?: number;
  grain?: boolean;
}

const SKINS: SkinDef[] = [
  { base: '#f7f2e4', base2: '#e2dac4', pip: '#1b1f33', pip1: '#d63b3b', rough: 0.32, metal: 0 },
  {
    base: '#2a2c38',
    base2: '#0d0e14',
    pip: '#f2c14e',
    pip1: '#f2c14e',
    rough: 0.18,
    metal: 0.55,
    glow: 0.25,
  },
  { base: '#c9283a', base2: '#8e1522', pip: '#fff4e0', pip1: '#ffd36b', rough: 0.28, metal: 0 },
  {
    base: '#4cc597',
    base2: '#23805d',
    pip: '#ffffff',
    pip1: '#fff3a0',
    rough: 0.1,
    metal: 0.05,
    opacity: 0.94,
  },
  { base: '#f0b92e', base2: '#b8830f', pip: '#4a2f06', pip1: '#8f1d1d', rough: 0.22, metal: 0.92 },
  { base: '#2f7be0', base2: '#174a9a', pip: '#ffffff', pip1: '#ffd36b', rough: 0.2, metal: 0.15 },
  {
    base: '#a8703f',
    base2: '#6e4223',
    pip: '#fff1d6',
    pip1: '#ffcf5c',
    rough: 0.72,
    metal: 0,
    grain: true,
  },
  {
    base: '#161c42',
    base2: '#070a1c',
    pip: '#36e2ff',
    pip1: '#ff4fd8',
    rough: 0.3,
    metal: 0.45,
    glow: 1,
  },
];

/** Urutan material BoxGeometry: +x, -x, +y, -y, +z, -z. Sisi berhadapan berjumlah 7. */
const FACE_VALUE = [3, 4, 2, 5, 1, 6];

const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [
    [0, 0],
    [2, 2],
  ],
  3: [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  4: [
    [0, 0],
    [2, 0],
    [0, 2],
    [2, 2],
  ],
  5: [
    [0, 0],
    [2, 0],
    [1, 1],
    [0, 2],
    [2, 2],
  ],
  6: [
    [0, 0],
    [2, 0],
    [0, 1],
    [2, 1],
    [0, 2],
    [2, 2],
  ],
};

const S = 256;

/** Rotasi agar sisi bernilai v menghadap atas (+y). */
function upQuat(v: number): THREE.Quaternion {
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  switch (v) {
    case 1:
      e.set(-Math.PI / 2, 0, 0);
      break;
    case 6:
      e.set(Math.PI / 2, 0, 0);
      break;
    case 3:
      e.set(0, 0, Math.PI / 2);
      break;
    case 4:
      e.set(0, 0, -Math.PI / 2);
      break;
    case 5:
      e.set(Math.PI, 0, 0);
      break;
    default:
      e.set(0, 0, 0);
  }
  return q.setFromEuler(e);
}

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  return [c, c.getContext('2d')!];
}

function faceMaps(sk: SkinDef, v: number) {
  const [c, x] = canvas();
  const g = x.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, sk.base);
  g.addColorStop(1, sk.base2);
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  if (sk.grain) {
    for (let i = 0; i < 70; i++) {
      x.strokeStyle = `rgba(${40 + Math.random() * 40},${20 + Math.random() * 20},10,${0.05 + Math.random() * 0.1})`;
      x.lineWidth = 1 + Math.random() * 3;
      x.beginPath();
      const y = Math.random() * S;
      x.moveTo(0, y);
      x.bezierCurveTo(
        S * 0.3,
        y + Math.random() * 14 - 7,
        S * 0.6,
        y + Math.random() * 14 - 7,
        S,
        y,
      );
      x.stroke();
    }
  }
  const [b, bx] = canvas();
  bx.fillStyle = '#fff';
  bx.fillRect(0, 0, S, S);
  const [m, mx] = canvas();
  mx.fillStyle = '#000';
  mx.fillRect(0, 0, S, S);
  const pts = PIPS[v]!;
  const r = v === 1 ? S * 0.13 : S * 0.09;
  pts.forEach(([i, j]) => {
    const px = S * (0.25 + 0.25 * i);
    const py = S * (0.25 + 0.25 * j);
    const col = v === 1 ? sk.pip1 : sk.pip;
    // lubang: bayangan tepi atas, isi bertitik gelap
    const hg = x.createRadialGradient(px - r * 0.3, py - r * 0.3, r * 0.1, px, py, r * 1.05);
    hg.addColorStop(0, col);
    hg.addColorStop(0.85, col);
    hg.addColorStop(1, 'rgba(0,0,0,0.55)');
    x.fillStyle = hg;
    x.beginPath();
    x.arc(px, py, r * 1.05, 0, Math.PI * 2);
    x.fill();
    const bg = bx.createRadialGradient(px, py, r * 0.2, px, py, r * 1.15);
    bg.addColorStop(0, '#000');
    bg.addColorStop(0.75, '#222');
    bg.addColorStop(1, '#fff');
    bx.fillStyle = bg;
    bx.beginPath();
    bx.arc(px, py, r * 1.15, 0, Math.PI * 2);
    bx.fill();
    mx.fillStyle = col;
    mx.beginPath();
    mx.arc(px, py, r * 0.85, 0, Math.PI * 2);
    mx.fill();
  });
  const t = (cv: HTMLCanvasElement, srgb: boolean) => {
    const tx = new THREE.CanvasTexture(cv);
    tx.anisotropy = 4;
    if (srgb) tx.encoding = THREE.sRGBEncoding;
    return tx;
  };
  return { map: t(c, true), bump: t(b, false), emis: t(m, true) };
}

function ease(t: number): number {
  return t * t * (3 - 2 * t);
}

interface Mover {
  mesh: THREE.Mesh;
  home: THREE.Vector3;
  start: THREE.Vector3;
  final: THREE.Quaternion;
  axis: THREE.Vector3;
  spin: number;
  delay: number;
  /** pose diam sebelum lemparan, titik awal gerak angkat */
  restPos: THREE.Vector3;
  restQ: THREE.Quaternion;
  /** pose di puncak angkatan (awal jatuh) */
  liftQ: THREE.Quaternion;
}

const DUR = 0.85;
/** lama dadu terangkat dari posisi diam sebelum dilempar */
const LIFT = 0.18;
const LIFT_Y = 0.95;
/** waktu relatif mendarat dan tinggi pantulan */
const BOUNCES: [number, number, number][] = [
  [0, 0.4, 0],
  [0.4, 0.68, 0.62],
  [0.68, 0.87, 0.2],
  [0.87, 1, 0.05],
];

export class Dice3D {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(28, 2, 0.1, 50);
  private readonly dice: Mover[] = [];
  private mats: THREE.MeshStandardMaterial[][] = [];
  private raf = 0;
  private t0 = 0;
  private done: (() => void) | null = null;
  private skin = -1;
  private readonly cache = new Map<string, ReturnType<typeof faceMaps>>();

  constructor(private readonly host: HTMLElement) {
    const cv = document.createElement('canvas');
    cv.className = 'dice3d';
    host.appendChild(cv);
    this.renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.camera.position.set(0, 6.0, 4.7);
    this.camera.lookAt(0, 0.2, 0);

    this.scene.add(new THREE.HemisphereLight(0xdde8ff, 0x30281c, 0.75));
    const key = new THREE.DirectionalLight(0xfff2de, 2.1);
    key.position.set(-3, 8, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.radius = 5;
    key.shadow.bias = -0.0008;
    const sc = key.shadow.camera as THREE.OrthographicCamera;
    sc.left = -5;
    sc.right = 5;
    sc.top = 5;
    sc.bottom = -5;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x9ec4ff, 0.8);
    rim.position.set(4, 3, -5);
    this.scene.add(rim);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.ShadowMaterial({ opacity: 0.38 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.5;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const geo = new RoundedBoxGeometry(1, 1, 1, 4, 0.14);
    [-0.85, 0.85].forEach((x) => {
      const mesh = new THREE.Mesh(geo, []);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.dice.push({
        mesh,
        home: new THREE.Vector3(x, 0, 0.1),
        start: new THREE.Vector3(),
        final: new THREE.Quaternion(),
        axis: new THREE.Vector3(1, 0, 0),
        spin: 0,
        delay: 0,
        restPos: new THREE.Vector3(),
        restQ: new THREE.Quaternion(),
        liftQ: new THREE.Quaternion(),
      });
    });
    this.setSkin(0);
    this.place(1, 1);
    this.resize();
  }

  resize(): void {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.render();
  }

  private maps(k: number, v: number) {
    const key = `${k}:${v}`;
    let m = this.cache.get(key);
    if (!m) {
      m = faceMaps(SKINS[k] ?? SKINS[0]!, v);
      this.cache.set(key, m);
    }
    return m;
  }

  setSkin(k: number): void {
    if (k === this.skin) return;
    this.skin = k;
    const sk = SKINS[k] ?? SKINS[0]!;
    this.mats.flat().forEach((m) => m.dispose());
    this.mats = this.dice.map(() =>
      FACE_VALUE.map((v) => {
        const mp = this.maps(k, v);
        return new THREE.MeshStandardMaterial({
          map: mp.map,
          bumpMap: mp.bump,
          bumpScale: 2.2,
          roughness: sk.rough,
          metalness: sk.metal,
          emissive: new THREE.Color(0xffffff),
          emissiveMap: mp.emis,
          emissiveIntensity: sk.glow ?? 0,
          transparent: sk.opacity !== undefined,
          opacity: sk.opacity ?? 1,
        });
      }),
    );
    this.dice.forEach((d, i) => (d.mesh.material = this.mats[i]!));
    this.render();
  }

  /** Letakkan dadu diam dengan sisi atas a dan b. */
  place(a: number, b: number): void {
    [a, b].forEach((v, i) => {
      const d = this.dice[i]!;
      d.final.copy(
        new THREE.Quaternion()
          .setFromAxisAngle(new THREE.Vector3(0, 1, 0), i ? 0.5 : -0.35)
          .multiply(upQuat(v)),
      );
      d.mesh.quaternion.copy(d.final);
      d.mesh.position.copy(d.home);
    });
    this.render();
  }

  /** Lempar dan berhenti di (a, b). Selesai saat dadu diam. */
  roll(a: number, b: number): Promise<void> {
    this.finish();
    [a, b].forEach((v, i) => {
      const d = this.dice[i]!;
      const yaw = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        (Math.random() - 0.5) * 2.4,
      );
      d.final.copy(yaw.multiply(upQuat(v)));
      // dadu terangkat dari tempatnya, lalu jatuh dan memantul ke tempat semula
      d.restPos.copy(d.mesh.position);
      d.restQ.copy(d.mesh.quaternion);
      d.start.set(
        d.home.x + (i ? 1 : -1) * (0.25 + Math.random() * 0.3),
        LIFT_Y,
        d.home.z - 0.9 + Math.random() * 0.4,
      );
      d.axis.set(Math.random() - 0.5, Math.random() * 0.6 - 0.3, Math.random() - 0.5).normalize();
      d.spin = Math.PI * (4 + Math.random() * 2) * (i ? -1 : 1);
      d.liftQ.setFromAxisAngle(d.axis, d.spin).multiply(d.final);
      d.delay = i * 0.04;
    });
    this.t0 = performance.now();
    return new Promise((res) => {
      this.done = res;
      const tick = () => {
        const done = this.frame((performance.now() - this.t0) / 1000);
        if (done) this.finish();
        else this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    });
  }

  private finish(): void {
    cancelAnimationFrame(this.raf);
    this.dice.forEach((d) => {
      d.mesh.quaternion.copy(d.final);
      d.mesh.position.copy(d.home);
    });
    this.render();
    const r = this.done;
    this.done = null;
    r?.();
  }

  /** Satu bingkai animasi pada detik `t`. Mengembalikan true bila semua dadu sudah diam. */
  private frame(t: number): boolean {
    let all = true;
    const tmp = new THREE.Quaternion();
    this.dice.forEach((d) => {
      const tt = t - d.delay;
      if (tt < LIFT) {
        // fase angkat: naik halus dari posisi diam sambil mulai berputar
        all = false;
        const k = ease(Math.min(1, Math.max(0, tt / LIFT)));
        d.mesh.position.set(
          d.restPos.x + (d.start.x - d.restPos.x) * k,
          d.restPos.y + (d.start.y - d.restPos.y) * k,
          d.restPos.z + (d.start.z - d.restPos.z) * k,
        );
        d.mesh.quaternion.copy(d.restQ).slerp(d.liftQ, k);
        return;
      }
      const u = Math.min(1, Math.max(0, (tt - LIFT) / DUR));
      if (u < 1) all = false;
      // posisi horizontal meluncur dan melambat menuju tempat berhenti
      const hx = ease(Math.min(1, u / 0.82));
      d.mesh.position.x = d.start.x + (d.home.x - d.start.x) * hx;
      d.mesh.position.z = d.start.z + (d.home.z - d.start.z) * hx;
      // ketinggian: jatuh dari puncak angkatan lalu pantulan mengecil
      let y = 0;
      for (const [a, b, h] of BOUNCES) {
        if (u >= a && u <= b) {
          const k = (u - a) / (b - a);
          y = h * 4 * k * (1 - k);
        }
      }
      if (u < BOUNCES[0]![1]) {
        const k = u / BOUNCES[0]![1];
        y = LIFT_Y * (1 - k * k);
      }
      d.mesh.position.y = y;
      // putaran mengecil sampai nol saat mendarat
      const ang = d.spin * Math.pow(1 - u, 1.7);
      tmp.setFromAxisAngle(d.axis, ang);
      d.mesh.quaternion.copy(tmp).multiply(d.final);
    });
    this.render();
    return all;
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
