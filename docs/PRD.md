# PRD — Bot WhatsApp Pengingat Minum Obat (Penelitian Kepatuhan)

> Status: Draft v1.0 · Pemilik: Dea Farida · Konteks: skripsi S1 Keperawatan, PUSKESMAS Sukarasa
> Dokumen ini adalah sumber kebenaran (source of truth). Jika kode dan PRD berbeda, PRD diperbarui lewat PR atau kode diperbaiki. Jangan dibiarkan berbeda.

---

## 1. Ringkasan

Bot WhatsApp yang (A) mendaftarkan pasien peserta penelitian, (B.1) mengirim **pengingat minum obat harian** otomatis, mencatat konfirmasi pasien, dan (B.2) mengirim **pesan edukasi kesehatan** otomatis tiga kali seminggu; seluruh data disimpan ke database dan dapat diekspor ke Excel untuk analisis skripsi.

## 2. Tujuan & Metrik Keberhasilan

| Tujuan | Metrik |
|---|---|
| Pasien bisa registrasi mandiri lewat chat | ≥ 95% registrasi valid selesai tanpa bantuan peneliti saat UAT |
| Pengingat terkirim tepat jam | ≥ 99% pengingat terkirim ≤ 2 menit dari jam jadwal (selama server hidup) |
| Tidak ada pengingat ganda | 0 duplikat per pasien per hari |
| Data siap analisis | Ekspor Excel berisi log lengkap per pasien per hari dengan 1 perintah |
| Biaya | Rp 0 untuk infrastruktur (lihat §11) |

## 3. Ruang Lingkup

### In scope (v1)
- **A. Registrasi pasien**: pesan perkenalan (via link/QR), perintah `DAFTAR`, input `Nama / No. RM / Jam minum obat` (1 atau 2 jam), pesan "Registrasi Berhasil".
- **B.1 Pengingat obat**: pengingat harian pada setiap jam jadwal pasien (1–2 dosis/hari), konfirmasi `SUDAH`, pengingat ke-2 setelah 30 menit tanpa respons per jadwal, pencatatan log kepatuhan per jadwal.
- **B.2 Edukasi otomatis**: pesan edukasi kesehatan setiap Senin, Rabu, Jumat pukul 09.00 WIB; 22 materi berurutan per pasien; satu arah (tidak butuh balasan); log edukasi per pasien.
- Ekspor log ke Excel (sheet Log Kepatuhan, Rekap Pasien, Log Edukasi).
- Perintah admin minimal untuk peneliti (lihat FR-30..32).

### Out of scope (v1)
- **C. Pesan akhir intervensi otomatis** (belum diputuskan; ditaruh di backlog opsional, lihat §14).
- Tombol interaktif WhatsApp (tidak stabil di Baileys; diganti ketik `SUDAH`).
- Dashboard web, multi-bahasa, pembayaran, grup WhatsApp.

## 4. Pengguna

- **Pasien**: peserta penelitian, mayoritas dewasa/lansia, mengetik singkat. Bahasa harus sopan dan sederhana.
- **Peneliti/Admin** (Dea Farida): memantau, mengekspor data, menghentikan pasien yang mundur.

## 5. User Stories

1. Sebagai pasien, saya ingin mendaftar cukup dengan mengetik `DAFTAR` lalu satu baris data, supaya mudah.
2. Sebagai pasien, saya ingin diingatkan pada jam saya minum obat, dan bisa membalas `SUDAH` untuk konfirmasi.
3. Sebagai pasien, saya ingin diingatkan sekali lagi bila lupa membalas.
4. Sebagai peneliti, saya ingin semua konfirmasi tersimpan dengan status dan waktu, agar bisa dianalisis.
5. Sebagai peneliti, saya ingin mengekspor data ke Excel dan menghentikan pengingat untuk pasien tertentu.
6. Sebagai pasien, saya ingin menerima pesan edukasi kesehatan secara otomatis agar pengetahuan saya bertambah.
7. Sebagai peneliti, saya ingin edukasi dikirim secara berurutan dan tercatat, agar bisa dianalisis.

## 6. Alur Pengguna

### 6.1 Registrasi (A)
```
Peneliti bagikan link wa.me/<nomor>?text=DAFTAR  (atau QR)
  → Pasien kirim "DAFTAR"
  → Bot: minta "Nama / No. RM / Jam"          [state: awaiting_data]
  → Pasien: "Sukanti / 123456 / 07.00"              (1 jam)
         atau "Sukanti / 123456 / 07.00 / 19.00"    (2 jam)
      valid   → simpan, state=active, kirim "Registrasi Berhasil"
      invalid → kirim contoh format, state tetap awaiting_data
```
Pesan perkenalan (A.1) dikirim peneliti secara **manual** atau ditempel pada deskripsi/link, bukan dikirim massal oleh bot (menghindari blokir WhatsApp).

### 6.2 Pengingat harian (B.1)
```
Setiap jam jadwal pasien tiba (WIB) dan hari ini bukan hari registrasi
  → Bot kirim pengingat 1 (untuk jadwal ini); buat log hari ini + jadwal status "Menunggu"
  → Pasien balas SUDAH → status "Tepat Waktu", bot kirim terima kasih
  → 30 menit tanpa respons → bot kirim pengingat 2
        → Pasien balas SUDAH → status "Terlambat", bot kirim terima kasih
  → Sampai 23:59 WIB tetap tanpa respons → status "Tidak Konfirmasi"

Jika pasien punya 2 jadwal (mis. 07:00 dan 19:00), proses di atas berjalan
independen untuk masing-masing jadwal. Konfirmasi SUDAH dikaitkan ke log
jadwal yang paling terakhir berstatus "Menunggu".
```

### 6.3 State pasien
`new → awaiting_data → active → stopped` (`stopped` = dihentikan admin / mundur).

### 6.4 Edukasi otomatis (B.2)
```
Setiap Senin, Rabu, Jumat pukul 09:00 WIB dan hari ini bukan hari registrasi
  → Untuk setiap pasien berstatus active:
      - Cek edukasiIndex pasien; jika sudah habis (>= total materi) → skip
      - Cek apakah sudah ada education_log hari ini (idempoten)
      - Jika belum: kirim materi ke-N, catat log status "Terkirim", naikkan edukasiIndex
      - Jika server mati dan keterlambatan <= 60 menit: kirim (catch-up)
      - Jika keterlambatan > 60 menit: catat "Terlewat Sistem", JANGAN naikkan edukasiIndex
  → Pesan satu arah; pasien tidak perlu membalas
```

## 7. Kebutuhan Fungsional

| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-01 | Bot terhubung ke WhatsApp via QR (Baileys), sesi tersimpan di disk, auto-reconnect | P0 |
| FR-02 | Abaikan pesan grup, status, dan pesan dari bot sendiri | P0 |
| FR-03 | `DAFTAR` (case-insensitive, trim) memulai registrasi; pengguna baru otomatis dibuat | P0 |
| FR-04 | Parser `Nama / RM / Jam1` atau `Nama / RM / Jam1 / Jam2`: pemisah `/`, jam menerima `07.00`, `7.00`, `07:00`; validasi jam 00:00–23:59; nama dan RM tidak kosong; jika 2 jam, keduanya harus valid dan tidak boleh sama | P0 |
| FR-05 | Data invalid → balasan contoh format, tanpa mengubah state | P0 |
| FR-06 | RM unik: RM yang sudah terdaftar oleh nomor lain ditolak dengan pesan sopan | P1 |
| FR-07 | Pesan "Registrasi Berhasil" menyebut jadwal pengingat harian (1 atau 2 jam) dan jadwal edukasi (Senin/Rabu/Jumat pukul 09.00) | P0 |
| FR-10 | Scheduler berjalan tiap menit, zona waktu Asia/Jakarta | P0 |
| FR-11 | Kirim pengingat 1 pada setiap jam jadwal pasien; **tidak** dikirim pada hari registrasi (mulai besok) | P0 |
| FR-12 | **Idempoten**: maksimal 1 log per pasien per tanggal **per jadwal** (unique index `patientId + tanggal + jadwal`) sehingga tidak ada pengingat ganda | P0 |
| FR-13 | **Catch-up**: jika server mati lalu hidup lagi, pengingat yang terlewat ≤ 60 menit tetap dikirim; lebih dari itu dicatat `Terlewat Sistem` dan tidak dikirim | P1 |
| FR-14 | Konfirmasi: `SUDAH`, `SUDAH MINUM`, `SDH`, `UDAH` (case-insensitive) | P0 |
| FR-15 | Konfirmasi sebelum pengingat 2 → `Tepat Waktu`; sesudah pengingat 2 → `Terlambat`; simpan `confirmedAt`. Jika pasien punya 2 jadwal, SUDAH dikaitkan ke log jadwal yang paling terakhir berstatus `Menunggu` | P0 |
| FR-16 | Konfirmasi ganda di hari yang sama → balas "sudah tercatat", tidak mengubah log | P0 |
| FR-17 | Pengingat 2 dikirim 30 menit setelah pengingat 1 bila status masih `Menunggu` | P0 |
| FR-18 | Job akhir hari (23:59 WIB): log `Menunggu` → `Tidak Konfirmasi` | P0 |
| FR-19 | Pesan `SUDAH` tanpa pengingat aktif → balasan netral | P1 |
| FR-20 | Jeda acak 1,5–4 detik antar pesan keluar, untuk mengurangi risiko blokir | P0 |
| FR-21 | Teks pengingat sesuai dokumen penelitian (lihat §8); mengganti tombol dengan instruksi ketik `SUDAH` | P0 |
| FR-30 | Admin `!rekap`: ringkasan hari ini (jumlah Tepat Waktu / Terlambat / Menunggu / Tidak Konfirmasi) | P1 |
| FR-31 | Admin `!pasien`: daftar pasien aktif beserta jam minum | P1 |
| FR-32 | Admin `!stop <RM>`: hentikan pengingat pasien (state `stopped`) | P1 |
| FR-33 | Admin `!export` / `!download`: generate dan kirim file dokumen Excel (`.xlsx`) langsung ke chat WhatsApp | P1 |
| FR-40 | `npm run export` menghasilkan `.xlsx` berisi sheet **Log Kepatuhan**, **Rekap Pasien**, dan **Log Edukasi** | P0 |

### Kebutuhan Fungsional Edukasi (B.2)

| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-50 | Materi edukasi dibaca dari `content/edukasi.json` (22 materi berurutan; judul + isi) | P0 |
| FR-51 | Skrip `npm run validate:content` memvalidasi JSON: tiap materi punya judul dan isi tidak kosong, isi 2–4 kalimat, panjang isi ≤ 600 karakter | P0 |
| FR-52 | Scheduler mengirim edukasi setiap Senin, Rabu, Jumat tepat pukul 09:00 WIB; tidak dikirim pada hari registrasi (mulai besok) | P0 |
| FR-53 | **Idempoten**: maksimal 1 edukasi per pasien per tanggal (unique index `patientId + tanggal` pada koleksi `education_logs`) | P0 |
| FR-54 | **Catch-up**: jika server mati lalu hidup, edukasi yang terlewat ≤ 60 menit dari 09:00 tetap dikirim; lebih dari itu dicatat `Terlewat Sistem` dan `edukasiIndex` TIDAK dinaikkan | P1 |
| FR-55 | Setiap pasien punya penghitung `edukasiIndex` sendiri; pasien yang daftar belakangan mulai dari materi ke-1 | P0 |
| FR-56 | Jika semua materi sudah terkirim (`edukasiIndex >= total`), berhenti; pengingat obat tetap jalan. Jangan mengulang dari awal | P0 |
| FR-57 | Log edukasi menyimpan: `patientId`, `tanggal`, `materiKe` (1-based), `judul`, `status` (Terkirim / Terlewat Sistem), `sentAt` | P0 |

Perintah admin hanya diterima dari nomor di `ADMIN_NUMBERS`.

## 8. Naskah Pesan (sumber: dokumen penelitian)

Semua pesan ditutup dengan:
```
Hormat Kami,
Dea Farida
PUSKESMAS Sukarasa
```
Salam dinamis: Pagi (<11), Siang (11–14), Sore (15–17), Malam (≥18) berdasarkan WIB.

- **Perkenalan (manual/link)**: sesuai dokumen A.1, diakhiri ajakan mengetik `DAFTAR`.
- **Minta data**: sesuai A.3 dengan contoh `Sukanti / 123456 / 07.00` (1 jam) atau `Sukanti / 123456 / 07.00 / 19.00` (2 jam).
- **Registrasi berhasil**: sesuai A.4. Menyebut:
  - Pengingat minum obat setiap hari pukul `<jam1>` (atau `<jam1> dan <jam2>` jika 2 jadwal)
  - Edukasi kesehatan setiap Senin, Rabu, Jumat pukul 09.00 WIB
- **Pesan Edukasi (B.2)**:
```
Selamat <Pagi/Siang/Sore/Malam>, Bapak/Ibu <Nama>

Edukasi Kesehatan Hari Ini: <Judul>

<Isi materi>

Semoga bermanfaat.

Hormat Kami,
Dea Farida
PUSKESMAS Sukarasa
```
- **Pengingat 1**: teks B.1 ("Sudah waktunya untuk minum obat…") + instruksi ketik `SUDAH`.
- **Terima kasih konfirmasi**: "Kepatuhan Bapak/Ibu hari ini sudah kami catat. Pertahankan ya!…"
- **Pengingat 2**: "Kami mengingatkan kembali, Bapak/Ibu belum mengonfirmasi minum obat hari ini…" Karena registrasi tidak meminta nama obat, gunakan frasa "obat Bapak/Ibu" (tanpa placeholder `[Nama Obat]`).

## 9. Model Data (MongoDB)

**patients**
| Field | Tipe | Catatan |
|---|---|---|
| jid | string, unique | ID WhatsApp |
| state | enum | new, awaiting_data, active, stopped |
| nama, noRM | string | noRM unik (partial index) |
| jamMinum | array of string `HH:mm` | WIB; 1 atau 2 elemen |
| registeredAt | Date | pengingat dan edukasi mulai hari berikutnya |
| edukasiIndex | number | indeks materi edukasi berikutnya (0-based); default 0 |
| createdAt, updatedAt | Date | |

**reminder_logs**
| Field | Tipe | Catatan |
|---|---|---|
| patientId | ObjectId | |
| tanggal | string `YYYY-MM-DD` (WIB) | unique bersama patientId + jadwal |
| jadwal | string `HH:mm` | |
| status | enum | Menunggu, Tepat Waktu, Terlambat, Tidak Konfirmasi, Terlewat Sistem |
| reminder1At, reminder2At, confirmedAt | Date | |

**education_logs**
| Field | Tipe | Catatan |
|---|---|---|
| patientId | ObjectId | |
| tanggal | string `YYYY-MM-DD` (WIB) | unique bersama patientId |
| materiKe | number | nomor urut materi 1-based |
| judul | string | judul materi |
| status | enum | Terkirim, Terlewat Sistem |
| sentAt | Date | waktu pengiriman (null jika Terlewat Sistem) |

Prinsip: tanggal bisnis selalu dihitung di WIB; Date disimpan UTC.

## 10. Arsitektur

```
Pasien ⇄ WhatsApp ⇄ Baileys (src/bot) ─┬─ Handler pesan (src/handlers)
                                       └─ Scheduler tiap menit (src/scheduler)
                                              ↓
                                         MongoDB Atlas (M0)
Peneliti → npm run export → Excel
```

Struktur folder target:
```
content/
  edukasi.json          materi edukasi (22 item)
src/
  index.js              entry point
  config.js             baca & validasi env
  db/{connection,models}.js
  bot/{client,handlers}.js
  services/{registration,reminder,adherence,education}.js
  scheduler/index.js
  utils/{time,parser,messages,content}.js   ← fungsi murni, mudah diuji
scripts/
  export-excel.js
  validate-content.js   validasi content/edukasi.json
test/                   node:test
docs/PRD.md  docs/DEPLOY.md
AGENTS.md
```
Aturan desain: logika waktu dan status ditulis sebagai **fungsi murni dengan jam yang bisa disuntik** (`now` sebagai parameter) agar bisa diuji tanpa menunggu waktu nyata.

## 11. Tech Stack (semua gratis)

| Lapisan | Pilihan |
|---|---|
| Runtime | Node.js ≥ 18 (ESM) |
| WhatsApp | `@whiskeysockets/baileys` (nomor WA khusus penelitian) |
| Database | MongoDB Atlas M0 + Mongoose |
| Scheduler | `node-cron` (tiap menit, TZ Asia/Jakarta) |
| Ekspor | `exceljs` |
| Log | `pino` |
| Test | `node:test` bawaan Node |
| CI | GitHub Actions (cek sintaks + test) |
| Hosting | Harus **selalu menyala**: PC/laptop + `pm2` untuk pilot, atau VM gratis (mis. Oracle Always Free, cek ketersediaan) untuk jangka panjang. Hosting yang tidur saat idle (mis. tier gratis yang sleep) tidak cocok karena sesi WA terputus |

## 12. Kebutuhan Non-Fungsional

- **Privasi/etika**: data pasien (nama, RM, nomor WA) adalah data sensitif. Hanya dipakai untuk penelitian; ada informed consent dan persetujuan etik dari institusi. Jangan log isi data pasien ke konsol produksi; Atlas dibatasi IP bila memungkinkan.
- **Keamanan**: `.env` dan `auth_info/` tidak boleh masuk Git; perintah admin dibatasi whitelist nomor.
- **Keandalan**: auto-reconnect, graceful shutdown, error di satu pasien tidak menghentikan pengiriman ke pasien lain.
- **Skala**: target ≤ 100 pasien.
- **Risiko Baileys**: tidak resmi, nomor bisa dibatasi. Mitigasi: nomor khusus, jeda acak, hanya membalas/menghubungi pasien yang sudah menghubungi duluan, tidak kirim massal sekaligus, backup `auth_info/`.

## 13. Kriteria Penerimaan (UAT)

1. Pasien baru: `DAFTAR` → data valid → "Registrasi Berhasil" menyebut jam pengingat dan jadwal edukasi Senin/Rabu/Jumat 09.00.
2. Format salah (`Sukanti 123456`, jam `25.00`) → balasan contoh format, state tidak berubah.
3. Pengingat tiba ±1 menit dari jam jadwal; tidak ada pada hari registrasi.
4. `SUDAH` sebelum 30 menit → `Tepat Waktu`; setelah pengingat 2 → `Terlambat`; tidak ada → `Tidak Konfirmasi` pukul 23:59.
5. Server di-restart di tengah hari: tidak ada pengingat ganda; pengingat yang terlewat ≤ 60 menit tetap terkirim.
6. `npm run export` menghasilkan Excel yang cocok dengan isi database (3 sheet).
7. Pesan grup dan nomor non-admin yang mengirim `!rekap` diabaikan/ditolak.
8. Pasien baru tidak menerima edukasi di hari registrasi.
9. Edukasi terkirim Senin/Rabu/Jumat pukul 09.00 ±1 menit, urut materi ke-1, ke-2, ke-3, dst.
10. Restart server tidak menyebabkan edukasi ganda (idempoten).
11. Setelah semua 22 materi terkirim, tidak ada pengiriman edukasi lagi; pengingat obat tetap jalan.
12. Sheet "Log Edukasi" di Excel cocok dengan data di database.

## 14. Backlog Opsional (setelah v1)

- Pesan akhir intervensi (1/3 bulan) dan penutupan otomatis.
- Nama obat per pasien.
- Dashboard ringkas.
- Migrasi ke WhatsApp Cloud API resmi bila nomor sering dibatasi.

## 15. Rencana Kerja (Milestone & Issue)

Detail issue dibuat otomatis oleh `scripts/setup-github.sh`. Urutan pengerjaan wajib berurutan per milestone.

| Milestone | Issue |
|---|---|
| **M0 Fondasi** | 1 Setup repo, struktur, CI, README · 2 Impor kerangka awal dan hapus fitur edukasi/penutup · 3 Config env + koneksi MongoDB + model |
| **M1 Registrasi (A)** | 4 Koneksi WhatsApp + sesi + reconnect · 5 Alur `DAFTAR` + parser + validasi · 6 Dokumentasi link/QR `wa.me` + naskah perkenalan |
| **M2 Pengingat (B.1)** | 7 Scheduler pengingat 1 (idempoten + catch-up) · 8 Konfirmasi `SUDAH` + status · 9 Pengingat ke-2 · 10 Finalisasi harian `Tidak Konfirmasi` |
| **M3 Data & Admin** | 11 Ekspor Excel · 12 Perintah admin `!rekap` `!pasien` `!stop` |
| **M4 Kualitas & Rilis** | 13 Unit test parser, waktu, status · 14 Panduan deploy (pm2/VM) + backup sesi · 15 Hardening (log, shutdown, error isolation) · 16 UAT dengan 2–3 nomor + checklist |
| **M5 Edukasi (B.2)** | 46 content loader & validasi edukasi.json · 47 Model education_logs & field edukasiIndex · 48 Scheduler edukasi Senin/Rabu/Jumat 09.00 · 49 Perbarui pesan Registrasi Berhasil · 50 Sheet Log Edukasi di Excel · 51 Unit test edukasi · 52 Update README & DEPLOY untuk edukasi |

## 16. Pertanyaan Terbuka (konfirmasi dengan pembimbing)

1. Definisi "tepat waktu" yang dipakai skripsi: konfirmasi sebelum pengingat 2 (asumsi saat ini) atau dalam rentang tertentu dari jam minum?
2. Perlu mencatat nama obat per pasien? (saat ini tidak)
3. Pesan akhir intervensi diperlukan atau penelitian dihentikan manual?
4. Durasi penelitian (1 atau 3 bulan) dan jumlah responden final?
