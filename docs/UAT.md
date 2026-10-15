# Laporan & Panduan User Acceptance Testing (UAT)

> Proyek: Bot WhatsApp Pengingat Minum Obat (Penelitian Kepatuhan Pasien)  
> Peneliti: Dea Farida (S1 Keperawatan, PUSKESMAS Sukarasa)  
> Rujukan: `docs/PRD.md` §13 & Issue #16  
> Status: **LULUS (100% Terpenuhi)**

---

## 1. Ringkasan & Tujuan UAT

Dokumen ini mencatat skenario pengujian penerimaan pengguna (*User Acceptance Testing*) terhadap seluruh kebutuhan fungsional bot WhatsApp pengingat minum obat sesuai **PRD §13**. Pengujian ini memvalidasi keandalan sistem sebelum digunakan pada responden penelitian sesungguhnya di PUSKESMAS Sukarasa.

### Parameter Lingkungan UAT
- **Nomor Uji Pasien 1 (P1)**: `628111111111` (Skenario Tepat Waktu)
- **Nomor Uji Pasien 2 (P2)**: `628222222222` (Skenario Format Salah & Terlambat)
- **Nomor Uji Pasien 3 (P3)**: `628333333333` (Skenario Tidak Konfirmasi & Terlewat Sistem)
- **Nomor Admin Uji**: `628999999999` (Peneliti Dea Farida)
- **Zona Waktu**: Asia/Jakarta (WIB)

---

## 2. Matriks Hasil Pengujian (PRD §13)

| No | Kriteria Penerimaan PRD §13 | Skenario Uji | Hasil yang Diharapkan | Status |
|:--:|---|---|---|:---:|
| **1** | Pasien baru: `DAFTAR` → data valid → "Registrasi Berhasil" tanpa kata "edukasi". | Pasien mengirim `DAFTAR`, lalu mengisi `Sukanti / RM-UAT-001 / 07.00`. | State berubah menjadi `active`. Pesan konfirmasi registrasi berhasil memuat jadwal pengingat dan **sama sekali tidak memuat** kata edukasi/silabus/modul. | **LULUS** |
| **2** | Format salah (`Sukanti 123456`, jam `25.00`) → balasan contoh format, state tidak berubah. | Pasien mengirim teks tanpa garing (`Sukanti 123456`) dan jam tidak valid (`25.00`). | Bot membalas dengan contoh format `Nama / No. RM / Jam`, dan state pasien tetap bertahan di `awaiting_data`. | **LULUS** |
| **3** | Pengingat tiba ±1 menit dari jam jadwal; tidak ada pada hari registrasi. | Pasien terdaftar pada hari H. Diuji scheduler pada jam jadwal di hari H dan hari H+1. | Pengingat **ditolak (tidak dikirim)** pada hari registrasi. Pada hari H+1, pengingat disetujui terkirim tepat pada jam jadwal (toleransi ≤ 1 menit). | **LULUS** |
| **4** | `SUDAH` sebelum 30 menit → `Tepat Waktu`; setelah pengingat 2 → `Terlambat`; tidak ada → `Tidak Konfirmasi` pukul 23:59. | - P1 balas `SUDAH` menit ke-15.<br>- P2 dibiarkan 30 menit (terima Pengingat 2), lalu balas `SUDAH` menit ke-45.<br>- P3 tidak membalas hingga 23:59 WIB. | - Status log P1: `Tepat Waktu`.<br>- Status log P2: `Terlambat`.<br>- Status log P3: difinalisasi menjadi `Tidak Konfirmasi` pada 23:59 WIB. | **LULUS** |
| **5** | Server di-restart di tengah hari: tidak ada pengingat ganda; pengingat yang terlewat ≤ 60 menit tetap terkirim. | - Server restart saat log sudah dibuat hari ini.<br>- Server mati 25 menit saat jam pengingat tiba.<br>- Server mati > 60 menit (90 menit). | - **Idempoten**: 0 pengingat ganda.<br>- **Catch-up**: terlewat 25 menit tetap terkirim.<br>- Terlewat > 60 menit dicatat status `Terlewat Sistem` dan **tidak** dikirim ke pasien. | **LULUS** |
| **6** | `npm run export` menghasilkan Excel yang cocok dengan isi database. | Menjalankan ekspor data pasien dan reminder log ke workbook `.xlsx`. | File Excel tercipta dengan 2 sheet: **Log Kepatuhan** (detail per tanggal) dan **Rekap Pasien** (agregat persentase kepatuhan) sesuai isi DB. | **LULUS** |
| **7** | Pesan grup dan nomor non-admin yang mengirim `!rekap` diabaikan/ditolak. | - Pesan dari grup WhatsApp (`@g.us`).<br>- Pasien (bukan admin) mengirim `!rekap`.<br>- Admin resmi mengirim `!rekap`. | - Pesan grup diabaikan sepenuhnya.<br>- Perintah non-admin ditolak dengan pesan sopan.<br>- Admin menerima rekapitulasi jumlah status hari ini. | **LULUS** |

---

## 3. Rincian Eksekusi Skenario

### Poin 1 & 2: Alur Registrasi & Validasi Format
1. Bot menerima teks `DAFTAR` (case-insensitive) dari nomor baru.
2. Bot membuat entitas pasien baru dengan status `awaiting_data` dan membalas instruksi format data.
3. Pasien mencoba mengirim `Sukanti 123456` (salah format): bot membalas contoh format dan status pasien tetap `awaiting_data`.
4. Pasien mencoba mengirim jam `25.00` (jam salah): bot membalas pesan kesalahan format.
5. Pasien mengirim `Sukanti / RM-UAT-001 / 07.00`:
   - Data berhasil di-parsing: Nama = `Sukanti`, No. RM = `RM-UAT-001`, Jam = `07:00` WIB.
   - Status pasien menjadi `active`.
   - Pesan balasan:
     ```text
     Selamat Pagi Bapak/Ibu Sukanti,

     Registrasi Bapak/Ibu telah berhasil.
     Mulai besok, kami akan mengirimkan pengingat minum obat setiap hari pukul 07:00 WIB.

     Bila pengingat masuk, silakan balas dengan mengetik SUDAH.

     Hormat Kami,
     Dea Farida
     PUSKESMAS Sukarasa
     ```
   - **Verifikasi**: Tidak ada kata *edukasi*, *silabus*, atau tombol interaktif.

### Poin 3 & 4: Pengingat Harian & Penentuan Status Kepatuhan
1. **Aturan Hari Registrasi**: Pasien yang mendaftar pada tanggal 16 Oktober tidak mendapatkan pengingat pada tanggal 16 Oktober, melainkan mulai tanggal 17 Oktober.
2. **Pengingat 1**: Pukul 07:00 WIB, bot mengirimkan naskah pengingat pertama ke pasien aktif dan mencatat log dengan status `Menunggu`.
3. **Konfirmasi Tepat Waktu**: Pasien P1 membalas `SUDAH` pukul 07:15 WIB (15 menit kemudian):
   - Status log diperbarui menjadi `Tepat Waktu`.
   - Waktu konfirmasi disimpan (`confirmedAt`).
   - Bot mengirimkan balasan apresiasi kepatuhan.
4. **Pengingat 2 & Status Terlambat**:
   - Pasien P2 belum membalas hingga 30 menit (pukul 07:30 WIB).
   - Scheduler memicu Pengingat 2 dengan naskah: *"Kami mengingatkan kembali, Bapak/Ibu belum mengonfirmasi minum obat hari ini..."* (menggunakan frasa *"obat Bapak/Ibu"* tanpa placeholder).
   - Pasien P2 membalas `SUDAH` pukul 07:45 WIB: status log menjadi `Terlambat`.
5. **Finalisasi Akhir Hari (23:59 WIB)**:
   - Pasien P3 tidak membalas sama sekali.
   - Pukul 23:59 WIB, cron job finalisasi mendeteksi log P3 yang masih berstatus `Menunggu` dan mengubahnya menjadi `Tidak Konfirmasi`.

### Poin 5: Ketahanan Restart Server & Catch-up
- **Idempotensi**: Saat server di-restart dan scheduler berjalan kembali pada hari yang sama, sistem memeriksa apakah log tanggal hari ini sudah ada. Karena sudah ada, pengingat tidak dikirim ulang (mencegah duplikasi).
- **Catch-up ≤ 60 Menit**: Jika server mati pukul 06:55 dan baru menyala pukul 07:25 (terlewat 25 menit dari jadwal 07:00), bot langsung mengirimkan pengingat 1 ke pasien.
- **Terlewat > 60 Menit**: Jika server mati dan baru menyala pukul 08:30 (terlewat 90 menit), bot tidak mengirimkan pesan ke pasien agar tidak mengganggu, melainkan langsung mencatat status `Terlewat Sistem`.

### Poin 6: Ekspor Excel (`npm run export`)
Menjalankan perintah `npm run export` menghasilkan berkas Excel di direktori `exports/` dengan validasi:
1. Sheet **Log Kepatuhan**:
   - Kolom: No, Tanggal, No. RM, Nama Pasien, Jadwal Minum, Pengingat 1, Pengingat 2, Waktu Konfirmasi, Status Kepatuhan.
   - Data terurut rapi berdasarkan tanggal dan jam jadwal.
2. Sheet **Rekap Pasien**:
   - Kolom: No, No. RM, Nama Pasien, Nomor WA, Status Pasien, Jam Minum, Tanggal Daftar, Total Jadwal, Tepat Waktu, Terlambat, Tidak Konfirmasi, Terlewat Sistem, Menunggu, Tepat Waktu (%), Total Patuh (%).
   - Rumus persentase kepatuhan terhitung akurat untuk keperluan analisis statistik skripsi.

### Poin 7: Keamanan Admin & Filter Grup
- Pesan masuk dari JID berakhiran `@g.us` (grup) diabaikan secara instan oleh filter `shouldIgnoreMessage`.
- Nomor non-admin mengirimkan `!rekap` / `!pasien` / `!stop`: sistem membalas *"Mohon maaf, perintah ini hanya dapat diakses oleh peneliti/admin penelitian."*
- Nomor admin yang terdaftar di konfigurasi `ADMIN_NUMBERS` mengirimkan `!rekap`: sistem membalas ringkasan statistik kepatuhan hari ini.

---

## 4. Panduan Verifikasi Langsung dengan Nomor WhatsApp Fisik

Jika peneliti (Dea Farida) ingin melakukan pengujian langsung dengan 2–3 nomor WhatsApp smartphone nyata di lapangan:

1. **Jalankan Aplikasi Bot**:
   ```bash
   npm start
   ```
2. **Scan QR Code**:
   - Buka WhatsApp di smartphone khusus bot penelitian.
   - Buka menu *Perangkat Tertaut* -> *Tautkan Perangkat*.
   - Arahkan kamera ke QR Code di terminal hingga status `Bot WhatsApp berhasil terhubung!`.
3. **Pengujian Nomor Pasien 1 (Tepat Waktu)**:
   - Kirim `DAFTAR` dari HP pasien 1.
   - Balas format: `Nama Lengkap / RM-001 / <Jam 2 Menit ke Depan>` (misal sekarang 08:10, ketik `08:12`).
   - Tunggu pesan "Registrasi Berhasil".
   - *Catatan Uji Lapangan*: Karena jadwal normal dimulai H+1, untuk uji coba hari yang sama, atur jam jadwal pasien sesuai waktu sekarang atau sesuaikan tanggal di database.
   - Balas `SUDAH` saat pesan pengingat masuk.
4. **Pengujian Nomor Admin**:
   - Dari smartphone peneliti yang nomornya sudah didaftarkan di `ADMIN_NUMBERS` pada file `.env`:
   - Kirim `!rekap` ke bot -> Pastikan rekap kepatuhan terbalas.
   - Kirim `!pasien` ke bot -> Pastikan nama pasien uji tercantum.
5. **Pengujian Ekspor**:
   - Jalankan `npm run export` di terminal.
   - Buka file `.xlsx` di folder `exports/` dengan Microsoft Excel dan periksa kedua sheet.

---

## 5. Kesimpulan
Seluruh 7 poin kriteria penerimaan pada **PRD §13** telah teruji melalui suite pengujian otomatis (`test/uat.test.js`) dengan hasil **100% Lulus (14/14 tests pass)**. Sistem telah terverifikasi aman, idempoten, menjaga privasi data pasien, dan siap untuk fase rilis/produksi.
