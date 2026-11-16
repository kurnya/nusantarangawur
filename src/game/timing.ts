/**
 * Perkiraan lama animasi untuk satu daftar events (milidetik). Dipakai Host supaya batas waktu
 * giliran baru "mulai berjalan" setelah layar pemain selesai memutar animasi.
 * Angka mengikuti jeda di Presenter dan durasi efek di view/fx.ts.
 */
import type { GameEvent } from '../engine/types';

export const DICE_MS = 1150;
export const STEP_MS = 230;
export const RENT_MS = 1050;
export const JAIL_MS = 450;
export const CARD_MS = 3500;
const FX_PRE_MS = 550;
/** batas atas satu animasi besar (sama dengan FX_TIMEOUT_MS di Presenter) */
export const FX_MAX_MS = 15000;
const FX_MS: Record<string, number> = {
  banjir: 4200,
  rob: 4200,
  merapi: 9400,
  gempa: 3600,
  tsunami: 5200,
  kebakaran: 3800,
  longsor: 4800,
  kering: 4200,
  puting: 8300,
  meteor: 6700,
  meteorstorm: 8600,
  petir: 6000,
};

export function estimateAnimMs(events: readonly GameEvent[]): number {
  let ms = 0;
  for (const e of events) {
    switch (e.e) {
      case 'DiceRolled':
        ms += DICE_MS;
        break;
      case 'PawnStepped':
        ms += STEP_MS;
        break;
      case 'PaidRent':
        ms += RENT_MS;
        break;
      case 'PlayerJailed':
        ms += JAIL_MS;
        break;
      case 'CardDrawn':
      case 'HazardHit':
        ms += CARD_MS;
        break;
      case 'BencanaFx':
        ms += Math.min(FX_MAX_MS, FX_PRE_MS + (FX_MS[e.key] ?? 5000));
        break;
      default:
        break;
    }
  }
  return ms;
}
