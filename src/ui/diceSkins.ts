/** Pilihan dadu kosmetik. Warna dipasang lewat variabel CSS pada `.cube.sk0..sk7` (lihat dice.css). */
export interface DiceSkin {
  name: string;
}

export const DICE_SKINS: readonly DiceSkin[] = [
  { name: 'Klasik' },
  { name: 'Obsidian' },
  { name: 'Batik Merah' },
  { name: 'Giok' },
  { name: 'Emas' },
  { name: 'Samudra' },
  { name: 'Kayu Jati' },
  { name: 'Neon' },
];

export const diceSkinName = (k: number): string => DICE_SKINS[k]?.name ?? DICE_SKINS[0]!.name;

/** API pemilihan dadu yang disediakan main.ts (satu perangkat atau online). */
export interface DiceApi {
  skin(pid: number): number;
  pick(pid: number, k: number): void;
}
