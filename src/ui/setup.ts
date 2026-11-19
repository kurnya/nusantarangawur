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
  /** karakter pilihan tiap baris pemain (bisa diganti dengan mengetuk avatar) */
  const pick: number[] = Array.from({ length: C.MAX_PLAYERS }, (_, i) => i);
  let open = -1;
  const render = () => {
    $('#cnt').textContent = String(n);
    const pl = $('#plist');
    const old = [...pl.querySelectorAll('input')].map((i) => i.value);
    pl.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const pw = PAWNS[pick[i]!]!;
      const d = el('div', 'pin');
      d.style.setProperty('--c', pw.color);
      const def = PAWNS[pick[i]!]!.name;
      const prev = old[i];
      // nama bawaan ikut berganti bila pemain belum mengetik nama sendiri
      const keep = prev !== undefined && !PAWNS.some((p) => p.name === prev);
      d.innerHTML = `<button type="button" class="pav" data-row="${i}" aria-label="Ganti karakter pemain ${i + 1} (${esc(pw.name)})" title="Ganti karakter">${tkImg(pick[i]!)}</button><input id="pn${i}" maxlength="${NAME_MAX}" aria-label="Nama pemain ${i + 1}" value="${esc(keep ? prev : def)}">`;
      pl.appendChild(d);
      if (open === i) {
        const used = new Set(pick.slice(0, n).filter((_, j) => j !== i));
        const grid = el('div', 'pawnpick pchoose');
        grid.setAttribute('role', 'radiogroup');
        grid.innerHTML = PAWNS.map(
          (p, k) =>
            `<button type="button" class="pp${pick[i] === k ? ' on' : ''}" data-pk="${k}" ${used.has(k) ? 'disabled' : ''} style="--c:${p.color}" title="${esc(p.name)}"><span>${tkImg(k)}</span><small>${esc(p.name)}</small></button>`,
        ).join('');
        pl.appendChild(grid);
      }
    }
    pl.querySelectorAll<HTMLButtonElement>('.pav').forEach((b) => {
      b.onclick = () => {
        const r = Number(b.dataset.row);
        open = open === r ? -1 : r;
        render();
      };
    });
    pl.querySelectorAll<HTMLButtonElement>('[data-pk]').forEach((b) => {
      b.onclick = () => {
        pick[open] = Number(b.dataset.pk);
        open = -1;
        render();
      };
    });
  };
  $('#minus').onclick = () => {
    n = Math.max(C.MIN_PLAYERS, n - 1);
    open = -1;
    render();
  };
  $('#plus').onclick = () => {
    n = Math.min(C.MAX_PLAYERS, n + 1);
    // baris baru: pakai karakter pertama yang belum dipakai
    const used = new Set(pick.slice(0, n - 1));
    if (used.has(pick[n - 1]!)) pick[n - 1] = PAWNS.findIndex((_, k) => !used.has(k));
    render();
  };
  $('#start').onclick = () => {
    const players = Array.from({ length: n }, (_, i) => ({
      name: cleanSetupName(
        (document.getElementById(`pn${i}`) as HTMLInputElement | null)?.value ?? '',
        PAWNS[pick[i]!]!.name,
      ),
      pawn: pick[i]!,
    }));
    $('#setup').classList.add('hidden');
    onStart(players);
  };
  render();
}
