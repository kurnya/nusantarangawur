/**
 * Animasi "Undian Urutan Giliran" – tampil sebelum permainan dimulai.
 * Hanya menampilkan urutan yang sudah ditentukan engine (deterministik, dari state awal).
 * Tidak mengubah state atau seed. Melewati animasi bila:
 *   - hanya 1 pemain aktif (tidak mungkin karena min 2, tapi berjaga-jaga)
 *   - mode cepat (fast=true)
 *   - prefers-reduced-motion aktif
 *   - pemain bergabung kembali di tengah permainan (rev > 0)
 */
import { PAWNS } from '../engine/board';
import type { GameState } from '../engine/types';
import { audio } from '../audio';
import { el, esc, tkImg } from './dom';

export interface TurnDrawOptions {
  /** state awal permainan (rev harus 0) */
  state: GameState;
  /** lewati animasi */
  fast?: boolean;
  /** prefers-reduced-motion */
  reducedMotion?: boolean;
}

/**
 * Hitung urutan giliran mulai dari pemain pertama (turn) berputar ke kanan.
 * Mengembalikan array pid berurut dari yang jalan duluan.
 */
export function turnOrder(s: GameState): number[] {
  const n = s.players.length;
  const result: number[] = [];
  for (let i = 0; i < n; i++) {
    const pid = (s.turn + i) % n;
    if (!s.players[pid]?.bankrupt) result.push(pid);
  }
  return result;
}

/** Kocokan visual deterministik; tidak menyentuh RNG permainan atau state. */
function visualShuffle(ids: readonly number[], seed: number): number[] {
  const out = [...ids];
  let x = (seed ^ 0x9e3779b9) >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
    x = (x ^ (x >>> 16)) >>> 0;
    const j = x % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Tampilkan animasi undian urutan giliran di overlay penuh.
 * Mengembalikan Promise yang selesai saat animasi selesai atau dilewati.
 */
export async function showTurnDraw(opts: TurnDrawOptions): Promise<void> {
  const { state: s, fast = false, reducedMotion = false } = opts;

  // Jangan putar animasi bila: mode cepat, reduced-motion, sudah berjalan (rev>0),
  // atau hanya ada satu pemain tidak bangkrut.
  const order = turnOrder(s);
  if (fast || reducedMotion || s.rev > 0 || order.length <= 1) return;

  return new Promise<void>((resolve) => {
    // Buat overlay
    const overlay = el('div', 'tdo-overlay');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Undian urutan giliran');

    // Tombol lewati
    const skipBtn = el('button', 'btn tdo-skip', 'Lewati');
    skipBtn.type = 'button';

    const content = el('div', 'tdo-box');
    content.innerHTML = `
      <h2 class="tdo-title">🎲 Undian Urutan Giliran</h2>
      <p class="tdo-sub">Mengocok urutan pemain...</p>
      <div class="tdo-cards" id="tdoCards"></div>
      <div class="tdo-result hidden" id="tdoResult">
        <p class="tdo-sub">Urutan bermain:</p>
        <ol class="tdo-list" id="tdoList"></ol>
      </div>
    `;
    content.appendChild(skipBtn);
    overlay.appendChild(content);
    document.body.appendChild(overlay);

    // Jaga fokus
    skipBtn.focus();

    const done = () => {
      overlay.classList.add('tdo-out');
      overlay.addEventListener('animationend', () => overlay.remove(), { once: true });
      // Fallback bila animasi tidak berjalan
      setTimeout(() => overlay.remove(), 600);
      resolve();
    };

    skipBtn.onclick = done;

    // Kunci Escape juga lewati
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        done();
      }
    };
    document.addEventListener('keydown', onKey, { once: true });

    // Tahap 1: tampilkan kartu pemain yang "dikocok" (posisi acak-acak animasi)
    const cardsEl = document.getElementById('tdoCards')!;
    const resultEl = document.getElementById('tdoResult')!;
    const listEl = document.getElementById('tdoList')!;

    // Render semua kartu pemain dalam urutan acak (tampak dikocok)
    const shuffled = visualShuffle(order, s.rng);
    shuffled.forEach((pid) => {
      const p = s.players[pid]!;
      const pawn = PAWNS[p.pawn];
      const card = el('div', 'tdo-card tdo-shuffle');
      card.dataset.pid = String(pid);
      card.style.setProperty('--c', pawn?.color ?? '#888');
      card.innerHTML = `
        <div class="tdo-avatar">${tkImg(p.pawn)}</div>
        <div class="tdo-name">${esc(p.name)}</div>
      `;
      cardsEl.appendChild(card);
    });

    // Tahap 2: setelah 1 detik, kocokan berhenti, lalu satu per satu muncul dengan nomor urut
    const SHUFFLE_MS = 1000;
    const REVEAL_MS = 320; // selang per pemain
    const HOLD_MS = 1800; // tahan hasil sebelum tutup

    setTimeout(() => {
      // Sembunyikan kartu kocokan
      cardsEl.classList.add('tdo-hidden');
      resultEl.classList.remove('hidden');

      // Tampilkan hasil satu per satu
      order.forEach((pid, rank) => {
        setTimeout(() => {
          const p = s.players[pid]!;
          const pawn = PAWNS[p.pawn];
          const item = el('li', 'tdo-item');
          item.style.setProperty('--c', pawn?.color ?? '#888');
          item.innerHTML = `
            <span class="tdo-rank">${rank + 1}</span>
            <span class="tdo-av">${tkImg(p.pawn)}</span>
            <span class="tdo-nm">${esc(p.name)}</span>
            ${rank === 0 ? '<span class="tdo-first">Jalan Duluan!</span>' : ''}
          `;
          listEl.appendChild(item);
          // Efek muncul
          item.classList.add('tdo-reveal');
          // Suara memakai bus aplikasi agar tidak membuat AudioContext baru per pemain.
          try {
            audio.play(rank === 0 ? 'gain' : 'click');
          } catch {
            /* audio tidak tersedia, abaikan */
          }
        }, rank * REVEAL_MS);
      });

      // Tutup overlay setelah semua muncul + jeda tahan
      setTimeout(done, order.length * REVEAL_MS + HOLD_MS);
    }, SHUFFLE_MS);
  });
}
