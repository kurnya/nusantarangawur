# Catatan keputusan

- **F0** Vite 8, TypeScript 6, Vitest 5, ESLint 10 (flat config) — versi terbaru saat setup. Three dikunci `0.128.0` (+ `@types/three@0.128.0`) sesuai brief.
- **F0** `build.assetsDir = 'bundle'` agar JS/CSS hasil build tidak bercampur dengan folder `public/assets/`.
- **F0** `tsconfig` pakai `noUncheckedIndexedAccess` agar akses array aman.
- **F0** Playwright, PeerJS, zod belum dipasang; dipasang saat fase yang memakainya (4/5).
- **F0** Git Bash Windows mengubah nilai env berawalan `/`; gunakan `MSYS_NO_PATHCONV=1` saat uji `VITE_BASE` lokal.
- **F1** Data statis diekstrak dari prototipe oleh `scripts/extract-data.mjs` (menjalankan kode data prototipe apa adanya) ke `src/engine/data/*.json`. Kunci animasi kartu (`fx`) dihitung dari `FXMAP` prototipe dan disimpan di tiap kartu. Jalankan ulang skrip jika prototipe berubah.
- **F1** Satu intent = satu hasil atomik. Mesin tidak menunggu "Terima nasib" (modal): kartu langsung diterapkan dan `CardDrawn` + `BencanaFx` dikirim sebagai events; tampilan yang menahan modal/animasi. Ini perlu agar Host tidak menunggu klik pemain.
- **F1** `owners` berupa array sepanjang 244 petak (bukan objek) supaya hash dan snapshot stabil.
- **F1** Niat: `roll`, `buy`, `build`, `endTurn`, `payJail` (pemain, `pid` ditimpa Host sesuai koneksi) dan `weather`, `endGame` (sistem; Host wajib menolaknya dari client).
- **F1** `roll` juga sah di fase `act` jika `dbl>0` dan tidak di penjara (kembar: lempar lagi). `endTurn` sah di fase `act` walau `dbl>0` (dipakai untuk batas waktu giliran; prototipe menyembunyikan tombolnya).
- **F1** `build` sah di fase `roll` maupun `act` (sama dengan prototipe, bangun lewat klik petak).
- **F1** Cuaca awal dipilih berbobot dari semua 7 jenis. (Prototipe tak sengaja menyingkirkan "Cerah" karena memilih "bukan Cerah" saat mulai.) Pergantian berikutnya tidak pernah sama dengan sebelumnya.
- **F1** Selang waktu cuaca (90 dtk-5 mnt) hanya konstanta + `nextWeatherDelayMs()`; timernya milik Host (fase 4/5), bukan mesin.
- **F1** Mesin menerima 2-8 pemain (tes memakai 2); batas 3-8 untuk lobi ada di `config.ts` (`MIN_PLAYERS`/`MAX_PLAYERS`) dan dipakai lapisan jaringan.
- **F1** Efek kartu `each` (bayar semua pemain) ada di prototipe tapi tidak dipakai kartu mana pun, jadi tidak diportir.
- **F1** Tes Vitest dijalankan lewat PowerShell; di Git Bash Windows vitest sempat gagal dengan `Cannot read properties of undefined (reading 'config')` (penyebab belum diketahui, hanya terjadi di shell itu; `--pool=vmThreads` juga lolos).
