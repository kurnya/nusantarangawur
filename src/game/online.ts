/**
 * Pengendali permainan online (P2P). Halaman Host menjalankan HostSession dan bermain lewat
 * client loopback; semua halaman (termasuk Host) memakai ClientSession yang sama.
 * Animasi dari Host diputar berurutan lewat antrean.
 */
import { WEATHER } from '../engine/config';
import type { GameEvent, GameState } from '../engine/types';
import { ClientSession, type LobbyInfo } from '../net/client';
import { HostSession, loadHostSave } from '../net/host';
import { linkPair } from '../net/memory';
import { NetError } from '../net/peer';
import type { ClientIntent } from '../net/protocol';
import { inviteUrl, isRoomCode, makeRoomCode, normalizeCode } from '../net/room';
import type { Link, Transport } from '../net/transport';
import { confirmEndGame, showWinner } from '../ui/endgame';
import type { Hud } from '../ui/hud';
import { hideMenu, menuBusy, renderLobby, setLobbyStatus, type LobbyActions } from '../ui/lobby';
import type { GameView } from '../view/scene';
import type { Presenter } from './presenter';

export interface OnlineDeps {
  hud: Hud;
  view: GameView | null;
  presenter: Presenter;
  transport: Transport;
  /** kembali ke menu dengan pesan */
  toMenu: (error?: string, code?: string) => void;
  minPlayers?: number;
}

const RECONNECT_TRIES = 15;
const RECONNECT_GAP_MS = 3000;

const tokenKey = (code: string) => `nn.token.${code}`;
function ss(): Storage | null {
  try {
    return sessionStorage;
  } catch {
    return null;
  }
}
function ls(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

export class OnlineGame {
  client: ClientSession | null = null;
  host: HostSession | null = null;
  code = '';
  private name = '';
  private pawn = 0;
  private started = false;
  private readonly queue: (() => Promise<void>)[] = [];
  private draining = false;
  private status = 'Menyambung...';
  private reconnecting = false;

  constructor(private readonly d: OnlineDeps) {}

  get state(): GameState | null {
    return this.client?.state ?? null;
  }
  get me(): number | null {
    return this.client?.pid ?? null;
  }
  get playing(): boolean {
    return this.draining || this.queue.length > 0;
  }
  get isHost(): boolean {
    return this.host !== null;
  }

  /* ---------- membuat / bergabung ---------- */

  async create(name: string): Promise<void> {
    this.name = name;
    menuBusy('Membuka ruangan...');
    for (let k = 0; k < 4; k++) {
      const code = makeRoomCode();
      try {
        await this.openHost(code, null);
        return;
      } catch (e) {
        if (e instanceof NetError && e.kind === 'taken') continue;
        this.d.toMenu(errMsg(e));
        return;
      }
    }
    this.d.toMenu('Gagal membuat kode ruangan. Coba lagi.');
  }

  /** Halaman Host dimuat ulang: pulihkan ruangan dari localStorage jika ada. */
  async resumeHost(code: string, name: string): Promise<void> {
    this.name = name;
    menuBusy(`Memulihkan ruangan ${code}...`);
    try {
      await this.openHost(code, loadHostSave(ls(), code));
    } catch (e) {
      this.d.toMenu(errMsg(e));
    }
  }

  private async openHost(code: string, save: ReturnType<typeof loadHostSave>): Promise<void> {
    const endpoint = await this.d.transport.host(code);
    this.code = code;
    this.host = new HostSession({
      code,
      endpoint,
      storage: ls(),
      restore: save ?? undefined,
      minPlayers: this.d.minPlayers,
    });
    this.host.onChange = () => this.renderLobby();
    history.replaceState(null, '', `#/host/${code}`);
    const [mine, hostSide] = linkPair();
    this.host.attachLocal(hostSide);
    const token =
      save?.seats.find((s) => s.host)?.token ?? ss()?.getItem(tokenKey(code)) ?? undefined;
    this.connect(mine, token);
    window.addEventListener('beforeunload', () => this.host?.close('Host meninggalkan permainan.'));
  }

  async join(name: string, raw: string): Promise<void> {
    const code = normalizeCode(raw);
    this.name = name;
    if (!isRoomCode(code)) {
      this.d.toMenu('Kode ruangan harus 5 karakter (huruf dan angka).', raw);
      return;
    }
    menuBusy(`Menyambung ke ruangan ${code}...`);
    try {
      const link = await this.d.transport.join(code);
      this.code = code;
      history.replaceState(null, '', `#/join/${code}`);
      this.connect(link, ss()?.getItem(tokenKey(code)) ?? undefined);
    } catch (e) {
      this.d.toMenu(errMsg(e), code);
    }
  }

  private connect(link: Link, token?: string): void {
    const { hud, presenter } = this.d;
    this.client = new ClientSession(
      link,
      { name: this.name || 'Pemain', pawn: this.pawn, token },
      {
        onWelcome: (_pid, tok, code) => {
          ss()?.setItem(tokenKey(code), tok);
          this.status = this.isHost
            ? 'Ruangan terbuka. Bagikan kode atau tautan.'
            : 'Tersambung ke Host.';
          this.renderLobby();
        },
        onLobby: (lobby) => {
          if (!lobby.started) this.renderLobby();
          else if (this.started && !presenter.playing) presenter.renderAll();
          this.syncEndButton();
        },
        onSnapshot: (s) => this.enqueue(async () => this.applySnapshot(s)),
        onEvents: (prev, events, s) => this.enqueue(() => this.playEvents(prev, events, s)),
        onReject: (reason) => hud.toast(reason),
        onEnd: (reason) => void this.ended(reason),
        onLost: () => void this.lost(),
        onPing: (ms) => {
          if (!this.started) {
            this.status = `${this.isHost ? 'Ruangan terbuka' : 'Tersambung'} · ping ${ms} ms`;
            setLobbyStatus(this.status);
          }
        },
      },
    );
    if (!this.isHost) this.client.startPing();
  }

  /* ---------- lobi ---------- */

  private readonly lobbyActions: LobbyActions = {
    setName: (n) => {
      this.name = n;
      this.client?.setProfile(n, this.myLobby()?.pawn ?? this.pawn);
    },
    setPawn: (p) => {
      this.pawn = p;
      this.client?.setProfile(this.myLobby()?.name ?? this.name, p);
    },
    setReady: (r) => this.client?.setReady(r),
    start: () => {
      const r = this.host?.start();
      if (r && !r.ok) this.d.hud.toast(r.reason ?? 'Belum bisa mulai.');
    },
    kick: (id) => this.host?.kick(id),
    setStartMoney: (v) => this.host?.setSettings({ startMoney: v }),
    leave: () => this.leave(),
  };

  private myLobby() {
    return this.client?.lobby?.players.find((p) => p.id === this.client?.pid);
  }

  private renderLobby(): void {
    if (this.started || !this.client) return;
    renderLobby(
      {
        code: this.code,
        invite: inviteUrl(this.code),
        me: this.client.pid,
        isHost: this.isHost,
        lobby: this.client.lobby as LobbyInfo | null,
        status: this.status,
        canStart: this.host?.canStart(),
      },
      this.lobbyActions,
    );
  }

  leave(): void {
    if (this.host) {
      this.host.close();
      this.host.forget();
    }
    this.client?.close();
    ss()?.removeItem(tokenKey(this.code));
    history.replaceState(null, '', location.pathname + location.search);
    location.reload();
  }

  /* ---------- permainan ---------- */

  act(i: ClientIntent): void {
    const s = this.state;
    if (!s || !this.client || this.playing) return;
    if (s.turn !== this.client.pid) return;
    this.client.intent(i);
  }

  async askEndGame(): Promise<void> {
    const s = this.state;
    if (!this.host || !s || s.phase === 'over') return;
    if (await confirmEndGame(this.d.hud, s)) this.host.endGame();
  }

  /** keterangan di kartu kontrol saat menunggu pemain yang terputus */
  waitNote(): string | undefined {
    const s = this.state;
    const lp = this.client?.lobby?.players.find((p) => p.id === s?.turn);
    if (lp && !lp.connected) return '(terputus, giliran otomatis setelah 45 detik)';
    return undefined;
  }

  private syncEndButton(): void {
    const b = document.getElementById('endGame');
    if (b) b.style.display = this.isHost ? '' : 'none';
  }

  private enqueue(job: () => Promise<void>): void {
    this.queue.push(job);
    if (!this.draining) void this.drain();
  }
  private async drain(): Promise<void> {
    this.draining = true;
    try {
      while (this.queue.length) {
        const job = this.queue.shift()!;
        try {
          await job();
        } catch (err) {
          console.error(err);
        }
      }
    } finally {
      this.draining = false;
      this.d.presenter.renderAll();
    }
  }

  private applySnapshot(s: GameState): void {
    const { hud, view, presenter } = this.d;
    if (!this.started) {
      this.started = true;
      hideMenu();
      this.syncEndButton();
      view?.start(s);
      view?.setWeather(s.weather, true);
      hud.renderWx(s.weather);
      presenter.show(s);
      hud.log({
        msg: 'Permainan dimulai dari Titik Nol Sabang, jalan ke kanan. Selamat berkeliling Nusantara.',
        cls: '',
      });
      hud.log({
        msg: `Cuaca awal: ${WEATHER[s.weather].name}. ${WEATHER[s.weather].desc}`,
        cls: 'wx',
      });
      return;
    }
    view?.setWeather(s.weather);
    hud.renderWx(s.weather);
    presenter.show(s);
    view?.syncAll(s);
  }

  private async playEvents(prev: GameState, events: GameEvent[], s: GameState): Promise<void> {
    await this.d.presenter.play(prev, events, s);
    if (s.phase === 'over' && events.some((e) => e.e === 'GameOver')) {
      this.host?.forget();
      await showWinner(this.d.hud, s, 'Kembali ke menu');
      this.leave();
    }
  }

  /* ---------- putus ---------- */

  private async ended(reason: string): Promise<void> {
    ss()?.removeItem(tokenKey(this.code));
    await this.d.hud.ask(`<h3>Sesi berakhir</h3><p style="margin:0">${escText(reason)}</p>`, [
      { label: 'Kembali ke menu', cls: 'pri' },
    ]);
    history.replaceState(null, '', location.pathname + location.search);
    location.reload();
  }

  /** Sambungan ke Host putus: coba sambung ulang dengan token, lalu menyerah. */
  private async lost(): Promise<void> {
    if (this.reconnecting || this.isHost) return;
    this.reconnecting = true;
    const { hud } = this.d;
    hud.toast('Koneksi ke Host terputus. Menyambung ulang...');
    setLobbyStatus('Koneksi terputus. Menyambung ulang...');
    for (let k = 0; k < RECONNECT_TRIES; k++) {
      await new Promise((r) => setTimeout(r, RECONNECT_GAP_MS));
      try {
        const link = await this.d.transport.join(this.code);
        this.reconnecting = false;
        this.connect(link, ss()?.getItem(tokenKey(this.code)) ?? undefined);
        hud.toast('Tersambung lagi.');
        return;
      } catch {
        /* coba lagi */
      }
    }
    this.reconnecting = false;
    await hud.ask(
      '<h3>Host terputus</h3><p style="margin:0">Permainan berhenti karena Host tidak bisa dihubungi. Jika Host memuat ulang halamannya, ruangan bisa dipulihkan: buka lagi tautan undangan.</p>',
      [{ label: 'Kembali ke menu', cls: 'pri' }],
    );
    history.replaceState(null, '', location.pathname + location.search);
    location.reload();
  }
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Terjadi kesalahan jaringan.';
}
function escText(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
