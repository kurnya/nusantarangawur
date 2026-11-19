/** Teks catatan perjalanan (bahasa Indonesia) dari GameEvent. Sama dengan kalimat prototipe. */
import { CARD_BY_ID, TILES, cityOf } from '../engine/board';
import * as C from '../engine/config';
import { cityPrice, fmtMoney } from '../engine/rules';
import type { GameEvent, GameState } from '../engine/types';

export type LogCls = '' | 'good' | 'bad' | 'wx';
export interface LogLine {
  msg: string;
  cls: LogCls;
}

const LVN = C.LV_NAMES;

/** `s` adalah state tampilan SEBELUM event diterapkan. */
export function messageFor(ev: GameEvent, s: GameState): LogLine | null {
  const nm = (pid: number) => s.players[pid]?.name ?? '?';
  const city = (t: number) => cityOf(t);
  switch (ev.e) {
    case 'TurnSkipped':
      return { msg: `${nm(ev.pid)} melewatkan giliran.`, cls: 'bad' };
    case 'DiceSteered':
      return {
        msg: `${C.WEATHER[ev.weather].name} membuat ${nm(ev.pid)} salah arah dan melangkah ke petak Nasib atau Bencana.`,
        cls: 'bad',
      };
    case 'DiceRolled':
      {
        const values = ev.values ?? [ev.a, ev.b];
        const total = values.reduce((sum, value) => sum + value, 0);
      return {
        msg: `${nm(ev.pid)} melempar dadu ${values.join(' + ')} = ${total}${ev.double ? ' (kembar)' : ''}.`,
        cls: '',
      };
      }
    case 'PassedStart':
      return {
        msg: `${nm(ev.pid)} melewati Titik Nol Sabang. Gaji ${fmtMoney(ev.amount)}.`,
        cls: 'good',
      };
    case 'Landed': {
      const T = TILES[ev.tile];
      if (!T) return null;
      if (T.t === 'city') {
        const c = city(ev.tile)!;
        const o = s.owners[ev.tile];
        if (ev.buyable)
          return {
            msg: `${nm(ev.pid)} tiba di ${c.name} (${c.prov.name}). Kosong, harga ${fmtMoney(cityPrice(c.prov))}.`,
            cls: '',
          };
        if (o && o.p === ev.pid)
          return { msg: `${nm(ev.pid)} mampir ke ${c.name}, kotanya sendiri.`, cls: '' };
        return null;
      }
      if (T.k === 'START') return { msg: `${nm(ev.pid)} berhenti di Titik Nol Sabang.`, cls: '' };
      if (T.k === 'JAIL') return { msg: `${nm(ev.pid)} cuma mampir ke Nusakambangan.`, cls: '' };
      if (T.k === 'RAZIA') return { msg: `${nm(ev.pid)} kena razia.`, cls: 'bad' };
      return null;
    }
    case 'MoneyChanged':
      if (ev.reason === 'pajak')
        return { msg: `${nm(ev.pid)} kena PPN 12%: ${fmtMoney(-ev.amount)}.`, cls: 'bad' };
      if (ev.reason === 'park')
        return { msg: `${nm(ev.pid)} ngopi gratis. Dapat ${fmtMoney(ev.amount)}.`, cls: 'good' };
      return null;
    case 'PaidRent':
      return {
        msg: `${nm(ev.from)} bayar sewa ${fmtMoney(ev.amount)} ke ${nm(ev.to)} di ${city(ev.tile)?.name ?? '?'}.`,
        cls: 'bad',
      };
    case 'TicketUsed':
      return {
        msg: `${nm(ev.pid)} pakai tiket gratis, bebas sewa di ${city(ev.tile)?.name ?? '?'}.`,
        cls: 'good',
      };
    case 'CardDrawn': {
      const c = CARD_BY_ID[ev.card];
      return {
        msg: `${nm(ev.pid)} mengambil kartu ${ev.kind}: ${c?.x ?? ''}`,
        cls: ev.tag === 'baik' ? 'good' : 'bad',
      };
    }
    case 'CardIdle':
      return {
        msg: `${nm(ev.pid)} mendarat di petak ${ev.kind}, tapi kali ini tidak berefek.`,
        cls: '',
      };
    case 'HazardHit':
      if (ev.kind === 'banjir')
        return { msg: `${nm(ev.pid)} kena banjir karena hujan deras.`, cls: 'bad' };
      if (ev.kind === 'petir')
        return { msg: `${nm(ev.pid)} disambar petir di tengah badai.`, cls: 'bad' };
      return {
        msg: `Kebakaran akibat panas terik melanda ${city(ev.tile)?.name ?? '?'} milik ${nm(ev.pid)}.`,
        cls: 'bad',
      };
    case 'CityLost': {
      const c = city(ev.tile);
      if (!c) return null;
      if (ev.level !== null)
        return {
          msg: `${LVN[ev.level + 1]} di ${c.name} hancur. Turun jadi ${LVN[ev.level]}.`,
          cls: 'bad',
        };
      const tanda = c.prov.cities[c.ci]?.t ?? '';
      return { msg: `${c.name} (${tanda}) hancur dan lepas dari ${nm(ev.pid)}.`, cls: 'bad' };
    }
    case 'NoCityFine':
      return { msg: `${nm(ev.pid)} tidak punya kota, jadi hanya kena denda.`, cls: 'bad' };
    case 'CitySold':
      return ev.forced
        ? {
            msg: `${nm(ev.pid)} terpaksa menjual ${city(ev.tile)?.name ?? '?'} (${fmtMoney(ev.value)}).`,
            cls: 'bad',
          }
        : {
            msg: `${nm(ev.pid)} menjual ${city(ev.tile)?.name ?? '?'} ke bank (${fmtMoney(ev.value)}).`,
            cls: '',
          };
    case 'CityMortgaged':
      return {
        msg: `${nm(ev.pid)} menggadaikan ${city(ev.tile)?.name ?? '?'} ke bank (+${fmtMoney(ev.value)}).`,
        cls: '',
      };
    case 'CityRedeemed':
      return {
        msg: `${nm(ev.pid)} menebus ${city(ev.tile)?.name ?? '?'} (${fmtMoney(ev.cost)}).`,
        cls: 'good',
      };
    case 'RentWaived':
      return {
        msg: `${city(ev.tile)?.name ?? '?'} sedang tergadai. ${nm(ev.pid)} bebas sewa.`,
        cls: 'good',
      };
    case 'CityBought': {
      const c = city(ev.tile)!;
      return {
        msg: `${nm(ev.pid)} membeli ${c.name} (${c.prov.cities[c.ci]?.t ?? ''}).`,
        cls: 'good',
      };
    }
    case 'CityBuilt':
      return {
        msg: `${nm(ev.pid)} membangun ${LVN[ev.level]} di ${city(ev.tile)?.name ?? '?'}.`,
        cls: 'good',
      };
    case 'PlayerJailed':
      if (ev.reason === 'kembar3')
        return {
          msg: `${nm(ev.pid)} kembar 3 kali berturut-turut dan dicurigai. Masuk penjara.`,
          cls: 'bad',
        };
      return { msg: `${nm(ev.pid)} masuk Nusakambangan.`, cls: 'bad' };
    case 'JailReleased':
      if (ev.reason === 'kembar')
        return { msg: `${nm(ev.pid)} bebas dari Nusakambangan lewat dadu kembar.`, cls: 'good' };
      if (ev.reason === 'denda')
        return {
          msg: `${nm(ev.pid)} wajib membayar denda ${fmtMoney(C.JAIL_FEE)} lalu keluar.`,
          cls: 'bad',
        };
      return { msg: `${nm(ev.pid)} membayar ${fmtMoney(C.JAIL_FEE)} dan keluar penjara.`, cls: '' };
    case 'JailStay':
      return { msg: `${nm(ev.pid)} masih di penjara.`, cls: '' };
    case 'Bankrupt':
      return { msg: `${nm(ev.pid)} bangkrut dan keluar dari permainan.`, cls: 'bad' };
    case 'WeatherChanged': {
      const w = C.WEATHER[ev.to];
      return { msg: `Cuaca berubah: ${w.name}. ${w.desc}`, cls: 'wx' };
    }
    default:
      return null;
  }
}

/** Kalimat tambahan setelah membeli (monopoli). */
export function monopolyLine(
  ev: Extract<GameEvent, { e: 'CityBought' }>,
  s: GameState,
): LogLine | null {
  if (!ev.monopoly) return null;
  const c = cityOf(ev.tile)!;
  return {
    msg: `${s.players[ev.pid]?.name ?? '?'} menguasai kelima kota ${c.prov.name}. Sewa berlipat dua.`,
    cls: 'good',
  };
}

export function chanceLine(
  ev: Extract<GameEvent, { e: 'CardDrawn' }>,
  s: GameState,
): LogLine | null {
  if (ev.chance == null) return null;
  return {
    msg: `Cuaca ${C.WEATHER[s.weather].name}: peluang nasib baik ${Math.round(ev.chance * 100)}%.`,
    cls: '',
  };
}
