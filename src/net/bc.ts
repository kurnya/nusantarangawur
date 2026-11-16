/**
 * Transport antar tab dalam satu browser lewat BroadcastChannel. Untuk tes Playwright dan
 * pengembangan tanpa internet (`?net=tab`). Bukan untuk bermain antar perangkat.
 */
import { NetError } from './peer';
import { Emitter, type HostEndpoint, type Link, type Transport } from './transport';

type Frame =
  | { k: 'hello'; link: string }
  | { k: 'ok'; link: string }
  | { k: 'msg'; link: string; from: 'h' | 'c'; data: string }
  | { k: 'bye'; link: string; from: 'h' | 'c' }
  | { k: 'ping-host' }
  | { k: 'host-here' };

const chanName = (code: string) => `nn-room-${code}`;
const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

class BcLink implements Link {
  private readonly msg = new Emitter<[string]>();
  private readonly cls = new Emitter<[]>();
  closed = false;
  constructor(
    private readonly ch: BroadcastChannel,
    readonly id: string,
    private readonly side: 'h' | 'c',
  ) {}
  deliver(data: string): void {
    if (!this.closed) this.msg.emit(data);
  }
  remoteClosed(): void {
    if (this.closed) return;
    this.closed = true;
    this.cls.emit();
  }
  send(data: string): void {
    if (this.closed) return;
    this.ch.postMessage({ k: 'msg', link: this.id, from: this.side, data } satisfies Frame);
  }
  close(): void {
    if (this.closed) return;
    this.ch.postMessage({ k: 'bye', link: this.id, from: this.side } satisfies Frame);
    this.remoteClosed();
  }
  onMessage(cb: (data: string) => void): void {
    this.msg.on(cb);
  }
  onClose(cb: () => void): void {
    this.cls.on(cb);
  }
}

export class TabTransport implements Transport {
  async host(code: string): Promise<HostEndpoint> {
    const ch = new BroadcastChannel(chanName(code));
    const em = new Emitter<[Link]>();
    const links = new Map<string, BcLink>();
    ch.onmessage = (e: MessageEvent<Frame>) => {
      const f = e.data;
      if (f.k === 'ping-host') ch.postMessage({ k: 'host-here' } satisfies Frame);
      else if (f.k === 'hello') {
        const l = new BcLink(ch, f.link, 'h');
        links.set(f.link, l);
        ch.postMessage({ k: 'ok', link: f.link } satisfies Frame);
        em.emit(l);
      } else if (f.k === 'msg' && f.from === 'c') links.get(f.link)?.deliver(f.data);
      else if (f.k === 'bye' && f.from === 'c') {
        links.get(f.link)?.remoteClosed();
        links.delete(f.link);
      }
    };
    window.addEventListener('pagehide', () => links.forEach((l) => l.close()));
    return {
      onConnection: (cb) => em.on(cb),
      close: () => {
        links.forEach((l) => l.close());
        ch.close();
      },
    };
  }

  join(code: string): Promise<Link> {
    return new Promise((resolve, reject) => {
      const ch = new BroadcastChannel(chanName(code));
      const id = rid();
      let link: BcLink | null = null;
      const timer = setTimeout(() => {
        ch.close();
        reject(new NetError('Ruangan tidak ditemukan di tab lain.', 'notfound'));
      }, 3000);
      ch.onmessage = (e: MessageEvent<Frame>) => {
        const f = e.data;
        if (f.k === 'ok' && f.link === id && !link) {
          clearTimeout(timer);
          link = new BcLink(ch, id, 'c');
          window.addEventListener('pagehide', () => link?.close());
          resolve(link);
        } else if (link && f.k === 'msg' && f.link === id && f.from === 'h') link.deliver(f.data);
        else if (link && f.k === 'bye' && f.link === id && f.from === 'h') {
          link.remoteClosed();
          ch.close();
        }
      };
      ch.postMessage({ k: 'hello', link: id } satisfies Frame);
    });
  }
}
