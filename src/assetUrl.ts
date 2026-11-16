/** Semua path aset relatif terhadap base (aman di sub-path GitHub Pages). */
export function assetUrl(path: string, base: string = import.meta.env.BASE_URL): string {
  const b = base.endsWith('/') ? base : base + '/';
  return `${b}assets/${path.replace(/^\/+/, '')}`;
}
