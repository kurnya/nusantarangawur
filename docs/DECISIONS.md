# Catatan keputusan

- **F0** Vite 8, TypeScript 6, Vitest 5, ESLint 10 (flat config) — versi terbaru saat setup. Three dikunci `0.128.0` (+ `@types/three@0.128.0`) sesuai brief.
- **F0** `build.assetsDir = 'bundle'` agar JS/CSS hasil build tidak bercampur dengan folder `public/assets/`.
- **F0** `tsconfig` pakai `noUncheckedIndexedAccess` agar akses array aman.
- **F0** Playwright, PeerJS, zod belum dipasang; dipasang saat fase yang memakainya (4/5).
- **F0** Git Bash Windows mengubah nilai env berawalan `/`; gunakan `MSYS_NO_PATHCONV=1` saat uji `VITE_BASE` lokal.
