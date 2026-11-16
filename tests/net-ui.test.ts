import { describe, expect, it } from 'vitest';
import { estimateAnimMs, DICE_MS, STEP_MS, FX_MAX_MS } from '../src/game/timing';
import { netAdvice, type NetInfo } from '../src/ui/netpanel';

const base: NetInfo = {
  status: 'ok',
  ping: 40,
  route: 'langsung (lewat internet)',
  isHost: false,
  turn: false,
  me: 1,
  players: [],
};

describe('diagnosis koneksi', () => {
  it('tanpa saran saat koneksi baik', () => expect(netAdvice(base)).toEqual([]));
  it('terputus: sarankan jaringan lain atau hotspot', () =>
    expect(netAdvice({ ...base, status: 'lost' })[0]).toMatch(/hotspot/));
  it('ping tinggi: koneksi lambat', () =>
    expect(netAdvice({ ...base, ping: 900 })[0]).toMatch(/lambat/));
  it('Host tanpa TURN dengan pemain terputus: sarankan TURN', () => {
    const players = [
      { id: 0, name: 'H', pawn: 0, ready: true, connected: true, host: true },
      { id: 1, name: 'B', pawn: 1, ready: true, connected: false, host: false },
    ];
    expect(netAdvice({ ...base, isHost: true, players }).join(' ')).toMatch(/TURN/);
    expect(netAdvice({ ...base, isHost: true, turn: true, players })).toEqual([]);
  });
});

describe('perkiraan lama animasi', () => {
  it('dadu + langkah', () => {
    expect(
      estimateAnimMs([
        { e: 'DiceRolled', pid: 0, a: 1, b: 2, double: false },
        { e: 'PawnStepped', pid: 0, from: 0, to: 1 },
        { e: 'PawnStepped', pid: 0, from: 1, to: 2 },
      ]),
    ).toBe(DICE_MS + 2 * STEP_MS);
  });
  it('animasi besar dibatasi', () => {
    expect(
      estimateAnimMs([{ e: 'BencanaFx', key: 'merapi', tile: 0, player: 0 }]),
    ).toBeLessThanOrEqual(FX_MAX_MS);
    expect(
      estimateAnimMs([{ e: 'BencanaFx', key: 'tak-dikenal', tile: 0, player: 0 }]),
    ).toBeGreaterThan(0);
  });
});
