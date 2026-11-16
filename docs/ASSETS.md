# Aset

Semua aset gambar ada di `public/assets/` (WebP transparan) dan dimuat lewat `assetUrl()` sehingga aman di sub-path GitHub Pages. Metadata ukuran ada di [`src/view/assets-manifest.json`](../src/view/assets-manifest.json).

| Folder    | Isi                                                 | Nama file                              |
| --------- | --------------------------------------------------- | -------------------------------------- |
| `cities/` | atlas ikon kota, satu atlas per huruf grup provinsi | `c{HURUF}.webp`                        |
| `trees/`  | 12 pohon (quad billboard)                           | `t0.webp` … `t11.webp`                 |
| `ships/`  | 8 gambar kapal (cadangan; kapal 3D prosedural)      | `s0.webp` …                            |
| `spec/`   | ikon petak khusus                                   | `k0.webp` … (lihat `specIdx`)          |
| `ppl/`    | 8 bidak orang (UI HTML)                             | `p0.webp` … `p7.webp`                  |
| `fx/`     | 24 ikon efek animasi                                | `e0.webp` … `e23.webp` (lihat `fxIdx`) |
| `models/` | opsional, model GLB                                 | lihat di bawah                         |

## Atlas kota

- Provinsi diurutkan seperti `PORDER` (Aceh = 0 … Papua Selatan = 37). Grup huruf = `floor(indeks / 4)`: A = provinsi 0-3, B = 4-7, … J = 36-37.
- Satu atlas berukuran **1280 × 1024**: 5 kolom (kota ke-1..5) × 4 baris (provinsi ke-1..4 dalam grup), sel 256 × 256.
- Atlas yang sudah ada tercatat di `cityHave` pada manifest. **Saat ini D, F, dan J belum ada.**
- Jika atlas belum ada, kota ditampilkan sebagai **inisial dalam lingkaran berwarna provinsi** (di peta 3D dan UI). Tidak ada emoji di peta 3D.

### Menambah atlas baru

1. Buat gambar memakai prompt di `reference/prototype/prompt-aset.md`, susun 5 × 4 sel 256 px.
2. Simpan sebagai `public/assets/cities/c{HURUF}.webp` (contoh `cD.webp`).
3. Tambahkan hurufnya ke `cityHave` di `src/view/assets-manifest.json`.
4. Jalankan `npm run dev` dan periksa petak provinsi grup itu.

## Ikon efek (`fx/`)

`fxIdx` memetakan kunci (emoji, hanya sebagai pengenal) ke nomor gambar. Emoji tidak pernah digambar di peta 3D: jika kunci tidak punya gambar, sprite efeknya disembunyikan. `🏚️` dipetakan ke `e18` (genteng runtuh) untuk animasi gempa.

## Model 3D opsional (GLB)

Buat `public/assets/models/manifest.json`, contoh:

```json
{ "pawn0": "pawn0.glb", "ship3": "ship3.glb" }
```

- Kunci yang diterima: `pawn0`..`pawn7` (karakter bidak) dan `ship0`..`ship7` (jenis kapal). Kunci lain dan nama file berisi `..` diabaikan.
- Model otomatis diskalakan (bidak setinggi 104 unit, kapal sepanjang ukuran bawaannya), diletakkan di tanah, dan dipusatkan.
- Jika file gagal dimuat, model prosedural bawaan tetap dipakai.
- Tes: `tests/models.test.ts` memakai glTF sintetis.
