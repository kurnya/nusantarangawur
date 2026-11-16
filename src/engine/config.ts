/** Semua angka aturan permainan ada di sini. Satuan uang: juta rupiah. */
import type { WeatherKey } from './types';

export const START_MONEY = 15000;
export const SALARY = 2000;
export const JAIL_FEE = 500;
export const JAIL_TURNS = 3;
export const DOUBLES_TO_JAIL = 3;
export const PARK_BONUS = 100;
export const PAJAK_RATE = 0.12;
export const PAJAK_MIN = 300;
export const NO_CITY_FINE = 300;
/** Kartu yang menggerakkan pemain ke Nasib/Bencana lagi tidak berefek di kedalaman ini. */
export const CARD_DEPTH_LIMIT = 2;

/** minimal pemain (keputusan pemilik: 2, brief awal 3) */
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;

export const CITY_PRICE_RATE = 0.28;
export const RENT_RATE = 0.16;
export const RENT_SET_STEP = 0.25;
export const MIN_RENT = 10;
export const LVMULT = [1, 3, 6, 10] as const;
export const LV_NAMES = ['Kota biasa', 'Pasar', 'Mal', 'Metropolitan'] as const;
export const MAX_LEVEL = 3;
export const BUILD_RATE = 0.6;
export const ASSET_BASE = 0.5;
export const ASSET_PER_LEVEL = 0.3;
/** gadai: uang yang diterima = proporsi nilai aset */
export const MORTGAGE_RATE = 0.6;
/** tebus: nilai gadai + bunga */
export const REDEEM_INTEREST = 0.1;

export const GOOD_BASE = 0.2;
export const GOOD_MIN = 0.02;
export const GOOD_MAX = 0.9;

export interface WeatherDef {
  name: string;
  /** Pengaruh pada peluang Nasib baik; negatif juga mengarahkan dadu. */
  luck: number;
  desc: string;
  weight: number;
  /** Peluang kejadian per giliran (banjir/petir/kebakaran). */
  hazard?: number;
}

export const WEATHER: Record<WeatherKey, WeatherDef> = {
  cerah: { name: 'Cerah', luck: 0.3, weight: 22, desc: 'Peluang Nasib baik naik 30 poin.' },
  berawan: { name: 'Berawan', luck: 0.1, weight: 20, desc: 'Peluang Nasib baik naik 10 poin.' },
  hujan: {
    name: 'Hujan',
    luck: 0,
    weight: 16,
    hazard: 0.25,
    desc: 'Pemain bisa kena banjir di luar kotak musibah.',
  },
  badai: {
    name: 'Hujan badai petir',
    luck: 0,
    weight: 10,
    hazard: 0.22,
    desc: 'Pemain bisa disambar petir secara acak.',
  },
  panas: {
    name: 'Panas terik',
    luck: 0,
    weight: 12,
    hazard: 0.25,
    desc: 'Rumah (kota yang dibeli) bisa terbakar.',
  },
  kabut: {
    name: 'Berkabut',
    luck: -0.5,
    weight: 12,
    desc: 'Luck turun 50%. Dadu lebih sering membawa ke Nasib atau Bencana.',
  },
  asap: {
    name: 'Kabut asap',
    luck: -0.8,
    weight: 8,
    desc: 'Luck turun 80%. Dadu sangat sering membawa ke Nasib atau Bencana.',
  },
};
export const WEATHER_KEYS = Object.keys(WEATHER) as WeatherKey[];
export const FLOOD_LOSS = 350;
/** Selang pergantian cuaca (milidetik, waktu nyata). */
export const WEATHER_MIN_MS = 90_000;
export const WEATHER_MAX_MS = 300_000;
