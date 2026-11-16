# PROMPT UNTUK CLAUDE AGENT (VS Code): Nusantara Ngawur, versi multiplayer P2P

Salin seluruh isi file ini sebagai pesan pertama ke Claude Code di VS Code, atau simpan sebagai `docs/BRIEF.md` lalu ketik:
"Baca docs/BRIEF.md sampai habis, lalu kerjakan fase demi fase."

---

## 0. Peran dan cara kerja

Kamu adalah engineer utama proyek **Nusantara Ngawur**: board game ala Monopoly bertema Indonesia, berjalan di browser, multiplayer **peer to peer** untuk 3 sampai 8 pemain, di-host gratis di **GitHub Pages**.

Aturan kerja yang wajib:

1. **Jangan pernah menjalankan `git push`, `git push --force`, atau perintah yang mengubah remote.** Pemilik proyek yang push manual. Kamu boleh `git init`, `git add`, dan `git commit` lokal dengan pesan commit ala Conventional Commits, satu commit per langkah yang jelas.
2. Kerjakan **per fase** (bagian 12). Selesaikan satu fase, jalankan verifikasinya, lalu tulis ringkasan singkat (apa yang selesai, apa yang belum, apa yang perlu keputusan pemilik). Jangan lompat fase.
3. Jika ada keputusan desain yang tidak tertulis di brief ini dan akibatnya besar (mengubah aturan permainan, mengganti teknologi), **tanyakan dulu**. Untuk hal kecil, ambil keputusan masuk akal dan catat di `docs/DECISIONS.md`.
4. Semua teks yang tampil ke pemain **berbahasa Indonesia**, bernada santai dan nyeleneh. Kode, nama variabel, dan komentar boleh bahasa Inggris atau Indonesia, tapi konsisten.
5. Jangan menulis emoji di peta 3D. Emoji di UI HTML boleh, tapi ikon utama memakai aset gambar (lihat bagian 9).
6. Sebelum menyatakan sesuatu "selesai", **jalankan** tes dan build, baca hasilnya, dan sebutkan hasilnya apa adanya. Jangan bilang berhasil kalau belum dijalankan.

---

## 1. Ringkasan produk

- Nama: **Nusantara Ngawur**. Tagline: "Sabang sampai Merauke".
- Papan berbentuk jalur berkelok yang mengelilingi sebuah pulau gunung berapi di tengah laut, tampil **3D** (Three.js), dalam nampan kayu.
- **38 provinsi**, tiap provinsi punya **5 kota** (190 kota). Pemain membeli kota, menguasai provinsi, membangun, lalu menagih sewa.
- Nada permainan: **nyeleneh**. Kartu Nasib 80% berisi kabar buruk, kartu Bencana selalu merugikan.
- **Multiplayer peer to peer**: 3 sampai 8 pemain, **1 pemain = 1 bidak = 1 browser**. Tidak ada server game milik kita.
- Hosting: **GitHub Pages** (situs statis). Tanpa backend, tanpa database.

Kamu sudah diberi **prototipe lokal (hot-seat, 1 perangkat)** di `reference/prototype/` (satu file `index.html` sekitar 2.200 baris plus folder `assets/`). Prototipe itu adalah **spesifikasi hidup**: semua aturan, data, tampilan, animasi, dan nuansa yang diinginkan ada di sana. Tugasmu bukan menulis ulang dari nol secara kreatif, tetapi **memecah prototipe itu menjadi proyek yang terstruktur, lalu menambahkan lapisan multiplayer P2P**. Jangan mengubah aturan atau tampilan kecuali diminta di brief ini.

---

## 2. Tumpukan teknologi (keputusan sudah diambil)

| Hal         | Pilihan                                                                                                                                                                                                        |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bahasa      | TypeScript (strict)                                                                                                                                                                                            |
| Build       | Vite, output statis di `dist/`                                                                                                                                                                                 |
| 3D          | Three.js dari npm. Prototipe memakai **r128 dari CDN**. Pindahkan ke paket npm dengan versi yang dikunci (`three@0.128.0` dulu supaya perilaku identik), baru naik versi di fase terakhir jika ada alasan kuat |
| P2P         | **PeerJS** (WebRTC data channel) memakai broker publik PeerJS untuk signaling                                                                                                                                  |
| Tes         | Vitest untuk mesin permainan, Playwright untuk tes browser                                                                                                                                                     |
| Lint/format | ESLint + Prettier                                                                                                                                                                                              |
| Hosting     | GitHub Pages lewat GitHub Actions (bagian 11)                                                                                                                                                                  |
| Aset        | WebP bertransparansi di `public/assets/`                                                                                                                                                                       |

Wajib: aplikasi harus berjalan benar di bawah sub-path GitHub Pages (`https://USERNAME.github.io/REPO/`). Atur `base` di `vite.config.ts` lewat variabel lingkungan, dan **semua path aset harus relatif terhadap base** (pakai `import.meta.env.BASE_URL`), jangan memakai path absolut `/assets/...`.

---

## 3. Arsitektur multiplayer (inti pekerjaan)

### 3.1 Model: host berwibawa (host-authoritative)

P2P murni tanpa server tetap butuh satu sumber kebenaran supaya tidak ada pemain yang curang atau state yang berselisih. Gunakan model ini:

- Pemain yang membuat ruangan menjadi **Host**. **Mesin permainan hanya berjalan di browser Host.**
- Pemain lain (**Client**) mengirim **niat (intent)**: "lempar dadu", "beli", "bangun", "akhiri giliran", "bayar denda penjara". Mereka tidak mengubah state sendiri.
- Host memvalidasi niat (apakah gilirannya, apakah fase benar, apakah uang cukup), menjalankan mesin, lalu **menyiarkan hasilnya** ke semua orang.
- **Dadu dan semua acak (kartu, cuaca, kejadian) dilempar oleh Host**, memakai RNG ber-seed yang disimpan di state. Client tidak pernah menghasilkan angka acak yang memengaruhi aturan.
- Host juga bermain sebagai salah satu pemain.

### 3.2 Pisahkan mesin dari tampilan

Buat paket murni **tanpa DOM dan tanpa Three.js** di `src/engine/`:

```
src/engine/
  types.ts        // GameState, Player, Tile, Card, Effect, Intent, GameEvent
  data/           // provinces.json, cards.json, tiles layout, weather table (diekstrak dari prototipe)
  rng.ts          // RNG ber-seed (mulberry32 atau sejenisnya), state RNG ikut disimpan
  rules.ts        // fungsi murni: rentFor, buildCost, cityPrice, assetValue, goodChance, ...
  engine.ts       // reduce(state, intent, rng) => { state, events }
  weather.ts      // pergantian cuaca, efek per cuaca
  bot.ts          // bot sederhana untuk tes otomatis
```

Mesin memakai pola `applyIntent(state, intent) -> { state, events[] }`. **`events` adalah daftar kejadian berurutan** (contoh: `DiceRolled`, `PawnStepped`, `PaidRent{from,to,amount}`, `CardDrawn`, `BencanaFx{key,tile,player}`, `WeatherChanged`, `PlayerJailed`, `Bankrupt`, `GameOver`). Lapisan tampilan memutar events itu sebagai animasi, **berurutan**, sementara state final sudah pasti.

Tampilan (`src/view/`) hanya membaca state dan memutar events. Ia tidak boleh memuat aturan permainan.

### 3.3 Protokol jaringan

Semua pesan berupa JSON dengan skema yang divalidasi (gunakan `zod` atau validasi manual) dan **nomor versi protokol** (`v: 1`).

```
Client -> Host
  { t:"hello", name, pawn, token }            // bergabung / menyambung kembali
  { t:"intent", seq, intent }                 // niat aksi, seq naik tiap pesan dari client itu
  { t:"ready", ready:boolean }
  { t:"ping", ts }

Host -> Client (siaran)
  { t:"lobby", players[], settings, hostId }
  { t:"snapshot", rev, state }                // state penuh, dikirim saat bergabung / menyambung ulang / tiap N langkah
  { t:"events", rev, events[], stateHash }    // hasil satu niat, berurutan
  { t:"reject", seq, reason }                 // niat ditolak
  { t:"pong", ts }
  { t:"kick" | "end", reason }
```

Aturan sinkronisasi:

- `rev` adalah nomor revisi state yang naik satu per niat yang diterima. Client yang menerima `events` dengan `rev` loncat segera meminta `snapshot`.
- Host menyertakan `stateHash` ringkas. Client menghitung hash dari state yang ia susun sendiri. Jika berbeda, minta `snapshot` penuh. Ini mendeteksi bug sinkronisasi saat pengembangan.
- Client **boleh** menerapkan events secara lokal memakai mesin yang sama (deterministik) supaya state tetap tersedia, tetapi sumber kebenarannya tetap Host.
- Pesan dari client diberi batas laju (rate limit) dan ukuran maksimum. Abaikan pesan yang tidak valid, jangan crash.

### 3.4 Ruangan (lobi)

- Host menekan "Buat ruangan". Sistem membuat **kode ruangan 5 karakter** (huruf besar dan angka, tanpa karakter ambigu seperti `0 O 1 I`). ID PeerJS = `nusantara-ngawur-` + kode.
- Tampilkan kode besar dan **tautan undangan** `https://.../#/join/KODE`. Tautan itu membuka halaman dan langsung mencoba bergabung.
- Pemain lain memasukkan kode atau membuka tautan.
- Lobi: daftar pemain (3 sampai 8), nama (maks 14 karakter), **pilih karakter bidak** (8 karakter, lihat bagian 9, tidak boleh kembar), status siap. Host menekan "Mulai" hanya jika minimal 3 pemain dan semua siap.
- Tolak pemain baru jika ruangan penuh atau permainan sudah berjalan (kecuali dia sedang menyambung ulang, lihat 3.5).
- Opsi host (opsional, fase akhir): uang awal, kecepatan animasi, batas waktu giliran.

### 3.5 Putus dan menyambung ulang

- Tiap pemain menerima `token` acak saat pertama bergabung, disimpan di `sessionStorage`/`localStorage`. Dengan token itu ia bisa **menyambung ulang ke bidak yang sama** setelah refresh atau koneksi putus.
- Jika client putus: bidaknya ditandai "terputus". Jika gilirannya, tunggu 45 detik; setelah itu otomatis `akhiri giliran` (lempar dadu otomatis jika perlu) agar permainan tidak macet. Beri tombol "Kick" untuk host.
- Jika **Host putus**: permainan berhenti dengan pesan jelas ("Host terputus"). Migrasi host adalah fitur lanjutan, **bukan** bagian fase awal, tetapi rancang `snapshot` supaya nanti bisa dipakai pemain lain untuk melanjutkan. Simpan snapshot terakhir di `localStorage` Host agar ruangan bisa dipulihkan setelah refresh.

### 3.6 Koneksi dan NAT

- PeerJS memakai STUN publik secara default. Sebagian jaringan (NAT simetris, jaringan kantor atau kampus) butuh TURN. Siapkan **daftar ICE server yang bisa dikonfigurasi** lewat variabel lingkungan Vite (`VITE_ICE_SERVERS` berupa JSON) dan dokumentasikan cara memakai layanan TURN gratis seperti Metered Open Relay atau Cloudflare Calls di `docs/MULTIPLAYER.md`. **Jangan menaruh kredensial rahasia di repo.** Kredensial TURN publik gratis boleh lewat variabel lingkungan GitHub Actions.
- Sediakan layar diagnosis koneksi sederhana: status (menghubungkan, tersambung, gagal), ping, dan pesan saran jika gagal ("coba jaringan lain atau gunakan hotspot").

### 3.7 Keamanan dan kecurangan (realistis)

Ini game santai antar teman, bukan taruhan. Tetap lakukan:

- Validasi semua niat di Host (giliran, fase, uang, kepemilikan).
- Client tidak dipercaya untuk angka acak atau perubahan uang.
- Escape semua teks dari pemain (nama) sebelum masuk `innerHTML`, atau pakai `textContent`. Cegah XSS lewat nama.
- Batasi panjang nama, jumlah pesan per detik, ukuran pesan.

---

## 4. Aturan permainan (portir persis dari prototipe)

Ambil angka dan rumus dari `reference/prototype/index.html` (fungsi `rentFor`, `buildCost`, `cityPrice`, `assetValue`, `land`, `move`, `goJail`, `drawCard`, `applyEffect`, `settle`, `bankrupt`). Ringkasannya:

**Uang.** Satuan uang dalam juta rupiah. Uang awal Rp15 M (15.000). Gaji lewat Titik Nol Sabang: Rp2 M (2.000). Denda keluar penjara: Rp500 jt.

**Papan: 244 petak.** Titik Nol Sabang (mulai) 1, kota 190, Nasib 28, Bencana 13, Razia 4, Penjara (Nusakambangan) 4, PPN 12% sebanyak 3, Warung Kopi (parkir gratis, dapat Rp100 jt) 1. Urutan provinsi (`PORDER`): ACH, SUT, SMB, RIA, KEP, JAM, SSL, BBL, BKL, LPG, BTN, DKI, JBR, JTG, DIY, JTM, BAL, NTB, NTT, KBR, KTG, KSL, KTM, KTR, SLU, GRT, STG, SLB, SLS, STR, MLK, MLU, PPA, PPB, PBD, PPT, PPG, PPS. Pemain berjalan **ke kanan** dari Titik Nol. Tata letak petak (`GAPS`) ada di prototipe: pindahkan ke `data/`.

**Harga dan sewa.**

- `cityPrice(provinsi) = round(provinsi.price * 0.28 / 10) * 10`.
- Sewa: `max(10, round(cityPrice * 0.16 * (1 + 0.25*(k-1)) * LVMULT[level] / 10) * 10)` dengan `k` = jumlah kota yang dipegang pemilik di provinsi itu (1 sampai 5) dan `LVMULT = [1, 3, 6, 10]`. Memegang kelima kota berarti sewa dasar berlipat dua.
- Level bangunan: Kota biasa (0), Pasar (1), Mal (2), Metropolitan (3). Biaya bangun = 60% harga kota (dibulatkan), setengahnya jika punya kupon bangun.
- Nilai aset untuk perhitungan kekayaan = `cityPrice*0.5 + level*cityPrice*0.3`.

**Alur giliran.** Lempar dua dadu. Dadu kembar berarti boleh lempar lagi, kembar tiga kali berturut-turut berarti masuk penjara. Setelah mendarat: kota kosong bisa dibeli, kota lawan bayar sewa (kecuali punya tiket bebas sewa), petak Nasib/Bencana menarik kartu, PPN 12% dari uang (minimal Rp300 jt), Razia masuk penjara, Warung Kopi dapat Rp100 jt. Di penjara: 3 giliran, kembar membebaskan, boleh bayar denda. Jika uang negatif, jual kota termurah satu per satu; jika tetap negatif, bangkrut. Permainan selesai jika tinggal satu pemain, atau saat ada yang menekan "Akhiri dan hitung kekayaan" (kekayaan = uang + nilai aset).

**Kartu.** `NASIB_BAD` (20 kartu), `NASIB_GOOD` (16 kartu), `BENCANA` (12 kartu). Efek yang dikenal: `m` (uang), `mv` (maju/mundur), `skip` (lewat giliran), `jail`, `free` (tiket bebas sewa), `disc` (kupon bangun), `lc` (kota hancur). Bencana selalu merugikan. Pindahkan teks, efek, dan pemetaan animasi (`FXMAP`) ke `data/cards.json`.

**Peluang Nasib baik.** Dasar 20%. Dipengaruhi cuaca (bagian 5).

---

## 5. Cuaca global (satu cuaca untuk seluruh peta)

Cuaca berlaku untuk **semua pemain sekaligus** dan **dikendalikan Host**. Pergantian cuaca terjadi **acak di waktu nyata**, bukan per ronde: setiap **90 detik sampai 5 menit** (acak seragam) Host memilih cuaca baru (tidak boleh sama dengan sebelumnya) dan menyiarkan event `WeatherChanged`. Bobot pilihan: Cerah 22, Berawan 20, Hujan 16, Badai petir 10, Panas terik 12, Berkabut 12, Kabut asap 8.

| Cuaca             | Efek permainan                                                                                                                                 | Efek tampilan                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Cerah             | Peluang Nasib baik naik 30 poin (20% jadi 50%)                                                                                                 | langit cerah, cahaya hangat            |
| Berawan           | Nasib baik naik 10 poin (jadi 30%)                                                                                                             | awan putih menutup langit              |
| Hujan             | Tiap giliran 25% pemain kena banjir di luar kotak musibah (rugi Rp350 jt, animasi banjir)                                                      | mendung, hujan di seluruh peta         |
| Hujan badai petir | Tiap giliran 22% pemain disambar petir (lewat 1 giliran, animasi petir)                                                                        | mendung gelap, hujan lebat, kilat acak |
| Panas terik       | Tiap giliran 25% satu kota milik pemain terbakar (turun satu level atau hancur, animasi kebakaran). Tidak berefek jika pemain belum punya kota | cahaya terik, nuansa hangat            |
| Berkabut          | Luck turun 50%: peluang Nasib baik jadi 10%, dan dengan peluang 50% dadu diarahkan ke petak Nasib atau Bencana bila terjangkau                 | kabut putih                            |
| Kabut asap        | Luck turun 80%: peluang Nasib baik jadi 4%, dan dengan peluang 80% dadu diarahkan ke petak Nasib atau Bencana                                  | kabut cokelat pekat                    |

Rumus peluang Nasib baik: jika luck >= 0 maka `0.2 + luck`, jika negatif maka `0.2 * (1 + luck)`, dibatasi 2% sampai 90%. Kejadian cuaca (banjir, petir, kebakaran) dihitung **setelah pemain selesai bergerak dan mendarat**, hanya jika pemain tidak di penjara dan tidak bangkrut. Seluruh angka ini harus berupa **konstanta di satu file konfigurasi** supaya mudah disetel. Implementasi referensi ada di prototipe (`WX`, `WXW`, `WX_HAZ`, `goodChance`, `steerDice`, `weatherEvent`, blok "CUACA GLOBAL" di kode tampilan).

Tombol "Cuaca: hidup/mati" hanya mematikan **tampilan** cuaca (untuk perangkat lemah), bukan efek aturannya.

---

## 6. Tampilan dan pengalaman (portir dari prototipe)

Semua ini sudah ada di prototipe. Pertahankan.

- **Papan 3D**: nampan kayu, laut dengan shader (garis pantai turkuaz, buih halus), pulau gunung berapi di tengah (kawah, asap, lava), 5 pulau kecil, pohon sebagai quad billboard ber-instance, awan, kapal-kapal 3D yang berlayar jauh dari daratan, label wilayah (Sumatera, Jawa, dan seterusnya) di atas ombak.
- **Petak kota besar, tidak seragam tetapi saling menempel**, warna per wilayah, ikon kota dari atlas gambar (bukan emoji).
- **Bidak berupa orang** (bukan hewan), model 3D: Petani, Penari, Nelayan, Driver Ojol, Sultan, Pesilat, Tukang Bakso, Karyawan. Selalu menghadap kamera.
- **Animasi hanya untuk kartu Bencana** (dan kejadian cuaca): banjir, rob, gunung meletus, gempa, tsunami, kebakaran hutan, longsor, kekeringan, puting beliung (bidak melayang terbawa angin), meteor dan hujan meteor (bidak terpental), petir (bidak gosong). Port semua fungsi `FX.*`. Kartu Nasib tidak perlu animasi besar.
- **Panel pemain di bagian atas**: kartu saldo tiap pemain. **Animasi saldo**: saat pemain membayar pemain lain (sewa), koin dan label nominal terbang dari kartu pembayar ke kartu penerima, angka saldo bergerak naik/turun, muncul "-/+ nominal". Perubahan dari bank (gaji, pajak, kartu) memunculkan nominal mengambang di kartu.
- **POV per pemain (sangat penting di versi multiplayer).** Setiap pemain melihat **layarnya sendiri**: peta memenuhi layar, kartu kontrol kecil di **kanan bawah** berisi tombol "Lempar dadu" dan aksi (Beli, Bangun, Akhiri giliran). **Tombol aksi hanya aktif di giliran pemain itu**; di luar giliran tampil "Menunggu {nama} bermain...". Kamera pemain mengikuti bidak yang sedang jalan, tetapi tiap pemain bebas menggeser, memutar, dan zoom kameranya sendiri, dengan tombol "Fokus bidak" dan "Peta penuh".
- **Catatan perjalanan (log)** tersembunyi secara default, dibuka dan ditutup lewat tombol "Catatan" di toolbar, **status buka/tutup disimpan per pemain**, ada lencana jumlah catatan belum dibaca. Tombol "Akhiri dan hitung kekayaan" ada di dalam jendela catatan (di versi multiplayer: hanya Host, atau lewat voting).
- Kotak informasi cuaca di pojok kanan atas (nama dan efeknya), tanpa hitungan mundur (cuaca berganti tiba-tiba).
- Dadu 3D CSS yang berputar, lempar dilakukan Host, semua layar memutar animasi dadu dengan hasil yang sama.
- Responsif sampai layar HP (kartu kontrol selebar layar di bawah, kotak cuaca dipindah agar tidak menutup toolbar).
- Hormati `prefers-reduced-motion`. Pastikan kontras dan fokus keyboard layak.

**Sinkronisasi animasi di multiplayer.** Animasi besar (Bencana, cuaca) diputar di **semua** layar dari event yang sama. Satu event animasi harus selesai (atau melewati batas waktu maksimum) sebelum event berikutnya diputar, dan input pemain dikunci selama itu. Sediakan flag untuk melewati animasi (`?fast=1`) untuk tes.

---

## 7. Struktur repo yang diharapkan

```
nusantara-ngawur/
  .github/workflows/
    deploy.yml          // build + deploy ke GitHub Pages (bagian 11)
    ci.yml              // lint + tes pada pull request
  docs/
    BRIEF.md            // file ini
    DECISIONS.md        // catatan keputusan
    MULTIPLAYER.md      // protokol, ICE/TURN, cara uji lokal
    ASSETS.md           // cara menambah/mengganti aset
    DEPLOY.md           // langkah publikasi
  public/
    assets/             // cities, trees, ships, spec, ppl, fx (webp), models/ (GLB opsional)
  reference/
    prototype/          // prototipe lama, JANGAN diubah
  scripts/
    assets/             // skrip Python/Node pemrosesan aset (opsional)
  src/
    engine/             // mesin murni (bagian 3.2)
    net/                // host.ts, client.ts, protocol.ts, session.ts
    view/               // scene.ts, water.ts, pawns.ts, ships.ts, fx/, weather.ts, hud.ts, lobby.ts
    ui/                 // DOM: lobi, HUD, modal kartu, log
    main.ts
  tests/                // vitest + playwright
  index.html
  vite.config.ts
  package.json
  README.md
```

---

## 8. Mutu kode

- TypeScript `strict`, tanpa `any` kecuali dibenarkan dengan komentar.
- Mesin permainan **murni dan deterministik**: dengan state awal, seed, dan urutan niat yang sama, hasilnya harus identik. Ini dasar semua tes dan sinkronisasi.
- Tidak ada variabel global yang liar. Prototipe memakai banyak global dan closure besar; pecah menjadi modul.
- Bersihkan sumber daya Three.js (dispose geometri, material, tekstur) saat efek selesai agar tidak bocor memori.
- Jaga performa: target 60 fps di laptop biasa dan layak di HP kelas menengah. Sediakan mode "kualitas rendah" (kurangi bayangan, jumlah pohon, partikel).
- Jangan memuat font atau library dari CDN secara wajib. Jika memakai Google Fonts (Bungee, Plus Jakarta Sans), sediakan fallback sistem agar permainan tetap jalan saat offline.

---

## 9. Aset

Aset gambar sudah dibuat dan ada di `reference/prototype/assets/` (WebP transparan): ikon kota per atlas, pohon (12), kapal (8), ikon petak khusus (8), bidak orang (8), ikon efek (24). Salin ke `public/assets/` dan pertahankan nama file. Metadata ukuran (`TREEMETA`, `SHIPMETA`, `FXMETA`, `FXIDX`, `SPEC_IDX`, `CITY_HAVE`) ada di prototipe; pindahkan menjadi file manifest JSON.

Status: atlas kota untuk beberapa grup provinsi **belum ada** (huruf D, F, dan J). Kota-kota itu sementara memakai emoji sebagai cadangan di UI HTML. Sediakan mekanisme **fallback bersih** (jika atlas tidak ada, tampilkan inisial kota dalam lingkaran berwarna, bukan emoji di peta 3D) dan dokumentasikan cara menambah atlas baru di `docs/ASSETS.md`. Prompt pembuatan aset ada di `reference/prototype/prompt-aset.md`.

**Model 3D opsional (GLB).** Bidak dan kapal saat ini model prosedural Three.js. Siapkan kait: jika ada `public/assets/models/manifest.json` (contoh `{"pawn0":"pawn0.glb","ship3":"ship3.glb"}`), model GLB menggantikan model bawaan (otomatis diskalakan dan diletakkan di tanah). Jalur ini ada di prototipe (`loadModels`, `fitModel`, `swapShip`). Pertahankan, dan tulis tes dengan GLB sintetis.

---

## 10. Pengujian dan verifikasi

Wajib ada:

1. **Tes unit mesin (Vitest):** rumus sewa/biaya/harga, aliran giliran, dadu kembar, penjara, kebangkrutan, jual otomatis, setiap efek kartu, peluang Nasib baik per cuaca, arah dadu saat berkabut, kejadian cuaca (banjir, petir, kebakaran), determinisme (seed sama menghasilkan hasil sama).
2. **Tes simulasi:** jalankan ratusan permainan penuh dengan bot (3 sampai 8 pemain), pastikan tidak ada crash, tidak ada state tidak sah (uang NaN, dua pemilik satu kota), dan permainan selalu berakhir.
3. **Tes jaringan:** abstraksikan transport (interface `Transport`) sehingga ada implementasi PeerJS dan implementasi **in-memory** untuk tes. Uji: bergabung, niat ditolak saat bukan giliran, siaran events, `rev` loncat memicu snapshot, hash tidak cocok memicu snapshot, putus lalu sambung ulang dengan token, Host putus.
4. **Tes browser (Playwright):** buka dua sampai empat halaman dalam satu mesin, buat ruangan, gabung dengan kode, mainkan beberapa giliran, pastikan tombol hanya aktif di giliran yang benar dan state konsisten di semua halaman. Gunakan renderer WebGL perangkat lunak (SwiftShader) di CI dan tunggu animasi dengan `?fast=1`.
5. **Tes visual ringan:** tangkapan layar tiap cuaca dan beberapa animasi Bencana untuk pemeriksaan manual (tidak harus dibandingkan piksel).

Sebelum tiap fase dinyatakan selesai: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` harus lulus, dan hasilnya dilaporkan.

---

## 11. Hosting GitHub Pages dan workflow (pemilik yang push manual)

Kamu **membuat file workflow**, tetapi **tidak menjalankan push**. Pemilik akan push sendiri ke `main`, lalu GitHub Actions membangun dan menerbitkan.

Buat `.github/workflows/deploy.yml`:

```yaml
name: Deploy ke GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - name: Build
        run: npm run build
        env:
          # Nama repo dipakai sebagai base path: https://USERNAME.github.io/REPO/
          VITE_BASE: /${{ github.event.repository.name }}/
          # Opsional: daftar ICE/TURN server dalam JSON, simpan di Settings > Secrets and variables > Actions > Variables
          VITE_ICE_SERVERS: ${{ vars.VITE_ICE_SERVERS }}
      - name: Salin index.html jadi 404.html (untuk tautan #/join/...)
        run: cp dist/index.html dist/404.html
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Buat `.github/workflows/ci.yml` untuk pull request: checkout, setup-node, `npm ci`, lint, typecheck, test, build (tanpa deploy). Tes Playwright boleh dijalankan di job terpisah dan tidak wajib menggagalkan deploy pada awalnya.

Tulis `docs/DEPLOY.md` berisi langkah untuk pemilik (dalam bahasa Indonesia):

1. Buat repo kosong di GitHub, tambahkan remote (`git remote add origin ...`).
2. Di **Settings > Pages**, pilih **Source: GitHub Actions**.
3. Push ke `main` secara manual (`git push -u origin main`).
4. Buka tab **Actions**, tunggu workflow hijau, lalu buka URL yang muncul di langkah deploy.
5. Cara menambah variabel `VITE_ICE_SERVERS` untuk TURN.
6. Cara membatalkan atau mengulang deploy (`workflow_dispatch`), dan cara rollback (revert commit lalu push).
7. Catatan: Pages hanya menyajikan situs statis, jadi tidak ada backend; semua sinkronisasi lewat WebRTC.

Pastikan: `vite.config.ts` membaca `process.env.VITE_BASE ?? "/"`; tautan undangan memakai hash routing (`#/join/KODE`) supaya aman di Pages; tidak ada path absolut yang rusak di bawah sub-path; tes `npm run build && npm run preview` diverifikasi dengan base `/nusantara-ngawur/`.

---

## 12. Rencana fase dan kriteria selesai

**Fase 0. Fondasi.** Inisialisasi repo, Vite + TypeScript, ESLint/Prettier, Vitest, struktur folder, salin prototipe ke `reference/`, salin aset ke `public/`, buat `README.md`, `docs/DECISIONS.md`. Selesai jika `npm run dev` menampilkan halaman kosong yang memuat aset dari base yang benar dan semua skrip (`lint`, `typecheck`, `test`, `build`) berjalan.

**Fase 1. Mesin murni.** Ekstrak data (provinsi, kartu, tata letak petak, tabel cuaca) ke JSON. Tulis mesin `engine/` lengkap (giliran, kartu, sewa, bangun, penjara, bangkrut, cuaca) sebagai fungsi murni ber-seed. Bot dan tes simulasi 500 permainan lulus. **Belum ada tampilan.** Verifikasi paritas aturan dengan prototipe pada beberapa skenario yang dipilih.

**Fase 2. Tampilan 3D.** Pecah kode Three.js prototipe menjadi modul `view/`. Papan, air, pulau, pohon, kapal, bidak, kamera, petak, label. Tampilan membaca `GameState` dari mesin (mode satu perangkat dulu, boleh memakai mesin lokal). Semua animasi Bencana dan cuaca diputar dari `GameEvent`. Selesai jika permainan hot-seat di proyek baru **setara** dengan prototipe (bandingkan tangkapan layar).

**Fase 3. HUD dan POV.** Kartu kontrol kanan bawah, panel pemain atas, animasi saldo, log yang bisa dibuka-tutup per pemain, modal kartu, tampilan HP.

**Fase 4. Jaringan.** `Transport` abstrak, implementasi in-memory, implementasi PeerJS, protokol, lobi, host berwibawa, snapshot/events/hash, sambung ulang, putus. Tes jaringan lulus. Selesai jika dua sampai empat tab browser bisa bermain satu permainan penuh dengan state konsisten.

**Fase 5. Multiplayer penuh.** 3 sampai 8 pemain, pilih bidak unik, tombol aksi per giliran, sinkronisasi animasi, kunci input saat animasi, batas waktu giliran, diagnosis koneksi, konfigurasi ICE/TURN, `docs/MULTIPLAYER.md`.

**Fase 6. Deploy.** Workflow GitHub Actions, base path, `404.html`, `docs/DEPLOY.md`, verifikasi `npm run preview` dengan base sub-path. Berikan checklist untuk pemilik.

**Fase 7. Pemolesan.** Mode kualitas rendah, aksesibilitas, suara (opsional, default mati), opsi host, migrasi host (opsional), statistik akhir permainan, hapus kode mati, perbarui dokumentasi.

Setelah tiap fase: laporkan hasil verifikasi, daftar file utama yang berubah, dan pertanyaan terbuka. **Berhenti dan tunggu konfirmasi** sebelum fase berikutnya jika ada pertanyaan terbuka yang memengaruhi desain.

---

## 13. Hal yang sengaja belum dikerjakan (jangan dikerjakan kecuali diminta)

- Model 3D khusus tiap kota (landmark). Itu ide masa depan.
- Akun, peringkat online, penyimpanan di server.
- Chat suara atau teks (boleh ditambahkan sebagai emoji reaksi cepat di fase 7 jika sempat).
- Mode penonton.

---

## 14. Daftar periksa serah terima akhir

- [ ] `npm run lint`, `typecheck`, `test`, `build` lulus (lampirkan keluaran).
- [ ] 500 permainan simulasi lulus tanpa state tidak sah.
- [ ] Dua sampai empat tab Playwright menyelesaikan satu permainan dengan state konsisten.
- [ ] `npm run preview` berjalan benar di bawah base `/nusantara-ngawur/`.
- [ ] Tidak ada `git push` yang dijalankan; riwayat commit lokal rapi.
- [ ] `docs/DEPLOY.md` dan `docs/MULTIPLAYER.md` lengkap.
- [ ] Tidak ada rahasia atau kredensial di repo.
- [ ] Daftar masalah yang diketahui dan langkah berikutnya ditulis di `README.md`.
