/**
 * Pengendali permainan satu perangkat (hot-seat): menjalankan mesin lokal, memutar events,
 * dan menjadwalkan pergantian cuaca waktu nyata. Peran ini nanti dipegang Host di mode P2P.
 */
import { WEATHER } from '../engine/config';
import { applyIntent, createGame } from '../engine/engine';
import type { GameState, Intent, PlayerIntent } from '../engine/types';
import { nextWeatherDelayMs } from '../engine/weather';
import { confirmEndGame, showWinner } from '../ui/endgame';
import type { Hud } from '../ui/hud';
import { showTurnDraw } from '../ui/turnDraw';
import type { GameView } from '../view/scene';
import type { Presenter } from './presenter';

type PlayerIntentNoPid = PlayerIntent extends infer T
  ? T extends { pid: number }
    ? Omit<T, 'pid'>
    : never
  : never;

export interface LocalDeps {
  hud: Hud;
  view: GameView | null;
  presenter: Presenter;
  /** prefers-reduced-motion perangkat */
  reducedMotion?: boolean;
  /** pengali selang cuaca (uji) */
  weatherScale?: number;
}

export class LocalGame {
  state: GameState | null = null;
  private busy = false;
  private readonly queue: Intent[] = [];
  private wxTimer = 0;

  constructor(private readonly d: LocalDeps) {}

  start(
    players: { name: string; pawn: number }[],
    diceCount = 2,
    seed = (Math.random() * 2 ** 31) | 0,
  ): void {
    const s = createGame({ seed, players, diceCount });
    this.state = s;
    this.busy = true;
    void this.startIntro(s, diceCount);
  }

  private async startIntro(s: GameState, diceCount: number): Promise<void> {
    const { hud, view, presenter } = this.d;
    try {
      view?.start(s);
      view?.setWeather(s.weather, true);
      hud.renderWx(s.weather);
      presenter.show(s);
      hud.log({
        msg: `${s.players[s.turn]!.name} terpilih secara acak untuk jalan duluan. ${diceCount} dadu dipakai.`,
        cls: '',
      });
      hud.log({
        msg: `Cuaca awal: ${WEATHER[s.weather].name}. ${WEATHER[s.weather].desc}`,
        cls: 'wx',
      });
      await showTurnDraw({
        state: s,
        fast: hud.fast,
        reducedMotion: this.d.reducedMotion,
      });
      presenter.renderAll();
      this.scheduleWeather();
    } finally {
      this.busy = false;
    }
  }

  /** Niat dari tombol pemain yang sedang giliran (hot-seat: selalu pemain giliran). */
  act(i: PlayerIntentNoPid): void {
    const s = this.state;
    if (!s) return;
    if (this.busy) return;
    void this.dispatch({ ...i, pid: s.turn } as Intent);
  }

  get playing(): boolean {
    return this.busy;
  }

  async dispatch(intent: Intent): Promise<void> {
    if (this.busy) {
      if (intent.t === 'weather' || intent.t === 'endGame') this.queue.push(intent);
      return;
    }
    const prev = this.state;
    if (!prev) return;
    const r = applyIntent(prev, intent);
    if (!r.ok) {
      this.d.hud.toast(r.reason);
      return;
    }
    this.busy = true;
    this.state = r.state;
    try {
      await this.d.presenter.play(prev, r.events, r.state);
    } finally {
      this.busy = false;
    }
    if (r.state.phase === 'over') {
      clearTimeout(this.wxTimer);
      await this.showWinner(r.state);
      return;
    }
    const next = this.queue.shift();
    if (next) void this.dispatch(next);
  }

  private scheduleWeather(): void {
    clearTimeout(this.wxTimer);
    const ms = nextWeatherDelayMs() * (this.d.weatherScale ?? 1);
    this.wxTimer = window.setTimeout(() => {
      if (this.state?.phase === 'over') return;
      void this.dispatch({ t: 'weather' });
      this.scheduleWeather();
    }, ms);
  }

  async askEndGame(): Promise<void> {
    const s = this.state;
    if (!s || s.phase === 'over' || this.busy) return;
    if (await confirmEndGame(this.d.hud, s)) await this.dispatch({ t: 'endGame' });
  }

  private async showWinner(s: GameState): Promise<void> {
    await showWinner(this.d.hud, s);
    location.reload();
  }
}
