# Panduan Onboarding & Naskah Perkenalan Pasien

Dokumen ini memuat panduan teknis bagi peneliti (**Dea Farida**) untuk menyiapkan tautan pendaftaran (`wa.me`), pembuatan QR code, dan naskah perkenalan pasien peserta penelitian kepatuhan minum obat di **PUSKESMAS Sukarasa** sesuai **PRD §6.1** dan **PRD §8**.

---

## 1. Latar Belakang & Mitigasi Risiko

Untuk mematuhi etika penelitian kesehatan dan menghindari pemblokiran nomor WhatsApp oleh sistem anti-spam WhatsApp:
1. **Tidak Ada Pesan Dingin (Cold Messaging)**: Bot **dilarang** memulai chat massal terlebih dahulu ke nomor pasien yang belum pernah menghubungi bot.
2. **Inisiasi Mandiri oleh Pasien**: Pasien memulai kontak pertama kali dengan mengeklik tautan `wa.me` atau memindai QR code yang memuat teks awal `DAFTAR`.
3. **Pemberian Informasi Penelitian**: Penjelasan mengenai tujuan penelitian dan perkenalan peneliti disampaikan secara manual saat informed consent atau disematkan pada materi cetak (poster/leaflet).

---

## 2. Cara Membuat Tautan Pendaftaran WhatsApp (`wa.me`)

Format standar tautan WhatsApp Click to Chat:
```
https://wa.me/<nomor_bot>?text=DAFTAR
```

### Aturan Format Nomor:
- Gunakan format internasional tanpa tanda tambah (`+`), spasi, atau tanda hubung (`-`).
- Ganti awalan `0` dengan kode negara Indonesia `62`.
- **Contoh**: Jika nomor WhatsApp bot adalah `0812-3456-7890`, maka formatnya menjadi:
  ```
  https://wa.me/6281234567890?text=DAFTAR
  ```

### Rekomendasi Pemendek Tautan (URL Shortener):
Agar tautan lebih ringkas dicantumkan pada media cetak, tautan di atas dapat dipendekkan menggunakan layanan gratis seperti:
- [s.id](https://s.id) (contoh: `s.id/daftar-pengingat-obat`)
- [bit.ly](https://bitly.com) (contoh: `bit.ly/ingat-obat-sukarasa`)

---

## 3. Cara Membuat QR Code Pendaftaran

QR code memudahkan pasien lansia atau keluarga mendampingi proses registrasi cukup dengan mengarahkan kamera ponsel:

1. Buka layanan generator QR Code gratis yang andal (misal: [qr-code-generator.com](https://www.qr-code-generator.com) atau [me-qr.com](https://me-qr.com)).
2. Masukkan URL pendaftaran: `https://wa.me/<nomor_bot>?text=DAFTAR`.
3. Unduh hasil QR code dalam format gambar beresolusi tinggi (PNG atau SVG).
4. Tempelkan QR code pada media penelitian:
   - Lembar penjelasan persetujuan penelitian (*Informed Consent*).
   - Standing banner atau poster di loket pendaftaran/farmasi PUSKESMAS Sukarasa.
   - Kartu pengingat saku yang dibagikan kepada responden.

---

## 4. Naskah Perkenalan Peneliti (Dokumen A.1) — Siap Salin

Naskah berikut dapat dibagikan langsung oleh peneliti secara manual (via pesan personal WhatsApp atau lembar informasi penelitian) kepada calon responden penelitian:

```text
Selamat [Pagi/Siang/Sore], Bapak/Ibu [Nama Pasien]

Perkenalkan, saya Dea Farida, mahasiswa S1 Keperawatan, yang sedang melakukan penelitian mengenai kepatuhan minum obat di PUSKESMAS Sukarasa.

Melalui layanan chat WhatsApp ini, Bapak/Ibu akan mendapatkan pengingat minum obat harian secara teratur. Seluruh data Bapak/Ibu dijaga kerahasiaannya dan hanya digunakan untuk keperluan penelitian.

Untuk mulai mengikuti program pengingat minum obat, silakan klik tautan berikut:
https://wa.me/6281234567890?text=DAFTAR

atau kirim pesan dengan mengetik: *DAFTAR*

Hormat Kami,
Dea Farida
PUSKESMAS Sukarasa
```

---

## 5. Alur Pendampingan Pasien di Lapangan

| Tahap | Tindakan Pasien / Peneliti | Respons Sistem Bot |
|---|---|---|
| **1. Scan/Klik** | Pasien memindai QR code atau mengeklik tautan `wa.me`. | Aplikasi WhatsApp terbuka dengan pesan terisi otomatis `DAFTAR`. |
| **2. Kirim DAFTAR** | Pasien menekan tombol kirim pesan `DAFTAR`. | Bot membalas dengan meminta data: `Nama Lengkap / No. Rekam Medis (RM) / Jam Minum Obat`. State pasien: `awaiting_data`. |
| **3. Input Data** | Pasien membalas dengan format: `Sukanti / 123456 / 07.00`. | Bot memvalidasi format, No. RM, dan jam WIB. |
| **4. Konfirmasi** | Jika valid, sistem menyimpan data dan mengubah state pasien menjadi `active`. | Bot mengirim pesan `*Registrasi Berhasil*` yang menginformasikan bahwa pengingat obat harian akan mulai dikirimkan esok hari pada jam yang dipilih. |
| **5. Format Salah** | Jika format salah (misal tidak ada garis miring atau jam keliru). | Bot membalas dengan contoh format yang benar tanpa membatalkan proses (`state` tetap `awaiting_data`). |
