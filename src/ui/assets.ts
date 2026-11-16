/**
 * Panel "Aset": kelola kota milik pemain kapan saja. Bangun, gadai, tebus, atau jual ke bank.
 * Membaca state terbaru dan mengirim niat lewat `act`; aturan tetap divalidasi mesin/Host.
 */
import { PROVINCES, TILES, cityOf } from '../engine/board';
import * as C from '../engine/config';
import {
  buildCost,
  fmtMoney,
  mortgageValue,
  redeemCost,
  rentOf,
  saleValue,
  wealth,
} from '../engine/rules';
import type { GameState } from '../engine/types';
import { provColor } from '../view/util';
import { $, ciImg, el, esc } from './dom';

export type AssetIntent =
  | { t: 'build'; tile: number }
  | { t: 'mortgage'; tile: number }
  | { t: 'redeem'; tile: number }
  | { t: 'sell'; tile: number };

export interface AssetDeps {
  state: () => GameState | null;
  /** pemilik layar ini */
  pov: () => number;
  act: (i: AssetIntent) => void;
  /** alasan tombol dikunci (mis. animasi berjalan di mode satu perangkat), atau null */
  blocked?: () => string | null;
}

export class AssetPanel {
  private box: HTMLDivElement;
  private open = false;
  private key = '';
  private confirmSell: number | null = null;
  private timer = 0;
  private back: HTMLElement | null = null;

  constructor(private readonly d: AssetDeps) {
    this.box = el('div', 'overlay hidden assets');
    this.box.setAttribute('role', 'dialog');
    this.box.setAttribute('aria-modal', 'true');
    this.box.setAttribute('aria-label', 'Kelola aset');
    this.box.innerHTML = '<div class="dlg" id="assetDlg"></div>';
    this.box.addEventListener('click', (e) => {
      if (e.target === this.box) this.close();
    });
    document.body.appendChild(this.box);
    document.addEventListener('keydown', (e) => {
      if (this.open && e.key === 'Escape' && $('#modal').classList.contains('hidden')) this.close();
    });
  }

  get isOpen(): boolean {
    return this.open;
  }

  show(): void {
    this.back = document.activeElement as HTMLElement | null;
    this.open = true;
    this.key = '';
    this.confirmSell = null;
    this.box.classList.remove('hidden');
    this.render(true);
    clearInterval(this.timer);
    this.timer = window.setInterval(() => this.render(), 400);
  }

  close(): void {
    this.open = false;
    clearInterval(this.timer);
    this.box.classList.add('hidden');
    this.back?.focus?.();
  }

  toggle(): void {
    if (this.open) this.close();
    else this.show();
  }

  /** gambar ulang hanya jika state, kunci, atau konfirmasi berubah */
  private render(focus = false): void {
    const s = this.d.state();
    const pid = this.d.pov();
    const blocked = this.d.blocked?.() ?? null;
    const key = `${s?.rev}:${pid}:${blocked}:${this.confirmSell}`;
    if (key === this.key) return;
    this.key = key;
    const dlg = $('#assetDlg');
    const p = s?.players[pid];
    if (!s || !p) {
      dlg.innerHTML = '<h3>Aset</h3><p>Permainan belum dimulai.</p>';
      return;
    }
    const mine = s.owners
      .map((o, i) => (o && o.p === pid ? i : -1))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b);
    const off = !!blocked || p.bankrupt || s.phase === 'over';
    const rows = mine
      .map((i) => {
        const o = s.owners[i]!;
        const info = cityOf(i)!;
        const T = TILES[i]!;
        const ci = T.t === 'city' ? T.ci : 0;
        const status = o.m
          ? `<span class="tag mort">Tergadai</span> tidak menarik sewa`
          : `${C.LV_NAMES[o.lv]} · sewa ${fmtMoney(rentOf(s, i))}`;
        const btns: string[] = [];
        if (!o.m && o.lv < C.MAX_LEVEL) {
          const cost = buildCost(s, i, pid);
          btns.push(
            btn(
              'build',
              i,
              `Bangun ${C.LV_NAMES[o.lv + 1]}`,
              `-${fmtMoney(cost)}`,
              'gold',
              off || p.money < cost,
            ),
          );
        }
        if (o.m) {
          const c = redeemCost(s, i);
          btns.push(btn('redeem', i, 'Tebus', `-${fmtMoney(c)}`, 'pri', off || p.money < c));
        } else btns.push(btn('mortgage', i, 'Gadai', `+${fmtMoney(mortgageValue(s, i))}`, '', off));
        const sv = saleValue(s, i);
        btns.push(
          this.confirmSell === i
            ? btn('sell', i, 'Yakin jual?', `+${fmtMoney(sv)}`, 'danger', off)
            : btn('ask-sell', i, 'Jual', `+${fmtMoney(sv)}`, '', off),
        );
        return `<li class="arow${o.m ? ' mort' : ''}" style="--oc:${provColor(info.prov.hue)}"><i>${ciImg(info.prov.code, ci, 34)}</i><div class="ainfo"><b>${esc(info.name)}</b><small>${esc(info.prov.name)} · ${status}</small></div><div class="abtns">${btns.join('')}</div></li>`;
      })
      .join('');
    const sets = PROVINCES.filter((pr) => pr.tiles.every((t) => s.owners[t]?.p === pid)).length;
    dlg.innerHTML = `
      <h3>Aset ${esc(p.name)}</h3>
      <p class="asum">Uang <b>${fmtMoney(p.money)}</b> · Kekayaan <b>${fmtMoney(wealth(s, pid))}</b> · ${mine.length} kota · ${sets} provinsi penuh</p>
      ${blocked ? `<p class="netstat">${esc(blocked)}</p>` : ''}
      ${mine.length ? `<ul class="cl alist">${rows}</ul>` : '<p class="netstat">Belum punya kota. Beli kota saat mendarat di kota kosong.</p>'}
      <p class="netstat">Gadai: dapat ${Math.round(C.MORTGAGE_RATE * 100)}% nilai aset, kota tetap milikmu tapi tidak menarik sewa dan tidak bisa dibangun. Tebus: bayar nilai gadai + ${Math.round(C.REDEEM_INTEREST * 100)}% bunga. Jual: kota lepas ke bank.</p>
      <div class="row"><button class="btn big" id="assetClose">Tutup</button></div>`;
    $('#assetClose').onclick = () => this.close();
    dlg.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) => {
      b.onclick = () => {
        const t = Number(b.dataset.tile);
        const a = b.dataset.act!;
        if (a === 'ask-sell') {
          this.confirmSell = t;
          this.render();
          window.setTimeout(() => {
            if (this.confirmSell === t) {
              this.confirmSell = null;
              this.render();
            }
          }, 4000);
          return;
        }
        this.confirmSell = null;
        this.d.act({ t: a as AssetIntent['t'], tile: t });
      };
    });
    if (focus) document.getElementById('assetClose')?.focus();
  }
}

function btn(
  act: string,
  tile: number,
  label: string,
  amount: string,
  cls: string,
  dis: boolean,
): string {
  return `<button class="btn ${cls}" data-act="${act}" data-tile="${tile}" ${dis ? 'disabled' : ''}><span>${esc(label)}</span><small>${esc(amount)}</small></button>`;
}
