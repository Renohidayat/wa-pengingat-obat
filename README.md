# Bot WhatsApp Pengingat Minum Obat (Penelitian Kepatuhan)

> **Pemilik Proyek**: Dea Farida  
> **Konteks**: Penelitian Skripsi S1 Keperawatan, PUSKESMAS Sukarasa  
> **Dokumentasi Sumber Kebenaran**: [docs/PRD.md](docs/PRD.md)  
> **Aturan Kerja & Standar Kode**: [AGENTS.md](AGENTS.md)

---

## 1. Deskripsi

Aplikasi bot WhatsApp otomatis yang dirancang untuk:
1. **Registrasi Mandiri Pasien (A)**: Pasien mendaftar via chat dengan format `Nama / No. RM / Jam minum obat`.
2. **Pengingat Minum Obat Harian (B.1)**: Mengirimkan pesan pengingat harian pada jam minum obat pasien (WIB), mencatat konfirmasi `SUDAH`, mengirimkan pengingat ke-2 jika belum ada respons setelah 30 menit, dan memperbarui status kepatuhan harian.
3. **Pencatatan & Ekspor Data**: Menyimpan seluruh log kepatuhan ke MongoDB dan menyediakan fitur ekspor log ke Excel (`.xlsx`) untuk analisis data penelitian.

---

## 2. Tech Stack

- **Runtime**: Node.js ≥ 18 (ESM)
- **WhatsApp Engine**: `@whiskeysockets/baileys`
- **Database**: MongoDB Atlas M0 + Mongoose
- **Scheduler**: `node-cron` (zona waktu Asia/Jakarta)
- **Ekspor Data**: `exceljs`
- **Logger**: `pino`
- **Test Runner**: `node:test` (built-in Node.js)
- **CI**: GitHub Actions

---

## 3. Struktur Direktori

Mengikuti panduan arsitektur pada PRD §10:

```
├── .github/
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── workflows/
│       └── ci.yml
├── docs/
│   ├── DEPLOY.md
│   └── PRD.md
├── scripts/
│   ├── export-excel.js
│   └── setup-github.sh
├── src/
│   ├── bot/
│   │   ├── client.js
│   │   └── handlers.js
│   ├── db/
│   │   ├── connection.js
│   │   └── models.js
│   ├── scheduler/
│   │   └── index.js
│   ├── services/
│   │   ├── adherence.js
│   │   ├── registration.js
│   │   └── reminder.js
│   ├── utils/
│   │   ├── messages.js
│   │   ├── parser.js
│   │   └── time.js
│   ├── config.js
│   └── index.js
├── test/
│   └── smoke.test.js
├── .env.example
├── .gitignore
├── AGENTS.md
├── package.json
└── README.md
```

---

## 4. Prasyarat Sistem

- **Node.js** versi ≥ 18.0.0
- **npm** versi ≥ 9.0.0
- Akun / URI koneksi **MongoDB Atlas** atau MongoDB lokal

---

## 5. Cara Instalasi & Menjalankan Lokal

1. **Clone repositori**:
   ```bash
   git clone https://github.com/Renohidayat/wa-pengingat-obat.git
   cd wa-pengingat-obat
   ```

2. **Pasang dependensi**:
   ```bash
   npm ci
   ```

3. **Konfigurasi Environment**:
   Salin berkas template `.env.example` ke `.env`:
   ```bash
   cp .env.example .env
   ```
   Sesuaikan nilai `MONGODB_URI` dan `ADMIN_NUMBERS`.

4. **Menjalankan Pengujian**:
   ```bash
   npm test
   ```

5. **Menjalankan Aplikasi**:
   ```bash
   npm start
   ```

---

## 6. Standar Pengembangan

Setiap kontribusi wajib mengikuti aturan di [AGENTS.md](AGENTS.md):
- **Satu issue = satu branch = satu PR**.
- Format branch: `<type>/<nomor-issue>-<slug-singkat>`.
- Format commit: Conventional Commits (`<type>(<scope>): <deskripsi imperatif> (#<issue>)`).
- Semua tanggal bisnis menggunakan zona waktu **Asia/Jakarta (WIB)**.
- Dilarang keras melakukan commit rahasia (`.env`, `auth_info/`, token, data pasien).
