export type WeatherKey = 'cerah' | 'berawan' | 'hujan' | 'badai' | 'panas' | 'kabut' | 'asap';
export type SpecialKind = 'START' | 'JAIL' | 'PARK' | 'RAZIA' | 'NASIB' | 'BENCANA' | 'PAJAK';

export type Tile = { t: 'sp'; k: SpecialKind } | { t: 'city'; p: string; ci: number };

export interface City {
  n: string;
  e: string;
  t: string;
}
export interface Province {
  code: string;
  idx: number;
  name: string;
  reg: string;
  price: number;
  hue: number;
  cities: City[];
  /** indeks petak kelima kotanya */
  tiles: number[];
}

/** Efek kartu: m uang, mv maju/mundur, skip lewat giliran, jail, free tiket, disc kupon, lc kota hancur. */
export interface Effect {
  m?: number;
  mv?: number;
  skip?: number;
  jail?: number;
  free?: number;
  disc?: number;
  lc?: number;
}
export interface Card {
  id: string;
  x: string;
  e: Effect;
  em: string;
  fx: string | null;
}
export type CardKind = 'NASIB' | 'BENCANA';
export type CardTag = 'baik' | 'buruk' | 'bencana';

export interface Player {
  id: number;
  name: string;
  /** indeks karakter bidak 0..7 */
  pawn: number;
  money: number;
  pos: number;
  jail: number;
  skip: number;
  free: number;
  disc: boolean;
  bankrupt: boolean;
}

export interface Ownership {
  p: number;
  lv: number;
}

export type Phase = 'roll' | 'act' | 'over';

export interface GameState {
  /** nomor revisi, naik satu per intent yang diterima */
  rev: number;
  players: Player[];
  /** pemilik per petak (null = tidak dimiliki / bukan kota) */
  owners: (Ownership | null)[];
  turn: number;
  phase: Phase;
  /** jumlah dadu kembar berturut-turut giliran ini */
  dbl: number;
  /** petak kota yang boleh dibeli sekarang */
  pending: number | null;
  last: number;
  weather: WeatherKey;
  /** state RNG mulberry32 */
  rng: number;
  winner: number | null;
}

/** Niat pemain (pid diisi/ditimpa Host sesuai koneksi). */
export type PlayerIntent =
  | { t: 'roll'; pid: number }
  | { t: 'buy'; pid: number }
  | { t: 'build'; pid: number; tile: number }
  | { t: 'endTurn'; pid: number }
  | { t: 'payJail'; pid: number };
/** Niat sistem, hanya boleh dikirim Host. */
export type SystemIntent = { t: 'weather' } | { t: 'endGame' };
export type Intent = PlayerIntent | SystemIntent;

export type MoneyReason =
  'salary' | 'pajak' | 'park' | 'card' | 'jailfee' | 'fine' | 'flood' | 'buy' | 'build' | 'sell';

export type HazardKind = 'banjir' | 'petir' | 'kebakaran';

export type GameEvent =
  | { e: 'TurnStarted'; pid: number }
  | { e: 'TurnSkipped'; pid: number }
  | { e: 'DiceRolled'; pid: number; a: number; b: number; double: boolean }
  | { e: 'DiceSteered'; pid: number; weather: WeatherKey }
  | { e: 'PawnStepped'; pid: number; from: number; to: number }
  | { e: 'PassedStart'; pid: number; amount: number }
  | { e: 'Landed'; pid: number; tile: number; buyable: boolean }
  | { e: 'MoneyChanged'; pid: number; amount: number; reason: MoneyReason }
  | { e: 'PaidRent'; from: number; to: number; amount: number; tile: number }
  | { e: 'TicketUsed'; pid: number; tile: number }
  | { e: 'CityBought'; pid: number; tile: number; price: number; monopoly: boolean }
  | { e: 'CityBuilt'; pid: number; tile: number; level: number; cost: number }
  | { e: 'CitySold'; pid: number; tile: number; value: number }
  | { e: 'CityLost'; pid: number; tile: number; level: number | null }
  | { e: 'NoCityFine'; pid: number; amount: number }
  | { e: 'CardDrawn'; pid: number; kind: CardKind; tag: CardTag; card: string; chance?: number }
  | { e: 'CardIdle'; pid: number; kind: CardKind }
  | { e: 'BencanaFx'; key: string; tile: number; player: number }
  | { e: 'HazardHit'; pid: number; kind: HazardKind; tile: number; text: string }
  | { e: 'WeatherChanged'; from: WeatherKey; to: WeatherKey }
  | { e: 'PlayerJailed'; pid: number; pos: number; reason: 'razia' | 'kartu' | 'kembar3' }
  | { e: 'JailReleased'; pid: number; reason: 'kembar' | 'denda' | 'bayar' }
  | { e: 'JailStay'; pid: number; left: number }
  | { e: 'Bankrupt'; pid: number }
  | { e: 'GameOver'; winner: number | null; ranking: { pid: number; wealth: number }[] };

export interface IntentOk {
  ok: true;
  state: GameState;
  events: GameEvent[];
}
export interface IntentErr {
  ok: false;
  reason: string;
}
export type IntentResult = IntentOk | IntentErr;
