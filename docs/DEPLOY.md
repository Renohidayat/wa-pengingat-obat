# Panduan Deployment & Operasional Server (PM2 / VM)

> **Proyek**: Bot WhatsApp Pengingat Minum Obat (Penelitian Kepatuhan Pasien)  
> **Peneliti**: Dea Farida — PUSKESMAS Sukarasa  
> **Dokumen Terkait**: [PRD.md](PRD.md) · [ONBOARDING.md](ONBOARDING.md)

---

## 1. Peringatan Penting: Karakteristik Hosting

> [!CAUTION]
> **Layanan Serverless dan PaaS Gratisan yang "Tidur" (Sleep on Idle) TIDAK DAPAT DIGUNAKAN.**  
> Contoh layanan yang tidak cocok: *Render Free Tier, Heroku Free/Eco, Vercel, Netlify, Railway Hobby Sleep*.
> 
> **Penyebab:**
> 1. **Koneksi Baileys Stateful**: WhatsApp bot memerlukan koneksi WebSocket yang terus menyala untuk menerima dan membalas pesan secara real-time. Jika server tidur, sesi WhatsApp terputus dan pasien tidak dapat menghubungi bot.
> 2. **Scheduler Presisi**: Pengecekan jadwal minum obat (`node-cron`) dieksekusi setiap menit secara real-time (Asia/Jakarta).
> 3. **Penyimpanan Sesi Lokal**: Folder sesi `auth_info/` harus berada di disk persisten, bukan ephemeral container yang hilang saat restart.

### Rekomendasi Pilihan Hosting:
1. **Laptop / Komputer PC Penelitian yang Selalu Menyala** (Sangat disarankan untuk tahap pilot/skripsi, biaya Rp 0):
   - Menggunakan OS Windows, Linux, atau macOS.
   - Pastikan komputer tidak masuk ke mode *Sleep* / *Hibernate*.
   - Terhubung ke jaringan internet stabil.
2. **Virtual Private Server (VPS) / Cloud VM**:
   - **Oracle Cloud Always Free** (VM Compute Ampere / AMD, gratis permanen).
   - VPS Linux (Ubuntu 22.04 LTS / 24.04 LTS) murah (misal Biznet Gio, IDCloudHost, DigitalOcean $4-6/bln).

---

## 2. Persiapan Lingkungan Server

### 2.1. Memasang Node.js (≥ 18.0.0)

Untuk Ubuntu/Debian:
```bash
# Tambahkan repositori NodeSource Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git

# Verifikasi versi Node.js dan npm
node -v   # Harus >= v18.0.0 (misal v20.x.x)
npm -v
```

Untuk Windows:
- Unduh dan pasang Node.js LTS dari [nodejs.org](https://nodejs.org/).

### 2.2. Memasang PM2 (Process Manager)
PM2 bertugas menjaga bot tetap menyala, me-restart otomatis jika terjadi error atau server mati lalu hidup kembali (*auto-restart on crash & boot*).

```bash
sudo npm install -g pm2
```

---

## 3. Instalasi & Konfigurasi Bot

### 3.1. Clone Repositori
```bash
git clone https://github.com/Renohidayat/wa-pengingat-obat.git
cd wa-pengingat-obat
```

### 3.2. Pasang Dependensi Produksi
```bash
npm ci --omit=dev
```

### 3.3. Mengatur Berkas Lingkungan (`.env`)
Salin template berkas `.env.example`:
```bash
cp .env.example .env
```
Sunting berkas `.env` (gunakan `nano .env`):
```ini
# Environment
NODE_ENV=production
TZ=Asia/Jakarta
LOG_LEVEL=info

# Database MongoDB Atlas
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/wa_pengingat_obat?retryWrites=true&w=majority

# Nomor Admin / Peneliti (pisahkan koma bila lebih dari 1, tanpa tanda + atau spasi)
ADMIN_NUMBERS=628123456789

# Direktori Penyimpanan Sesi WhatsApp (disk persisten)
AUTH_DIR=./auth_info
```

> [!IMPORTANT]
> - Pastikan IP server sudah di-*whitelist* pada Network Access di dashboard MongoDB Atlas (atau gunakan `0.0.0.0/0` dengan password database yang kuat).
> - Jangan pernah membagikan atau mengunggah file `.env` ke Git repository.

---

## 4. Pemindaian QR Code Pertama Kali (First Pairing)

Sebelum dijalankan di background oleh PM2, jalankan bot secara interaktif sekali untuk memindai QR Code nomor WhatsApp penelitian:

1. Jalankan aplikasi di terminal:
   ```bash
   npm start
   ```
2. QR Code akan muncul di terminal.
3. Buka aplikasi WhatsApp pada ponsel khusus penelitian:
   - Masuk ke **Pengaturan (Settings) > Perangkat Tertaut (Linked Devices) > Tautkan Perangkat (Link a Device)**.
   - Pindai QR Code yang tampil di layar terminal.
4. Tunggu hingga muncul log:
   ```
   {"level":30,"msg":"Koneksi WhatsApp berhasil tersambung"}
   ```
5. Tekan `Ctrl + C` untuk keluar dari mode interaktif. Folder `auth_info/` kini telah terisi berkas kredensial sesi.

---

## 5. Menjalankan Bot dengan PM2

### 5.1. Memulai Aplikasi
Jalankan bot menggunakan PM2:
```bash
pm2 start ecosystem.config.cjs
```
*(Atau bila tanpa berkas konfigurasi: `pm2 start src/index.js --name wa-bot`)*

### 5.2. Mengaktifkan Auto-Start saat Server Reboot
Agar bot otomatis berjalan saat komputer/VPS menyala setelah restart:
```bash
# Dapatkan perintah startup sesuai sistem operasi
pm2 startup

# Jalankan perintah yang ditampilkan di terminal (bila menggunakan Linux sudo)
# Kemudian simpan daftar proses aktif:
pm2 save
```

### 5.3. Perintah Operasional Harian PM2
| Kebutuhan | Perintah |
|---|---|
| Melihat status bot | `pm2 status` |
| Melihat log real-time | `pm2 logs wa-bot` |
| Melihat 100 baris log terakhir | `pm2 logs wa-bot --lines 100` |
| Me-restart bot | `pm2 restart wa-bot` |
| Menghentikan bot sementara | `pm2 stop wa-bot` |
| Memantau penggunaan memori/CPU | `pm2 monit` |

---

## 6. Prosedur Backup & Restore Sesi WhatsApp (`auth_info/`)

Folder `auth_info/` berisi token autentikasi dan enkripsi kunci Baileys. Jika folder ini hilang atau korup, bot akan logout dan harus memindai ulang QR Code.

### 6.1. Prosedur Backup Sesi
Lakukan backup berkala (misal seminggu sekali atau sebelum melakukan update server):
```bash
# Buat arsip cadangan sesi berstempel tanggal
tar -czvf auth_info_backup_$(date +%Y%m%d_%H%M%S).tar.gz auth_info/
```
Simpan file arsip cadangan tersebut di lokasi yang aman (misalnya unduh ke komputer lokal peneliti atau simpan di Google Drive terenkripsi).

### 6.2. Prosedur Restore Sesi
Jika berpindah server atau direktori sesi rusak:
1. Hentikan proses bot:
   ```bash
   pm2 stop wa-bot
   ```
2. Ekstrak file cadangan ke folder kerja proyek:
   ```bash
   tar -xzvf auth_info_backup_YYYYMMDD_HHMMSS.tar.gz
   ```
3. Nyalakan kembali bot:
   ```bash
   pm2 start wa-bot
   ```
Bot akan otomatis menyambung kembali tanpa perlu memindai QR Code ulang.

### 6.3. Prosedur Re-Scan QR Code (Jika Sesi Expired / Terputus Permanen)
Jika WhatsApp di ponsel sengaja di-logout atau sesi dinyatakan kadaluarsa oleh WhatsApp:
1. Hentikan proses bot:
   ```bash
   pm2 stop wa-bot
   ```
2. Hapus sesi lama:
   ```bash
   rm -rf auth_info/
   ```
3. Jalankan sementara dengan `npm start`, scan QR Code baru hingga terhubung.
4. Hentikan (`Ctrl + C`) dan jalankan kembali melalui PM2:
   ```bash
   pm2 start wa-bot
   ```

---

## 7. Prosedur Pembaruan Kode (Deploy Update)

Saat ada perbaikan bug atau rilis versi baru dari GitHub:

```bash
# 1. Masuk ke direktori proyek
cd wa-pengingat-obat

# 2. Ambil pembaruan kode terbaru
git checkout main
git pull origin main

# 3. Sinkronkan dependensi bila ada perubahan package
npm ci --omit=dev

# 4. Restart bot dengan konfigurasi terbaru
pm2 restart wa-bot --update-env

# 5. Periksa log untuk memastikan bot hidup normal
pm2 logs wa-bot --lines 30
```

---

## 8. Prosedur Ekspor Data Kepatuhan Skripsi

Kapan pun peneliti membutuhkan data Excel untuk analisis data:

```bash
# Jalankan perintah ekspor data
npm run export
```
File Excel akan otomatis dibuat di folder `exports/` dengan format:
`exports/rekap-kepatuhan-YYYY-MM-DD.xlsx`

File berisi dua lembar kerja (*sheet*):
1. **Log Kepatuhan**: Catatan pengingat dan status konfirmasi setiap pasien per hari.
2. **Rekap Pasien**: Ringkasan kepatuhan kumulatif per pasien beserta persentase kepatuhan.

---

## 9. Penanganan Gangguan & Kendala Operasional (Troubleshooting)

### Q: Komputer / Server sempat mati listrik selama 1 jam, apakah pengingat pasien akan terlewat?
**A:** Bot dilengkapi fitur **Catch-Up Otomatis (FR-13)**.
- Jika server menyala kembali dalam selisih waktu **≤ 60 menit** dari jadwal pasien, bot akan otomatis mengirimkan pengingat yang tertunda.
- Jika terlewat **> 60 menit**, pengingat tidak akan dikirimkan untuk menjaga etika waktu pasien dan sistem otomatis mencatat status sebagai `Terlewat Sistem`.
- Tidak ada duplikasi pengingat karena sistem menerapkan indeks unik harian (*idempotent*).

### Q: Pesan pengingat tidak terkirim pada jamnya?
1. Cek apakah bot aktif: `pm2 status`.
2. Cek apakah ada kendala koneksi WhatsApp: `pm2 logs wa-bot`.
3. Pastikan jam server menggunakan waktu Indonesia: periksa dengan perintah `date` di terminal server (harus menunjukkan waktu WIB yang akurat).

### Q: Ponsel utama WhatsApp kehabisan baterai, apakah bot tetap jalan?
**A:** **Ya**. Baileys menggunakan protokol Multi-Device resmi WhatsApp. Sekali tertaut, bot pada server tetap dapat mengirim dan menerima pesan meskipun ponsel utama mati atau tidak memiliki koneksi internet selama sesi tidak dicabut dari ponsel.
