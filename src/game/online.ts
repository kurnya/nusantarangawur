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
import { isAssetIntent, type ClientIntent } from '../net/protocol';
import { probeTurn, sessionIce } from '../net/ice';
import { inviteUrl, isRoomCode, makeRoomCode, normalizeCode } from '../net/room';
import type { Link, Transport } from '../net/transport';
import { confirmEndGame, showWinner } from '../ui/endgame';
import type { Hud } from '../ui/hud';
import { setupNetPanel, type NetInfo } from '../ui/netpanel';
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

const DICE_KEY = 'ng_dice_online';
function loadDice(): number | undefined {
  try {
    const v = Number(localStorage.getItem(DICE_KEY));
    return localStorage.getItem(DICE_KEY) !== null && Number.isInteger(v) && v >= 0 && v < 8
      ? v
      : undefined;
  } catch {
    return undefined;
  }
}
function saveDice(k: number): void {
  try {
    localStorage.setItem(DICE_KEY, String(k));
  } catch {
    /* penyimpanan tidak tersedia */
  }
}

export class OnlineGame {
  client: ClientSession | null = null;
  host: HostSession | null = null;
  code = '';
  private name = '';
  private pawn = 0;
  /** dadu pilihan perangkat ini (disimpan agar terpakai lagi di ruangan berikutnya) */
  private dice: number | undefined = loadDice();
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
      { name: this.name || 'Pemain', pawn: this.pawn, dice: this.dice, token },
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
          this.applyWeatherFx(lobby.settings.weatherFx);
        },
        onSnapshot: (s) => this.enqueue(async () => this.applySnapshot(s)),
        onEvents: (prev, events, s) => this.enqueue(() => this.playEvents(prev, events, s)),
        onReject: (reason) => hud.toast(reason),
        onTimer: () => this.tickTimer(),
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
    setDiceCount: (v) => this.host?.setSettings({ diceCount: v }),
    setTurnLimit: (s) => this.host?.setSettings({ turnLimit: s }),
    leave: () => this.leave(),
  };

  /** Dadu yang dipakai pemain `pid`: pilihan yang diumumkan Host, atau bawaan per kursi. */
  diceOf(pid: number): number {
    if (pid === this.me && this.dice !== undefined) return this.dice;
    const d = this.client?.lobby?.players.find((p) => p.id === pid)?.dice;
    return d ?? pid % 8;
  }

  /** Pilih dadu untuk pemain ini; Host menyiarkannya ke semua pemain. */
  setDice(k: number): void {
    this.dice = k;
    saveDice(k);
    const me = this.myLobby();
    this.client?.setProfile(me?.name ?? this.name, me?.pawn ?? this.pawn, k);
  }

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
    if (!s || !this.client || s.phase === 'over') return;
    // kelola aset boleh kapan saja; aksi giliran hanya di giliran sendiri dan setelah animasi
    if (!isAssetIntent(i)) {
      if (this.playing || s.turn !== this.client.pid) return;
    }
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
    if (lp?.gone) return '(dikeluarkan, dimainkan otomatis)';
    if (lp && !lp.connected) return '(terputus)';
    return undefined;
  }

  /** Perbarui hitung mundur giliran di kartu kontrol. */
  private tickTimer(): void {
    const el = document.getElementById('tmr');
    if (!el) return;
    const s = this.state;
    const tm = this.client?.timer;
    if (!s || s.phase === 'over' || !tm || tm.pid !== s.turn) {
      el.textContent = '';
      return;
    }
    const left = Math.max(0, Math.ceil((tm.until - performance.now()) / 1000));
    const mm = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    const name = s.players[s.turn]?.name ?? '';
    el.textContent =
      tm.mode === 'away'
        ? `${name} terputus · giliran otomatis dalam ${mm}`
        : tm.mode === 'gone'
          ? `${name} dimainkan otomatis`
          : s.turn === this.me
            ? `Sisa waktu giliranmu ${mm}`
            : `Waktu ${name}: ${mm}`;
    el.classList.toggle('low', tm.mode === 'limit' && left <= 10);
  }

  private async netInfo(): Promise<NetInfo> {
    const c = this.client;
    const st = c?.status;
    return {
      status:
        st === 'lost' || this.reconnecting ? 'lost' : st === 'connecting' ? 'connecting' : 'ok',
      ping: c?.ping ?? -1,
      route: this.isHost ? null : ((await c?.route()) ?? null),
      isHost: this.isHost,
      turn: (await sessionIce()).turn,
      me: this.me,
      players: c?.lobby?.players ?? [],
    };
  }

  /** Uji TURN dari perangkat ini: apakah server TURN memberi jalur relay. */
  async testTurn(): Promise<string> {
    const ice = await sessionIce();
    if (!ice.turn)
      return ice.warning ?? 'TURN belum diatur. Hanya jalur langsung (STUN) yang tersedia.';
    const n = await probeTurn(ice.servers);
    return n > 0
      ? `TURN berfungsi (${n} jalur relay${ice.source === 'url' ? ', kredensial dari URL' : ''}).`
      : 'TURN tidak menjawab. Periksa kredensial atau kuota layanan TURN.';
  }

  private async kickInGame(id: number): Promise<void> {
    const p = this.client?.lobby?.players.find((x) => x.id === id);
    if (!this.host || !p) return;
    const k = await this.d.hud.ask(
      `<h3>Keluarkan ${escText(p.name)}?</h3><p style="margin:0">Gilirannya akan dimainkan otomatis sampai permainan selesai. Ia tidak bisa masuk lagi.</p>`,
      [{ label: 'Batal' }, { label: 'Keluarkan', cls: 'pri' }],
    );
    if (k === 1) this.host.kick(id);
  }

  /** Tampilan cuaca diatur Host untuk semua layar; tombolnya hanya muncul di layar Host. */
  private applyWeatherFx(on: boolean): void {
    this.d.view?.setWeatherVisible(on);
    const b = document.getElementById('camWeather');
    if (!b) return;
    b.hidden = !this.isHost;
    b.textContent = on ? 'Cuaca: hidup' : 'Cuaca: mati';
  }

  /** Host: hidupkan/matikan tampilan cuaca untuk semua pemain. */
  toggleWeather(): void {
    const on = this.client?.lobby?.settings.weatherFx ?? true;
    this.host?.setWeatherFx(!on);
  }

  private syncEndButton(): void {
    const b = document.getElementById('endGame') as HTMLButtonElement | null;
    if (b) b.hidden = !this.isHost || !this.started;
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
      setupNetPanel(
        () => this.netInfo(),
        (id) => void this.kickInGame(id),
        () => this.testTurn(),
      );
      window.setInterval(() => this.tickTimer(), 500);
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
