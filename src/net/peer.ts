/**
 * Transport WebRTC lewat PeerJS. Signaling memakai broker publik PeerJS; data langsung antar
 * browser lewat data channel yang andal. ICE/TURN diatur dari VITE_ICE_SERVERS.
 */
import Peer, { type DataConnection } from 'peerjs';
import { Emitter, type HostEndpoint, type Link, type Transport } from './transport';
import { sessionIce } from './ice';
import { peerIdFor } from './room';

export const CONNECT_TIMEOUT_MS = 15_000;

/** Kesalahan koneksi dengan pesan berbahasa Indonesia untuk pemain. */
export class NetError extends Error {
  constructor(
    message: string,
    readonly kind: 'taken' | 'notfound' | 'network' | 'timeout' | 'browser',
  ) {
    super(message);
  }
}

function errorFor(type: string | undefined): NetError {
  switch (type) {
    case 'unavailable-id':
      return new NetError('Kode ruangan sedang dipakai. Coba buat ruangan lagi.', 'taken');
    case 'peer-unavailable':
      return new NetError(
        'Ruangan tidak ditemukan. Periksa kodenya, atau Host belum membuka ruangan.',
        'notfound',
      );
    case 'browser-incompatible':
      return new NetError(
        'Browser ini tidak mendukung WebRTC. Coba Chrome, Firefox, atau Safari terbaru.',
        'browser',
      );
    default:
      return new NetError(
        'Gagal tersambung ke server sinyal. Periksa internet, lalu coba lagi.',
        'network',
      );
  }
}

class PeerLink implements Link {
  private readonly msg = new Emitter<[string]>();
  private readonly cls = new Emitter<[]>();
  private closed = false;
  constructor(readonly conn: DataConnection) {
    conn.on('data', (d) => {
      if (typeof d === 'string') this.msg.emit(d);
    });
    const end = () => {
      if (this.closed) return;
      this.closed = true;
      this.cls.emit();
    };
    conn.on('close', end);
    conn.on('error', end);
    // deteksi putus di tingkat ICE (mis. HP pindah jaringan)
    conn.on('iceStateChanged', (s) => {
      if (s === 'failed' || s === 'closed') end();
    });
  }
  send(data: string): void {
    if (this.closed || !this.conn.open) return;
    try {
      void this.conn.send(data);
    } catch {
      /* channel sudah tertutup */
    }
  }
  close(): void {
    this.conn.close();
    if (!this.closed) {
      this.closed = true;
      this.cls.emit();
    }
  }
  onMessage(cb: (data: string) => void): void {
    this.msg.on(cb);
  }
  onClose(cb: () => void): void {
    this.cls.on(cb);
  }
  /** Jenis jalur WebRTC terpilih: langsung (host/srflx) atau lewat server TURN (relay). */
  async route(): Promise<string | null> {
    const pc = this.conn.peerConnection;
    if (!pc) return null;
    try {
      const stats = await pc.getStats();
      let pairLocal: string | null = null;
      stats.forEach((r: RTCStats & Record<string, unknown>) => {
        if (r.type === 'candidate-pair' && r.state === 'succeeded' && (r.nominated || r.selected))
          pairLocal = String(r.localCandidateId);
      });
      if (!pairLocal) return null;
      const cand = stats.get(pairLocal) as (RTCStats & { candidateType?: string }) | undefined;
      switch (cand?.candidateType) {
        case 'host':
          return 'langsung (jaringan lokal)';
        case 'srflx':
        case 'prflx':
          return 'langsung (lewat internet)';
        case 'relay':
          return 'lewat server TURN';
        default:
          return null;
      }
    } catch {
      return null;
    }
  }
}

export class PeerTransport implements Transport {
  /** `relayOnly`: paksa lewat TURN (uji `?relay=1`) */
  constructor(private readonly relayOnly = false) {}

  private async config(): Promise<RTCConfiguration> {
    const ice = await sessionIce();
    return {
      iceServers: ice.servers,
      ...(this.relayOnly ? { iceTransportPolicy: 'relay' as RTCIceTransportPolicy } : {}),
    };
  }

  async host(code: string): Promise<HostEndpoint> {
    const config = await this.config();
    return new Promise((resolve, reject) => {
      const peer = new Peer(peerIdFor(code), { config, debug: 0 });
      const em = new Emitter<[Link]>();
      let opened = false;
      const timer = setTimeout(() => {
        if (!opened) {
          peer.destroy();
          reject(new NetError('Server sinyal tidak menjawab. Coba lagi sebentar lagi.', 'timeout'));
        }
      }, CONNECT_TIMEOUT_MS);
      peer.on('open', () => {
        opened = true;
        clearTimeout(timer);
        resolve({ onConnection: (cb) => em.on(cb), close: () => peer.destroy() });
      });
      peer.on('connection', (conn) => {
        conn.on('open', () => em.emit(new PeerLink(conn)));
      });
      // putus dari broker tidak memutus koneksi pemain yang sudah ada; sambung lagi supaya
      // pemain baru atau yang menyambung ulang tetap bisa masuk
      peer.on('disconnected', () => {
        if (!peer.destroyed) peer.reconnect();
      });
      peer.on('error', (err) => {
        if (!opened) {
          clearTimeout(timer);
          peer.destroy();
          reject(errorFor((err as { type?: string }).type));
        }
      });
    });
  }

  async join(code: string): Promise<Link> {
    const config = await this.config();
    return new Promise((resolve, reject) => {
      const peer = new Peer({ config, debug: 0 });
      let done = false;
      const fail = (e: NetError) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        peer.destroy();
        reject(e);
      };
      const timer = setTimeout(
        () =>
          fail(
            new NetError(
              'Tidak bisa tersambung ke Host. Coba jaringan lain atau gunakan hotspot HP.',
              'timeout',
            ),
          ),
        CONNECT_TIMEOUT_MS,
      );
      peer.on('error', (err) => fail(errorFor((err as { type?: string }).type)));
      peer.on('open', () => {
        const conn = peer.connect(peerIdFor(code), { reliable: true, serialization: 'raw' });
        conn.on('open', () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          const link = new PeerLink(conn);
          link.onClose(() => peer.destroy());
          resolve(link);
        });
      });
    });
  }
}
