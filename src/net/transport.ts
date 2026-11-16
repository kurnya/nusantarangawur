/**
 * Abstraksi transport supaya logika Host/Client bisa dites tanpa WebRTC.
 * Implementasi: memory.ts (tes dan loopback Host) dan peer.ts (PeerJS/WebRTC).
 */

/** Satu sambungan dua arah yang mengirim teks. */
export interface Link {
  send(data: string): void;
  close(): void;
  onMessage(cb: (data: string) => void): void;
  onClose(cb: () => void): void;
  /** jalur koneksi untuk layar diagnosis (opsional) */
  route?(): Promise<string | null>;
}

export interface HostEndpoint {
  onConnection(cb: (link: Link) => void): void;
  close(): void;
}

export interface Transport {
  /** Buka ruangan dengan kode tertentu. Gagal jika kode sudah dipakai. */
  host(code: string): Promise<HostEndpoint>;
  /** Sambung ke ruangan. */
  join(code: string): Promise<Link>;
}

/** Kumpulan pendengar sederhana. */
export class Emitter<T extends unknown[]> {
  private fns: ((...a: T) => void)[] = [];
  on(fn: (...a: T) => void): void {
    this.fns.push(fn);
  }
  emit(...a: T): void {
    for (const f of [...this.fns]) {
      try {
        f(...a);
      } catch (err) {
        console.error(err);
      }
    }
  }
}
