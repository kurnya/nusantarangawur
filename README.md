# Nusantara Ngawur

Board game ala Monopoly bertema Indonesia. 3D di browser, multiplayer P2P (3-8 pemain), hosting GitHub Pages.
Spesifikasi lengkap: [docs/BRIEF.md](docs/BRIEF.md). Prototipe acuan: `reference/prototype/` (jangan diubah).

## Perintah

| Perintah            | Fungsi                       |
| ------------------- | ---------------------------- |
| `npm run dev`       | server pengembangan          |
| `npm run lint`      | ESLint                       |
| `npm run typecheck` | tsc strict                   |
| `npm test`          | Vitest                       |
| `npm run build`     | typecheck + build ke `dist/` |
| `npm run preview`   | cek hasil build              |

Uji sub-path Pages: `VITE_BASE=/nusantara-ngawur/ npm run build && npm run preview`
(di Git Bash Windows awali dengan `MSYS_NO_PATHCONV=1` agar path tidak diubah).

## Status

Fase 0 (fondasi), Fase 1 (mesin murni, `src/engine/`), Fase 2 (tampilan 3D + hot-seat), Fase 3 (HUD, POV, tampilan HP), Fase 4 (jaringan P2P), dan Fase 5 (multiplayer penuh 2 sampai 8 pemain: batas waktu giliran, diagnosis koneksi, kick) selesai. Berikutnya: Fase 6 (deploy). Cara main online dan uji lokal: [docs/MULTIPLAYER.md](docs/MULTIPLAYER.md).

## Masalah diketahui / langkah berikut

- Atlas kota huruf D, F, J belum ada; kota-kota itu tampil sebagai inisial (lihat docs/ASSETS.md).
- Parameter URL: `?fast=1` lewati animasi, `?low=1` kualitas rendah.
- Tes browser pertama kali butuh `npx playwright install chromium`.
