/**
 * Konfigurasi ICE (STUN/TURN).
 *
 * Sumber, digabung berurutan:
 * 1. VITE_ICE_SERVERS_URL: URL yang mengembalikan JSON array RTCIceServer, diambil saat bermain.
 *    Cocok untuk Metered (`https://NAMA.metered.live/api/v1/turn/credentials?apiKey=KUNCI`):
 *    kredensial TURN berumur pendek, tidak tertanam di build.
 * 2. VITE_ICE_SERVERS: JSON array RTCIceServer statis.
 * 3. STUN publik bawaan.
 * Jika URL gagal atau lambat, permainan tetap jalan dengan sumber 2 dan 3.
 */
import { DEFAULT_ICE } from './room';

export const ICE_FETCH_TIMEOUT_MS = 4000;

/** Ambil hanya entri RTCIceServer yang sah dari nilai apa pun. */
export function validIce(v: unknown): RTCIceServer[] {
  if (!Array.isArray(v)) return [];
  return v.filter((s): s is RTCIceServer => {
    if (!s || typeof s !== 'object') return false;
    const u = (s as RTCIceServer).urls;
    const urls = typeof u === 'string' ? [u] : Array.isArray(u) ? u : null;
    return (
      !!urls &&
      urls.length > 0 &&
      urls.every((x) => typeof x === 'string' && /^(stuns?|turns?):/.test(x))
    );
  });
}

export function parseIceJson(raw: string | undefined): RTCIceServer[] {
  if (!raw || !raw.trim()) return [];
  try {
    return validIce(JSON.parse(raw));
  } catch {
    return [];
  }
}

export const isTurn = (s: RTCIceServer) => [s.urls].flat().some((u) => /^turns?:/.test(u));
export const hasTurn = (list: readonly RTCIceServer[]) => list.some(isTurn);

export interface IceEnv {
  VITE_ICE_SERVERS?: string;
  VITE_ICE_SERVERS_URL?: string;
}

/** Hasil penyusunan daftar ICE beserta keterangan untuk diagnosis. */
export interface IceConfig {
  servers: RTCIceServer[];
  /** 'url' jika daftar dari URL berhasil diambil */
  source: 'url' | 'static' | 'default';
  turn: boolean;
  /** pesan bila URL gagal */
  warning?: string;
}

export async function resolveIce(
  env: IceEnv,
  fetchFn: typeof fetch = fetch,
  timeoutMs = ICE_FETCH_TIMEOUT_MS,
): Promise<IceConfig> {
  const fixed = parseIceJson(env.VITE_ICE_SERVERS);
  let fromUrl: RTCIceServer[] = [];
  let warning: string | undefined;
  const url = env.VITE_ICE_SERVERS_URL?.trim();
  if (url) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetchFn(url, { signal: ctl.signal, cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      fromUrl = validIce(await r.json());
      if (!fromUrl.length) warning = 'Daftar TURN dari URL kosong atau tidak sah.';
    } catch {
      warning = 'Gagal mengambil daftar TURN; memakai cadangan.';
    } finally {
      clearTimeout(timer);
    }
  }
  const merged = [...fromUrl, ...fixed];
  const servers = merged.some((s) => [s.urls].flat().some((u) => u.startsWith('stun')))
    ? merged
    : [...merged, ...DEFAULT_ICE];
  return {
    servers,
    source: fromUrl.length ? 'url' : fixed.length ? 'static' : 'default',
    turn: hasTurn(servers),
    warning,
  };
}

let cached: Promise<IceConfig> | null = null;
/** Daftar ICE untuk sesi ini (diambil sekali). */
export function sessionIce(): Promise<IceConfig> {
  cached ??= resolveIce(import.meta.env as IceEnv);
  return cached;
}

/**
 * Uji apakah server TURN memberi jalur relay: kumpulkan kandidat ICE dengan kebijakan relay-saja.
 * Mengembalikan jumlah kandidat relay (0 = TURN tidak bekerja).
 */
export async function probeTurn(servers: RTCIceServer[], timeoutMs = 7000): Promise<number> {
  if (!hasTurn(servers) || typeof RTCPeerConnection === 'undefined') return 0;
  const pc = new RTCPeerConnection({ iceServers: servers, iceTransportPolicy: 'relay' });
  let n = 0;
  try {
    pc.createDataChannel('uji');
    const done = new Promise<void>((res) => {
      pc.onicecandidate = (e) => {
        if (!e.candidate) res();
        else if (/ typ relay /.test(e.candidate.candidate)) n++;
      };
      setTimeout(res, timeoutMs);
    });
    await pc.setLocalDescription(await pc.createOffer());
    await done;
  } catch {
    /* abaikan */
  } finally {
    pc.close();
  }
  return n;
}
