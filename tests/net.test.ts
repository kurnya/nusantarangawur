import { afterEach, describe, expect, it, vi } from 'vitest';
import { botIntent } from '../src/engine/bot';
import { stateHash } from '../src/engine/hash';
import { ClientSession } from '../src/net/client';
import {
  DISCONNECT_GRACE_MS,
  HostSession,
  RATE_CAP,
  loadHostSave,
  type HostOptions,
} from '../src/net/host';
import { encode, type ClientIntent } from '../src/net/protocol';
import { MemoryNetwork, linkPair } from '../src/net/memory';
import {
  codeFromHash,
  isRoomCode,
  makeRoomCode,
  parseIceServers,
  DEFAULT_ICE,
} from '../src/net/room';

const CODE = 'ABCDE';
/** transport memori memakai microtask: cukup kosongkan antrean microtask */
const micro = async (n = 30) => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};
const flush = async (n = 6) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
};

interface Rec {
  c: ClientSession;
  rejects: string[];
  ends: string[];
  resyncs: string[];
  events: number;
  lost: number;
}

async function setup(n: number, opts: Partial<HostOptions> = {}) {
  const net = new MemoryNetwork();
  const endpoint = await net.host(CODE);
  const host = new HostSession({ code: CODE, endpoint, weather: false, seed: 42, ...opts });
  const clients: Rec[] = [];
  const join = async (name: string, pawn: number, token?: string): Promise<Rec> => {
    const link = await net.join(CODE);
    const rec: Rec = { c: null as never, rejects: [], ends: [], resyncs: [], events: 0, lost: 0 };
    rec.c = new ClientSession(
      link,
      { name, pawn, token },
      {
        onReject: (r) => rec.rejects.push(r),
        onEnd: (r) => rec.ends.push(r),
        onResync: (w) => rec.resyncs.push(w),
        onEvents: () => rec.events++,
        onLost: () => rec.lost++,
      },
    );
    await flush();
    return rec;
  };
  for (let i = 0; i < n; i++) clients.push(await join(`P${i}`, i));
  return { net, host, clients, join };
}

async function started(n = 3, opts: Partial<HostOptions> = {}) {
  const t = await setup(n, opts);
  t.clients.forEach((r) => r.c.setReady(true));
  await flush();
  expect(t.host.start()).toEqual({ ok: true });
  await flush();
  return t;
}

const turnClient = (t: { host: HostSession; clients: Rec[] }) => t.clients[t.host.state!.turn]!;
const sameAsHost = (t: { host: HostSession; clients: Rec[] }) => {
  const h = stateHash(t.host.state);
  return t.clients.every((r) => r.c.status === 'lost' || stateHash(r.c.state) === h);
};

afterEach(() => {
  vi.useRealTimers();
});

describe('ruangan', () => {
  it('kode 5 karakter tanpa karakter ambigu, tautan #/join', () => {
    for (let i = 0; i < 200; i++) {
      const c = makeRoomCode();
      expect(isRoomCode(c)).toBe(true);
      expect(c).not.toMatch(/[0O1I]/);
    }
    expect(codeFromHash('#/join/ab2cd')).toBe('AB2CD');
    expect(codeFromHash('#/join/AB0CD')).toBeNull();
    expect(codeFromHash('#/lain')).toBeNull();
  });
  it('ICE server dari env, cadangan STUN bila kosong atau rusak', () => {
    expect(parseIceServers(undefined)).toEqual(DEFAULT_ICE);
    expect(parseIceServers('bukan json')).toEqual(DEFAULT_ICE);
    expect(parseIceServers('[{"urls":"turn:x.org:3478","username":"u","credential":"p"}]')).toEqual(
      [{ urls: 'turn:x.org:3478', username: 'u', credential: 'p' }],
    );
  });
});

describe('lobi', () => {
  it('bergabung: tiap pemain dapat id dan token, bidak kembar dialihkan', async () => {
    const t = await setup(2);
    const late = await t.join('Kembar', 0);
    expect(t.clients.map((r) => r.c.pid)).toEqual([0, 1]);
    expect(late.c.pid).toBe(2);
    expect(late.c.token).toMatch(/^[\w-]{16,}$/);
    const pawns = late.c.lobby!.players.map((p) => p.pawn);
    expect(new Set(pawns).size).toBe(3);
  });
  it('nama dibatasi 14 karakter dan karakter kontrol dibuang', async () => {
    const t = await setup(1);
    t.clients[0]!.c.setProfile('<b>Aku\u0007</b> panjang sekali namanya', 3);
    await flush();
    const p = t.host.players[0]!;
    expect(p.name.length).toBeLessThanOrEqual(14);
    expect(p.name.includes('\u0007')).toBe(false);
    expect(p.name).toBe('<b>Aku</b> pan');
    expect(p.pawn).toBe(3);
  });
  it('mulai hanya jika minimal 3 pemain dan semua siap', async () => {
    const t = await setup(2);
    t.clients.forEach((r) => r.c.setReady(true));
    await flush();
    expect(t.host.start().ok).toBe(false);
    const c = await t.join('C', 2);
    expect(t.host.start().ok).toBe(false);
    c.c.setReady(true);
    await flush();
    expect(t.host.start().ok).toBe(true);
  });
  it('ruangan penuh menolak pemain ke-9', async () => {
    const t = await setup(8);
    const ninth = await t.join('Sembilan', 0);
    expect(ninth.ends[0]).toMatch(/penuh/);
  });
  it('permainan berjalan menolak pemain baru tanpa token', async () => {
    const t = await started(3);
    const x = await t.join('Telat', 5);
    expect(x.ends[0]).toMatch(/sudah berjalan/);
  });
  it('pemain yang keluar dari lobi melepas kursinya', async () => {
    const t = await setup(3);
    t.net.clientLinks[1]!.close();
    await flush();
    expect(t.host.players.map((p) => p.name)).toEqual(['P0', 'P2']);
  });
});

describe('permainan', () => {
  it('mulai: semua client menerima snapshot yang sama', async () => {
    const t = await started(3);
    expect(t.clients.every((r) => r.c.status === 'playing')).toBe(true);
    expect(sameAsHost(t)).toBe(true);
  });
  it('niat ditolak saat bukan giliran', async () => {
    const t = await started(3);
    const other = t.clients.find((r) => r.c.pid !== t.host.state!.turn)!;
    other.c.intent({ t: 'roll' });
    await flush();
    expect(other.rejects).toEqual(['Bukan giliranmu.']);
    expect(t.host.state!.rev).toBe(0);
  });
  it('niat sah: events disiarkan ke semua, state konsisten', async () => {
    const t = await started(3);
    turnClient(t).c.intent({ t: 'roll' });
    await flush();
    expect(t.host.state!.rev).toBe(1);
    expect(t.clients.every((r) => r.events === 1)).toBe(true);
    expect(sameAsHost(t)).toBe(true);
  });
  it('rev loncat memicu permintaan snapshot', async () => {
    const t = await started(3);
    const victim = t.clients[2]!;
    const hostSide = t.net.clientLinks[2]!.peer;
    let dropped = 0;
    hostSide.drop = (d) => d.includes('"t":"events"') && dropped++ === 0;
    // dua niat: yang pertama hilang untuk korban
    turnClient(t).c.intent({ t: 'roll' });
    await flush();
    const s = t.host.state!;
    const next: ClientIntent = s.phase === 'roll' ? { t: 'roll' } : { t: 'endTurn' };
    turnClient(t).c.intent(next);
    await flush(10);
    expect(victim.resyncs).toContain('rev');
    expect(sameAsHost(t)).toBe(true);
  });
  it('hash tidak cocok memicu snapshot', async () => {
    const t = await started(3);
    const victim = t.clients[1]!;
    victim.c.state!.players[0]!.money += 7; // rusak state lokal
    turnClient(t).c.intent({ t: 'roll' });
    await flush(10);
    expect(victim.resyncs).toContain('hash');
    expect(sameAsHost(t)).toBe(true);
  });
  it('pesan tidak sah dan terlalu besar diabaikan tanpa crash', async () => {
    const t = await started(3);
    const raw = t.net.clientLinks[0]!;
    raw.send('bukan json');
    raw.send(JSON.stringify({ v: 1, t: 'intent', seq: 1, intent: { t: 'curang', uang: 1e9 } }));
    raw.send(JSON.stringify({ v: 2, t: 'ping', ts: 1 }));
    raw.send('x'.repeat(100_000));
    raw.send(encode({ v: 1, t: 'intent', seq: 9, intent: { t: 'build', tile: -5 } as never }));
    await flush();
    expect(t.host.state!.rev).toBe(0);
    expect(sameAsHost(t)).toBe(true);
  });
  it('batas laju: banjir pesan dipotong', async () => {
    const t = await setup(1, { now: () => 1000 });
    let pongs = 0;
    t.net.clientLinks[0]!.onMessage((d) => {
      if (d.includes('"pong"')) pongs++;
    });
    for (let i = 0; i < 200; i++) t.net.clientLinks[0]!.send(encode({ v: 1, t: 'ping', ts: i }));
    await flush(10);
    expect(pongs).toBeLessThanOrEqual(RATE_CAP);
  });
  it('putus lalu sambung ulang dengan token: bidak sama, dapat snapshot', async () => {
    const t = await started(3);
    const b = t.clients[1]!;
    const token = b.c.token!;
    t.net.clientLinks[1]!.close();
    await flush();
    expect(b.lost).toBe(1);
    expect(t.host.players[1]!.connected).toBe(false);
    turnClient(t).c.intent({ t: 'roll' }); // permainan jalan terus
    await flush();
    const back = await t.join('B lagi', 1, token);
    expect(back.c.pid).toBe(1);
    expect(back.c.status).toBe('playing');
    expect(stateHash(back.c.state)).toBe(stateHash(t.host.state));
    expect(t.host.players[1]!.connected).toBe(true);
  });
  it('pemain terputus saat gilirannya: 45 detik lalu giliran otomatis', async () => {
    vi.useFakeTimers();
    const t = await (async () => {
      const p = started(3);
      await vi.runAllTimersAsync();
      return p;
    })();
    const pid = t.host.state!.turn;
    t.net.clientLinks[pid]!.close();
    await vi.advanceTimersByTimeAsync(10);
    expect(t.host.state!.turn).toBe(pid);
    await vi.advanceTimersByTimeAsync(DISCONNECT_GRACE_MS + 10);
    expect(t.host.state!.turn).not.toBe(pid);
  });
  it('Host terputus: client tahu sambungan hilang', async () => {
    const t = await started(3);
    t.net.clientLinks.forEach((l) => l.peer.close());
    await flush();
    expect(t.clients.every((r) => r.c.status === 'lost' && r.lost === 1)).toBe(true);
  });
  it('Host menutup ruangan: client menerima pesan akhir', async () => {
    const t = await started(3);
    t.host.close();
    await flush();
    expect(t.clients.every((r) => r.ends[0] === 'Host menutup ruangan.')).toBe(true);
  });
  it('Host bermain lewat client loopback', async () => {
    const net = new MemoryNetwork();
    const host = new HostSession({ code: CODE, endpoint: await net.host(CODE), weather: false });
    const [a, b] = linkPair();
    host.attachLocal(b);
    const me = new ClientSession(a, { name: 'Host', pawn: 4 });
    await flush();
    expect(me.pid).toBe(0);
    expect(me.lobby!.hostId).toBe(0);
    expect(me.lobby!.players[0]!.host).toBe(true);
  });
  it('Host menyimpan snapshot dan bisa dipulihkan setelah refresh', async () => {
    const mem = new Map<string, string>();
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    };
    const t = await started(3, { storage });
    turnClient(t).c.intent({ t: 'roll' });
    await flush();
    const tokens = t.clients.map((r) => r.c.token!);
    t.host.close();
    const save = loadHostSave(storage, CODE)!;
    expect(save.state!.rev).toBe(1);
    const net2 = new MemoryNetwork();
    const host2 = new HostSession({
      code: CODE,
      endpoint: await net2.host(CODE),
      weather: false,
      restore: save,
    });
    const link = await net2.join(CODE);
    const back = new ClientSession(link, { name: 'x', pawn: 0, token: tokens[2] });
    await flush();
    expect(back.pid).toBe(2);
    expect(stateHash(back.state)).toBe(stateHash(host2.state));
  });
  it('permainan penuh 4 pemain lewat jaringan: semua state konsisten sampai selesai', async () => {
    const t = await started(4);
    let guard = 0;
    while (t.host.state!.phase !== 'over' && guard++ < 6000) {
      const s = t.host.state!;
      const i = botIntent(s);
      if (i.t === 'weather' || i.t === 'endGame') break;
      const { pid: _pid, ...ci } = i;
      void _pid;
      t.clients[s.turn]!.c.intent(ci as ClientIntent);
      await micro();
      if (guard % 400 === 0) expect(sameAsHost(t)).toBe(true);
    }
    if (t.host.state!.phase !== 'over') t.host.endGame();
    await flush();
    expect(t.host.state!.phase).toBe('over');
    expect(sameAsHost(t)).toBe(true);
    expect(t.clients.every((r) => r.resyncs.length === 0)).toBe(true);
  }, 60_000);
});
