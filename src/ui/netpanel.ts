/**
 * Panel "Koneksi": status sambungan, ping, jalur WebRTC, saran bila bermasalah.
 * Untuk Host juga daftar pemain beserta tombol Kick.
 */
import { PAWNS } from '../engine/board';
import type { LobbyPlayer } from '../net/protocol';
import { $, el, esc } from './dom';

export interface NetInfo {
  /** 'ok' tersambung, 'lost' terputus, 'connecting' menyambung */
  status: 'ok' | 'lost' | 'connecting';
  ping: number;
  route: string | null;
  isHost: boolean;
  /** TURN sudah diatur lewat VITE_ICE_SERVERS */
  turn: boolean;
  me: number | null;
  players: LobbyPlayer[];
}

export const SLOW_PING_MS = 400;

/** Saran untuk pemain berdasarkan kondisi koneksi. */
export function netAdvice(i: NetInfo): string[] {
  const out: string[] = [];
  if (i.status === 'lost')
    out.push(
      'Koneksi ke Host terputus. Coba jaringan lain atau gunakan hotspot HP, lalu buka lagi tautan undangan.',
    );
  else if (i.status === 'connecting') out.push('Sedang menyambung. Tunggu sebentar.');
  else if (!i.isHost && i.ping > SLOW_PING_MS)
    out.push('Koneksi lambat. Permainan tetap jalan, tapi aksi bisa terasa telat.');
  if (i.isHost && !i.turn && i.players.some((p) => !p.connected && !p.host && !p.gone))
    out.push(
      'Ada pemain yang terputus. Jika ia sering gagal tersambung, jaringannya mungkin butuh server TURN (lihat docs/MULTIPLAYER.md).',
    );
  return out;
}

const statusText = (s: NetInfo['status']) =>
  s === 'ok' ? 'Tersambung' : s === 'lost' ? 'Terputus' : 'Menyambung...';

export function setupNetPanel(
  info: () => Promise<NetInfo>,
  onKick: (id: number) => void,
  testTurn?: () => Promise<string>,
): void {
  const stage = $('#stage');
  const btn = $('#camNet');
  const pn = el('div', 'fxpanel netpanel');
  pn.setAttribute('role', 'region');
  pn.setAttribute('aria-label', 'Diagnosis koneksi');
  stage.appendChild(pn);
  let timer = 0;
  let turnMsg = '';
  let testing = false;
  const render = async () => {
    const i = await info();
    const rows = [
      `<b>Status</b> ${statusText(i.status)}`,
      i.isHost ? '<b>Peran</b> Host' : `<b>Ping</b> ${i.ping >= 0 ? `${i.ping} ms` : '-'}`,
      `<b>Jalur</b> ${esc(i.route ?? (i.isHost ? 'kamu Host' : 'belum diketahui'))}`,
    ];
    const adv = netAdvice(i)
      .map((a) => `<p class="adv">${esc(a)}</p>`)
      .join('');
    const list = i.players
      .map((p) => {
        const st = p.gone
          ? 'dikeluarkan, dimainkan otomatis'
          : p.connected
            ? 'tersambung'
            : 'terputus';
        const kick =
          i.isHost && !p.host && !p.gone
            ? `<button class="btn kick" data-kick="${p.id}" aria-label="Keluarkan ${esc(p.name)}">Kick</button>`
            : '';
        return `<li style="--oc:${PAWNS[p.pawn]?.color ?? '#888'}"><span class="dot ${p.connected ? 'on' : ''}"></span><span>${esc(p.name)}${p.id === i.me ? ' (kamu)' : ''}<small>${st}</small></span>${kick}</li>`;
      })
      .join('');
    pn.innerHTML = `<h4>Koneksi</h4><div class="nrows">${rows.map((r) => `<div>${r}</div>`).join('')}<div><b>TURN</b> ${i.turn ? 'diatur' : 'belum diatur'}</div></div>${adv}<ul class="nlist">${list}</ul>${testTurn ? `<button class="btn" id="netTurn" ${testing ? 'disabled' : ''}>${testing ? 'Menguji TURN...' : 'Uji TURN'}</button><p class="adv" id="netTurnMsg">${esc(turnMsg)}</p>` : ''}`;
    const tb = pn.querySelector<HTMLButtonElement>('#netTurn');
    if (tb && testTurn)
      tb.onclick = async () => {
        testing = true;
        void render();
        turnMsg = await testTurn();
        testing = false;
        void render();
      };
    pn.querySelectorAll<HTMLButtonElement>('[data-kick]').forEach((b) => {
      b.onclick = () => onKick(Number(b.dataset.kick));
    });
    btn.classList.toggle('warn', i.status !== 'ok' || netAdvice(i).length > 0);
  };
  btn.hidden = false;
  btn.onclick = () => {
    const open = pn.classList.toggle('open');
    clearInterval(timer);
    if (open) {
      void render();
      timer = window.setInterval(() => void render(), 1000);
    }
  };
  // tanda peringatan di tombol tetap diperbarui walau panel tertutup
  window.setInterval(() => {
    if (!pn.classList.contains('open'))
      void info().then((i) => btn.classList.toggle('warn', i.status !== 'ok'));
  }, 2000);
}
