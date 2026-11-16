/** Batas dan pembersih nama pemain (tanpa dependensi, dipakai lobi dan layar awal). */
export const NAME_MAX = 14;

/** Buang karakter kontrol, rapikan spasi, potong ke NAME_MAX. */
export function cleanName(s: string): string {
  const noCtl = [...s].filter((ch) => {
    const c = ch.charCodeAt(0);
    return c >= 32 && c !== 127;
  });
  return noCtl.join('').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
}
