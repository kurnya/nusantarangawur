/**
 * Client: mengirim niat ke Host dan menerima hasilnya. Client menerapkan niat yang sama dengan
 * mesin deterministik untuk menyusun state lokal, lalu mencocokkan hash dengan Host. Jika `rev`
 * loncat atau hash berbeda, client meminta snapshot penuh. Sumber kebenaran tetap Host.
 */
import { applyIntent } from '../engine/engine';
import { stateHash } from '../engine/hash';
import type { GameEvent, GameState } from '../engine/types';
import {
  decodeHost,
  encode,
  type ClientIntent,
  type ClientMsg,
  type HostMsg,
  type LobbyPlayer,
  type RoomSettings,
} from './protocol';
import type { Link } from './transport';

export type ClientStatus = 'connecting' | 'lobby' | 'playing' | 'ended' | 'lost';

export interface LobbyInfo {
  players: LobbyPlayer[];
  settings: RoomSettings;
  hostId: number;
  started: boolean;
}

export interface ClientCallbacks {
  onWelcome?(pid: number, token: string, code: string): void;
  onLobby?(lobby: LobbyInfo): void;
  /** state penuh diterima (awal permainan, sambung ulang, atau perbaikan sinkron) */
  onSnapshot?(state: GameState): void;
  /** hasil satu niat: putar `events` dari `prev` sampai `state` */
  onEvents?(prev: GameState, events: GameEvent[], state: GameState): void;
  onReject?(reason: string, seq: number): void;
  /** Host mengakhiri sesi atau mengeluarkan pemain ini */
  onEnd?(reason: string, kicked: boolean): void;
  /** sambungan ke Host putus */
  onLost?(): void;
  onPing?(ms: number): void;
  /** client meminta snapshot karena tidak sinkron (untuk diagnosis) */
  onResync?(why: 'rev' | 'hash' | 'invalid'): void;
  /** batas waktu giliran berubah */
  onTimer?(timer: TurnTimer | null): void;
}

/** Tenggat giliran menurut jam lokal (performance.now). */
export interface TurnTimer {
  pid: number;
  until: number;
  mode: 'gone' | 'away' | 'limit';
}

export interface Hello {
  name: string;
  pawn: number;
  dice?: number;
  token?: string;
}

export class ClientSession {
  pid: number | null = null;
  token: string | null = null;
  code: string | null = null;
  lobby: LobbyInfo | null = null;
  state: GameState | null = null;
  status: ClientStatus = 'connecting';
  ping = -1;
  timer: TurnTimer | null = null;
  private seq = 0;
  private syncing = false;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly link: Link,
    hello: Hello,
    private readonly cb: ClientCallbacks = {},
  ) {
    link.onMessage((raw) => this.receive(raw));
    link.onClose(() => {
      this.stopPing();
      if (this.status !== 'ended') {
        this.status = 'lost';
        this.cb.onLost?.();
      }
    });
    this.send({
      v: 1,
      t: 'hello',
      name: hello.name,
      pawn: hello.pawn,
      dice: hello.dice,
      token: hello.token,
    });
  }

  /* ---------- kirim ---------- */

  private send(msg: ClientMsg): void {
    this.link.send(encode(msg));
  }
  intent(intent: ClientIntent): number {
    const seq = ++this.seq;
    this.send({ v: 1, t: 'intent', seq, intent });
    return seq;
  }
  setReady(ready: boolean): void {
    this.send({ v: 1, t: 'ready', ready });
  }
  setProfile(name: string, pawn: number, dice?: number): void {
    this.send({ v: 1, t: 'profile', name, pawn, dice });
  }
  requestSync(): void {
    this.syncing = true;
    this.send({ v: 1, t: 'sync' });
  }
  startPing(everyMs = 3000): void {
    this.stopPing();
    const tick = () => this.send({ v: 1, t: 'ping', ts: performance.now() });
    tick();
    this.pingTimer = setInterval(tick, everyMs);
  }
  stopPing(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }
  /** jalur koneksi ke Host (untuk diagnosis) */
  route(): Promise<string | null> {
    return this.link.route?.() ?? Promise.resolve(null);
  }
  close(): void {
    this.status = 'ended';
    this.stopPing();
    this.link.close();
  }

  /* ---------- terima ---------- */

  private receive(raw: string): void {
    const msg = decodeHost(raw);
    if (!msg) return;
    this.handle(msg);
  }

  private handle(msg: HostMsg): void {
    switch (msg.t) {
      case 'welcome':
        this.pid = msg.pid;
        this.token = msg.token;
        this.code = msg.code;
        if (this.status === 'connecting') this.status = 'lobby';
        this.cb.onWelcome?.(msg.pid, msg.token, msg.code);
        return;
      case 'lobby':
        this.lobby = {
          players: msg.players,
          settings: msg.settings,
          hostId: msg.hostId,
          started: msg.started,
        };
        this.cb.onLobby?.(this.lobby);
        return;
      case 'snapshot':
        this.syncing = false;
        this.state = msg.state;
        this.status = msg.state.phase === 'over' ? 'ended' : 'playing';
        this.cb.onSnapshot?.(msg.state);
        return;
      case 'events': {
        if (this.syncing) return; // tunggu snapshot
        const prev = this.state;
        if (!prev || msg.rev !== prev.rev + 1) {
          this.cb.onResync?.('rev');
          this.requestSync();
          return;
        }
        const r = applyIntent(prev, msg.intent);
        if (!r.ok) {
          this.cb.onResync?.('invalid');
          this.requestSync();
          return;
        }
        if (stateHash(r.state) !== msg.stateHash) {
          this.cb.onResync?.('hash');
          this.requestSync();
          return;
        }
        this.state = r.state;
        // events dari Host yang diputar (isinya sama dengan hasil mesin lokal)
        this.cb.onEvents?.(prev, msg.events, r.state);
        return;
      }
      case 'reject':
        this.cb.onReject?.(msg.reason, msg.seq);
        return;
      case 'pong':
        this.ping = Math.max(0, Math.round(performance.now() - msg.ts));
        this.cb.onPing?.(this.ping);
        return;
      case 'timer':
        this.timer =
          msg.pid < 0 ? null : { pid: msg.pid, until: performance.now() + msg.ms, mode: msg.mode };
        this.cb.onTimer?.(this.timer);
        return;
      case 'kick':
      case 'end':
        this.status = 'ended';
        this.stopPing();
        this.cb.onEnd?.(msg.reason, msg.t === 'kick');
        return;
    }
  }
}
