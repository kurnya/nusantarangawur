import { assetUrl } from '../assetUrl';
import { PROV } from '../engine/board';
import { MANIFEST, cityIcon, cityInitials, provColor } from '../view/util';

export function $(sel: string): HTMLElement {
  const e = document.querySelector<HTMLElement>(sel);
  if (!e) throw new Error(`elemen tidak ada: ${sel}`);
  return e;
}

/** Escape teks untuk dimasukkan ke innerHTML (mencegah XSS lewat nama pemain). */
export const esc = (s: unknown): string =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );

/** Buat elemen. `html` harus markup tepercaya (sudah di-escape). */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  html?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

export const sleep = (ms: number, fast: boolean) =>
  new Promise<void>((r) => setTimeout(r, fast ? 0 : ms));

/** Gambar bidak (karakter 0..15). */
export const tkImg = (pawn: number) =>
  `<img class="tkimg" alt="" src="${assetUrl(`ppl/p${pawn}.webp`)}">`;

/** Ikon petak khusus. */
export function spImg(k: string, px: number): string {
  const i = MANIFEST.specIdx[k];
  return i == null
    ? ''
    : `<img class="si" alt="" style="height:${px}px" src="${assetUrl(`spec/k${i}.webp`)}">`;
}

/** Ikon kota dari atlas; cadangan: inisial dalam lingkaran berwarna provinsi. */
export function ciImg(code: string, ci: number, px: number): string {
  const ic = cityIcon(code, ci);
  const pr = PROV[code];
  if (!ic) {
    const name = pr?.cities[ci]?.n ?? '?';
    const col = pr ? provColor(pr.hue) : '#888';
    return `<span class="cinit" style="width:${px}px;height:${px}px;font-size:${Math.round(px * 0.42)}px;--ic:${col}">${esc(cityInitials(name))}</span>`;
  }
  const url = assetUrl(`cities/c${ic.L}.webp`);
  return `<span class="ci" style="width:${px}px;height:${px}px;background-image:url(${url});background-position:${ic.col * 25}% ${(ic.row * 100) / 3}%"></span>`;
}
