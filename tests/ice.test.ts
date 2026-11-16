import { describe, expect, it } from 'vitest';
import { hasTurn, parseIceJson, resolveIce, validIce } from '../src/net/ice';
import { DEFAULT_ICE } from '../src/net/room';

const TURN = { urls: 'turn:turn.contoh.org:443?transport=tcp', username: 'u', credential: 'p' };
const okFetch = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe('konfigurasi ICE', () => {
  it('validasi: hanya stun:/turn: yang sah', () => {
    expect(validIce([TURN, { urls: ['stun:a.org:3478'] }])).toHaveLength(2);
    expect(validIce([{ urls: 'https://jahat.org' }, { urls: 42 }, null, 'x'])).toEqual([]);
    expect(validIce({ urls: 'turn:x' })).toEqual([]);
    expect(parseIceJson('bukan json')).toEqual([]);
  });

  it('tanpa konfigurasi: STUN bawaan, tanpa TURN', async () => {
    const c = await resolveIce({});
    expect(c.servers).toEqual(DEFAULT_ICE);
    expect(c.source).toBe('default');
    expect(c.turn).toBe(false);
  });

  it('VITE_ICE_SERVERS statis dengan TURN', async () => {
    const c = await resolveIce({ VITE_ICE_SERVERS: JSON.stringify([TURN]) });
    expect(c.turn).toBe(true);
    expect(c.source).toBe('static');
    expect(c.servers[0]).toEqual(TURN);
    // STUN bawaan ditambahkan karena daftar tidak memuat STUN
    expect(c.servers.some((s) => String(s.urls).startsWith('stun'))).toBe(true);
  });

  it('VITE_ICE_SERVERS_URL: daftar dari URL didahulukan', async () => {
    const fromUrl = [{ urls: 'stun:stun.metered.ca:80' }, TURN];
    const c = await resolveIce(
      { VITE_ICE_SERVERS_URL: 'https://contoh.metered.live/api/v1/turn/credentials?apiKey=k' },
      okFetch(fromUrl),
    );
    expect(c.source).toBe('url');
    expect(c.servers).toEqual(fromUrl);
    expect(hasTurn(c.servers)).toBe(true);
  });

  it('URL gagal (HTTP 401): cadangan statis dan peringatan', async () => {
    const c = await resolveIce(
      { VITE_ICE_SERVERS_URL: 'https://x', VITE_ICE_SERVERS: JSON.stringify([TURN]) },
      okFetch({ error: 'apiKey salah' }, 401),
    );
    expect(c.source).toBe('static');
    expect(c.warning).toMatch(/Gagal/);
    expect(c.turn).toBe(true);
  });

  it('URL mengembalikan isi tidak sah: diabaikan', async () => {
    const c = await resolveIce({ VITE_ICE_SERVERS_URL: 'https://x' }, okFetch({ bukan: 'array' }));
    expect(c.source).toBe('default');
    expect(c.warning).toMatch(/kosong atau tidak sah/);
  });

  it('URL lambat: dibatalkan setelah batas waktu', async () => {
    const slow = ((_u: string, init: RequestInit) =>
      new Promise((_r, rej) =>
        init.signal?.addEventListener('abort', () => rej(new Error('abort'))),
      )) as unknown as typeof fetch;
    const t0 = Date.now();
    const c = await resolveIce({ VITE_ICE_SERVERS_URL: 'https://x' }, slow, 50);
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(c.source).toBe('default');
  });
});
