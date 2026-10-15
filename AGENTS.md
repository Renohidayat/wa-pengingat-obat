# AGENTS.md — Aturan Kerja (WAJIB DIBACA SEBELUM MENGERJAKAN APA PUN)

Kamu bekerja sebagai **developer senior** di repo ini. Pemilik proyek: Dea Farida (pengguna/peneliti). Bahasa komunikasi: **Bahasa Indonesia**. Bahasa kode, nama variabel, dan nama branch: Inggris.

## 0. Sebelum mulai (checklist wajib, setiap sesi)
1. Baca `docs/PRD.md` sampai selesai. PRD adalah sumber kebenaran.
2. Baca file ini sampai selesai.
3. Jalankan `git status`, `git branch --show-current`, `git pull origin main`.
4. Jalankan `gh issue list --state open` dan ambil **satu** issue sesuai urutan milestone.
5. Sebutkan ke pengguna: issue mana yang dikerjakan dan rencana singkatnya. Tunggu OK hanya jika ada keputusan yang ambigu; jika jelas, langsung kerjakan.

## 1. Aturan emas
- **Satu issue = satu branch = satu PR.** Jangan menggabungkan beberapa issue.
- **Jangan pernah commit langsung ke `main`.** Jangan `git push --force` ke `main`.
- **Jangan menambah fitur di luar PRD.** Jika menemukan ide/bug baru, buat issue baru (`gh issue create`), jangan dikerjakan sekarang.
- **Jangan pernah commit rahasia**: `.env`, `auth_info/`, token, URI database, data pasien nyata. Jika terlanjur masuk commit, hentikan dan beri tahu pengguna.
- **Scope v1 hanya registrasi (A) dan pengingat obat (B.1).** Tidak ada edukasi, tidak ada pesan akhir intervensi, tidak ada tombol interaktif WhatsApp.
- Jika PRD ambigu atau bertentangan dengan permintaan pengguna, **tanya dulu**, jangan menebak. Jika keputusan itu mengubah perilaku, perbarui PRD di PR yang sama.

## 2. Alur kerja per issue

```bash
# 1. Pastikan main terbaru
git checkout main && git pull origin main

# 2. Buat branch dari issue  (format: <type>/<nomor-issue>-<slug-singkat>)
git checkout -b feat/7-daily-reminder-scheduler

# 3. Kerjakan dalam langkah kecil. Commit SETIAP perubahan logis.
git add <file-spesifik>          # jangan 'git add .' tanpa cek git status/diff dulu
git commit -m "feat(scheduler): kirim pengingat pada jam pasien (#7)"

# 4. Push dan buka PR
git push -u origin feat/7-daily-reminder-scheduler
gh pr create --fill --body-file .github/PULL_REQUEST_TEMPLATE.md   # lalu lengkapi isinya, sertakan "Closes #7"

# 5. Setelah pengguna menyetujui: squash merge, hapus branch
gh pr merge --squash --delete-branch
git checkout main && git pull origin main
```

**Merge hanya setelah pengguna menjawab setuju secara eksplisit.** Setelah PR dibuka, tampilkan ringkasan dan minta review.

### Tipe branch
`feat/` fitur · `fix/` perbaikan bug · `chore/` setup/konfigurasi · `docs/` dokumentasi · `refactor/` rapikan kode tanpa ubah perilaku · `test/` pengujian

### Commit (Conventional Commits)
Format: `<type>(<scope>): <deskripsi imperatif singkat> (#<issue>)`
- Type: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`.
- Scope contoh: `bot`, `scheduler`, `registration`, `parser`, `db`, `export`, `admin`, `deploy`.
- Satu commit = satu perubahan logis; build dan test tetap lulus di tiap commit.
- Deskripsi ≤ 72 karakter, tanpa titik di akhir. Isi body bila perlu menjelaskan *kenapa*.
- Contoh baik: `fix(parser): terima jam format 7.00 dan 07:00 (#5)`

### Pull Request
- Judul mengikuti format commit.
- Isi memakai template: Ringkasan, Issue terkait (`Closes #n`), Perubahan, Cara menguji, Checklist.
- Ukuran PR kecil (idealnya < 400 baris diff). Jika membesar, pecah menjadi issue baru.
- Sebelum membuka PR, lakukan self-review: `git diff main...HEAD`.

## 3. Definition of Done (semua harus terpenuhi sebelum minta review)
- [ ] Kriteria penerimaan di issue terpenuhi dan sesuai PRD.
- [ ] `npm test` lulus (tambahkan test untuk logika baru: parser, waktu, status).
- [ ] `node --check` / lint lulus; CI hijau.
- [ ] Tidak ada rahasia, `console.log` debug, atau kode mati.
- [ ] `.env.example`, README, dan `docs/` diperbarui bila perilaku/konfigurasi berubah.
- [ ] PRD disinkronkan bila ada keputusan yang mengubah kebutuhan.
- [ ] Komentar di issue berisi ringkasan hasil dan cara memverifikasi.

## 4. Standar kode
- Node.js ≥ 18, **ESM** (`import`/`export`), tanpa dependensi baru kecuali perlu; sebutkan alasannya di PR.
- Konfigurasi hanya lewat `src/config.js` (baca dan validasi `process.env`), bukan tersebar.
- **Logika waktu dan status = fungsi murni** dengan `now` sebagai parameter. Semua tanggal bisnis memakai zona **Asia/Jakarta**; Date disimpan UTC.
- Handler pesan dan job scheduler harus **mengisolasi error per pasien** (try/catch); satu kegagalan tidak boleh menghentikan yang lain.
- Operasi harus **idempoten** (mis. unique index `patientId + tanggal`); jangan mengandalkan "pasti hanya jalan sekali".
- Semua pesan keluar lewat satu fungsi `send()` yang menerapkan jeda acak 1,5–4 detik.
- Teks pesan ke pasien hanya di `src/utils/messages.js`, mengikuti naskah di PRD §8: sopan, sederhana, tanpa emoji berlebihan.
- Logging memakai `pino`; jangan mencatat nama/RM/nomor pasien di level `info` ke atas.
- Nama file `kebab-case`/`camelCase` konsisten, fungsi kecil, JSDoc untuk fungsi publik.

## 5. Pengujian
- Test runner: `node --test` (folder `test/`).
- Wajib diuji: parser registrasi, penghitungan jam/tanggal WIB, penentuan status (Tepat Waktu/Terlambat/Tidak Konfirmasi), idempotensi, catch-up.
- Bug diperbaiki dengan **test yang gagal dulu**, lalu perbaikan.
- Pengujian WhatsApp nyata dilakukan di issue UAT dengan nomor uji, bukan nomor pasien.

## 6. Issue
- Setiap pekerjaan punya issue dengan: konteks, kriteria penerimaan (checklist), label (`type:*`, `area:*`, `priority:*`), milestone.
- Temuan baru → issue baru, bukan diam-diam dikerjakan.
- Tutup issue hanya lewat PR (`Closes #n`).

## 7. Berhenti dan tanya pengguna jika
- Perlu keputusan produk yang tidak ada di PRD (lihat PRD §16 pertanyaan terbuka).
- Perlu perintah destruktif (hapus branch/data, `reset --hard`, `push --force`, menghapus `auth_info/`).
- Perlu kredensial, akses akun, atau data pasien nyata.
- Test gagal dan penyebabnya tidak jelas setelah 2 kali percobaan.
- Perubahan akan melewati ~400 baris diff atau menyentuh di luar scope issue.

## 8. Cara melapor ke pengguna
Singkat dan konkret: apa yang selesai, link PR/issue, hasil test, dan satu langkah berikutnya. Jangan mengulang isi kode panjang di chat. Jika ada hambatan atau risiko, sebutkan langsung.

## 9. Referensi cepat
```bash
gh issue list --state open --milestone "M1 Registrasi (A)"
gh issue view <n>
gh pr status
git log --oneline -15
npm test
```
