import type { Effect } from '../engine/types';
import { fmtMoney } from '../engine/rules';

export type ChipKind = 'plus' | 'minus' | 'move' | 'skip' | 'jail' | 'free' | 'disc' | 'lose';
export interface Chip {
  k: ChipKind;
  t: string;
}

/** Ringkasan efek kartu sebagai chip pendek (urutan sama dengan penerapan di mesin). */
export function cardChips(e: Effect | undefined): Chip[] {
  if (!e) return [];
  const out: Chip[] = [];
  if (e.m) out.push({ k: e.m > 0 ? 'plus' : 'minus', t: fmtMoney(e.m).replace(/^(?!-)/, '+') });
  if (e.lc) out.push({ k: 'lose', t: 'Satu kota hancur' });
  if (e.skip) out.push({ k: 'skip', t: `Lewati ${e.skip} giliran` });
  if (e.free) out.push({ k: 'free', t: `Bebas sewa ${e.free}x` });
  if (e.disc) out.push({ k: 'disc', t: 'Bangun ½ harga' });
  if (e.jail) out.push({ k: 'jail', t: 'Masuk Nusakambangan' });
  else if (e.mv) {
    const n = Math.abs(e.mv);
    out.push({ k: 'move', t: `${e.mv > 0 ? 'Maju' : 'Mundur'} ${n} petak` });
  }
  return out;
}

export type CardTone = 'baik' | 'buruk' | 'bencana';

/** Nada warna kartu dari label tag. */
export function cardTone(tag: string): CardTone {
  const t = tag.toLowerCase();
  if (t.includes('baik')) return 'baik';
  if (t.includes('buruk')) return 'buruk';
  return 'bencana';
}

/** Nomor kartu untuk keterangan bawah, mis. "No. 07". */
export function cardNo(id: string): string {
  const m = /(\d+)$/.exec(id);
  return m?.[1] ? `No. ${String(Number(m[1]) + 1).padStart(2, '0')}` : '';
}
