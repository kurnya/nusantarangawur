/** Transport dalam memori: untuk tes jaringan dan untuk menyambungkan Host ke client miliknya sendiri. */
import { Emitter, type HostEndpoint, type Link, type Transport } from './transport';

class MemLink implements Link {
  peer!: MemLink;
  closed = false;
  private readonly msg = new Emitter<[string]>();
  private readonly cls = new Emitter<[]>();
  /** pesan yang dijatuhkan (simulasi gangguan) */
  drop: ((data: string) => boolean) | null = null;

  send(data: string): void {
    if (this.closed) return;
    if (this.drop?.(data)) return;
    const p = this.peer;
    queueMicrotask(() => {
      if (!p.closed) p.msg.emit(data);
    });
  }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.cls.emit();
    const p = this.peer;
    queueMicrotask(() => p.close());
  }
  onMessage(cb: (data: string) => void): void {
    this.msg.on(cb);
  }
  onClose(cb: () => void): void {
    this.cls.on(cb);
  }
}

/** Sepasang link yang saling terhubung. */
export function linkPair(): [MemLink, MemLink] {
  const a = new MemLink();
  const b = new MemLink();
  a.peer = b;
  b.peer = a;
  return [a, b];
}

export class MemoryNetwork implements Transport {
  private readonly rooms = new Map<string, Emitter<[Link]>>();
  /** sisi client dari semua link, untuk tes (putuskan, jatuhkan pesan) */
  readonly clientLinks: MemLink[] = [];

  async host(code: string): Promise<HostEndpoint> {
    if (this.rooms.has(code)) throw new Error('Kode ruangan sudah dipakai.');
    const em = new Emitter<[Link]>();
    this.rooms.set(code, em);
    return {
      onConnection: (cb) => em.on(cb),
      close: () => {
        this.rooms.delete(code);
      },
    };
  }

  async join(code: string): Promise<Link> {
    const em = this.rooms.get(code);
    if (!em) throw new Error('Ruangan tidak ditemukan.');
    const [client, host] = linkPair();
    this.clientLinks.push(client);
    queueMicrotask(() => em.emit(host));
    return client;
  }
}
