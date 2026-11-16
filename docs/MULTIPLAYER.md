# Multiplayer P2P

Nusantara Ngawur berjalan tanpa server game. Satu pemain menjadi **Host**; mesin permainan hanya berjalan di browser Host. Pemain lain (**Client**) tersambung langsung ke Host lewat WebRTC (PeerJS). GitHub Pages hanya menyajikan file statis.

## Alur singkat

1. Host menekan **Buat ruangan**. Dibuat kode 5 karakter (huruf besar dan angka tanpa `0 O 1 I`), id PeerJS `nusantara-ngawur-KODE`, dan tautan `…/#/join/KODE`.
2. Pemain lain mengetik kode atau membuka tautan (langsung mencoba bergabung).
3. Di lobi: nama (maks 14 karakter), pilih karakter bidak (tidak boleh kembar), tekan **Siap**. Host menekan **Mulai** jika minimal 2 pemain dan semua siap.
4. Selama bermain, client mengirim **niat**; Host memvalidasi, menjalankan mesin, dan menyiarkan hasil.

Host juga pemain: halaman Host menjalankan `HostSession` dan bermain lewat client _loopback_ (link dalam memori), jadi jalurnya identik dengan pemain lain.

## Arsitektur

| Berkas                 | Isi                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| `src/net/protocol.ts`  | skema pesan (zod), versi `v: 1`, batas ukuran                                                |
| `src/net/transport.ts` | interface `Transport` / `Link`                                                               |
| `src/net/peer.ts`      | transport PeerJS (WebRTC)                                                                    |
| `src/net/memory.ts`    | transport dalam memori (tes, loopback Host)                                                  |
| `src/net/bc.ts`        | transport antar tab (`BroadcastChannel`, `?net=tab`) untuk tes dan pengembangan              |
| `src/net/host.ts`      | `HostSession`: lobi, validasi niat, siaran, sambung ulang, giliran otomatis, simpan snapshot |
| `src/net/client.ts`    | `ClientSession`: kirim niat, susun state lokal, cek `rev` dan hash                           |
| `src/game/online.ts`   | perekat ke UI: menu, lobi, antrean animasi, putus dan sambung ulang                          |

## Protokol (v1)

Semua pesan JSON, divalidasi, dan memuat `v: 1`. Pesan tidak sah atau terlalu besar diabaikan (tidak membuat crash).

Client ke Host:

```
{ v:1, t:"hello", name, pawn, token? }   // bergabung; token = menyambung ulang ke kursi yang sama
{ v:1, t:"profile", name, pawn }         // ganti nama/bidak di lobi
{ v:1, t:"intent", seq, intent }         // roll | buy | build{tile} | endTurn | payJail (tanpa pid)
{ v:1, t:"ready", ready }
{ v:1, t:"sync" }                         // minta snapshot penuh
{ v:1, t:"ping", ts }
```

Host ke Client:

```
{ v:1, t:"welcome", pid, token, code }
{ v:1, t:"lobby", players[], settings, hostId, started }
{ v:1, t:"snapshot", rev, state }
{ v:1, t:"events", rev, intent, events[], stateHash }
{ v:1, t:"reject", seq, reason }
{ v:1, t:"pong", ts }
{ v:1, t:"kick" | "end", reason }
{ v:1, t:"timer", pid, ms, mode }      // sisa waktu giliran; mode limit | away | gone; pid -1 = tanpa batas
```

Tambahan dibanding brief: `welcome` (memberi `pid` dan `token`), `profile`, `sync`, `timer`, dan field `intent` di `events`.

### Sinkronisasi

- `pid` niat selalu ditentukan Host dari koneksi; client tidak bisa bertindak atas nama pemain lain.
- Dadu, kartu, cuaca, dan semua acak memakai RNG ber-seed di state Host.
- `rev` naik satu per niat yang diterima. Client menerapkan `intent` yang sama ke mesin deterministik miliknya dan membandingkan `stateHash` (FNV-1a dari state dengan urutan key stabil). Jika `rev` loncat atau hash berbeda, client mengirim `sync` dan Host membalas `snapshot`.
- Animasi diputar dari `events` secara berurutan di tiap layar; input terkunci selama animasi.

### Keamanan (realistis untuk game santai)

- Semua niat divalidasi di Host (giliran, fase, uang, kepemilikan).
- Batas laju per pemain: ember token kapasitas 20, isi ulang 10 per detik. Pesan client maksimal 4 KB.
- Nama dibersihkan dari karakter kontrol, maksimal 14 karakter, dan selalu di-escape sebelum masuk HTML.
- Hanya Host yang bisa mulai, mengeluarkan pemain, dan mengakhiri permainan.

## Kartu dan cuaca di mode online

- Kartu Nasib/Bencana dan musibah cuaca: hanya pemain yang mengambil kartu yang melihat kartu di tengah layar. Pemain lain melihat notifikasi kecil di pojok kanan atas.
- Tombol **Cuaca: hidup/mati** hanya ada di layar Host dan berlaku untuk semua pemain (hanya tampilan; efek cuaca pada aturan tetap berjalan).

## Batas waktu giliran

Host memilih di lobi: tanpa batas (bawaan), 15, 30, 60, 90, 120, atau 180 detik. Tenggat dihitung **per giliran** (bukan per aksi). Setiap aksi menambah tenggat sebesar perkiraan lama animasinya (`src/game/timing.ts`), supaya waktu tidak termakan animasi di layar pemain. Host menyiarkan sisa waktu lewat pesan `timer`; semua layar menampilkan hitung mundur di kartu kontrol. Jika waktu habis, Host memainkan giliran otomatis (lempar dadu bila perlu, lalu akhiri giliran; kota tidak dibeli).

## Diagnosis koneksi

Tombol **Koneksi** (hanya mode online) membuka panel berisi status (tersambung, menyambung, terputus), ping ke Host, jalur WebRTC (langsung lewat jaringan lokal, langsung lewat internet, atau lewat server TURN), daftar pemain beserta status, dan saran bila bermasalah. Tombol berwarna merah jika ada masalah.

## Putus dan menyambung ulang

- Token sesi disimpan di `sessionStorage` (`nn.token.KODE`). Refresh tab = kembali ke bidak yang sama.
- Client yang putus mencoba menyambung ulang tiap 3 detik (15 kali).
- Bidak pemain terputus ditandai "Terputus". Jika gilirannya, Host menunggu **45 detik** lalu memainkan giliran otomatis (lempar dadu bila perlu, lalu akhiri giliran).
- Host bisa **Kick** pemain dari lobi. Saat bermain, Kick ada di panel **Koneksi**: pemain itu tidak bisa masuk lagi dan gilirannya dimainkan otomatis 1,5 detik setelah tiba.
- **Host putus**: client menampilkan "Host terputus". Host menyimpan snapshot terakhir di `localStorage` (`nn.host.KODE`). Jika Host memuat ulang halamannya (URL `#/host/KODE`), ruangan dipulihkan dengan kode yang sama dan pemain bisa menyambung lagi lewat tautan undangan. Migrasi host ke pemain lain belum ada; bentuk snapshot sudah cukup untuk itu.

## ICE, STUN, dan TURN

**Keputusan saat ini: tanpa TURN.** Permainan hanya memakai STUN publik (gratis, tanpa akun). Ini cukup untuk kebanyakan Wi-Fi rumah dan data seluler. Di sebagian jaringan (NAT simetris, Wi-Fi kantor atau kampus, sebagian operator seluler) koneksi bisa gagal; sarannya pakai jaringan lain atau hotspot HP salah satu pemain. Panel **Koneksi** menampilkan saran ini otomatis.

Server TURN publik gratis bersama (Metered Open Relay, kredensial `openrelayproject`) sudah diuji pada 16-11-2026 dan **tidak memberi jalur relay lagi**, jadi tidak dipakai.

### Jika nanti butuh TURN (tanpa ubah kode)

Dukungan TURN sudah ada di kode (`src/net/ice.ts`) dan **tidak aktif** selama variabel di bawah kosong.

1. Cara termudah: daftar paket gratis **Metered** (metered.ca), buat aplikasi TURN, salin URL API kredensialnya, bentuknya `https://NAMA.metered.live/api/v1/turn/credentials?apiKey=KUNCI`.
2. Isi variabel `VITE_ICE_SERVERS_URL` dengan URL itu:
   - lokal: di berkas `.env.local` (tidak ikut di-commit);
   - GitHub Pages: **Settings > Secrets and variables > Actions > Variables** (lihat `docs/DEPLOY.md`).
3. Periksa dari komputer sendiri: `node scripts/turn-check.mjs` (harus menulis "TURN berfungsi").
4. Di dalam permainan: panel **Koneksi > Uji TURN**. Untuk membuktikan jalur benar-benar lewat TURN: buka dengan `?relay=1` (memaksa relay), lalu panel Koneksi menampilkan jalur "lewat server TURN".

Alternatif: `VITE_ICE_SERVERS` berisi JSON array `RTCIceServer` statis. Kredensial di variabel ini ikut terbaca di situs publik, jadi hanya untuk layanan gratis atau berkuota. URL Metered lebih aman karena kredensialnya berumur pendek. Daftar dari URL didahulukan; jika URL gagal atau lebih dari 4 detik, permainan tetap jalan dengan STUN.

Cloudflare TURN butuh server kecil untuk membuat kredensial, jadi tidak cocok untuk situs statis tanpa backend.

## Menguji di komputer sendiri

```bash
npm run dev
```

- **Antar tab tanpa internet**: buka `http://localhost:5173/?net=tab` di beberapa tab satu browser. Buat ruangan di tab pertama, lalu buka `http://localhost:5173/?net=tab#/join/KODE` di tab lain.
- **WebRTC sungguhan**: buka `http://localhost:5173/` di dua browser atau perangkat (perlu internet untuk broker PeerJS). Untuk perangkat lain di jaringan yang sama: `npm run dev -- --host`, lalu buka alamat IP komputer.
- Parameter uji: `?fast=1` (tanpa animasi), `?low=1` (kualitas rendah), `?relay=1` (paksa lewat TURN).
- Tes otomatis: `npm test` (termasuk `tests/net.test.ts` dengan transport dalam memori), `npm run test:e2e` (3 tab Playwright), dan `node scripts/peer-smoke.mjs` (PeerJS sungguhan, butuh `npx vite --port 4173` menyala).
