/** Kode ruangan, id PeerJS, token sesi, dan konfigurasi ICE. */

/** huruf besar dan angka tanpa karakter ambigu 0 O 1 I */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LEN = 5;
export const PEER_PREFIX = 'nusantara-ngawur-';

function randomInts(n: number, max: number): number[] {
  const a = new Uint32Array(n);
  crypto.getRandomValues(a);
  return [...a].map((x) => x % max);
}

export function makeRoomCode(): string {
  return randomInts(CODE_LEN, CODE_ALPHABET.length)
    .map((i) => CODE_ALPHABET[i])
    .join('');
}

export function isRoomCode(s: string): boolean {
  return new RegExp(`^[${CODE_ALPHABET}]{${CODE_LEN}}$`).test(s);
}

/** Rapikan kode yang diketik pemain (huruf kecil, spasi). */
export function normalizeCode(s: string): string {
  return s
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, CODE_LEN);
}

export const peerIdFor = (code: string) => PEER_PREFIX + code;

export function makeToken(): string {
  const a = new Uint8Array(18);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Tautan undangan dengan hash routing (aman di GitHub Pages). */
export function inviteUrl(code: string, loc: Location = location): string {
  return `${loc.origin}${loc.pathname}#/join/${code}`;
}

/** Baca kode dari hash `#/join/KODE`. */
export function codeFromHash(hash: string): string | null {
  const m = /^#\/join\/([A-Za-z0-9]{5})$/.exec(hash);
  if (!m) return null;
  const c = normalizeCode(m[1]!);
  return isRoomCode(c) ? c : null;
}

export const DEFAULT_ICE: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
];
