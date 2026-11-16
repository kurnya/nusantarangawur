# Publikasi ke GitHub Pages

Situs ini statis: GitHub Pages hanya menyajikan file HTML, JS, dan gambar. Tidak ada backend; pemain tersambung satu sama lain lewat WebRTC (lihat `docs/MULTIPLAYER.md`). Build dan publikasi dijalankan oleh GitHub Actions setiap kali `main` di-push.

## Langkah pertama kali

1. **Buat repo kosong di GitHub**, misalnya `nusantara-ngawur` (tanpa README, tanpa .gitignore, supaya tidak bentrok dengan riwayat lokal).
2. **Tambahkan remote** di folder proyek:

   ```bash
   git remote add origin https://github.com/USERNAME/nusantara-ngawur.git
   ```

3. **Aktifkan Pages**: di repo GitHub buka **Settings > Pages**, lalu pada **Build and deployment > Source** pilih **GitHub Actions**.
4. **Push manual** ke `main`:

   ```bash
   git push -u origin main
   ```

5. **Tunggu workflow**: buka tab **Actions**, pilih run "Deploy ke GitHub Pages". Jika semua langkah hijau, URL situs muncul di kotak job `deploy` (bentuknya `https://USERNAME.github.io/nusantara-ngawur/`).

Base path diatur otomatis dari nama repo: repo `nusantara-ngawur` disajikan di `/nusantara-ngawur/`. Jika repo bernama `USERNAME.github.io`, situs disajikan di root (`/`).

## Isi workflow

| Workflow                       | Kapan                                        | Isi                                                                                                         |
| ------------------------------ | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `.github/workflows/deploy.yml` | push ke `main`, atau tombol **Run workflow** | `npm ci`, lint, typecheck, tes, build, salin `index.html` menjadi `404.html`, unggah dan terbitkan ke Pages |
| `.github/workflows/ci.yml`     | pull request, atau tombol **Run workflow**   | lint, typecheck, tes, build; job terpisah tes browser Playwright (boleh gagal, tidak memblokir)             |

Jika lint, typecheck, atau tes gagal, situs **tidak** diperbarui; versi lama tetap tayang.

## Variabel opsional: TURN

Saat ini permainan **tanpa TURN** (cukup STUN publik). Jika nanti ada pemain yang selalu gagal tersambung:

1. Daftar paket gratis Metered dan salin URL API kredensial TURN (lihat `docs/MULTIPLAYER.md`).
2. Di repo: **Settings > Secrets and variables > Actions > tab Variables > New repository variable**.
3. Nama `VITE_ICE_SERVERS_URL`, nilai URL tadi. (Alternatif: `VITE_ICE_SERVERS` berisi JSON array server.)
4. Jalankan ulang deploy (lihat di bawah). Periksa di permainan: panel **Koneksi > Uji TURN**.

Jangan menaruh kredensial di file repo. Nilai variabel ini ikut tertanam di situs publik, jadi pakai layanan gratis atau berkuota.

## Mengulang, membatalkan, dan rollback

- **Ulang deploy tanpa perubahan kode** (mis. setelah mengubah variabel): tab **Actions > Deploy ke GitHub Pages > Run workflow > Run workflow**.
- **Batalkan deploy yang sedang jalan**: buka run-nya di tab **Actions**, tekan **Cancel workflow**. Push baru juga otomatis membatalkan deploy lama yang belum selesai.
- **Rollback ke versi sebelumnya**: kembalikan commit yang bermasalah lalu push lagi.

  ```bash
  git revert <hash-commit-bermasalah>
  git push
  ```

  Alternatif cepat tanpa mengubah kode: di tab **Actions**, buka run deploy lama yang berhasil, tekan **Re-run all jobs** (menerbitkan ulang versi itu).

## Memeriksa build di komputer sendiri

```bash
VITE_BASE=/nusantara-ngawur/ npm run build
VITE_BASE=/nusantara-ngawur/ npx vite preview --port 4174
# buka http://localhost:4174/nusantara-ngawur/
node scripts/pages-check.mjs http://localhost:4174/nusantara-ngawur/
```

Di Git Bash Windows awali kedua perintah dengan `MSYS_NO_PATHCONV=1` supaya `/nusantara-ngawur/` tidak diubah menjadi path Windows. Di PowerShell: `$env:VITE_BASE='/nusantara-ngawur/'; npm run build`.

`scripts/pages-check.mjs` memeriksa: mode satu perangkat berjalan, semua gambar termuat dari sub-path, tautan undangan memakai sub-path, tamu bisa bergabung lewat tautan, tidak ada respons gagal atau error halaman.

## Catatan

- GitHub Pages hanya menyajikan situs statis. Tidak ada server game, akun, atau database; ruangan hidup selama tab Host terbuka.
- Tautan undangan memakai hash (`#/join/KODE`), jadi aman di Pages. `404.html` adalah salinan `index.html` sebagai pengaman jika ada yang membuka path yang tidak ada.
- Pertama kali, GitHub kadang butuh beberapa menit sebelum URL bisa dibuka.

## Daftar periksa pemilik

- [ ] Repo kosong dibuat di GitHub
- [ ] `git remote add origin ...` dijalankan
- [ ] Settings > Pages > Source: **GitHub Actions**
- [ ] `git push -u origin main`
- [ ] Tab Actions: run "Deploy ke GitHub Pages" hijau
- [ ] URL situs dibuka; tombol "Main di satu perangkat" berjalan
- [ ] Buat ruangan di satu perangkat, gabung dari HP lewat tautan undangan
- [ ] (Opsional) Variabel `VITE_ICE_SERVERS_URL` jika butuh TURN
