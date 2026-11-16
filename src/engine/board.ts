import provincesJson from './data/provinces.json';
import tilesJson from './data/tiles.json';
import cardsJson from './data/cards.json';
import specialJson from './data/special.json';
import pawnsJson from './data/pawns.json';
import regionsJson from './data/regions.json';
import type { Card, Province, SpecialKind, Tile } from './types';

export const TILES: readonly Tile[] = tilesJson as Tile[];
export const N_TILES = TILES.length;

export const PROVINCES: readonly Province[] = (provincesJson as Omit<Province, 'tiles'>[]).map(
  (p) => ({ ...p, tiles: [] as number[] }),
);
export const PROV: Readonly<Record<string, Province>> = Object.fromEntries(
  PROVINCES.map((p) => [p.code, p]),
);
TILES.forEach((T, i) => {
  if (T.t === 'city') (PROV[T.p] as Province).tiles.push(i);
});

export const CARDS = cardsJson as {
  nasibBad: Card[];
  nasibGood: Card[];
  bencana: Card[];
};
const ALL_CARDS = [...CARDS.nasibBad, ...CARDS.nasibGood, ...CARDS.bencana];
export const CARD_BY_ID: Readonly<Record<string, Card>> = Object.fromEntries(
  ALL_CARDS.map((c) => [c.id, c]),
);

export const SPECIAL = specialJson as { k: SpecialKind; label: string; emoji: string }[];
export const PAWNS = pawnsJson as { emoji: string; name: string; color: string }[];
export const REGIONS = regionsJson as { code: string; name: string; color: string }[];

export function cityOf(tile: number): { prov: Province; ci: number; name: string } | null {
  const T = TILES[tile];
  if (!T || T.t !== 'city') return null;
  const prov = PROV[T.p] as Province;
  return { prov, ci: T.ci, name: (prov.cities[T.ci] as { n: string }).n };
}

export function tileName(tile: number): string {
  const T = TILES[tile];
  if (!T) return '?';
  if (T.t === 'city') return cityOf(tile)?.name ?? '?';
  return SPECIAL.find((s) => s.k === T.k)?.label ?? T.k;
}

export const JAIL_TILES: readonly number[] = TILES.map((T, i) =>
  T.t === 'sp' && T.k === 'JAIL' ? i : -1,
).filter((i) => i >= 0);

/** Penjara terdekat dari posisi tertentu (jarak melingkar). */
export function jailNear(pos: number): number {
  const dist = (i: number) => {
    const d = Math.abs(i - pos);
    return Math.min(d, N_TILES - d);
  };
  return JAIL_TILES.reduce((b, i) => (dist(i) < dist(b) ? i : b), JAIL_TILES[0] as number);
}
