import { describe, expect, it } from 'vitest';
import { N_TILES, PROV, TILES, cityOf } from '../src/engine/board';
import * as C from '../src/engine/config';
import { applyIntent, createGame } from '../src/engine/engine';
import { stateHash } from '../src/engine/hash';
import { assetValue, buildCost, cityPrice, rentFor, rentOf, wealth } from '../src/engine/rules';
import { cityTiles, has, mkGame, ofType, own, place, rigDice, step, tilesOf } from './helpers';

const jailTiles = tilesOf('JAIL');
const T7 = PROV.SUT!.tiles[0]!; // kota pertama Sumatera Utara
const ROLL_A = 3;
const ROLL_B = 5;
const ROLL_TOTAL = ROLL_A + ROLL_B;

describe('pembuatan dan penolakan', () => {
  it('createGame memberi uang awal dan fase roll', () => {
    const s = createGame({
      seed: 5,
      players: [
        { name: 'A', pawn: 0 },
        { name: 'B', pawn: 1 },
        { name: 'C', pawn: 2 },
      ],
    });
    expect(s.players.map((p) => p.money)).toEqual([15000, 15000, 15000]);
    expect(s.phase).toBe('roll');
    expect(s.rev).toBe(0);
    expect(s.owners).toHaveLength(N_TILES);
  });
  it('jumlah pemain tidak sah ditolak', () => {
    const mk = (n: number) =>
      createGame({
        seed: 1,
        players: Array.from({ length: n }, (_, i) => ({ name: 'x', pawn: i })),
      });
    expect(() => mk(1)).toThrow();
    expect(() => mk(9)).toThrow();
    expect(mk(8).players).toHaveLength(8);
  });
  it('niat bukan giliran, fase salah, uang kurang ditolak tanpa mengubah state', () => {
    const s = mkGame(3);
    const before = JSON.stringify(s);
    const bad = [
      applyIntent(s, { t: 'roll', pid: 1 }),
      applyIntent(s, { t: 'buy', pid: 0 }),
      applyIntent(s, { t: 'endTurn', pid: 0 }),
      applyIntent(s, { t: 'build', pid: 0, tile: 3 }),
      applyIntent(s, { t: 'payJail', pid: 0 }),
      applyIntent(s, { t: 'roll', pid: 9 }),
      applyIntent(s, { t: 'build', pid: 0, tile: -1 }),
    ];
    for (const r of bad) expect(r.ok).toBe(false);
    expect(JSON.stringify(s)).toBe(before);
  });
  it('state masukan tidak dimutasi dan rev naik satu', () => {
    const s = rigDice(mkGame(3), ROLL_A, ROLL_B);
    const before = JSON.stringify(s);
    const r = step(s, { t: 'roll', pid: 0 });
    expect(JSON.stringify(s)).toBe(before);
    expect(r.state.rev).toBe(1);
  });
  it('setelah permainan selesai semua niat ditolak', () => {
    const r = step(mkGame(3), { t: 'endGame' });
    expect(r.state.phase).toBe('over');
    expect(applyIntent(r.state, { t: 'roll', pid: 0 }).ok).toBe(false);
    expect(applyIntent(r.state, { t: 'weather' }).ok).toBe(false);
  });
  it('deterministik: seed dan urutan niat sama menghasilkan hash sama', () => {
    const run = (seed: number) => {
      let s = mkGame(3, 'cerah', seed);
      for (let i = 0; i < 40; i++) {
        const p = s.turn;
        const r = applyIntent(
          s,
          s.phase === 'roll' || s.dbl > 0 ? { t: 'roll', pid: p } : { t: 'endTurn', pid: p },
        );
        if (!r.ok) throw new Error(r.reason);
        s = r.state;
      }
      return stateHash(s);
    };
    expect(run(7)).toBe(run(7));
    expect(run(7)).not.toBe(run(8));
  });
});

describe('gerak, beli, sewa', () => {
  it('lempar dadu jalan, mendarat di kota kosong lalu bisa dibeli', () => {
    expect(TILES[T7]!.t).toBe('city');
    const s = rigDice(mkGame(3), ROLL_A, ROLL_B);
    const r = step(s, { t: 'roll', pid: 0 });
    expect(ofType(r.events, 'PawnStepped')).toHaveLength(ROLL_TOTAL);
    expect(r.state.players[0]!.pos).toBe(T7);
    expect(r.state.pending).toBe(T7);
    expect(r.state.phase).toBe('act');
    expect(r.state.last).toBe(ROLL_TOTAL);
    const b = step(r.state, { t: 'buy', pid: 0 });
    const price = cityPrice(cityOf(T7)!.prov);
    expect(b.state.owners[T7]).toEqual({ p: 0, lv: 0 });
    expect(b.state.players[0]!.money).toBe(15000 - price);
    expect(b.state.pending).toBeNull();
  });
  it('tidak bisa beli jika uang kurang', () => {
    let s = rigDice(mkGame(3), ROLL_A, ROLL_B);
    s = step(s, { t: 'roll', pid: 0 }).state;
    s.players[0]!.money = 10;
    expect(applyIntent(s, { t: 'buy', pid: 0 }).ok).toBe(false);
  });

  it('menguasai kelima kota menandai monopoli dan sewa dasar dobel', () => {
    const prov = PROV.SUT!;
    let s = mkGame(3);
    prov.tiles.slice(0, 4).forEach((t) => own(s, t, 0));
    expect(rentOf(s, prov.tiles[0]!)).toBe(rentFor(prov, 4, 0));
    place(s, 0, prov.tiles[4]! - 7);
    s = rigDice(s, 3, 4);
    s = step(s, { t: 'roll', pid: 0 }).state;
    const b = step(s, { t: 'buy', pid: 0 });
    expect(ofType(b.events, 'CityBought')[0]!.monopoly).toBe(true);
    // k=5 berarti 1 + 0.25*4 = 2x sewa k=1
    // pembulatan ke 10 jt membuat selisih paling banyak 10 jt
    expect(Math.abs(rentFor(prov, 5, 0) - rentFor(prov, 1, 0) * 2)).toBeLessThanOrEqual(10);
  });
  it('mendarat di kota lawan membayar sewa', () => {
    const s = rigDice(mkGame(3), ROLL_A, ROLL_B);
    own(s, T7, 1, 1);
    const rent = rentOf(s, T7);
    const r = step(s, { t: 'roll', pid: 0 });
    expect(r.state.players[0]!.money).toBe(15000 - rent);
    expect(r.state.players[1]!.money).toBe(15000 + rent);
    expect(ofType(r.events, 'PaidRent')[0]).toMatchObject({
      from: 0,
      to: 1,
      amount: rent,
      tile: T7,
    });
  });
  it('tiket bebas sewa dipakai sekali', () => {
    const s = rigDice(mkGame(3), ROLL_A, ROLL_B);
    own(s, T7, 1);
    s.players[0]!.free = 1;
    const r = step(s, { t: 'roll', pid: 0 });
    expect(r.state.players[0]!.money).toBe(15000);
    expect(r.state.players[0]!.free).toBe(0);
    expect(has(r.events, 'TicketUsed')).toBe(true);
  });
  it('melewati Titik Nol memberi gaji', () => {
    const s = mkGame(3);
    place(s, 0, N_TILES - 4);
    const r = step(rigDice(s, 3, 4), { t: 'roll', pid: 0 });
    expect(r.state.players[0]!.pos).toBe(3);
    expect(ofType(r.events, 'PassedStart')).toHaveLength(1);
    expect(r.state.players[0]!.money).toBe(15000 + C.SALARY);
  });
  it('mendarat di kota sendiri tidak membayar', () => {
    const s = rigDice(mkGame(3), ROLL_A, ROLL_B);
    own(s, T7, 0);
    const r = step(s, { t: 'roll', pid: 0 });
    expect(r.state.players[0]!.money).toBe(15000);
    expect(r.state.pending).toBeNull();
  });
});

describe('petak khusus', () => {
  const landOn = (kind: 'PAJAK' | 'PARK' | 'RAZIA', money = 15000) => {
    const t = tilesOf(kind).find((x) => x >= 8)!;
    const s = mkGame(3);
    s.players[0]!.money = money;
    place(s, 0, t - 7);
    return step(rigDice(s, 3, 4), { t: 'roll', pid: 0 });
  };
  it('PPN 12% dari uang', () => {
    expect(landOn('PAJAK').state.players[0]!.money).toBe(15000 - 1800);
  });
  it('PPN minimal Rp300 jt', () => {
    expect(landOn('PAJAK', 1000).state.players[0]!.money).toBe(700);
  });
  it('Warung Kopi memberi Rp100 jt', () => {
    const t = tilesOf('PARK')[0]!;
    const s = mkGame(3);
    place(s, 0, t - 7);
    expect(step(rigDice(s, 3, 4), { t: 'roll', pid: 0 }).state.players[0]!.money).toBe(15100);
  });
  it('Razia memenjarakan dan giliran berpindah', () => {
    const r = landOn('RAZIA');
    const p = r.state.players[0]!;
    expect(p.jail).toBe(3);
    expect(jailTiles).toContain(p.pos);
    expect(r.state.turn).toBe(1);
    expect(ofType(r.events, 'PlayerJailed')[0]!.reason).toBe('razia');
  });
});

describe('dadu kembar dan penjara', () => {
  it('kembar boleh lempar lagi, boleh juga mengakhiri giliran', () => {
    const r = step(rigDice(mkGame(3), 2, 2), { t: 'roll', pid: 0 });
    expect(r.state.dbl).toBe(1);
    expect(r.state.phase).toBe('act');
    expect(applyIntent(r.state, { t: 'roll', pid: 0 }).ok).toBe(true);
    expect(applyIntent(r.state, { t: 'endTurn', pid: 0 }).ok).toBe(true);
  });
  it('tanpa kembar tidak bisa lempar lagi', () => {
    const r = step(rigDice(mkGame(3), 3, 4), { t: 'roll', pid: 0 });
    expect(applyIntent(r.state, { t: 'roll', pid: 0 }).ok).toBe(false);
  });
  it('kembar tiga kali berturut-turut masuk penjara', () => {
    const s = rigDice(mkGame(3), 3, 3);
    s.dbl = 2;
    s.phase = 'act';
    const r = step(s, { t: 'roll', pid: 0 });
    expect(r.state.players[0]!.jail).toBe(3);
    expect(ofType(r.events, 'PlayerJailed')[0]!.reason).toBe('kembar3');
    expect(r.state.turn).toBe(1);
    expect(r.state.dbl).toBe(0);
  });
  const jailed = () => {
    const s = mkGame(3);
    place(s, 0, jailTiles[0]!);
    s.players[0]!.jail = 3;
    return s;
  };
  it('di penjara tanpa kembar: tetap di sana dan giliran lewat', () => {
    const r = step(rigDice(jailed(), 1, 2), { t: 'roll', pid: 0 });
    expect(r.state.players[0]!.jail).toBe(2);
    expect(r.state.players[0]!.pos).toBe(jailTiles[0]);
    expect(r.state.turn).toBe(1);
    expect(has(r.events, 'JailStay')).toBe(true);
  });
  it('kembar membebaskan dan langsung berjalan, tanpa lempar lagi', () => {
    const r = step(rigDice(jailed(), 2, 2), { t: 'roll', pid: 0 });
    expect(r.state.players[0]!.jail).toBe(0);
    expect(r.state.players[0]!.pos).toBe(jailTiles[0]! + 4);
    expect(r.state.dbl).toBe(0);
    expect(ofType(r.events, 'JailReleased')[0]!.reason).toBe('kembar');
  });
  it('giliran ketiga gagal: bayar denda lalu berjalan', () => {
    const s = jailed();
    s.players[0]!.jail = 1;
    const r = step(rigDice(s, 1, 2), { t: 'roll', pid: 0 });
    const p = r.state.players[0]!;
    expect(p.jail).toBe(0);
    expect(p.pos).toBe(jailTiles[0]! + 3);
    expect(p.money).toBeLessThanOrEqual(15000 - C.JAIL_FEE);
    expect(ofType(r.events, 'JailReleased')[0]!.reason).toBe('denda');
  });
  it('bayar denda sukarela', () => {
    const r = step(jailed(), { t: 'payJail', pid: 0 });
    expect(r.state.players[0]!.jail).toBe(0);
    expect(r.state.players[0]!.money).toBe(15000 - C.JAIL_FEE);
    expect(r.state.phase).toBe('roll');
    const s = jailed();
    s.players[0]!.money = 100;
    expect(applyIntent(s, { t: 'payJail', pid: 0 }).ok).toBe(false);
  });
});

describe('membangun', () => {
  const T = cityTiles()[10]!;
  it('biaya 60% harga kota, naik satu level', () => {
    const s = mkGame(3);
    own(s, T, 0);
    const cost = buildCost(s, T, 0);
    expect(cost).toBe(Math.round((cityPrice(cityOf(T)!.prov) * 0.6) / 10) * 10);
    const r = step(s, { t: 'build', pid: 0, tile: T });
    expect(r.state.owners[T]!.lv).toBe(1);
    expect(r.state.players[0]!.money).toBe(15000 - cost);
  });
  it('kupon bangun separuh harga dan habis dipakai', () => {
    const s = mkGame(3);
    own(s, T, 0);
    const full = buildCost(s, T, 0);
    s.players[0]!.disc = true;
    const half = buildCost(s, T, 0);
    expect(half).toBe(Math.round(full / 20) * 10);
    const r = step(s, { t: 'build', pid: 0, tile: T });
    expect(r.state.players[0]!.money).toBe(15000 - half);
    expect(r.state.players[0]!.disc).toBe(false);
  });
  it('maksimal level Metropolitan, hanya milik sendiri, butuh uang', () => {
    const s = mkGame(3);
    own(s, T, 0, 3);
    expect(applyIntent(s, { t: 'build', pid: 0, tile: T }).ok).toBe(false);
    const s2 = mkGame(3);
    own(s2, T, 1);
    expect(applyIntent(s2, { t: 'build', pid: 0, tile: T }).ok).toBe(false);
    const s3 = mkGame(3);
    own(s3, T, 0);
    s3.players[0]!.money = 5;
    expect(applyIntent(s3, { t: 'build', pid: 0, tile: T }).ok).toBe(false);
  });
  it('boleh membangun saat fase roll maupun act', () => {
    const s = mkGame(3);
    own(s, T, 0);
    expect(applyIntent(s, { t: 'build', pid: 0, tile: T }).ok).toBe(true);
    s.phase = 'act';
    expect(applyIntent(s, { t: 'build', pid: 0, tile: T }).ok).toBe(true);
  });
});

describe('jual otomatis dan bangkrut', () => {
  const dki = PROV.DKI!.tiles[0]!;
  it('uang negatif: jual kota termurah dulu', () => {
    const s = mkGame(3);
    const cheap = PROV.BKL!.tiles[0]!; // harga 500
    const mid = PROV.SUT!.tiles[1]!;
    own(s, cheap, 0);
    own(s, mid, 0);
    own(s, dki, 1, 3);
    s.players[0]!.money = 0;
    place(s, 0, dki - 7);
    const r = step(rigDice(s, 3, 4), { t: 'roll', pid: 0 });
    const sold = ofType(r.events, 'CitySold');
    expect(sold.length).toBeGreaterThan(0);
    expect(sold[0]!.tile).toBe(cheap);
    expect(sold[0]!.value).toBe(assetValue(s, cheap));
  });
  it('tidak cukup: bangkrut, kota dilepas, penerima tetap dapat sewa penuh', () => {
    const s = mkGame(3);
    own(s, dki, 1, 3);
    s.players[0]!.money = 0;
    place(s, 0, dki - 7);
    const rent = rentOf(s, dki);
    const r = step(rigDice(s, 3, 4), { t: 'roll', pid: 0 });
    expect(r.state.players[0]!.bankrupt).toBe(true);
    expect(r.state.players[0]!.money).toBe(0);
    expect(r.state.players[1]!.money).toBe(15000 + rent);
    expect(r.state.phase).not.toBe('over');
    expect(r.state.turn).toBe(1);
  });
  it('tinggal satu pemain: permainan selesai dan ada pemenang', () => {
    const s = mkGame(2);
    own(s, dki, 1, 3);
    s.players[0]!.money = 0;
    place(s, 0, dki - 7);
    const r = step(rigDice(s, 3, 4), { t: 'roll', pid: 0 });
    expect(r.state.phase).toBe('over');
    expect(r.state.winner).toBe(1);
    expect(has(r.events, 'GameOver')).toBe(true);
  });
  it('giliran melewati pemain bangkrut dan pemain yang harus lewat giliran', () => {
    const s = mkGame(4);
    s.players[1]!.bankrupt = true;
    s.players[1]!.money = 0;
    s.players[2]!.skip = 1;
    s.phase = 'act';
    const r = step(s, { t: 'endTurn', pid: 0 });
    expect(r.state.turn).toBe(3);
    expect(r.state.players[2]!.skip).toBe(0);
    expect(ofType(r.events, 'TurnSkipped')[0]!.pid).toBe(2);
  });
});

describe('akhiri permainan dan kekayaan', () => {
  it('kekayaan = uang + nilai aset, peringkat menurun', () => {
    const s = mkGame(3);
    const t = cityTiles()[40]!;
    own(s, t, 1, 2);
    s.players[0]!.money = 20000;
    s.players[2]!.money = 100;
    expect(wealth(s, 1)).toBe(15000 + assetValue(s, t));
    const r = step(s, { t: 'endGame' });
    expect(ofType(r.events, 'GameOver')[0]!.ranking.map((x) => x.pid)).toEqual([0, 1, 2]);
    expect(r.state.winner).toBe(0);
  });
});
