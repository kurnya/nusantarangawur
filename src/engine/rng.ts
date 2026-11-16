/** RNG ber-seed (mulberry32). Statenya satu angka 32-bit yang ikut disimpan di GameState. */
export class Rng {
  constructor(public state: number) {}

  /** float di [0,1) */
  float(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** integer di [0,n) */
  int(n: number): number {
    return Math.floor(this.float() * n);
  }
  /** dadu 1..6 */
  d6(): number {
    return 1 + this.int(6);
  }
  pick<T>(a: readonly T[]): T {
    return a[this.int(a.length)] as T;
  }
}
