import { describe, expect, it } from 'vitest';
import { CARDS, N_TILES, TILES, cityOf } from '../src/engine/board';
import * as C from '../src/engine/config';
import { applyIntent } from '../src/engine/engine';
import type { Rng } from '../src/engine/rng';
import { nextWeather, nextWeatherDelayMs, goodChance } from '../src/engine/weather';
import { Rng as R } from '../src/engine/rng';
import type { Card, GameState, WeatherKey } from '../src/engine/types';
import { cityTiles, has, mkGame, ofType, own, place, rig, rigDice, step, tilesOf } from './helpers';

const NASIB_AT = 6; // petak Nasib pertama; dari pos 0 dengan dadu 6
const BENCANA_AT = tilesOf('BENCANA').find((t) => t >= 8)!;

/** Siapkan satu lemparan yang mengambil kartu `idx` dari daftar `kind`. */
function setupCard(kind: 'nasibBad' | 'nasibGood' | 'bencana', idx: number): GameState {
  let s = mkGame(3, 'cerah');
  if (kind === 'bencana') {
    place(s, 0, BENCANA_AT - 7);
    // dua kota milik pemain supaya kartu "kota hancur" bisa menunjuk
    own(s, cityTiles()[30]!, 0, 1);
    own(s, cityTiles()[60]!, 0, 0);
    return rig(s, (r) => {
      if (r.d6() + r.d6() !== 7) return false;
      return r.int(CARDS.bencana.length) === idx;
    });
  }
  const bad = kind === 'nasibBad';
  const list = bad ? CARDS.nasibBad : CARDS.nasibGood;
  s = rig(s, (r: Rng) => {
    const a = r.d6();
    const b = r.d6();
    if (a + b !== NASIB_AT || a === b) return false;
    if (r.float() >= goodChance('cerah') !== bad) return false;
    return r.int(list.length) === idx;
  });
  return s;
}

describe('setiap kartu', () => {
  const all: ['nasibBad' | 'nasibGood' | 'bencana', number, Card][] = [
    ...CARDS.nasibBad.map((c, i) => ['nasibBad', i, c] as ['nasibBad', number, Card]),
    ...CARDS.nasibGood.map((c, i) => ['nasibGood', i, c] as ['nasibGood', number, Card]),
    ...CARDS.bencana.map((c, i) => ['bencana', i, c] as ['bencana', number, Card]),
  ];
  it('jumlah kartu: Nasib baru dari pemilik (80 buruk, 20 baik), Bencana 12', () => {
    expect([CARDS.nasibBad.length, CARDS.nasibGood.length, CARDS.bencana.length]).toEqual([
      80, 20, 12,
    ]);
  });
  it('Nasib buruk selalu merugikan, Nasib baik selalu menguntungkan', () => {
    for (const c of CARDS.nasibBad)
      expect((c.e.m ?? 0) <= 0 && (c.e.mv ?? 0) <= 0 && !c.e.free && !c.e.disc, c.x).toBe(true);
    for (const c of CARDS.nasibGood)
      expect((c.e.m ?? 0) >= 0 && (c.e.mv ?? 0) >= 0 && !c.e.skip && !c.e.jail, c.x).toBe(true);
    const ids = new Set([...CARDS.nasibBad, ...CARDS.nasibGood].map((c) => c.id));
    expect(ids.size).toBe(100);
  });
  it('Bencana selalu merugikan', () => {
    for (const c of CARDS.bencana) {
      const e = c.e;
      expect((e.m ?? 0) <= 0 && (e.mv ?? 0) <= 0 && !e.free && !e.disc).toBe(true);
      expect(Boolean(e.m || e.mv || e.skip || e.jail || e.lc)).toBe(true);
    }
  });

  it.each(all)('%s #%i: %o', (kind, idx, card) => {
    const s = setupCard(kind, idx);
    const r = step(s, { t: 'roll', pid: 0 });
    const drawn = ofType(r.events, 'CardDrawn')[0]!;
    expect(drawn.card).toBe(card.id);
    expect(drawn.tag).toBe(kind === 'bencana' ? 'bencana' : kind === 'nasibBad' ? 'buruk' : 'baik');
    const p = r.state.players[0]!;
    const e = card.e;
    const idxDrawn = r.events.indexOf(drawn);
    const after = r.events.slice(idxDrawn + 1);

    if (e.m) {
      const mc = ofType(after, 'MoneyChanged').find((x) => x.reason === 'card');
      expect(mc?.amount).toBe(e.m);
    }
    if (e.skip) expect(p.skip).toBe(e.skip);
    if (e.free) expect(p.free).toBe(e.free);
    if (e.disc) expect(p.disc).toBe(true);
    if (e.jail) {
      expect(p.jail).toBe(3);
      expect(ofType(after, 'PlayerJailed')[0]!.reason).toBe('kartu');
    }
    if (e.mv) {
      const steps = ofType(after, 'PawnStepped').slice(0, Math.abs(e.mv));
      expect(steps).toHaveLength(Math.abs(e.mv));
      const dir = e.mv > 0 ? 1 : -1;
      expect(steps[0]!.from).toBe(kind === 'bencana' ? BENCANA_AT : NASIB_AT);
      steps.forEach((st) =>
        expect((st.to - st.from + N_TILES) % N_TILES).toBe(dir === 1 ? 1 : N_TILES - 1),
      );
    }
    if (e.lc) {
      const lost = ofType(after, 'CityLost')[0]!;
      expect(s.owners[lost.tile]?.p).toBe(0);
      expect(ofType(after, 'BencanaFx')[0]!.tile).toBe(lost.tile);
    }
    if (kind === 'bencana') {
      expect(ofType(after, 'BencanaFx')[0]!.key).toBe(card.fx);
    } else {
      expect(has(after, 'BencanaFx')).toBe(false);
    }
  });
});

describe('cuaca', () => {
  it('peluang Nasib baik per cuaca (statistik dari lemparan nyata)', () => {
    const expected: Record<string, number> = {
      cerah: 0.5,
      berawan: 0.3,
      hujan: 0.2,
      kabut: 0.1,
      asap: 0.04,
    };
    for (const [w, want] of Object.entries(expected)) {
      let good = 0;
      let n = 0;
      for (let seed = 1; seed <= 24000 && n < 3000; seed++) {
        const s = mkGame(3, w as WeatherKey, seed);
        const r = applyIntent(s, { t: 'roll', pid: 0 });
        if (!r.ok) continue;
        const d = ofType(r.events, 'CardDrawn')[0];
        if (!d || d.kind !== 'NASIB') continue;
        n++;
        if (d.tag === 'baik') good++;
        if (C.WEATHER[w as WeatherKey].luck !== 0) expect(d.chance).toBeCloseTo(want, 10);
      }
      expect(n, w).toBeGreaterThan(1500);
      expect(good / n, w).toBeGreaterThan(want - 0.04);
      expect(good / n, w).toBeLessThan(want + 0.04);
    }
  });

  it('kabut dan kabut asap mengarahkan dadu ke Nasib/Bencana', () => {
    const frac = (w: WeatherKey) => {
      let hit = 0;
      let steered = 0;
      const N = 4000;
      for (let seed = 1; seed <= N; seed++) {
        const r = applyIntent(mkGame(3, w, seed), { t: 'roll', pid: 0 });
        if (!r.ok) throw new Error(r.reason);
        const dice = ofType(r.events, 'DiceRolled')[0]!;
        expect(dice.a).toBeGreaterThanOrEqual(1);
        expect(dice.b).toBeLessThanOrEqual(6);
        const first = ofType(r.events, 'PawnStepped')[0];
        const landed = ofType(r.events, 'Landed')[0]!;
        const T = TILES[landed.tile]!;
        // petak pendaratan pertama = 0 + a + b (belum ada kartu yang menggeser)
        expect(landed.tile).toBe(dice.a + dice.b);
        void first;
        if (T.t === 'sp' && (T.k === 'NASIB' || T.k === 'BENCANA')) hit++;
        if (has(r.events, 'DiceSteered')) steered++;
      }
      return { hit: hit / N, steered: steered / N };
    };
    const cerah = frac('cerah');
    const kabut = frac('kabut');
    const asap = frac('asap');
    expect(cerah.steered).toBe(0);
    expect(cerah.hit).toBeLessThan(0.25);
    expect(kabut.hit).toBeGreaterThan(0.45);
    expect(asap.hit).toBeGreaterThan(0.75);
    expect(asap.hit).toBeGreaterThan(kabut.hit);
  });

  it('niat weather mengganti cuaca, tidak pernah sama dengan sebelumnya, semua jenis muncul', () => {
    let s = mkGame(3, 'cerah');
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const r = step(s, { t: 'weather' });
      const ev = ofType(r.events, 'WeatherChanged')[0]!;
      expect(ev.to).not.toBe(ev.from);
      expect(r.state.weather).toBe(ev.to);
      seen.add(ev.to);
      s = r.state;
    }
    expect(seen.size).toBe(7);
  });

  it('bobot pilihan cuaca mendekati tabel', () => {
    const rng = new R(99);
    const cnt: Record<string, number> = {};
    const N = 60000;
    for (let i = 0; i < N; i++) {
      const w = nextWeather(rng, null);
      cnt[w] = (cnt[w] ?? 0) + 1;
    }
    for (const k of C.WEATHER_KEYS) {
      expect((cnt[k] ?? 0) / N).toBeCloseTo(C.WEATHER[k].weight / 100, 1);
      expect(Math.abs((cnt[k] ?? 0) / N - C.WEATHER[k].weight / 100)).toBeLessThan(0.01);
    }
  });

  it('selang pergantian cuaca 90 detik sampai 5 menit', () => {
    expect(nextWeatherDelayMs(() => 0)).toBe(90_000);
    expect(nextWeatherDelayMs(() => 0.999999)).toBeLessThanOrEqual(300_000);
    expect(nextWeatherDelayMs(() => 1)).toBe(300_000);
  });
});

describe('kejadian cuaca setelah bergerak', () => {
  // dari pos 0, dadu 3+4 mendarat di kota kosong tanpa angka acak tambahan
  const roll = (w: WeatherKey, hit: boolean, setup?: (s: GameState) => void) => {
    const hz = C.WEATHER[w].hazard!;
    let s = mkGame(3, w);
    setup?.(s);
    s = rigDice(s, 3, 4, (r) => r.float() < hz === hit);
    return step(s, { t: 'roll', pid: 0 });
  };

  it('hujan: banjir rugi Rp350 jt', () => {
    const r = roll('hujan', true);
    expect(ofType(r.events, 'HazardHit')[0]!.kind).toBe('banjir');
    expect(ofType(r.events, 'BencanaFx')[0]!.key).toBe('banjir');
    expect(r.state.players[0]!.money).toBe(15000 - C.FLOOD_LOSS);
    expect(ofType(r.events, 'MoneyChanged')[0]!.reason).toBe('flood');
  });
  it('hujan: tanpa kejadian jika peluang tidak kena', () => {
    const r = roll('hujan', false);
    expect(has(r.events, 'HazardHit')).toBe(false);
    expect(r.state.players[0]!.money).toBe(15000);
  });
  it('badai: disambar petir lewat satu giliran', () => {
    const r = roll('badai', true);
    expect(ofType(r.events, 'HazardHit')[0]!.kind).toBe('petir');
    expect(r.state.players[0]!.skip).toBe(1);
  });
  it('panas: satu kota milik pemain terbakar (turun level atau hancur)', () => {
    const lowTile = cityTiles()[100]!;
    const r = roll('panas', true, (s) => own(s, lowTile, 0, 2));
    const h = ofType(r.events, 'HazardHit')[0]!;
    expect(h.kind).toBe('kebakaran');
    expect(h.tile).toBe(lowTile);
    expect(r.state.owners[lowTile]).toEqual({ p: 0, lv: 1 });
    const r2 = roll('panas', true, (s) => own(s, lowTile, 0, 0));
    expect(r2.state.owners[lowTile]).toBeNull();
    expect(ofType(r2.events, 'CityLost')[0]!.level).toBeNull();
  });
  it('panas: tidak berefek jika pemain belum punya kota', () => {
    const r = roll('panas', true);
    expect(has(r.events, 'HazardHit')).toBe(false);
    expect(r.state.players[0]!.money).toBe(15000);
    expect(r.state.players[0]!.skip).toBe(0);
  });
  it('cuaca tanpa hazard (cerah, kabut) tidak memicu kejadian', () => {
    for (const w of ['cerah', 'berawan'] as WeatherKey[]) {
      const s = rigDice(mkGame(3, w), 3, 4);
      expect(has(step(s, { t: 'roll', pid: 0 }).events, 'HazardHit')).toBe(false);
    }
  });
  it('tidak ada kejadian jika pemain masuk penjara (razia)', () => {
    const razia = tilesOf('RAZIA').find((t) => t >= 8)!;
    let s = mkGame(3, 'hujan');
    place(s, 0, razia - 7);
    s = rigDice(s, 3, 4, (r) => r.float() < 0.25);
    const r = step(s, { t: 'roll', pid: 0 });
    expect(has(r.events, 'PlayerJailed')).toBe(true);
    expect(has(r.events, 'HazardHit')).toBe(false);
  });
  it('tidak ada kejadian jika pemain tetap di penjara', () => {
    let s = mkGame(3, 'hujan');
    place(s, 0, tilesOf('JAIL')[0]!);
    s.players[0]!.jail = 3;
    s = rigDice(s, 1, 2);
    expect(has(step(s, { t: 'roll', pid: 0 }).events, 'HazardHit')).toBe(false);
  });
  it('petak terkait kota dipakai konsisten', () => {
    expect(cityOf(7)!.prov.code).toBe('SUT');
  });
});
