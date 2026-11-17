/** Dialog akhir permainan, dipakai mode satu perangkat dan online. */
import { PAWNS } from '../engine/board';
import { fmtMoney, saleValue, wealth } from '../engine/rules';
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
  const rank = [...s.players].sort((a, b) => {
    if (a.bankrupt !== b.bankrupt) return a.bankrupt ? 1 : -1;
    return wealth(s, b.id) - wealth(s, a.id);
  });
  const list = rank
    .map((p, k) => {
      const assets = s.owners.reduce((total, o, tile) => {
        return o?.p === p.id ? total + saleValue(s, tile) : total;
      }, 0);
      const cities = s.owners.filter((o) => o?.p === p.id).length;
      const pawn = PAWNS[p.pawn];
      const winner = p.id === s.winner;
      return `<li class="finalrow${winner ? ' winner' : ''}${p.bankrupt ? ' bankrupt' : ''}" style="--oc:${pawn?.color ?? '#888'}">
        <span class="finalrank">${k + 1}</span>
        <span class="finalpawn">${tkImg(p.pawn)}</span>
        <span class="finalinfo"><b>${esc(p.name)}${winner ? '<em>Pemenang</em>' : ''}</b><small>${esc(pawn?.name ?? 'Pemain')} · ${cities} kota</small></span>
        <span class="finalmoney"><b>${fmtMoney(wealth(s, p.id))}</b><small>Total kekayaan</small><small>${fmtMoney(p.money)} uang · ${fmtMoney(assets)} aset</small></span>
      </li>`;
    })
    .join('');
  await hud.ask(
    `<div class="finale"><div class="finalehero"><span class="trophy">🏆</span><div><h3>${esc(w ? w.name : 'Tidak ada')} menang!</h3><p>Hasil akhir permainan</p></div></div><ul class="finallist">${list}</ul></div>`,
    [{ label: button, cls: 'pri' }],
  );
}
