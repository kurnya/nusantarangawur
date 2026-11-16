/** Layar awal mode satu perangkat: jumlah pemain dan nama. */
import { PAWNS } from '../engine/board';
import * as C from '../engine/config';
import { NAME_MAX, cleanName } from '../net/names';
import { $, el, esc, tkImg } from './dom';

/** Nama dari layar awal; kosong diganti nama cadangan. */
export function cleanSetupName(raw: string, fallback: string): string {
  return cleanName(raw) || fallback;
}

export function setupScreen(onStart: (players: { name: string; pawn: number }[]) => void): void {
  let n = 4;
  const render = () => {
    $('#cnt').textContent = String(n);
    const pl = $('#plist');
    const old = [...pl.querySelectorAll('input')].map((i) => i.value);
    pl.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const d = el('label', 'pin');
      d.style.setProperty('--c', PAWNS[i]!.color);
      d.innerHTML = `<span aria-hidden="true">${tkImg(i)}</span><input id="pn${i}" maxlength="${NAME_MAX}" aria-label="Nama pemain ${i + 1}" value="${esc(old[i] ?? PAWNS[i]!.name)}">`;
      pl.appendChild(d);
    }
  };
  $('#minus').onclick = () => {
    n = Math.max(C.MIN_PLAYERS, n - 1);
    render();
  };
  $('#plus').onclick = () => {
    n = Math.min(C.MAX_PLAYERS, n + 1);
    render();
  };
  $('#start').onclick = () => {
    const players = Array.from({ length: n }, (_, i) => ({
      name: cleanSetupName(
        (document.getElementById(`pn${i}`) as HTMLInputElement | null)?.value ?? '',
        PAWNS[i]!.name,
      ),
      pawn: i,
    }));
    $('#setup').classList.add('hidden');
    onStart(players);
  };
  render();
}
