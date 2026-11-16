/**
 * Memutar daftar GameEvent sebagai animasi, berurutan, di atas state tampilan.
 * State akhir dari mesin/Host selalu menang di akhir pemutaran.
 */
import { cityOf } from '../engine/board';
import { cloneState } from '../engine/engine';
import type { GameEvent, GameState } from '../engine/types';
import { sleep } from '../ui/dom';
import type { Hud } from '../ui/hud';
import { chanceLine, messageFor, monopolyLine } from '../ui/messages';
import type { GameView } from '../view/scene';
import { applyEvent } from './replay';

export interface PresenterDeps {
  hud: Hud;
  view: GameView | null;
  fast: boolean;
  /** id pemain pemilik layar ini */
  pov: () => number;
  /** id pemain pemilik layar, atau null di mode hot-seat (semua layar = pemain giliran) */
  me: () => number | null;
  /** keterangan tambahan saat menunggu pemain lain (mis. terputus) */
  waitNote?: () => string | undefined;
}

/** batas waktu maksimum satu animasi besar supaya tidak macet */
const FX_TIMEOUT_MS = 15000;
/** modal kartu di mode jaringan: pemilik kartu dan pemain lain */
const CARD_OWNER_MS = 10000;
const CARD_OTHER_MS = 3500;

export class Presenter {
  /** state yang sedang ditampilkan (bisa di tengah pemutaran) */
  disp: GameState | null = null;
  playing = false;

  constructor(private readonly d: PresenterDeps) {}

  /** Tampilkan state langsung tanpa animasi. */
  show(s: GameState): void {
    this.disp = cloneState(s);
    this.renderAll();
  }

  renderAll(): void {
    const s = this.disp;
    if (!s) return;
    const { hud, view } = this.d;
    hud.renderPlayers(s, this.d.me());
    hud.renderTurn(s, { pov: this.d.pov(), busy: this.playing, waitNote: this.d.waitNote?.() });
    view?.syncPawns(s);
  }

  async play(prev: GameState, events: readonly GameEvent[], final: GameState): Promise<void> {
    this.disp = cloneState(prev);
    this.playing = true;
    this.renderAll();
    try {
      for (const ev of events) await this.step(ev);
    } finally {
      this.disp = cloneState(final);
      this.playing = false;
      this.d.view?.syncAll(this.disp);
      this.renderAll();
    }
  }

  private async step(ev: GameEvent): Promise<void> {
    const s = this.disp!;
    const { hud, view, fast } = this.d;
    const line = messageFor(ev, s);
    const log = () => {
      if (line) hud.log(line);
    };
    switch (ev.e) {
      case 'DiceRolled':
        await hud.rollDice(ev.a, ev.b);
        applyEvent(s, ev);
        log();
        this.renderAll();
        return;
      case 'PawnStepped':
        applyEvent(s, ev);
        view?.syncPawns(s);
        view?.hop(ev.pid);
        view?.follow(ev.to);
        hud.renderTurn(s, { pov: this.d.pov(), busy: true });
        await sleep(230, fast);
        return;
      case 'MoneyChanged':
        log();
        applyEvent(s, ev);
        hud.renderPlayers(s, this.d.me());
        hud.flash(ev.pid, ev.amount >= 0);
        hud.popAmt(ev.pid, ev.amount);
        return;
      case 'PaidRent':
        log();
        applyEvent(s, ev);
        hud.renderPlayers(s, this.d.me());
        hud.flash(ev.from, false);
        hud.flash(ev.to, true);
        hud.flyCoins(ev.from, ev.to, ev.amount);
        await sleep(1050, fast);
        return;
      case 'CardDrawn': {
        const cl = chanceLine(ev, s);
        if (cl) hud.log(cl);
        log();
        applyEvent(s, ev);
        const tag =
          ev.tag === 'baik' ? 'Nasib baik' : ev.tag === 'buruk' ? 'Nasib buruk' : 'Bencana alam';
        await this.cardModal(hud.cardById(ev.card, tag, ev.kind), ev.pid);
        this.renderAll();
        return;
      }
      case 'HazardHit': {
        log();
        applyEvent(s, ev);
        const icon = ev.kind === 'banjir' ? '🌊' : ev.kind === 'petir' ? '⚡' : '🔥';
        await this.cardModal(hud.cardHTML('BENCANA', ev.text, icon, 'Musibah cuaca'), ev.pid);
        return;
      }
      case 'BencanaFx':
        if (view && !fast)
          await Promise.race([
            view.play(ev.key, ev.tile, ev.player),
            new Promise((r) => setTimeout(r, FX_TIMEOUT_MS)),
          ]);
        return;
      case 'CityBought':
      case 'CityBuilt':
      case 'CityLost':
      case 'CitySold': {
        log();
        applyEvent(s, ev);
        if (ev.e === 'CityBought') {
          const m = monopolyLine(ev, s);
          if (m) hud.log(m);
        }
        if (ev.e === 'CityBought' || ev.e === 'CityBuilt') hud.flash(ev.pid, false);
        this.updateProvince(ev.tile);
        this.renderAll();
        return;
      }
      case 'PlayerJailed':
        log();
        applyEvent(s, ev);
        view?.syncPawns(s);
        view?.follow(ev.pos);
        this.renderAll();
        await sleep(450, fast);
        return;
      case 'Bankrupt': {
        const freed = s.owners.map((o, i) => (o && o.p === ev.pid ? i : -1)).filter((i) => i >= 0);
        log();
        applyEvent(s, ev);
        freed.forEach((i) => view?.updateTile(i));
        this.renderAll();
        return;
      }
      case 'WeatherChanged':
        log();
        applyEvent(s, ev);
        view?.setWeather(ev.to);
        hud.renderWx(ev.to, true);
        return;
      default:
        log();
        applyEvent(s, ev);
        if (ev.e === 'TurnStarted') {
          const p = s.players[ev.pid];
          const mine = this.d.me() === null || this.d.me() === ev.pid;
          view?.resumeFollow();
          if (p) hud.announce(mine ? `Giliran ${p.name}. Lempar dadu.` : `Giliran ${p.name}.`);
        }
        if (ev.e === 'TurnStarted' || ev.e === 'JailReleased' || ev.e === 'TicketUsed')
          this.renderAll();
        return;
    }
  }

  /** Sewa provinsi ikut berubah saat kota dibeli/dibangun: gambar ulang label kelimanya. */
  private updateProvince(tile: number): void {
    const view = this.d.view;
    cityOf(tile)?.prov.tiles.forEach((i) => view?.updateTile(i));
  }

  /**
   * Modal kartu. Pemilik kartu (atau semua di hot-seat) menutup dengan klik;
   * layar pemain lain menutup sendiri supaya animasi di semua layar tetap sinkron.
   */
  private async cardModal(html: string, pid: number): Promise<void> {
    const { hud, fast } = this.d;
    if (fast) return;
    const me = this.d.me();
    const btn = [{ label: 'Terima nasib', cls: 'pri' }];
    if (me === null) {
      await hud.ask(html, btn);
      return;
    }
    const wait = me === pid ? CARD_OWNER_MS : CARD_OTHER_MS;
    await Promise.race([hud.ask(html, btn), new Promise((r) => setTimeout(r, wait))]);
    hud.closeModal();
  }
}
