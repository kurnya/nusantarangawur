/** Dialog akhir permainan, dipakai mode satu perangkat dan online. */
import { fmtMoney, wealth } from '../engine/rules';
import type { GameState } from '../engine/types';
import { esc, tkImg } from './dom';
import type { Hud } from './hud';

/** Tampilkan peringkat kekayaan dan minta konfirmasi. true jika pemain memilih mengakhiri. */
export async function confirmEndGame(hud: Hud, s: GameState): Promise<boolean> {
  const rank = s.players
    .filter((p) => !p.bankrupt)
    .sort((a, b) => wealth(s, b.id) - wealth(s, a.id));
  const list = rank
    .map(
      (p, k) =>
        `<li style="--oc:var(--gold)" class="${k === 0 ? 'built' : ''}"><i><span style="display:block;width:30px;height:30px">${tkImg(p.pawn)}</span></i><div><b>${k + 1}. ${esc(p.name)}</b><small>Kekayaan ${fmtMoney(wealth(s, p.id))} · uang ${fmtMoney(p.money)}</small></div></li>`,
    )
    .join('');
  const k = await hud.ask(
    `<h3>Akhiri permainan?</h3><p style="color:var(--mute);margin:0">Kekayaan = uang + nilai jual semua kotamu. Peringkat saat ini:</p><ul class="cl">${list}</ul>`,
    [{ label: 'Lanjut main' }, { label: 'Akhiri sekarang', cls: 'pri' }],
  );
  return k === 1;
}

/** Umumkan pemenang. Selesai saat pemain menekan tombol. */
export async function showWinner(hud: Hud, s: GameState, button = 'Main lagi'): Promise<void> {
  const w = s.winner !== null ? s.players[s.winner] : null;
  await hud.ask(
    `<h3>🏆 ${esc(w ? w.name : 'Tidak ada')} menang!</h3><p style="color:var(--mute);margin:0">Penguasa terakhir Nusantara. Sabang sampai Merauke sudah dalam genggaman.</p>`,
    [{ label: button, cls: 'pri' }],
  );
}
