/**
 * Resep alam khas tiap provinsi (selain Aceh yang punya pembangun sendiri di aceh.ts).
 * `z` = bagian provinsi sebagai pecahan 0..1 sepanjang jalur; `s`: o = laut, i = darat.
 */
import type { Item } from './species';

const G1 = 0x5d9b40;
const G2 = 0x6aa046;
const DRY1 = 0xb8a85a;
const DRY2 = 0xc9b866;
const SAND1 = 0xe2d3a0;
const SAND2 = 0xe8dcae;

export const RECIPES: Record<string, Item[]> = {
  // Sumatera Utara: Danau Toba, Sibayak, jeruk Berastagi, Teluk Tapian Nauli
  SUT: [
    { f: 'ground', c: G1, c2: G2 },
    { f: 'grass', n: 80 },
    { f: 'sawit', z: [0, 0.28], n: 30, s: 'i' },
    { f: 'rain', z: [0, 0.3], n: 12, s: 'o' },
    { f: 'lake', k: 1, z: [0.24, 0.56], s: 'i', c: 0x2f78b8, c2: 0x1f5a98 },
    { f: 'pine', z: [0.28, 0.6], n: 26, s: 'o' },
    { f: 'volcano', k: 1, z: [0.58, 0.82], s: 'i' },
    { f: 'orchard', z: [0.6, 0.85], s: 'i', c: 0xf08a1e },
    { f: 'beach', z: [0.78, 1] },
    { f: 'coco', z: [0.78, 1], s: 'o', n: 20 },
    { f: 'seastack', z: [0.82, 1], n: 5 },
  ],
  // Sumatera Barat: Ngarai Sianok, Marapi, sawah berundak, tambang Sawahlunto
  SMB: [
    { f: 'ground', c: G1, c2: G2 },
    { f: 'grass', n: 80 },
    { f: 'beach', z: [0, 0.2] },
    { f: 'coco', z: [0, 0.25], s: 'o', n: 20 },
    { f: 'casuarina', z: [0, 0.22], n: 12 },
    { f: 'cliff', z: [0.25, 0.42], s: 'i', c: 0x9a8a6a, c2: 0xc9b88a },
    { f: 'volcano', k: 1, z: [0.3, 0.55], s: 'i' },
    { f: 'terrace', z: [0.4, 0.7], s: 'i' },
    { f: 'bamboo', z: [0.4, 0.8], n: 14, s: 'o' },
    { f: 'minepit', z: [0.62, 0.85], s: 'i' },
    { f: 'rice', z: [0.78, 1], s: 'i' },
    { f: 'volcano', z: [0.8, 1], s: 'i' },
  ],
  // Riau: gambut, sawit, sungai Siak, bakau pesisir
  RIA: [
    { f: 'ground', c: 0x4f8a3a, c2: 0x5a9540 },
    { f: 'grass', n: 70 },
    { f: 'swamp', n: 8, s: 'i' },
    { f: 'sawit', z: [0, 0.55], n: 40, k: 1, s: 'i' },
    { f: 'river', z: [0.25, 0.75], s: 'i', c: 0x8a6f4a },
    { f: 'mangrove', z: [0.55, 1], n: 18 },
    { f: 'coco', z: [0.7, 1], s: 'o', n: 16 },
  ],
  // Kepulauan Riau: pulau granit, pasir putih, laguna biru, penyu
  KEP: [
    { f: 'ground', c: SAND1, c2: SAND2 },
    { f: 'beach', c: 0xf6efd8 },
    { f: 'granite', n: 10 },
    { f: 'reef', n: 30 },
    { f: 'coco', n: 34, s: 'b' },
    { f: 'turtle', n: 4 },
    { f: 'grass', n: 40, c: 0x6aa046 },
  ],
  // Jambi: teh Kayu Aro, Gunung Kerinci, Bukit Duabelas, Batanghari
  JAM: [
    { f: 'ground', c: G1, c2: G2 },
    { f: 'grass', n: 80 },
    { f: 'sawit', z: [0, 0.25], n: 24, s: 'i' },
    { f: 'river', z: [0, 0.4], s: 'i', c: 0x8a6f4a },
    { f: 'tea', z: [0.25, 0.58], s: 'i' },
    { f: 'volcano', k: 1, z: [0.35, 0.7], s: 'i', h: 1.15 },
    { f: 'rain', z: [0.6, 1], n: 34 },
    { f: 'mist', z: [0.3, 0.7], n: 6 },
  ],
  // Sumatera Selatan: Musi, Gunung Dempo, nanas, megalit Pasemah
  SSL: [
    { f: 'ground', c: G1, c2: G2 },
    { f: 'grass', n: 80 },
    { f: 'river', z: [0, 0.4], s: 'i', h: 1.3, c: 0x8a6f4a },
    { f: 'volcano', z: [0.3, 0.6], s: 'i', k: 1 },
    { f: 'tea', z: [0.38, 0.62], s: 'i' },
    { f: 'pineapple', z: [0.5, 0.75], s: 'i' },
    { f: 'megalith', z: [0.75, 1], n: 3 },
    { f: 'rice', z: [0.72, 1], s: 'i' },
    { f: 'rain', z: [0.4, 0.8], n: 14, s: 'o' },
  ],
  // Bangka Belitung: batu granit raksasa, kolong timah biru, pantai pasir putih
  BBL: [
    { f: 'ground', c: SAND1, c2: 0xd8c690 },
    { f: 'beach', c: 0xf8f2e0 },
    { f: 'granite', n: 18, h: 1.15 },
    { f: 'minepit', z: [0.15, 0.7], c: 0xc9b88a, c2: 0x3fb6c9 },
    { f: 'coco', n: 28, s: 'b' },
    { f: 'grass', n: 50 },
  ],
  // Bengkulu: Rafflesia, Gunung Kaba, pantai barat
  BKL: [
    { f: 'ground', c: G1, c2: G2 },
    { f: 'grass', n: 80 },
    { f: 'rain', z: [0, 0.5], n: 28 },
    { f: 'rafflesia', z: [0.15, 0.5], n: 10 },
    { f: 'volcano', k: 1, z: [0.4, 0.7], s: 'i' },
    { f: 'beach', z: [0.6, 1] },
    { f: 'coco', z: [0.6, 1], s: 'o', n: 22 },
    { f: 'casuarina', z: [0.65, 1], n: 12 },
  ],
  // Lampung: Way Kambas (gajah), kopi, ombak Krui, Pahawang
  LPG: [
    { f: 'ground', c: G1, c2: G2 },
    { f: 'grass', n: 90 },
    { f: 'coffee', z: [0, 0.3], s: 'i' },
    { f: 'elephant', z: [0.45, 0.8], n: 6 },
    { f: 'rain', z: [0.4, 0.85], n: 24 },
    { f: 'beach', z: [0.7, 1] },
    { f: 'coco', z: [0.7, 1], s: 'o', n: 18 },
    { f: 'reef', z: [0.8, 1], n: 24 },
  ],
  // Banten: Krakatau, Baduy (bambu), pantai Anyer
  BTN: [
    { f: 'ground', c: G1, c2: G2 },
    { f: 'grass', n: 80 },
    { f: 'rice', z: [0, 0.4], s: 'i' },
    { f: 'beach', z: [0.15, 0.5] },
    { f: 'coco', z: [0.15, 0.5], s: 'o', n: 18 },
    { f: 'volcano', k: 1, z: [0.55, 0.95], s: 'o', v: [720, 790], h: 1.2 },
    { f: 'bamboo', z: [0.65, 1], n: 28, s: 'i' },
    { f: 'banana', z: [0.65, 1], n: 16, s: 'i' },
    { f: 'rain', z: [0.7, 1], n: 20, s: 'o' },
  ],
  // DKI Jakarta: taman kota, pohon rindang, mangrove utara, tepi laut
  DKI: [
    { f: 'ground', c: 0x8aa078, c2: 0x7a9068 },
    { f: 'acacia', n: 30, s: 'b', c: 0x4f9a40, c2: 0x8ccc60 },
    { f: 'flowers', n: 90 },
    { f: 'grass', n: 70 },
    { f: 'mangrove', z: [0.1, 0.35], n: 12 },
    { f: 'coco', z: [0.3, 0.7], n: 16, s: 'o' },
    { f: 'lake', z: [0.6, 0.85], s: 'i', h: 0.5, c: 0x4a9ac4 },
  ],
  // Jawa Barat: teh Puncak, Tangkuban Parahu, Kebun Raya Bogor, sawah Cianjur, Pangandaran
  JBR: [
    { f: 'ground', c: G1, c2: G2 },
    { f: 'grass', n: 80 },
    { f: 'tea', z: [0.08, 0.4], s: 'i' },
    { f: 'volcano', k: 1, z: [0.1, 0.45], s: 'i' },
    { f: 'rain', z: [0.35, 0.62], n: 30, s: 'o' },
    { f: 'terrace', z: [0.55, 0.8], s: 'i' },
    { f: 'beach', z: [0.8, 1] },
    { f: 'coco', z: [0.8, 1], s: 'o', n: 16 },
    { f: 'seastack', z: [0.82, 1], n: 4 },
  ],
  // Jawa Tengah: Dieng, Merapi-Merbabu, sawah, jati Jepara
  JTG: [
    { f: 'ground', c: G1, c2: G2 },
    { f: 'grass', n: 80 },
    { f: 'rice', z: [0, 0.35], s: 'i' },
    { f: 'volcano', z: [0.25, 0.5], s: 'i' },
    { f: 'cypress', z: [0.55, 0.88], n: 34, s: 'b' },
    { f: 'lake', z: [0.62, 0.8], s: 'i', h: 0.55, c: 0x35c4a8, c2: 0x2a9aa0 },
    { f: 'corn', z: [0.55, 0.85], s: 'o', c: 0x7a9a3a },
    { f: 'mist', z: [0.55, 0.9], n: 6 },
    { f: 'jati', z: [0.82, 1], n: 28 },
  ],
  // DI Yogyakarta: Merapi, gumuk pasir Parangtritis, perbukitan karst Gunungkidul
  DIY: [
    { f: 'ground', c: G1, c2: G2 },
    { f: 'grass', n: 70 },
    { f: 'rice', z: [0, 0.4], s: 'i' },
    { f: 'volcano', k: 1, z: [0.05, 0.4], s: 'i', h: 1.15 },
    { f: 'ground', z: [0.38, 0.7], s: 'o', c: 0xe0cd96, c2: 0xd8c38a },
    { f: 'beach', z: [0.4, 0.7], c: 0xe8d6a0 },
    { f: 'karst', z: [0.55, 0.88], n: 16, h: 0.55, s: 'i' },
    { f: 'coco', z: [0.7, 1], s: 'o', n: 14 },
  ],
  // Jawa Timur: Bromo, Ijen, apel Malang, sapi Madura
  JTM: [
    { f: 'ground', c: G1, c2: G2 },
    { f: 'grass', n: 70 },
    { f: 'orchard', z: [0, 0.28], s: 'i', c: 0xd0302a },
    { f: 'ground', z: [0.3, 0.58], s: 'i', c: 0xb9a97c, c2: 0xc9b88a },
    { f: 'volcano', k: 1, z: [0.3, 0.56], s: 'i', c: 0x6a6a5a, c2: 0x8a8070 },
    { f: 'volcano', k: 1, z: [0.6, 0.85], s: 'i', c: 0x4a6a3a },
    { f: 'lake', z: [0.62, 0.84], s: 'i', h: 0.4, c: 0x35d0c0, c2: 0x2ab0a8 },
    { f: 'lontar', z: [0.82, 1], n: 14, s: 'b' },
    { f: 'cow', z: [0.82, 1], n: 8 },
  ],
  // Bali: sawah berundak, Tebing Kelingking, Gunung Batur-Agung, kamboja
  BAL: [
    { f: 'ground', c: G1, c2: G2 },
    { f: 'flowers', n: 70, c: 0xffffff },
    { f: 'coco', n: 26, s: 'b' },
    { f: 'terrace', z: [0.2, 0.55], s: 'i' },
    { f: 'beach', z: [0.35, 0.62] },
    { f: 'volcano', k: 1, z: [0.58, 0.85], s: 'i' },
    { f: 'cliff', z: [0.82, 1], s: 'o' },
    { f: 'reef', z: [0.4, 0.6], n: 14 },
  ],
  // NTB: Rinjani, Gili (penyu), savana Sumbawa dan kuda
  NTB: [
    { f: 'ground', c: G1, c2: G2 },
    { f: 'grass', n: 70 },
    { f: 'volcano', k: 1, z: [0.18, 0.5], s: 'i', h: 1.3 },
    { f: 'lake', z: [0.22, 0.48], s: 'i', h: 0.45, c: 0x3a8ac0, c2: 0x2a6aa0 },
    { f: 'beach', z: [0.45, 0.72] },
    { f: 'reef', z: [0.45, 0.72], n: 34 },
    { f: 'turtle', z: [0.45, 0.72], n: 5 },
    { f: 'coco', z: [0.45, 0.72], s: 'o', n: 16 },
    { f: 'ground', z: [0.72, 1], c: DRY1, c2: DRY2 },
    { f: 'acacia', z: [0.72, 1], n: 12, c: 0x8a9a3a, c2: 0xb4b85a },
    { f: 'horse', z: [0.72, 1], n: 6 },
    { f: 'grass', z: [0.72, 1], n: 90, c: 0xb8a85a, c2: 0xc9b866 },
  ],
  // NTT: savana kering, komodo, lontar, tiga warna Kelimutu, pantai merah muda
  NTT: [
    { f: 'ground', c: DRY1, c2: DRY2 },
    { f: 'grass', n: 150, c: 0xb8a85a, c2: 0xc9b866 },
    { f: 'komodo', z: [0.05, 0.4], n: 6 },
    { f: 'lontar', n: 26, s: 'b' },
    { f: 'acacia', n: 12, c: 0x8a9a3a, c2: 0xb4b85a },
    { f: 'trilake', z: [0.4, 0.66], s: 'i' },
    { f: 'beach', z: [0.7, 0.92], c: 0xf0c0b8 },
    { f: 'reef', z: [0.7, 0.92], n: 20 },
    { f: 'horse', z: [0.8, 1], n: 6 },
  ],
  // Kalimantan Barat: Kapuas, orangutan, Danau Sentarum, hutan hujan
  KBR: [
    { f: 'ground', c: 0x4f8a3a, c2: 0x5a9540 },
    { f: 'grass', n: 70 },
    { f: 'river', z: [0, 0.5], s: 'i', h: 1.5, c: 0x8a6f4a },
    { f: 'rain', z: [0.2, 1], n: 40 },
    { f: 'orangutan', z: [0.4, 0.72], n: 5 },
    { f: 'lake', z: [0.7, 1], s: 'i', c: 0x4a7a6a, c2: 0x3a6a5a },
    { f: 'swamp', z: [0.7, 1], n: 8, s: 'o' },
  ],
  // Kalimantan Tengah: gambut, Tanjung Puting, sungai, tambang batu bara
  KTG: [
    { f: 'ground', c: 0x4f8a3a, c2: 0x5a9540 },
    { f: 'grass', n: 70 },
    { f: 'swamp', z: [0, 0.5], n: 10, s: 'i' },
    { f: 'rain', z: [0, 0.65], n: 36 },
    { f: 'river', z: [0.3, 0.8], s: 'i', h: 1.3, c: 0x6a5a3a, c2: 0x6a4a2a },
    { f: 'orangutan', z: [0.4, 0.8], n: 5 },
    { f: 'minepit', z: [0.8, 1], s: 'i', c: 0x4a4a48, c2: 0x2a7f95 },
  ],
  // Kalimantan Selatan: pasar terapung, Meratus, bakau
  KSL: [
    { f: 'ground', c: 0x4f8a3a, c2: 0x5a9540 },
    { f: 'grass', n: 70 },
    { f: 'river', z: [0, 0.38], s: 'i', h: 1.7, c: 0x8a6f4a, c2: 0xc98a3a },
    { f: 'hills', z: [0.35, 0.72], n: 8, s: 'i' },
    { f: 'rain', z: [0.4, 0.75], n: 28 },
    { f: 'mangrove', z: [0.72, 1], n: 16 },
    { f: 'beach', z: [0.75, 1] },
    { f: 'coco', z: [0.75, 1], s: 'o', n: 14 },
  ],
  // Kalimantan Timur: Mahakam, tambang batu bara, bakau Bontang, hutan IKN
  KTM: [
    { f: 'ground', c: 0x4f8a3a, c2: 0x5a9540 },
    { f: 'grass', n: 70 },
    { f: 'river', z: [0, 0.55], s: 'i', h: 1.4 },
    { f: 'minepit', z: [0.25, 0.5], s: 'i', c: 0x4a4a48, c2: 0x2a7f95 },
    { f: 'mangrove', z: [0.5, 0.82], n: 18 },
    { f: 'rain', z: [0.6, 1], n: 36 },
    { f: 'hills', z: [0.65, 1], n: 6, s: 'i' },
  ],
  // Kalimantan Utara: Kayan Mentarang, bakau Tarakan, kabut hutan
  KTR: [
    { f: 'ground', c: 0x3f7a35, c2: 0x4a8a3a },
    { f: 'grass', n: 60 },
    { f: 'rain', n: 50 },
    { f: 'mangrove', z: [0, 0.42], n: 22 },
    { f: 'river', z: [0.4, 0.9], s: 'i', h: 1.2 },
    { f: 'hills', z: [0.5, 1], n: 8, s: 'i' },
    { f: 'mist', z: [0.45, 1], n: 8 },
  ],
  // Sulawesi Utara: Bunaken, Tomohon (bunga), Lokon, Danau Tondano
  SLU: [
    { f: 'ground', c: G1, c2: G2 },
    { f: 'beach', z: [0, 0.35] },
    { f: 'reef', z: [0, 0.38], n: 40 },
    { f: 'coco', z: [0, 0.38], s: 'o', n: 28 },
    { f: 'volcano', k: 1, z: [0.4, 0.7], s: 'i' },
    { f: 'flowers', z: [0.42, 0.72], n: 130 },
    { f: 'lake', z: [0.7, 0.92], s: 'i', h: 0.6, c: 0x3a94c4 },
    { f: 'rain', z: [0.65, 1], n: 20, s: 'o' },
  ],
  // Gorontalo: Danau Limboto, air panas, kebun kelapa, hiu paus
  GRT: [
    { f: 'ground', c: G1, c2: G2 },
    { f: 'grass', n: 70 },
    { f: 'reef', z: [0, 0.2], n: 20 },
    { f: 'lake', z: [0.2, 0.5], s: 'i', h: 0.8, c: 0x4a94b4 },
    { f: 'hotspring', z: [0.5, 0.72], n: 3 },
    { f: 'coco', z: [0.65, 1], n: 40, s: 'b' },
    { f: 'beach', z: [0.8, 1] },
  ],
  // Sulawesi Tengah: Teluk Palu, Danau Poso, Togean, Banggai
  STG: [
    { f: 'ground', c: G1, c2: G2 },
    { f: 'grass', n: 70 },
    { f: 'cliff', z: [0.05, 0.25], s: 'o', c: 0xa88a5a, c2: 0xd2b87e },
    { f: 'lake', z: [0.35, 0.62], s: 'i', c: 0x2f84b8, c2: 0x2a68a0 },
    { f: 'pine', z: [0.35, 0.65], n: 20, s: 'o' },
    { f: 'beach', z: [0.62, 1] },
    { f: 'reef', z: [0.62, 0.95], n: 36 },
    { f: 'coco', z: [0.62, 1], s: 'o', n: 22 },
    { f: 'karst', z: [0.7, 1], n: 6, k: 1, s: 'o' },
  ],
  // Sulawesi Barat: pantai Mamuju, sandeq, Mamasa, sawit Pasangkayu
  SLB: [
    { f: 'ground', c: G1, c2: G2 },
    { f: 'grass', n: 70 },
    { f: 'beach', z: [0, 0.4] },
    { f: 'coco', z: [0, 0.4], s: 'o', n: 20 },
    { f: 'boat', z: [0.1, 0.4], n: 4 },
    { f: 'terrace', z: [0.4, 0.66], s: 'i' },
    { f: 'pine', z: [0.4, 0.68], n: 20, s: 'o' },
    { f: 'sawit', z: [0.66, 1], n: 48, k: 1, s: 'i' },
  ],
  // Sulawesi Selatan: karst Maros, kupu-kupu, Toraja, pinisi Bulukumba
  SLS: [
    { f: 'ground', c: G1, c2: G2 },
    { f: 'grass', n: 70 },
    { f: 'rice', z: [0, 0.2], s: 'i' },
    { f: 'karst', z: [0.18, 0.52], n: 16, s: 'i' },
    { f: 'butterflies', z: [0.18, 0.52], n: 40 },
    { f: 'terrace', z: [0.45, 0.76], s: 'i' },
    { f: 'beach', z: [0.7, 1] },
    { f: 'pinisi', z: [0.72, 1], n: 4 },
    { f: 'coco', z: [0.72, 1], s: 'o', n: 16 },
  ],
  // Sulawesi Tenggara: Wakatobi, tambang nikel, hutan jati Muna
  STR: [
    { f: 'ground', c: G1, c2: G2 },
    { f: 'grass', n: 70 },
    { f: 'mangrove', z: [0, 0.2], n: 14 },
    { f: 'beach', z: [0.2, 0.52] },
    { f: 'reef', z: [0.2, 0.55], n: 44 },
    { f: 'turtle', z: [0.2, 0.55], n: 4 },
    { f: 'minepit', z: [0.52, 0.76], s: 'i', c: 0xb0603a, c2: 0x6a3a22 },
    { f: 'jati', z: [0.72, 1], n: 30 },
    { f: 'karst', z: [0.78, 1], n: 6, s: 'i', h: 0.6 },
  ],
  // Maluku: pala dan cengkih, Gunung Api Banda, pantai pasir panjang, kayu putih
  MLK: [
    { f: 'ground', c: G1, c2: G2 },
    { f: 'grass', n: 70 },
    { f: 'volcano', k: 1, z: [0, 0.3], s: 'o', v: [720, 790], h: 1.1 },
    { f: 'spice', z: [0.1, 0.6], n: 36, k: 1, c: 0x2a6a38 },
    { f: 'spice', z: [0.4, 1], n: 30 },
    { f: 'beach', z: [0.45, 0.8] },
    { f: 'reef', z: [0.45, 0.8], n: 24 },
    { f: 'coco', z: [0.45, 0.8], s: 'o', n: 20 },
    { f: 'eucal', z: [0.8, 1], n: 26 },
  ],
  // Maluku Utara: Gamalama, Tidore, cengkih, pantai Morotai
  MLU: [
    { f: 'ground', c: G1, c2: G2 },
    { f: 'grass', n: 70 },
    { f: 'volcano', k: 1, z: [0.05, 0.42], s: 'i', h: 1.25 },
    { f: 'spice', z: [0.1, 0.65], n: 40 },
    { f: 'volcano', z: [0.4, 0.7], s: 'o', v: [720, 790] },
    { f: 'beach', z: [0.6, 1] },
    { f: 'coco', z: [0.6, 1], s: 'o', n: 22 },
    { f: 'reef', z: [0.7, 1], n: 24 },
  ],
  // Papua: Pegunungan Cycloop, Danau Sentani, hutan, pantai Biak
  PPA: [
    { f: 'ground', c: 0x4f8a3a, c2: 0x5a9540 },
    { f: 'grass', n: 70 },
    { f: 'peak', z: [0.08, 0.4], n: 2, c: 0x4d6f3d, c2: 0x8aa070 },
    { f: 'lake', z: [0.4, 0.68], s: 'i', k: 1, c: 0x3a90bc },
    { f: 'rain', z: [0.55, 1], n: 40 },
    { f: 'beach', z: [0.75, 1] },
    { f: 'reef', z: [0.75, 1], n: 28 },
    { f: 'coco', z: [0.75, 1], s: 'o', n: 16 },
  ],
  // Papua Barat: bakau Bintuni, pala Fakfak, Pegunungan Arfak, senja Kaimana
  PPB: [
    { f: 'ground', c: 0x4f8a3a, c2: 0x5a9540 },
    { f: 'grass', n: 70 },
    { f: 'mangrove', z: [0, 0.32], n: 26 },
    { f: 'spice', z: [0.3, 0.58], n: 30, k: 1 },
    { f: 'peak', z: [0.58, 0.92], n: 2, c: 0x4d6f3d, c2: 0x8aa070 },
    { f: 'mist', z: [0.58, 0.92], n: 6 },
    { f: 'beach', z: [0.7, 1] },
    { f: 'coco', z: [0.7, 1], s: 'o', n: 18 },
  ],
  // Papua Barat Daya: Raja Ampat (karst jamur), Wayag, Misool, penyu
  PBD: [
    { f: 'ground', c: SAND1, c2: SAND2 },
    { f: 'karst', k: 1, n: 26, h: 1.1 },
    { f: 'reef', n: 44 },
    { f: 'turtle', n: 6 },
    { f: 'beach', c: 0xf8f2e0 },
    { f: 'coco', n: 20, s: 'b' },
    { f: 'rain', n: 14, s: 'i' },
  ],
  // Papua Tengah: Puncak Jaya bersalju, tambang Grasberg, Danau Paniai
  PPT: [
    { f: 'ground', c: 0x4f8a3a, c2: 0x5a9540 },
    { f: 'grass', n: 60 },
    { f: 'peak', z: [0.08, 0.42], n: 3 },
    { f: 'mist', z: [0.1, 0.5], n: 8 },
    { f: 'minepit', z: [0.45, 0.66], s: 'i', c: 0x8a8a88, c2: 0x6aa0b0 },
    { f: 'lake', z: [0.7, 0.9], s: 'i', c: 0x3a8ab8 },
    { f: 'rain', z: [0, 1], n: 30, s: 'o' },
  ],
  // Papua Pegunungan: Lembah Baliem, honai, kebun ubi, sungai
  PPG: [
    { f: 'ground', c: 0x5aa045, c2: 0x68ac4a },
    { f: 'grass', n: 90 },
    { f: 'honai', n: 12 },
    { f: 'hills', n: 8, s: 'i' },
    { f: 'peak', z: [0.5, 1], n: 2, c: 0x4d6f3d, c2: 0x9aa890 },
    { f: 'river', z: [0.2, 0.7], s: 'i', c: 0x7a8a6a },
    { f: 'flowers', n: 50 },
    { f: 'mist', n: 8 },
  ],
  // Papua Selatan: Wasur (sarang rayap), rawa Mappi, kayu putih, bakau Asmat
  PPS: [
    { f: 'ground', c: 0x9aa850, c2: 0xa8b058 },
    { f: 'grass', n: 140, c: 0xb8a85a, c2: 0xc9b866 },
    { f: 'termite', z: [0.05, 0.9], n: 24 },
    { f: 'swamp', n: 12, s: 'i' },
    { f: 'eucal', z: [0.1, 0.9], n: 30, s: 'b' },
    { f: 'acacia', z: [0, 0.5], n: 8, c: 0x8a9a3a, c2: 0xb4b85a },
    { f: 'mangrove', z: [0.7, 1], n: 18 },
  ],
};
