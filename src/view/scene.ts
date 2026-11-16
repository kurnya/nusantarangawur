/**
 * Tampilan 3D: merakit dunia, petak, kapal, langit, bidak, efek, dan kontrol kamera.
 * Hanya membaca GameState dan menerima perintah animasi; tidak memuat aturan permainan.
 */
import * as THREE from 'three';
import type { GameState, WeatherKey } from '../engine/types';
import { focusOn, makeCam, overview, updateCamera, type Cam } from './camera';
import { Fx } from './fx';
import { MID } from './layout';
import { loadModels } from './models';
import { Pawns } from './pawns';
import { Ships } from './ships';
import { Sky } from './sky';
import { Tiles } from './tiles';
import { clamp, makeLcg } from './util';
import { FOGC, buildWorld, type World } from './world';

export interface ViewOpts {
  stage: HTMLElement;
  getState: () => GameState | null;
  onTileClick: (tile: number) => void;
  lowQuality?: boolean;
  /** lewati animasi besar (?fast=1) */
  fast?: boolean;
}

export class GameView {
  readonly cam: Cam = makeCam();
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(42, 1, 40, 60000);
  private readonly root = new THREE.Group();
  private readonly world: World;
  private readonly tiles: Tiles;
  private readonly ships: Ships;
  private readonly sky: Sky;
  readonly pawns: Pawns;
  private readonly fx: Fx;
  private clock = 0;
  private last = performance.now();
  /** mode layar pembuka: kamera berputar pelan */
  intro = true;

  /** Lempar Error jika WebGL tidak tersedia. */
  constructor(private readonly o: ViewOpts) {
    const stage = o.stage;
    this.renderer = new THREE.WebGLRenderer({
      antialias: !o.lowQuality,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, o.lowQuality ? 1 : 1.75));
    this.renderer.shadowMap.enabled = !o.lowQuality;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const cv = this.renderer.domElement;
    cv.id = 'gl';
    stage.insertBefore(cv, stage.firstChild);
    this.scene.fog = new THREE.Fog(FOGC, 14000, 50000);
    this.scene.add(this.root);

    const rnd = makeLcg();
    this.world = buildWorld({ scene: this.scene, rnd, lowQuality: o.lowQuality });
    this.tiles = new Tiles({
      root: this.root,
      rnd,
      maxAniso: this.renderer.capabilities.getMaxAnisotropy(),
      getState: o.getState,
    });
    this.ships = new Ships(this.root, rnd);
    let flash: (op: number, col?: string) => void = () => {};
    this.sky = new Sky({
      scene: this.scene,
      root: this.root,
      stage,
      rnd,
      cam: this.cam,
      waterMat: this.world.waterMat,
      flash: (op, col) => flash(op, col),
      lowQuality: o.lowQuality,
    });
    this.pawns = new Pawns(this.root);
    this.fx = new Fx({
      root: this.root,
      stage,
      cam: this.cam,
      pawns: this.pawns,
      sky: this.sky,
      waterMat: this.world.waterMat,
      hemi: this.world.hemi,
      sun: this.world.sun,
      TC: this.tiles.TC,
    });
    flash = this.fx.flash;

    this.bindControls(cv);
    const resize = () => {
      const w = Math.max(2, stage.clientWidth);
      const h = Math.max(2, stage.clientHeight);
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', resize);
    if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
    resize();

    const fontsReady = () => this.tiles.relabel();
    if (document.fonts?.load)
      Promise.race([
        Promise.all([
          document.fonts.load('400 30px Bungee'),
          document.fonts.load("800 26px 'Plus Jakarta Sans'"),
        ]),
        new Promise((r) => setTimeout(r, 2500)),
      ])
        .then(fontsReady)
        .catch(() => {});

    requestAnimationFrame(this.frame);
  }

  /* ---------- API untuk lapisan permainan ---------- */

  /** Mulai permainan: bangun bidak dan muat model GLB opsional. */
  start(state: GameState): void {
    this.intro = false;
    this.pawns.build(state.players);
    this.syncAll(state);
    const c = this.cam;
    c.follow = true;
    c.tilt = 52;
    c.az = 0;
    c.dist = this.o.stage.clientWidth < 700 ? 2500 : 1750;
    focusOn(c, state.players[state.turn]?.pos ?? 0, true);
    void loadModels((k, scene) => {
      if (k.startsWith('ship')) this.ships.swap(Number(k.slice(4)), scene);
      else if (k.startsWith('pawn')) {
        this.pawns.models[k] = scene;
        const s = this.o.getState();
        if (s) {
          this.pawns.build(s.players);
          this.syncPawns(s);
        }
      }
    });
  }

  syncAll(state: GameState): void {
    state.owners.forEach((_, i) => this.tiles.updateTile(i));
    this.syncPawns(state);
  }

  updateTile(i: number): void {
    this.tiles.updateTile(i);
  }

  syncPawns(state: GameState): void {
    this.pawns.sync(state.players, state.turn, state.phase !== 'over');
    const p = state.players[state.turn];
    if (this.cam.follow && p) focusOn(this.cam, p.pos);
  }

  /** Ikuti bidak pemain tertentu (saat ia berjalan). */
  follow(pos: number): void {
    if (this.cam.follow) focusOn(this.cam, pos);
  }

  hop(pid: number): void {
    this.pawns.hop(pid);
  }

  setWeather(k: WeatherKey, immediate = false): void {
    this.sky.setWeather(k, immediate);
  }

  async play(key: string, tile: number, pid: number): Promise<void> {
    if (this.o.fast) return;
    await this.fx.play(key, tile, pid);
  }

  focusPawn(pos: number): void {
    this.cam.follow = true;
    this.cam.dist = Math.min(this.cam.dist, 3200);
    focusOn(this.cam, pos);
  }
  overview(): void {
    overview(this.cam, this.o.stage);
  }
  toggleTilt(): void {
    this.cam.tilt = this.cam.tilt > 25 ? 4 : 52;
  }
  rotate(dir: 1 | -1): void {
    this.cam.az = Math.round(this.cam.az / 45) * 45 + 45 * dir;
  }
  zoom(f: number): void {
    this.cam.dist = clamp(this.cam.dist * f, 700, 36000);
  }
  toggleWeather(): boolean {
    this.cam.weather = !this.cam.weather;
    this.sky.refreshOverlay();
    return this.cam.weather;
  }

  /* ---------- kontrol penunjuk ---------- */

  private bindControls(cv: HTMLCanvasElement): void {
    const cam = this.cam;
    const ray = new THREE.Raycaster();
    const gplane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const ndc = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      return new THREE.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1,
      );
    };
    const groundAt = (cm: THREE.Camera, e: PointerEvent) => {
      ray.setFromCamera(ndc(e), cm);
      const p = new THREE.Vector3();
      return ray.ray.intersectPlane(gplane, p) ? p : null;
    };
    let drag: {
      x: number;
      y: number;
      tilt: number;
      az: number;
      fx: number;
      fz: number;
      cm: THREE.PerspectiveCamera;
      p0: THREE.Vector3 | null;
      rot: boolean;
    } | null = null;
    let pinch: { d: number; dist: number } | null = null;
    const pts = new Map<number, { x: number; y: number }>();
    let moved = 0;
    cv.addEventListener('pointerdown', (e) => {
      try {
        cv.setPointerCapture(e.pointerId);
      } catch {
        /* abaikan */
      }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const a = [...pts.values()];
        pinch = { d: Math.hypot(a[0]!.x - a[1]!.x, a[0]!.y - a[1]!.y), dist: cam.dist };
        drag = null;
        return;
      }
      updateCamera(cam, this.camera, 0);
      const cm = this.camera.clone();
      cm.updateMatrixWorld(true);
      drag = {
        x: e.clientX,
        y: e.clientY,
        tilt: cam.tilt,
        az: cam.az,
        fx: cam.fx,
        fz: cam.fz,
        cm,
        p0: groundAt(cm, e),
        rot: e.shiftKey || e.button === 2,
      };
      moved = 0;
    });
    cv.addEventListener('pointermove', (e) => {
      if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pts.size === 2) {
        const a = [...pts.values()];
        const d = Math.hypot(a[0]!.x - a[1]!.x, a[0]!.y - a[1]!.y);
        cam.dist = clamp((pinch.dist * pinch.d) / Math.max(d, 1), 700, 36000);
        moved = 99;
        return;
      }
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
      if (moved <= 6) return;
      if (drag.rot) {
        cam.az = drag.az - dx * 0.3;
        cam.tilt = clamp(drag.tilt - dy * 0.25, 3, 76);
      } else {
        cam.follow = false;
        const q = groundAt(drag.cm, e);
        if (q && drag.p0) {
          cam.tx = cam.fx = drag.fx + (drag.p0.x - q.x);
          cam.tz = cam.fz = drag.fz + (drag.p0.z - q.z);
        }
      }
    });
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (drag && moved <= 6 && e.type === 'pointerup') {
        ray.setFromCamera(ndc(e), this.camera);
        const h = ray.intersectObjects(this.tiles.pickables, false);
        const i = h[0]?.object.userData.i;
        if (typeof i === 'number') this.o.onTileClick(i);
      }
      drag = null;
      moved = 0;
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        cam.dist = clamp(cam.dist * Math.exp(e.deltaY * 0.0013), 700, 36000);
      },
      { passive: false },
    );
  }

  /* ---------- loop ---------- */

  private readonly frame = (now: number): void => {
    requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.clock += dt;
    const cam = this.cam;
    if (this.intro) {
      cam.az += dt * 3.5;
      cam.tx = MID[0];
      cam.tz = MID[1] + 700;
      cam.tilt = 47;
      cam.dist = 7500;
      cam.fx = cam.tx;
      cam.fz = cam.tz;
    }
    this.fx.update(dt);
    updateCamera(cam, this.camera, dt);
    this.world.sun.position.set(cam.fx - 2200, 3700, cam.fz + 1700);
    this.world.sun.target.position.set(cam.fx, 0, cam.fz);
    this.world.waterMat.uniforms.uTime!.value = this.clock;
    this.sky.step(dt, this.camera, this.scene);
    this.world.treeDim.value =
      (0.35 + 0.65 * this.fx.fxS.dim) * Math.min(1, 0.4 + 0.6 * this.sky.W.lt);
    this.pawns.step(dt, this.camera, this.clock);
    this.tiles.step(dt);
    this.ships.step(dt, this.clock);
    this.sky.stepDecor(dt, this.camera, this.clock);
    this.renderer.render(this.scene, this.camera);
  };
}
