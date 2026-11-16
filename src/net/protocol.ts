/**
 * Protokol jaringan versi 1. Semua pesan berupa JSON dan divalidasi dengan zod.
 * Lihat docs/MULTIPLAYER.md untuk penjelasan alur.
 */
import { z } from 'zod';
import { MAX_PLAYERS } from '../engine/config';
import type { GameEvent, GameState, Intent } from '../engine/types';
import { NAME_MAX, cleanName } from './names';

export { NAME_MAX, cleanName };

export const PROTOCOL_VERSION = 1;
/** batas ukuran pesan dari client (byte, sebagai teks JSON) */
export const MAX_CLIENT_MSG = 4096;
/** batas ukuran pesan dari host (snapshot penuh ~30 KB) */
export const MAX_HOST_MSG = 512 * 1024;
const name = z.string().max(64).transform(cleanName);
const pawn = z
  .number()
  .int()
  .min(0)
  .max(MAX_PLAYERS - 1);
const token = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/);

/** Niat dari client: tanpa pid (Host yang menentukan pid dari koneksi). */
export const ClientIntentSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('roll') }),
  z.object({ t: z.literal('buy') }),
  z.object({ t: z.literal('build'), tile: z.number().int().min(0).max(1000) }),
  z.object({ t: z.literal('endTurn') }),
  z.object({ t: z.literal('payJail') }),
]);
export type ClientIntent = z.infer<typeof ClientIntentSchema>;

export const ClientMsgSchema = z.discriminatedUnion('t', [
  z.object({ v: z.literal(1), t: z.literal('hello'), name, pawn, token: token.optional() }),
  z.object({ v: z.literal(1), t: z.literal('profile'), name, pawn }),
  z.object({
    v: z.literal(1),
    t: z.literal('intent'),
    seq: z.number().int().min(0),
    intent: ClientIntentSchema,
  }),
  z.object({ v: z.literal(1), t: z.literal('ready'), ready: z.boolean() }),
  z.object({ v: z.literal(1), t: z.literal('sync') }),
  z.object({ v: z.literal(1), t: z.literal('ping'), ts: z.number() }),
]);
export type ClientMsg = z.infer<typeof ClientMsgSchema>;

export interface LobbyPlayer {
  id: number;
  name: string;
  pawn: number;
  ready: boolean;
  connected: boolean;
  host: boolean;
  /** dikeluarkan Host saat bermain */
  gone?: boolean;
}
export interface RoomSettings {
  startMoney: number;
  /** batas waktu giliran (detik), 0 = tanpa batas */
  turnLimit: number;
}

export type HostMsg =
  | { v: 1; t: 'welcome'; pid: number; token: string; code: string }
  | {
      v: 1;
      t: 'lobby';
      players: LobbyPlayer[];
      settings: RoomSettings;
      hostId: number;
      started: boolean;
    }
  | { v: 1; t: 'snapshot'; rev: number; state: GameState }
  | {
      v: 1;
      t: 'events';
      rev: number;
      /** niat yang menghasilkan events ini, supaya client bisa menjalankan mesin yang sama */
      intent: Intent;
      events: GameEvent[];
      stateHash: string;
    }
  | { v: 1; t: 'reject'; seq: number; reason: string }
  | { v: 1; t: 'pong'; ts: number }
  | { v: 1; t: 'kick' | 'end'; reason: string }
  /** sisa waktu giliran pemain `pid` (ms); pid -1 = tanpa batas */
  | { v: 1; t: 'timer'; pid: number; ms: number; mode: 'gone' | 'away' | 'limit' };

/* Validasi pesan dari host: struktur dangkal saja (host dipercaya untuk isi state). */
const HostMsgShape = z.discriminatedUnion('t', [
  z.object({
    v: z.literal(1),
    t: z.literal('welcome'),
    pid: z.number().int(),
    token,
    code: z.string(),
  }),
  z.object({
    v: z.literal(1),
    t: z.literal('lobby'),
    players: z.array(
      z.object({
        id: z.number().int(),
        name: z.string(),
        pawn: z.number().int(),
        ready: z.boolean(),
        connected: z.boolean(),
        host: z.boolean(),
        gone: z.boolean().optional(),
      }),
    ),
    settings: z.object({ startMoney: z.number(), turnLimit: z.number() }),
    hostId: z.number().int(),
    started: z.boolean(),
  }),
  z.object({
    v: z.literal(1),
    t: z.literal('snapshot'),
    rev: z.number().int(),
    state: z.looseObject({}),
  }),
  z.object({
    v: z.literal(1),
    t: z.literal('events'),
    rev: z.number().int(),
    intent: z.looseObject({ t: z.string() }),
    events: z.array(z.looseObject({ e: z.string() })),
    stateHash: z.string(),
  }),
  z.object({ v: z.literal(1), t: z.literal('reject'), seq: z.number().int(), reason: z.string() }),
  z.object({ v: z.literal(1), t: z.literal('pong'), ts: z.number() }),
  z.object({ v: z.literal(1), t: z.literal('kick'), reason: z.string() }),
  z.object({ v: z.literal(1), t: z.literal('end'), reason: z.string() }),
  z.object({
    v: z.literal(1),
    t: z.literal('timer'),
    pid: z.number().int(),
    ms: z.number().min(0),
    mode: z.enum(['gone', 'away', 'limit']),
  }),
]);

export function encode(msg: ClientMsg | HostMsg): string {
  return JSON.stringify(msg);
}

/** Uraikan pesan client. Mengembalikan null jika tidak sah atau terlalu besar (jangan crash). */
export function decodeClient(raw: unknown): ClientMsg | null {
  if (typeof raw !== 'string' || raw.length > MAX_CLIENT_MSG) return null;
  try {
    const r = ClientMsgSchema.safeParse(JSON.parse(raw));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

export function decodeHost(raw: unknown): HostMsg | null {
  if (typeof raw !== 'string' || raw.length > MAX_HOST_MSG) return null;
  try {
    const data: unknown = JSON.parse(raw);
    return HostMsgShape.safeParse(data).success ? (data as HostMsg) : null;
  } catch {
    return null;
  }
}
