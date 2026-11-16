import * as C from './config';
import type { Rng } from './rng';
import type { WeatherKey } from './types';

export function goodChance(w: WeatherKey): number {
  const l = C.WEATHER[w].luck;
  return Math.max(
    C.GOOD_MIN,
    Math.min(C.GOOD_MAX, l >= 0 ? C.GOOD_BASE + l : C.GOOD_BASE * (1 + l)),
  );
}

/** Pilih cuaca baru berbobot, tidak boleh sama dengan sebelumnya (prev=null: semua boleh). */
export function nextWeather(rng: Rng, prev: WeatherKey | null): WeatherKey {
  const list = C.WEATHER_KEYS.filter((k) => k !== prev);
  const total = list.reduce((a, k) => a + C.WEATHER[k].weight, 0);
  let r = rng.float() * total;
  for (const k of list) {
    r -= C.WEATHER[k].weight;
    if (r <= 0) return k;
  }
  return list[0] as WeatherKey;
}

/** Selang waktu nyata sampai pergantian cuaca berikutnya. Dipakai Host untuk timer (bukan aturan). */
export function nextWeatherDelayMs(rand: () => number = Math.random): number {
  return C.WEATHER_MIN_MS + rand() * (C.WEATHER_MAX_MS - C.WEATHER_MIN_MS);
}
