# Multiplayer P2P

Nusantara Ngawur berjalan tanpa server game. Satu pemain menjadi **Host**; mesin permainan hanya berjalan di browser Host. Pemain lain (**Client**) tersambung langsung ke Host lewat WebRTC (PeerJS). GitHub Pages hanya menyajikan file statis.

## Alur singkat

1. Host menekan **Buat ruangan**. Dibuat kode 5 karakter (huruf besar dan angka tanpa `0 O 1 I`), id PeerJS `nusantara-ngawur-KODE`, dan tautan `…/#/join/KODE`.
2. Pemain lain mengetik kode atau membuka tautan (langsung mencoba bergabung).
3. Di lobi: nama (maks 14 karakter), pilih karakter bidak (tidak boleh kembar), tekan **Siap**. Host menekan **Mulai** jika minimal 3 pemain dan semua siap.
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
```

Tambahan dibanding brief: `welcome` (memberi `pid` dan `token`), `profile`, `sync`, dan field `intent` di `events`.

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

## Putus dan menyambung ulang

- Token sesi disimpan di `sessionStorage` (`nn.token.KODE`). Refresh tab = kembali ke bidak yang sama.
- Client yang putus mencoba menyambung ulang tiap 3 detik (15 kali).
- Bidak pemain terputus ditandai "Terputus". Jika gilirannya, Host menunggu **45 detik** lalu memainkan giliran otomatis (lempar dadu bila perlu, lalu akhiri giliran).
- Host bisa **Kick** pemain dari lobi.
- **Host putus**: client menampilkan "Host terputus". Host menyimpan snapshot terakhir di `localStorage` (`nn.host.KODE`). Jika Host memuat ulang halamannya (URL `#/host/KODE`), ruangan dipulihkan dengan kode yang sama dan pemain bisa menyambung lagi lewat tautan undangan. Migrasi host ke pemain lain belum ada; bentuk snapshot sudah cukup untuk itu.

## ICE, STUN, dan TURN

Bawaannya hanya STUN publik. Sebagian jaringan (NAT simetris, Wi-Fi kantor atau kampus, sebagian operator seluler) butuh **TURN**.

Atur lewat variabel lingkungan Vite `VITE_ICE_SERVERS` berisi JSON array `RTCIceServer`:

```json
[
  { "urls": "stun:stun.l.google.com:19302" },
  { "urls": "turn:NAMA-SERVER:443?transport=tcp", "username": "USERNAME", "credential": "PASSWORD" }
]
```

- **Metered Open Relay** (gratis): daftar di metered.ca, buat aplikasi TURN, salin daftar `iceServers` yang diberikan.
- **Cloudflare Calls TURN**: buat TURN key di dasbor Cloudflare. Kredensialnya berumur pendek, jadi lebih cocok jika nanti ada fungsi pembuat kredensial.
- Untuk GitHub Pages, isi di **Settings > Secrets and variables > Actions > Variables** dengan nama `VITE_ICE_SERVERS` (lihat `docs/DEPLOY.md`). **Jangan commit kredensial ke repo.** Kredensial TURN yang ikut di build bisa dibaca siapa pun yang membuka situs, jadi pakai layanan gratis atau berkuota.
- Nilai yang rusak atau kosong otomatis kembali ke STUN bawaan.

Jika tidak bisa tersambung: coba jaringan lain, atau nyalakan hotspot HP salah satu pemain.

## Menguji di komputer sendiri

```bash
npm run dev
```

- **Antar tab tanpa internet**: buka `http://localhost:5173/?net=tab` di beberapa tab satu browser. Buat ruangan di tab pertama, lalu buka `http://localhost:5173/?net=tab#/join/KODE` di tab lain.
- **WebRTC sungguhan**: buka `http://localhost:5173/` di dua browser atau perangkat (perlu internet untuk broker PeerJS). Untuk perangkat lain di jaringan yang sama: `npm run dev -- --host`, lalu buka alamat IP komputer.
- Parameter uji: `?fast=1` (tanpa animasi), `?low=1` (kualitas rendah), `?min=2` (boleh mulai dengan 2 pemain, khusus uji).
- Tes otomatis: `npm test` (termasuk `tests/net.test.ts` dengan transport dalam memori), `npm run test:e2e` (3 tab Playwright), dan `node scripts/peer-smoke.mjs` (PeerJS sungguhan, butuh `npx vite --port 4173` menyala).
