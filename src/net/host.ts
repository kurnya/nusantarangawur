/**
 * Host berwibawa. Mesin permainan hanya berjalan di sini. Client mengirim niat, Host memvalidasi,
 * menjalankan mesin, lalu menyiarkan events + hash state. Host sendiri bermain lewat client
 * loopback (link dalam memori), jadi jalurnya sama dengan pemain lain.
 */
import * as C from '../engine/config';
import { applyIntent, createGame } from '../engine/engine';
import { stateHash } from '../engine/hash';
import type { GameEvent, GameState, Intent, IntentOk } from '../engine/types';
import { estimateAnimMs } from '../game/timing';
import { nextWeatherDelayMs } from '../engine/weather';
import {
  decodeClient,
  encode,
  type ClientMsg,
  type HostMsg,
  type LobbyPlayer,
  type RoomSettings,
} from './protocol';
import { makeToken } from './room';
import type { HostEndpoint, Link } from './transport';

export const DISCONNECT_GRACE_MS = 45_000;
/** jeda sebelum giliran pemain yang dikeluarkan dimainkan otomatis */
export const GONE_MS = 1500;
export const HELLO_TIMEOUT_MS = 10_000;
/** batas laju: kapasitas ember dan isi ulang per detik */
export const RATE_CAP = 20;
export const RATE_REFILL = 10;

interface Seat {
  id: number;
  name: string;
  pawn: number;
  token: string;
  ready: boolean;
  connected: boolean;
  host: boolean;
  /** dikeluarkan Host saat bermain: gilirannya dimainkan otomatis segera */
  gone?: boolean;
  link: Link | null;
  bucket: { tokens: number; t: number };
}

/** Data yang disimpan Host di localStorage supaya ruangan bisa dipulihkan setelah refresh. */
export interface HostSave {
  v: 1;
  code: string;
  savedAt: number;
  settings: RoomSettings;
  seats: Omit<Seat, 'link' | 'bucket' | 'connected'>[];
  state: GameState | null;
}

export interface HostOptions {
  code: string;
  endpoint: HostEndpoint;
  settings?: Partial<RoomSettings>;
  /** minimal pemain untuk mulai (bawaan 3) */
  minPlayers?: number;
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  random?: () => number;
  now?: () => number;
  seed?: number;
  /** nyalakan timer cuaca (matikan di tes) */
  weather?: boolean;
  restore?: HostSave;
}

export const saveKey = (code: string) => `nn.host.${code}`;

export class HostSession {
  readonly code: string;
  private seats: Seat[] = [];
  settings: RoomSettings;
  state: GameState | null = null;
  private readonly links = new Set<Link>();
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private timer: { pid: number; mode: 'gone' | 'away' | 'limit'; deadline: number } | null = null;
  private wxTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private readonly o: HostOptions;
  /** dipanggil saat lobi berubah (untuk UI Host) */
  onChange: () => void = () => {};

  constructor(o: HostOptions) {
    this.o = o;
    this.code = o.code;
    this.settings = { startMoney: C.START_MONEY, turnLimit: 0, weatherFx: true, ...o.settings };
    if (o.restore) {
      // simpanan versi lama belum punya weatherFx
      this.settings = { ...o.restore.settings, weatherFx: o.restore.settings.weatherFx ?? true };
      this.state = o.restore.state;
      this.seats = o.restore.seats.map((s) => ({
        ...s,
        connected: false,
        link: null,
        bucket: { tokens: RATE_CAP, t: this.now() },
      }));
    }
    o.endpoint.onConnection((link) => this.attach(link, false));
    if (this.state && this.state.phase !== 'over') {
      this.scheduleWeather();
      this.armTurnTimer();
    }
  }

  private now(): number {
    return this.o.now?.() ?? Date.now();
  }
  get started(): boolean {
    return this.state !== null;
  }
  get players(): LobbyPlayer[] {
    return this.seats.map((s) => ({
      id: s.id,
      name: s.name,
      pawn: s.pawn,
      ready: s.ready || s.host,
      connected: s.connected,
      host: s.host,
      gone: !!s.gone,
    }));
  }
  get hostId(): number {
    return this.seats.find((s) => s.host)?.id ?? 0;
  }

  /** Sambungkan client loopback milik Host (dianggap Host). */
  attachLocal(link: Link): void {
    this.attach(link, true);
  }

  /* ---------- koneksi ---------- */

  private attach(link: Link, isHost: boolean): void {
    if (this.closed) {
      link.close();
      return;
    }
    this.links.add(link);
    let seat: Seat | null = null;
    const helloTimer = setTimeout(() => {
      if (!seat) link.close();
    }, HELLO_TIMEOUT_MS);
    link.onMessage((raw) => {
      const msg = decodeClient(raw);
      if (!msg) return; // pesan tidak sah: abaikan, jangan crash
      if (!seat) {
        if (msg.t !== 'hello') return;
        clearTimeout(helloTimer);
        seat = this.hello(link, msg, isHost);
        return;
      }
      if (!this.allow(seat)) return;
      this.handle(seat, msg);
    });
    link.onClose(() => {
      clearTimeout(helloTimer);
      this.links.delete(link);
      if (seat && seat.link === link) this.drop(seat);
    });
  }

  private hello(link: Link, msg: Extract<ClientMsg, { t: 'hello' }>, isHost: boolean): Seat | null {
    // sambung ulang dengan token
    const back = msg.token ? this.seats.find((s) => s.token === msg.token) : undefined;
    if (back) {
      if (back.link && back.link !== link) {
        const old = back.link;
        back.link = null;
        old.close();
      }
      back.link = link;
      back.connected = true;
      if (isHost) back.host = true;
      this.sendTo(back, { v: 1, t: 'welcome', pid: back.id, token: back.token, code: this.code });
      if (this.state)
        this.sendTo(back, { v: 1, t: 'snapshot', rev: this.state.rev, state: this.state });
      this.broadcastLobby();
      this.armTurnTimer();
      return back;
    }
    if (this.started) {
      this.kickLink(link, 'Permainan sudah berjalan. Tunggu permainan berikutnya.');
      return null;
    }
    if (this.seats.length >= C.MAX_PLAYERS) {
      this.kickLink(link, 'Ruangan penuh.');
      return null;
    }
    const taken = new Set(this.seats.map((s) => s.pawn));
    const pawn = taken.has(msg.pawn)
      ? [...Array(C.MAX_PLAYERS).keys()].find((p) => !taken.has(p))!
      : msg.pawn;
    const ids = new Set(this.seats.map((s) => s.id));
    let id = 0;
    while (ids.has(id)) id++;
    const seat: Seat = {
      id,
      name: msg.name || `Pemain ${id + 1}`,
      pawn,
      token: makeToken(),
      ready: false,
      connected: true,
      host: isHost,
      link,
      bucket: { tokens: RATE_CAP, t: this.now() },
    };
    this.seats.push(seat);
    this.seats.sort((a, b) => a.id - b.id);
    this.sendTo(seat, { v: 1, t: 'welcome', pid: seat.id, token: seat.token, code: this.code });
    this.broadcastLobby();
    return seat;
  }

  private drop(seat: Seat): void {
    seat.link = null;
    seat.connected = false;
    if (!this.started) {
      // di lobi: kursinya dilepas
      this.seats = this.seats.filter((s) => s !== seat);
    }
    this.broadcastLobby();
    this.armTurnTimer();
  }

  /** ember token per pemain */
  private allow(seat: Seat): boolean {
    const t = this.now();
    const b = seat.bucket;
    b.tokens = Math.min(RATE_CAP, b.tokens + ((t - b.t) / 1000) * RATE_REFILL);
    b.t = t;
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  }

  private handle(seat: Seat, msg: ClientMsg): void {
    switch (msg.t) {
      case 'hello':
        return;
      case 'ping':
        this.sendTo(seat, { v: 1, t: 'pong', ts: msg.ts });
        return;
      case 'sync':
        if (this.state)
          this.sendTo(seat, { v: 1, t: 'snapshot', rev: this.state.rev, state: this.state });
        else this.broadcastLobby();
        return;
      case 'ready':
        if (this.started) return;
        seat.ready = msg.ready;
        this.broadcastLobby();
        return;
      case 'profile': {
        if (this.started) return;
        if (msg.name) seat.name = msg.name;
        const taken = this.seats.some((s) => s !== seat && s.pawn === msg.pawn);
        if (!taken) seat.pawn = msg.pawn;
        this.broadcastLobby();
        return;
      }
      case 'intent': {
        if (!this.state) {
          this.sendTo(seat, {
            v: 1,
            t: 'reject',
            seq: msg.seq,
            reason: 'Permainan belum dimulai.',
          });
          return;
        }
        const intent = { ...msg.intent, pid: seat.id } as Intent;
        const r = applyIntent(this.state, intent);
        if (!r.ok) {
          this.sendTo(seat, { v: 1, t: 'reject', seq: msg.seq, reason: r.reason });
          return;
        }
        this.commit(intent, r);
        return;
      }
    }
  }

  /* ---------- aksi Host ---------- */

  canStart(): { ok: boolean; reason?: string } {
    if (this.started) return { ok: false, reason: 'Permainan sudah berjalan.' };
    const min = this.o.minPlayers ?? C.MIN_PLAYERS;
    if (this.seats.length < min) return { ok: false, reason: `Butuh minimal ${min} pemain.` };
    if (this.seats.some((s) => !s.ready && !s.host))
      return { ok: false, reason: 'Belum semua pemain siap.' };
    if (this.seats.some((s) => !s.connected))
      return { ok: false, reason: 'Ada pemain yang terputus.' };
    return { ok: true };
  }

  start(): { ok: boolean; reason?: string } {
    const c = this.canStart();
    if (!c.ok) return c;
    // nomori ulang kursi 0..n-1 supaya id kursi = id pemain di mesin
    this.seats.forEach((s, i) => (s.id = i));
    const seed = this.o.seed ?? Math.floor((this.o.random ?? Math.random)() * 2 ** 31);
    this.state = createGame({
      seed,
      startMoney: this.settings.startMoney,
      players: this.seats.map((s) => ({ name: s.name, pawn: s.pawn })),
    });
    for (const s of this.seats) {
      this.sendTo(s, { v: 1, t: 'welcome', pid: s.id, token: s.token, code: this.code });
      this.sendTo(s, { v: 1, t: 'snapshot', rev: this.state.rev, state: this.state });
    }
    this.broadcastLobby();
    this.persist();
    this.scheduleWeather();
    this.armTurnTimer();
    return { ok: true };
  }

  kick(id: number): void {
    const s = this.seats.find((x) => x.id === id);
    if (!s || s.host) return;
    if (s.link) this.kickLink(s.link, 'Kamu dikeluarkan oleh Host.');
    if (this.started && this.state && !this.state.players[id]?.bankrupt) {
      // pemain yang dikeluarkan saat bermain: giliran otomatis tetap berjalan
      s.connected = false;
      s.gone = true;
      s.link = null;
      s.token = makeToken();
    } else this.seats = this.seats.filter((x) => x !== s);
    this.broadcastLobby();
    this.armTurnTimer();
  }

  setSettings(p: Partial<RoomSettings>): void {
    if (this.started) return;
    this.settings = { ...this.settings, ...p };
    this.broadcastLobby();
  }

  /** Hidupkan/matikan tampilan cuaca untuk semua pemain (boleh saat bermain). */
  setWeatherFx(on: boolean): void {
    if (this.settings.weatherFx === on) return;
    this.settings = { ...this.settings, weatherFx: on };
    this.broadcastLobby();
  }

  /** "Akhiri dan hitung kekayaan" (hanya Host). */
  endGame(): void {
    this.system({ t: 'endGame' });
  }

  close(reason = 'Host menutup ruangan.'): void {
    if (this.closed) return;
    this.closed = true;
    this.clearTimers();
    const msg = encode({ v: 1, t: 'end', reason });
    for (const l of this.links) {
      try {
        l.send(msg);
      } catch {
        /* abaikan */
      }
      l.close();
    }
    this.o.endpoint.close();
  }

  /** Hapus simpanan (mis. setelah permainan selesai). */
  forget(): void {
    try {
      this.o.storage?.removeItem(saveKey(this.code));
    } catch {
      /* abaikan */
    }
  }

  /* ---------- inti ---------- */

  private system(intent: Intent): void {
    if (!this.state) return;
    const r = applyIntent(this.state, intent);
    if (r.ok) this.commit(intent, r);
  }

  private commit(intent: Intent, r: IntentOk): void {
    this.state = r.state;
    const msg = encode({
      v: 1,
      t: 'events',
      rev: r.state.rev,
      intent,
      events: r.events,
      stateHash: stateHash(r.state),
    });
    for (const s of this.seats) if (s.link) s.link.send(msg);
    this.persist();
    if (r.state.phase === 'over') {
      this.clearTimers();
      this.timer = null;
      this.broadcastTimer();
      return;
    }
    this.armTurnTimer(r.events);
  }

  /**
   * Timer giliran berbasis tenggat. Mode: 'gone' (dikeluarkan, 1,5 detik), 'away' (terputus,
   * 45 detik), atau 'limit' (batas waktu giliran dari pengaturan). Tenggat dihitung per giliran;
   * lama animasi tiap aksi ditambahkan supaya waktu tidak termakan animasi di layar pemain.
   */
  private armTurnTimer(events?: readonly GameEvent[]): void {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = null;
    const s = this.state;
    if (!s || s.phase === 'over' || this.closed) {
      this.timer = null;
      return;
    }
    const pid = s.turn;
    const seat = this.seats.find((x) => x.id === pid);
    const mode: 'gone' | 'away' | 'limit' =
      !seat || seat.gone ? 'gone' : !seat.connected ? 'away' : 'limit';
    const base =
      mode === 'gone'
        ? GONE_MS
        : mode === 'away'
          ? DISCONNECT_GRACE_MS
          : this.settings.turnLimit * 1000;
    if (!base) {
      if (this.timer) {
        this.timer = null;
        this.broadcastTimer();
      }
      return;
    }
    const anim = events ? estimateAnimMs(events) : 0;
    const now = this.now();
    const prev = this.timer;
    const newTurn =
      !prev ||
      prev.pid !== pid ||
      prev.mode !== mode ||
      !!events?.some((e) => e.e === 'TurnStarted');
    const deadline = newTurn ? now + base + anim : prev.deadline + anim;
    this.timer = { pid, mode, deadline };
    this.broadcastTimer();
    this.turnTimer = setTimeout(
      () => {
        const st = this.state;
        if (st && st.turn === pid && st.phase !== 'over') {
          this.timer = null;
          this.autoPlay(pid);
        }
      },
      Math.max(0, deadline - now),
    );
  }

  /** sisa waktu giliran saat ini (ms), atau null jika tanpa batas */
  get timeLeft(): number | null {
    return this.timer ? Math.max(0, this.timer.deadline - this.now()) : null;
  }

  private broadcastTimer(): void {
    const msg = encode(
      this.timer
        ? { v: 1, t: 'timer', pid: this.timer.pid, ms: this.timeLeft ?? 0, mode: this.timer.mode }
        : { v: 1, t: 'timer', pid: -1, ms: 0, mode: 'limit' },
    );
    for (const s of this.seats) s.link?.send(msg);
  }

  /** Mainkan giliran otomatis: lempar dadu bila perlu, lalu akhiri giliran. */
  autoPlay(pid: number): void {
    for (let k = 0; k < 12; k++) {
      const s = this.state;
      if (!s || s.phase === 'over' || s.turn !== pid) return;
      this.system({ t: s.phase === 'roll' ? 'roll' : 'endTurn', pid });
    }
  }

  private scheduleWeather(): void {
    if (this.o.weather === false || this.closed) return;
    if (this.wxTimer) clearTimeout(this.wxTimer);
    this.wxTimer = setTimeout(() => {
      if (!this.state || this.state.phase === 'over') return;
      this.system({ t: 'weather' });
      this.scheduleWeather();
    }, nextWeatherDelayMs(this.o.random));
  }

  private clearTimers(): void {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    if (this.wxTimer) clearTimeout(this.wxTimer);
    this.turnTimer = this.wxTimer = null;
  }

  /* ---------- kirim ---------- */

  private sendTo(seat: Seat, msg: HostMsg): void {
    seat.link?.send(encode(msg));
  }
  private kickLink(link: Link, reason: string): void {
    link.send(encode({ v: 1, t: 'kick', reason }));
    setTimeout(() => link.close(), 50);
  }
  private broadcastLobby(): void {
    const msg = encode({
      v: 1,
      t: 'lobby',
      players: this.players,
      settings: this.settings,
      hostId: this.hostId,
      started: this.started,
    });
    for (const s of this.seats) s.link?.send(msg);
    this.persist();
    this.onChange();
  }

  private persist(): void {
    if (!this.o.storage) return;
    const save: HostSave = {
      v: 1,
      code: this.code,
      savedAt: this.now(),
      settings: this.settings,
      seats: this.seats.map(({ id, name, pawn, token, ready, host }) => ({
        id,
        name,
        pawn,
        token,
        ready,
        host,
      })),
      state: this.state,
    };
    try {
      this.o.storage.setItem(saveKey(this.code), JSON.stringify(save));
    } catch {
      /* penyimpanan penuh atau diblokir */
    }
  }
}

/** Baca simpanan Host. null jika tidak ada, rusak, atau lebih tua dari `maxAgeMs`. */
export function loadHostSave(
  storage: Pick<Storage, 'getItem'> | null,
  code: string,
  now = Date.now(),
  maxAgeMs = 6 * 3600_000,
): HostSave | null {
  try {
    const raw = storage?.getItem(saveKey(code));
    if (!raw) return null;
    const v = JSON.parse(raw) as HostSave;
    if (v.v !== 1 || v.code !== code || now - v.savedAt > maxAgeMs) return null;
    return v;
  } catch {
    return null;
  }
}
