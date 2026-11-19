/**
 * Menu awal dan lobi ruangan online. Semua teks dari pemain di-escape.
 */
import { PAWNS } from '../engine/board';
import * as C from '../engine/config';
import { fmtMoney } from '../engine/rules';
import type { LobbyInfo } from '../net/client';
import { NAME_MAX } from '../net/names';
import {
  autoLevel,
  deviceHints,
  loadGraphicsPrefs,
  saveGraphicsPrefs,
  type FpsPref,
  type QualityPref,
} from '../view/quality';
import { $, esc, tkImg } from './dom';

export interface MenuActions {
  create(name: string): void;
  join(name: string, code: string): void;
  local(): void;
}

export interface LobbyActions {
  setName(name: string): void;
  setPawn(pawn: number): void;
  setReady(ready: boolean): void;
  start(): void;
  kick(id: number): void;
  setStartMoney(v: number): void;
  setDiceCount(v: number): void;
  setTurnLimit(sec: number): void;
  leave(): void;
}

/** pilihan batas waktu giliran (detik); 0 = tanpa batas */
export const TURN_LIMITS = [0, 15, 30, 60, 90, 120, 180];
export const limitText = (s: number) => (s ? `${s} detik` : 'Tanpa batas');

const QUALITY_OPTS: [QualityPref, string][] = [
  ['auto', `Otomatis (${autoLabel()})`],
  ['high', 'Tinggi'],
  ['medium', 'Sedang'],
  ['low', 'Rendah'],
];
const FPS_OPTS: [FpsPref, string][] = [
  ['auto', 'Otomatis'],
  ['30', '30 FPS'],
  ['45', '45 FPS'],
  ['60', '60 FPS'],
  ['90', '90 FPS'],
  ['120', '120 FPS'],
];
function autoLabel(): string {
  const l = autoLevel(deviceHints());
  return l === 'high' ? 'tinggi' : l === 'medium' ? 'sedang' : 'rendah';
}

const NAME_KEY = 'nn.name';
export function savedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}
function saveName(n: string): void {
  try {
    localStorage.setItem(NAME_KEY, n);
  } catch {
    /* abaikan */
  }
}

/** Menu awal di overlay #menu. */
export function showMenu(a: MenuActions, opts: { code?: string; error?: string } = {}): void {
  const box = $('#menuBox');
  box.innerHTML = `
    <h1 class="brand">Nusantara<br>Ngawur<small>Sabang sampai Merauke</small></h1>
    <p>Keliling 38 provinsi bareng teman, 2 sampai 8 pemain, tiap orang di HP atau laptopnya sendiri.</p>
    <label class="fld">Nama kamu<input id="mName" maxlength="${NAME_MAX}" autocomplete="nickname"></label>
    <div class="row"><button class="btn pri big" id="mCreate">Buat ruangan</button></div>
    <div class="joinrow">
      <label class="fld">Kode ruangan<input id="mCode" maxlength="5" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="ABCDE"></label>
      <button class="btn gold big" id="mJoin">Gabung</button>
    </div>
    <p class="err" id="mErr" role="alert"></p>
    <div class="row"><button class="btn" id="mLocal">Main di satu perangkat (bergantian)</button></div>
    <label class="fld">Kualitas grafis <select id="mQuality">${QUALITY_OPTS.map(
      ([v, l]) =>
        `<option value="${v}" ${loadGraphicsPrefs().quality === v ? 'selected' : ''}>${l}</option>`,
    ).join('')}</select></label>
    <label class="fld">Target FPS <select id="mFps">${FPS_OPTS.map(
      ([v, l]) =>
        `<option value="${v}" ${loadGraphicsPrefs().fps === v ? 'selected' : ''}>${l}</option>`,
    ).join('')}</select></label>
    <p class="netstat">Otomatis menyesuaikan perangkat dan menurunkan resolusi bila terasa berat. Pilih Rendah jika HP panas atau patah-patah.</p>`;
  const nameI = $('#mName') as HTMLInputElement;
  const codeI = $('#mCode') as HTMLInputElement;
  nameI.value = savedName();
  if (opts.code) codeI.value = opts.code;
  $('#mErr').textContent = opts.error ?? '';
  const name = () => {
    const n = nameI.value.trim().slice(0, NAME_MAX);
    if (n) saveName(n);
    return n;
  };
  $('#mCreate').onclick = () => a.create(name());
  $('#mJoin').onclick = () => {
    const c = codeI.value.trim().toUpperCase();
    if (!c) {
      $('#mErr').textContent = 'Masukkan kode ruangan 5 karakter.';
      codeI.focus();
      return;
    }
    a.join(name(), c);
  };
  codeI.onkeydown = (e) => {
    if (e.key === 'Enter') $('#mJoin').click();
  };
  $('#mLocal').onclick = () => a.local();
  const qs = $('#mQuality') as HTMLSelectElement;
  const fs = $('#mFps') as HTMLSelectElement;
  qs.onchange = () => {
    saveGraphicsPrefs({
      quality: qs.value as QualityPref,
      fps: fs.value as FpsPref,
    });
    location.reload();
  };
  fs.onchange = () => {
    saveGraphicsPrefs({
      quality: qs.value as QualityPref,
      fps: fs.value as FpsPref,
    });
    location.reload();
  };
  $('#menu').classList.remove('hidden');
  (opts.code ? $('#mJoin') : nameI).focus();
}

export function menuBusy(msg: string): void {
  const box = $('#menuBox');
  box.innerHTML = `<h1 class="brand">Nusantara<br>Ngawur</h1><p class="netwait" role="status">${esc(msg)}</p>`;
  $('#menu').classList.remove('hidden');
}

export function hideMenu(): void {
  $('#menu').classList.add('hidden');
}

export interface LobbyView {
  code: string;
  invite: string;
  me: number | null;
  isHost: boolean;
  lobby: LobbyInfo | null;
  status: string;
  canStart?: { ok: boolean; reason?: string };
}

/** Gambar lobi. Dipanggil ulang setiap kali lobi berubah. */
export function renderLobby(v: LobbyView, a: LobbyActions): void {
  const box = $('#menuBox');
  const players = v.lobby?.players ?? [];
  const meP = players.find((p) => p.id === v.me);
  const taken = new Set(players.filter((p) => p.id !== v.me).map((p) => p.pawn));
  const keepName =
    document.activeElement?.id === 'lbName'
      ? (document.activeElement as HTMLInputElement).value
      : null;
  box.innerHTML = `
    <header class="lbhead">
      <div class="lbtop">
        <h1 class="brand">Nusantara<br>Ngawur</h1>
        <div class="roomcode"><span>Kode ruangan</span><b id="lbCode">${esc(v.code)}</b></div>
      </div>
      <div class="invite"><input id="lbLink" readonly aria-label="Tautan undangan" value="${esc(v.invite)}"><button class="btn gold" id="lbCopy">Salin tautan</button></div>
      <p class="netstat" id="lbStat" role="status">${esc(v.status)}</p>
    </header>
    <div class="lbbody">
    <label class="fld">Nama kamu<input id="lbName" maxlength="${NAME_MAX}" value="${esc(keepName ?? meP?.name ?? '')}"></label>
    <div class="lbl">Pilih karakter</div>
    <div class="pawnpick" role="radiogroup" aria-label="Karakter bidak">
      ${PAWNS.map(
        (pw, i) =>
          `<button class="pp${meP?.pawn === i ? ' on' : ''}" data-pawn="${i}" role="radio" aria-checked="${meP?.pawn === i}" ${taken.has(i) ? 'disabled' : ''} style="--c:${pw.color}" title="${esc(pw.name)}"><span>${tkImg(i)}</span><small>${esc(pw.name)}</small></button>`,
      ).join('')}
    </div>
    <div class="lbl">Pemain (${players.length}/${C.MAX_PLAYERS})</div>
    <ul class="cl" id="lbList">
      ${players
        .map(
          (p) =>
            `<li class="${p.ready ? 'built' : ''}" style="--oc:${PAWNS[p.pawn]?.color ?? '#888'}"><i><span style="display:block;width:30px;height:30px">${tkImg(p.pawn)}</span></i><div><b>${esc(p.name)}${p.id === v.me ? ' (kamu)' : ''}${p.host ? ' · Host' : ''}</b><small>${esc(PAWNS[p.pawn]?.name ?? '')} · ${p.connected ? (p.ready ? 'Siap' : 'Belum siap') : 'Terputus'}</small></div>${v.isHost && !p.host ? `<button class="btn kick" data-kick="${p.id}" aria-label="Keluarkan ${esc(p.name)}">Kick</button>` : ''}</li>`,
        )
        .join('')}
    </ul>
    ${
      v.isHost
        ? `<div class="lbset"><label class="fld">Uang awal <select id="lbMoney">${[
            10000, 15000, 20000, 30000,
          ]
            .map(
              (m) =>
                `<option value="${m}" ${v.lobby?.settings.startMoney === m ? 'selected' : ''}>${fmtMoney(m)}</option>`,
            )
            .join('')}</select></label>
          <label class="fld">Jumlah dadu <select id="lbDiceCount">${[1, 2, 3, 4]
            .map((n) => `<option value="${n}" ${v.lobby?.settings.diceCount === n ? 'selected' : ''}>${n} dadu</option>`)
            .join('')}</select></label>
          <label class="fld">Batas waktu giliran <select id="lbLimit">${TURN_LIMITS.map(
            (s) =>
              `<option value="${s}" ${(v.lobby?.settings.turnLimit ?? 0) === s ? 'selected' : ''}>${limitText(s)}</option>`,
          ).join('')}</select></label></div>`
        : `<p class="netstat lbset1">Uang awal: ${fmtMoney(v.lobby?.settings.startMoney ?? C.START_MONEY)} · ${v.lobby?.settings.diceCount ?? 2} dadu · Batas waktu giliran: ${limitText(v.lobby?.settings.turnLimit ?? 0)}</p>`
    }
    </div>
    <footer class="lbfoot">
      ${v.isHost && v.canStart && !v.canStart.ok ? `<p class="netstat lbwhy">${esc(v.canStart.reason ?? '')}</p>` : ''}
      <div class="row">
        ${
          v.isHost
            ? `<button class="btn pri big" id="lbStart" ${v.canStart?.ok ? '' : 'disabled'}>Mulai</button>`
            : `<button class="btn ${meP?.ready ? '' : 'pri'} big" id="lbReady">${meP?.ready ? 'Batal siap' : 'Siap'}</button>`
        }
        <button class="btn big" id="lbLeave">Keluar</button>
      </div>
    </footer>`;
  $('#lbCopy').onclick = async () => {
    const inp = $('#lbLink') as HTMLInputElement;
    try {
      await navigator.clipboard.writeText(inp.value);
      $('#lbCopy').textContent = 'Tersalin';
    } catch {
      inp.select();
    }
  };
  const nameI = $('#lbName') as HTMLInputElement;
  if (keepName !== null) {
    nameI.focus();
    nameI.setSelectionRange(nameI.value.length, nameI.value.length);
  }
  nameI.onchange = () => {
    const n = nameI.value.trim().slice(0, NAME_MAX);
    if (n) {
      saveName(n);
      a.setName(n);
    }
  };
  box.querySelectorAll<HTMLButtonElement>('[data-pawn]').forEach((b) => {
    b.onclick = () => a.setPawn(Number(b.dataset.pawn));
  });
  box.querySelectorAll<HTMLButtonElement>('[data-kick]').forEach((b) => {
    b.onclick = () => a.kick(Number(b.dataset.kick));
  });
  const money = document.getElementById('lbMoney') as HTMLSelectElement | null;
  if (money) money.onchange = () => a.setStartMoney(Number(money.value));
  const diceCount = document.getElementById('lbDiceCount') as HTMLSelectElement | null;
  if (diceCount) diceCount.onchange = () => a.setDiceCount(Number(diceCount.value));
  const limit = document.getElementById('lbLimit') as HTMLSelectElement | null;
  if (limit) limit.onchange = () => a.setTurnLimit(Number(limit.value));
  const start = document.getElementById('lbStart');
  if (start) start.onclick = () => a.start();
  const ready = document.getElementById('lbReady');
  if (ready) ready.onclick = () => a.setReady(!meP?.ready);
  $('#lbLeave').onclick = () => a.leave();
  $('#menu').classList.remove('hidden');
}

/** Ubah status koneksi tanpa menggambar ulang seluruh lobi. */
export function setLobbyStatus(s: string): void {
  const e = document.getElementById('lbStat');
  if (e) e.textContent = s;
}
