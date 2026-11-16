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

Fase 0 (fondasi) dan Fase 1 (mesin murni, `src/engine/`) selesai. Berikutnya: Fase 2 (tampilan 3D).

## Masalah diketahui / langkah berikut

- Atlas kota huruf D, F, J belum ada (fallback bersih dibuat di fase 2).
