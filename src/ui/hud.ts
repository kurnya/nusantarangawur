/**
 * HUD DOM: panel saldo pemain (dengan animasi koin), kartu kontrol kanan bawah, dadu CSS,
 * kotak cuaca, catatan perjalanan (buka/tutup per pemain), modal kartu, dan toast.
 * Semua teks dari pemain di-escape.
 */
import { CARD_BY_ID, PAWNS, PROVINCES, TILES, cityOf, tileName } from '../engine/board';
import * as C from '../engine/config';
import { buildCost, canBuild, cityPrice, fmtMoney, ownedCount } from '../engine/rules';
import type { CardKind, GameState, WeatherKey } from '../engine/types';
import { $, el, esc, sleep, tkImg } from './dom';
import type { LogLine } from './messages';

export interface HudActions {
  roll(): void;
  buy(): void;
  build(tile: number): void;
  endTurn(): void;
  payJail(): void;
}

export interface TurnView {
  /** id pemain yang melihat layar ini */
  pov: number;
  /** sedang memutar animasi: tombol dikunci */
  busy: boolean;
  /** teks tambahan saat menunggu (mis. "terputus") */
  waitNote?: string;
}

const DICE_ROT: Record<number, [number, number]> = {
  1: [0, 0],
  6: [0, 180],
  3: [0, -90],
  4: [0, 90],
  2: [-90, 0],
  5: [90, 0],
};

export class Hud {
  private shown: Record<number, number> = {};
  private tws: Record<number, { from: number; to: number; t0: number; dur: number }> = {};
  private twRun = false;
  private flyTo = new Set<number>();
  private cubes: HTMLElement[] = [];
  private spin = 0;
  /** status catatan per id pemain */
  private logOpen: Record<number, boolean> = {};
  private logUnread: Record<number, number> = {};
  private lastPov = 0;
  private toastTimer = 0;
  private modalDone: ((k: number) => void) | null = null;

  constructor(
    readonly fast: boolean,
    private readonly actions: HudActions,
    /** prefers-reduced-motion: koin terbang diganti angka mengambang */
    private readonly reducedMotion = false,
  ) {
    this.buildDice();
  }

  /* ---------- panel pemain ---------- */

  /** `me`: id pemain pemilik layar (null di mode hot-seat). */
  renderPlayers(s: GameState, me: number | null = null): void {
    const w = $('#players');
    w.innerHTML = '';
    s.players.forEach((p, i) => {
      const mine = s.owners.filter((o) => o && o.p === i).length;
      const sets = PROVINCES.filter((pr) => ownedCount(s, i, pr) === 5).length;
      const on = i === s.turn && !p.bankrupt && s.phase !== 'over';
      const d = el(
        'div',
        'pc' + (on ? ' on' : '') + (p.bankrupt ? ' out' : '') + (i === me ? ' me' : ''),
      );
      d.style.setProperty('--c', PAWNS[p.pawn]?.color ?? '#888');
      d.id = `pc${i}`;
      const tags = p.bankrupt
        ? 'Bangkrut'
        : `${mine} kota · ${sets} provinsi penuh${p.jail ? ' · di penjara' : ''}${p.skip ? ' · lewat giliran' : ''}${p.free ? ' · tiket bebas sewa' : ''}${p.disc ? ' · kupon bangun' : ''}`;
      d.innerHTML = `<div class="tk">${tkImg(p.pawn)}</div><div><b>${esc(p.name)}${i === me ? '<span class="you">kamu</span>' : ''}</b><div class="m">${fmtMoney(this.shown[i] ?? p.money)}</div><div class="s">${esc(tags)}</div></div>`;
      w.appendChild(d);
    });
    this.syncMoney(s);
  }

  private paintMoney(i: number): void {
    const m = document.querySelector(`#pc${i} .m`);
    if (m) m.textContent = fmtMoney(this.shown[i] ?? 0);
  }

  private syncMoney(s: GameState): void {
    s.players.forEach((p, i) => {
      const cur = this.shown[i];
      if (cur == null || this.fast) {
        this.shown[i] = p.money;
        return;
      }
      const tw = this.tws[i];
      if (tw) {
        if (tw.to === p.money) return;
        this.tws[i] = { from: cur, to: p.money, t0: performance.now(), dur: 900 };
        return;
      }
      if (cur === p.money) return;
      this.tws[i] = {
        from: cur,
        to: p.money,
        t0: performance.now() + (this.flyTo.has(i) ? 800 : 0),
        dur: 900,
      };
    });
    if (Object.keys(this.tws).length && !this.twRun) {
      this.twRun = true;
      requestAnimationFrame(this.twTick);
    }
  }

  private readonly twTick = (now: number): void => {
    let any = false;
    for (const k of Object.keys(this.tws)) {
      const i = Number(k);
      const t = this.tws[i]!;
      const u = Math.max(0, Math.min(1, (now - t.t0) / t.dur));
      const e = u * u * (3 - 2 * u);
      this.shown[i] = Math.round(t.from + (t.to - t.from) * e);
      this.paintMoney(i);
      if (u >= 1) {
        this.shown[i] = t.to;
        this.paintMoney(i);
        delete this.tws[i];
      } else any = true;
    }
    if (any) requestAnimationFrame(this.twTick);
    else this.twRun = false;
  };

  flash(pid: number, up: boolean): void {
    const d = document.getElementById(`pc${pid}`);
    if (!d) return;
    d.classList.remove('up', 'down');
    void d.offsetWidth;
    d.classList.add(up ? 'up' : 'down');
  }

  popAmt(pid: number, amount: number, delay = 0): void {
    if (this.fast) return;
    const d = document.getElementById(`pc${pid}`);
    if (!d) return;
    const r = d.getBoundingClientRect();
    const up = amount >= 0;
    const run = () => {
      const e = el(
        'div',
        'mpop ' + (up ? 'up' : 'down'),
        esc((up ? '+' : '-') + fmtMoney(Math.abs(amount))),
      );
      e.style.left = `${r.left + r.width / 2 - 30}px`;
      e.style.top = `${r.bottom - 6}px`;
      document.body.appendChild(e);
      const a = e.animate(
        [
          { transform: 'translateY(0)', opacity: 0 },
          { transform: 'translateY(10px)', opacity: 1, offset: 0.2 },
          { transform: 'translateY(34px)', opacity: 0 },
        ],
        { duration: 1300, easing: 'ease-out' },
      );
      a.onfinish = () => e.remove();
    };
    if (delay) setTimeout(run, delay);
    else run();
  }

  /** Koin dan label nominal terbang dari kartu pembayar ke kartu penerima. */
  flyCoins(from: number, to: number, amt: number): void {
    if (this.fast) return;
    if (this.reducedMotion) {
      this.popAmt(from, -amt);
      this.popAmt(to, amt);
      return;
    }
    const a = document.getElementById(`pc${from}`);
    const b = document.getElementById(`pc${to}`);
    if (!a || !b) return;
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    const x0 = ra.left + ra.width / 2;
    const y0 = ra.top + ra.height / 2;
    const x1 = rb.left + rb.width / 2;
    const y1 = rb.top + rb.height / 2;
    const mx = (x0 + x1) / 2;
    const my = Math.max(y0, y1) + 90 + Math.abs(x1 - x0) * 0.08;
    const fl = (cls: string, delay: number, dur: number, txt = '') => {
      const e = el('div', 'mfly ' + cls, txt);
      document.body.appendChild(e);
      const an = e.animate(
        [
          { transform: `translate(${x0}px,${y0}px) scale(.5)`, opacity: 0 },
          {
            transform: `translate(${x0 + (mx - x0) * 0.3}px,${y0 + (my - y0) * 0.5}px) scale(1)`,
            opacity: 1,
            offset: 0.18,
          },
          { transform: `translate(${mx}px,${my}px) scale(1.1)`, opacity: 1, offset: 0.55 },
          { transform: `translate(${x1}px,${y1}px) scale(.7)`, opacity: 1, offset: 0.92 },
          { transform: `translate(${x1}px,${y1}px) scale(.4)`, opacity: 0 },
        ],
        { duration: dur, delay, easing: 'ease-in-out', fill: 'backwards' },
      );
      an.onfinish = () => e.remove();
    };
    for (let k = 0; k < 6; k++) fl('coin', k * 90, 900);
    fl('lab', 0, 1000, esc(fmtMoney(amt)));
    this.popAmt(from, -amt);
    this.popAmt(to, amt, 850);
    this.flyTo.add(to);
    setTimeout(() => this.flyTo.delete(to), 1200);
  }

  /* ---------- kartu kontrol ---------- */

  renderTurn(s: GameState, v: TurnView): void {
    const p = s.players[s.turn];
    const t = $('#turn');
    if (!p) return;
    this.applyLog(v.pov, s.phase);
    const tok = PAWNS[p.pawn];
    const mine = v.pov === s.turn;
    t.innerHTML = `<div class="who" style="--c:${tok?.color ?? '#888'}"><div class="tk">${tkImg(p.pawn)}</div><div><h2>${esc(p.name)}</h2><p>${esc(tok?.name ?? '')} · di ${esc(tileName(p.pos))}</p><span class="pv">${mine ? 'Giliran kamu' : 'Giliran ' + esc(p.name)}</span></div></div><div class="dr">Dadu terakhir <b id="dv">${s.last || '-'}</b></div><div class="tmr" id="tmr"></div><div id="acts"></div>`;
    const a = $('#acts');
    if (s.phase === 'over') return;
    if (!mine) {
      a.innerHTML = `<div class="wait">Menunggu ${esc(p.name)} bermain...${v.waitNote ? ' ' + esc(v.waitNote) : ''}</div>`;
      return;
    }
    const add = (label: string, cls: string, fn: () => void, dis = false) => {
      const b = el('button', 'btn big ' + cls);
      b.textContent = label;
      b.disabled = dis || v.busy;
      b.onclick = fn;
      a.appendChild(b);
      return b;
    };
    const i = p.pos;
    const T = TILES[i];
    if (s.phase === 'roll') {
      if (p.jail > 0) {
        add(
          `Bayar ${fmtMoney(C.JAIL_FEE)} untuk keluar`,
          'gold',
          this.actions.payJail,
          p.money < C.JAIL_FEE,
        );
        add(`Lempar dadu (kembar = bebas, sisa ${p.jail}x)`, 'pri', this.actions.roll);
      } else add('Lempar dadu', 'pri', this.actions.roll);
    } else if (s.phase === 'act') {
      if (s.pending !== null) {
        const c = cityOf(s.pending)!;
        const price = cityPrice(c.prov);
        add(`Beli ${c.name} (${fmtMoney(price)})`, 'gold', this.actions.buy, p.money < price);
      }
      if (T?.t === 'city' && canBuild(s, s.turn, i)) {
        const cost = buildCost(s, i, s.turn);
        const lv = s.owners[i]!.lv + 1;
        add(
          `Bangun ${C.LV_NAMES[lv]} (${fmtMoney(cost)})`,
          'gold',
          () => this.actions.build(i),
          p.money < cost,
        );
      }
      if (s.dbl > 0 && !p.jail) add('Kembar! Lempar lagi', 'pri', this.actions.roll);
      else add('Akhiri giliran', '', this.actions.endTurn);
    }
  }

  /* ---------- dadu ---------- */

  private buildDice(): void {
    const dice = $('#dice');
    dice.innerHTML = '';
    this.cubes = [];
    const pips: Record<number, number[]> = {
      1: [4],
      2: [0, 8],
      3: [0, 4, 8],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8],
    };
    [-36, 36].forEach((x) => {
      const c = el('div', 'cube');
      c.style.left = `${x}px`;
      for (let v = 1; v <= 6; v++) {
        let h = '';
        for (let k = 0; k < 9; k++) h += `<i${pips[v]!.includes(k) ? ' class="on"' : ''}></i>`;
        c.appendChild(el('div', `f f${v} p${v}`, h));
      }
      dice.appendChild(c);
      this.cubes.push(c);
    });
    this.setDice([1, 1], false);
  }

  private setDice(vals: [number, number], anim: boolean): void {
    this.spin += anim ? 1 : 0;
    this.cubes.forEach((c, k) => {
      const [ax, ay] = DICE_ROT[vals[k]!] ?? [0, 0];
      const extra = anim ? 720 * this.spin + (k ? 360 : 0) : 0;
      c.style.transform = `translateZ(0px) rotateX(${ax + extra}deg) rotateY(${ay + extra}deg)`;
    });
  }

  async rollDice(a: number, b: number): Promise<void> {
    this.setDice([a, b], !this.fast);
    await sleep(1150, this.fast);
  }

  /* ---------- cuaca ---------- */

  renderWx(w: WeatherKey, pulse = false): void {
    const c = $('#wxchip');
    const d = C.WEATHER[w];
    c.innerHTML = `<b>Cuaca: ${esc(d.name)}</b><span class="wd">${esc(d.desc)}</span>`;
    if (pulse) {
      c.classList.add('pulse');
      setTimeout(() => c.classList.remove('pulse'), 1800);
    }
  }

  /* ---------- catatan ---------- */

  log(line: LogLine): void {
    const l = $('#log');
    const d = el('div', line.cls);
    d.textContent = line.msg;
    l.insertBefore(d, l.firstChild);
    while (l.childNodes.length > 80) l.removeChild(l.lastChild!);
    for (let i = 0; i < C.MAX_PLAYERS; i++)
      if (!this.isLogOpen(i)) this.logUnread[i] = (this.logUnread[i] ?? 0) + 1;
    this.applyLog(this.lastPov, 'roll');
  }

  private isLogOpen(pov: number): boolean {
    if (this.logOpen[pov] === undefined) this.logOpen[pov] = loadFlag(`nn.logOpen.${pov}`);
    return this.logOpen[pov];
  }

  applyLog(pov: number, phase: string): void {
    this.lastPov = pov;
    const open = this.isLogOpen(pov);
    const d = document.getElementById('logd');
    const bd = document.getElementById('logBd');
    if (!d) return;
    d.classList.toggle('open', open);
    if (open) this.logUnread[pov] = 0;
    const n = this.logUnread[pov] ?? 0;
    if (bd) {
      bd.textContent = n > 9 ? '9+' : String(n);
      bd.classList.toggle('on', !open && n > 0 && phase !== 'setup');
    }
  }

  toggleLog(pov: number): void {
    this.logOpen[pov] = !this.isLogOpen(pov);
    saveFlag(`nn.logOpen.${pov}`, this.logOpen[pov]);
    this.applyLog(pov, 'roll');
  }

  /* ---------- modal ---------- */

  /** Tampilkan dialog. Mengembalikan indeks tombol. `html` harus tepercaya. */
  /**
   * Tampilkan dialog. Mengembalikan indeks tombol, atau -1 jika ditutup dari luar.
   * Escape memilih tombol terakhir (biasanya "Tutup"/"Terima nasib"). `html` harus tepercaya.
   */
  ask(html: string, buttons: { label: string; cls?: string; dis?: boolean }[]): Promise<number> {
    this.closeModal();
    return new Promise((res) => {
      const m = $('#modal');
      const d = $('#dlg');
      const back = document.activeElement as HTMLElement | null;
      d.innerHTML = html;
      const row = el('div', 'row');
      const done = (k: number) => {
        if (this.modalDone !== done) return;
        this.modalDone = null;
        m.classList.add('hidden');
        document.removeEventListener('keydown', onKey);
        back?.focus?.();
        res(k);
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          done(buttons.length - 1);
        }
      };
      buttons.forEach((b, k) => {
        const x = el('button', 'btn big ' + (b.cls ?? ''));
        x.textContent = b.label;
        x.disabled = !!b.dis;
        x.onclick = () => done(k);
        row.appendChild(x);
      });
      d.appendChild(row);
      this.modalDone = done;
      document.addEventListener('keydown', onKey);
      m.classList.remove('hidden');
      row.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    });
  }

  /** Tutup modal yang sedang terbuka; janji dialognya selesai dengan -1. */
  closeModal(): void {
    this.modalDone?.(-1);
    document.getElementById('modal')?.classList.add('hidden');
  }

  /**
   * Notifikasi kartu kecil di pojok kanan atas, untuk pemain yang bukan pengambil kartu.
   * Tidak menghalangi layar; hilang sendiri. Teks di-escape.
   */
  /** jumlah notifikasi pojok yang pernah tampil (untuk tes) */
  cornerCount = 0;

  cornerCard(n: { kind: CardKind; tag: string; who: string; text: string; icon: string }): void {
    this.cornerCount++;
    let box = document.getElementById('cardNotes');
    if (!box) {
      box = el('div', 'cardnotes');
      box.id = 'cardNotes';
      box.setAttribute('aria-live', 'polite');
      document.getElementById('stage')?.appendChild(box);
    }
    const d = el(
      'div',
      `cnote c-${n.kind}`,
      `<div class="cnh"><span>${n.kind}</span><small>${esc(n.tag)}</small></div><div class="cnb"><b>${esc(n.who)}</b> <span class="em">${n.icon}</span> ${esc(n.text)}</div>`,
    );
    d.title = 'Klik untuk menutup';
    const close = () => {
      d.classList.add('out');
      setTimeout(() => d.remove(), 300);
    };
    d.onclick = close;
    box.prepend(d);
    while (box.children.length > 3) box.lastElementChild?.remove();
    setTimeout(close, 7000);
  }

  /** Umumkan teks ke pembaca layar (wilayah aria-live tersembunyi). */
  announce(msg: string): void {
    const a = document.getElementById('announce');
    if (a) a.textContent = msg;
  }

  cardHTML(kind: CardKind, text: string, iconHtml: string, tag: string): string {
    return `<div class="cardface c-${kind}"><div class="ch"><span>${kind}</span><small>${esc(tag)}</small></div><div class="cb"><span class="em">${iconHtml}</span>${esc(text)}</div></div>`;
  }

  /** HTML kartu dari id kartu. Emoji kartu boleh tampil di UI HTML (bukan di peta 3D). */
  cardById(id: string, tag: string, kind: CardKind): string {
    const c = CARD_BY_ID[id];
    return this.cardHTML(kind, c?.x ?? '', esc(c?.em ?? ''), tag);
  }

  toast(msg: string): void {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => t.classList.remove('on'), 2200);
  }
}

function loadFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}
function saveFlag(key: string, v: boolean): void {
  try {
    localStorage.setItem(key, v ? '1' : '0');
  } catch {
    /* penyimpanan tidak tersedia: abaikan */
  }
}
