/**
 * Template naskah pesan WhatsApp sesuai naskah penelitian (PRD §8).
 * Semua pesan ditutup dengan footer standar peneliti dan menggunakan salam dinamis WIB.
 * Bebas dari fitur edukasi, silabus, dan pesan akhir intervensi otomatis.
 */

import { getGreeting } from './time.js';

export const MESSAGE_FOOTER = `Hormat Kami,
Dea Farida
PUSKESMAS Sukarasa`;

/**
 * Pesan perkenalan peneliti (dibagikan secara manual atau saat pasien pertama kali terhubung).
 * @param {string} [nama='']
 * @param {Date} [now=new Date()]
 * @returns {string}
 */
export function getIntroductionMessage(nama = '', now = new Date()) {
  const greeting = getGreeting(now);
  const panggilan = nama ? `Selamat ${greeting}, Bapak/Ibu ${nama}` : `Selamat ${greeting}, Bapak/Ibu`;
  return `${panggilan}

Perkenalkan, saya Dea Farida, mahasiswa S1 Keperawatan, yang sedang melakukan penelitian mengenai kepatuhan minum obat di PUSKESMAS Sukarasa.

Melalui layanan chat ini, Bapak/Ibu akan mendapatkan pengingat minum obat harian. Seluruh data Bapak/Ibu dijaga kerahasiaannya dan hanya digunakan untuk keperluan penelitian.

Untuk mulai mengikuti, silakan ketik: *DAFTAR*

${MESSAGE_FOOTER}`;
}

/**
 * Pesan permintaan data pasien setelah mengetik DAFTAR (A.3).
 * @returns {string}
 */
export function getRequestDataMessage() {
  return `Terima kasih, Bapak/Ibu. Silakan balas pesan ini dengan data berikut:

Nama Lengkap / No. Rekam Medis (RM) / Jam Minum Obat (contoh: 07.00)

Contoh balasan:
Sukanti / 123456 / 07.00

${MESSAGE_FOOTER}`;
}

/**
 * Pesan kesalahan format input data pasien (FR-05).
 * @returns {string}
 */
export function getInvalidFormatMessage() {
  return `Format yang Bapak/Ibu kirimkan belum sesuai. Silakan kirimkan data dengan format pemisah garis miring (/):

Nama Lengkap / No. Rekam Medis (RM) / Jam Minum Obat

Contoh balasan:
Sukanti / 123456 / 07.00

Catatan: Jam menggunakan format 24 jam (misal 07.00 atau 19.30).

${MESSAGE_FOOTER}`;
}

/**
 * Pesan jika No. RM sudah terdaftar oleh nomor lain (FR-06).
 * @param {string} noRM
 * @returns {string}
 */
export function getDuplicateRmMessage(noRM) {
  return `Mohon maaf, No. Rekam Medis (RM) ${noRM} sudah terdaftar di sistem kami. Jika ada kekeliruan data, silakan hubungi peneliti.

${MESSAGE_FOOTER}`;
}

/**
 * Pesan Registrasi Berhasil (A.4 & FR-07).
 * Hanya memuat jadwal pengingat harian (tanpa menyebut edukasi kesehatan).
 * @param {string} nama
 * @param {string} jamMinum
 * @returns {string}
 */
export function getRegistrationSuccessMessage(nama, jamMinum) {
  return `*Registrasi Berhasil*

Terima kasih, Bapak/Ibu ${nama}. Data Bapak/Ibu sudah tersimpan.

Mulai besok, kami akan mengirimkan:
Pengingat minum obat setiap hari pukul ${jamMinum} WIB

Semoga Bapak/Ibu selalu sehat.

${MESSAGE_FOOTER}`;
}

/**
 * Pesan Pengingat Minum Obat ke-1 (B.1).
 * Menggantikan tombol Baileys dengan instruksi mengetik SUDAH.
 * @param {string} nama
 * @param {Date} [now=new Date()]
 * @returns {string}
 */
export function getReminder1Message(nama, now = new Date()) {
  const greeting = getGreeting(now);
  return `Selamat ${greeting}, Bapak/Ibu ${nama}

Sudah waktunya untuk minum obat. Mereka yang minum obat sesuai anjuran akan sembuh. Mereka yang hanya meminum sebagian, merasa sembuh tetapi penyakitnya belum hilang dan akan kembali lagi.

Jika ingin sembuh sepenuhnya, minumlah obat hari ini. Usahakan minum di waktu yang sama sesuai anjuran tenaga kesehatan.

Setelah minum obat, silakan balas chat ini dengan mengetik: *SUDAH*

${MESSAGE_FOOTER}`;
}

/**
 * Pesan Pengingat Minum Obat ke-2 (setelah 30 menit tanpa respons).
 * Menggunakan frasa "obat Bapak/Ibu" (tanpa placeholder [Nama Obat]).
 * @param {string} nama
 * @param {Date} [now=new Date()]
 * @returns {string}
 */
export function getReminder2Message(nama, now = new Date()) {
  const greeting = getGreeting(now);
  return `Selamat ${greeting}, Bapak/Ibu ${nama}

Kami mengingatkan kembali, Bapak/Ibu belum mengonfirmasi minum obat hari ini. Jika belum, mohon segera minum obat Bapak/Ibu sesuai anjuran.

Jika sudah minum obat, silakan balas chat ini dengan mengetik: *SUDAH*

${MESSAGE_FOOTER}`;
}

/**
 * Pesan ucapan terima kasih setelah konfirmasi minum obat dicatat.
 * @param {string} nama
 * @returns {string}
 */
export function getAdherenceConfirmedMessage(nama) {
  return `Terima kasih, Bapak/Ibu ${nama}. Kepatuhan Bapak/Ibu hari ini sudah kami catat. Pertahankan ya!

Setiap obat yang diminum tepat waktu adalah langkah menuju sehat. Tetap semangat, ya!

${MESSAGE_FOOTER}`;
}

/**
 * Pesan jika pasien mengirim konfirmasi ulang di hari yang sama (FR-16).
 * @param {string} nama
 * @returns {string}
 */
export function getAlreadyConfirmedMessage(nama) {
  return `Terima kasih, Bapak/Ibu ${nama}. Konfirmasi minum obat Bapak/Ibu untuk hari ini sudah tercatat sebelumnya.

${MESSAGE_FOOTER}`;
}

/**
 * Pesan netral jika pasien mengirim SUDAH tanpa ada pengingat aktif (FR-19).
 * @param {string} [nama='']
 * @returns {string}
 */
export function getNoActiveReminderMessage(nama = '') {
  const sapaan = nama ? ` ${nama}` : '';
  return `Terima kasih informasinya, Bapak/Ibu${sapaan}. Saat ini tidak ada jadwal pengingat obat yang sedang menunggu konfirmasi.

${MESSAGE_FOOTER}`;
}

/**
 * Pesan jika pasien yang sudah terdaftar aktif mengirim perintah DAFTAR kembali.
 * @param {string} nama
 * @param {string} jamMinum
 * @returns {string}
 */
export function getAlreadyRegisteredMessage(nama, jamMinum) {
  return `Bapak/Ibu ${nama} sudah terdaftar dengan jadwal pengingat minum obat setiap hari pukul ${jamMinum} WIB.

${MESSAGE_FOOTER}`;
}

/**
 * Pesan jika pasien yang dihentikan (stopped) mengirim pesan.
 * @param {string} [nama='']
 * @returns {string}
 */
export function getPatientStoppedMessage(nama = '') {
  const sapaan = nama ? ` ${nama}` : '';
  return `Pengingat minum obat untuk Bapak/Ibu${sapaan} saat ini berstatus tidak aktif. Silakan hubungi peneliti jika ada pertanyaan.

${MESSAGE_FOOTER}`;
}

/**
 * Pesan penolakan perintah admin untuk pengirim non-admin (FR-30 s.d. FR-32).
 * @returns {string}
 */
export function getAdminUnauthorizedMessage() {
  return `Mohon maaf, perintah ini hanya dapat diakses oleh peneliti/admin penelitian.

${MESSAGE_FOOTER}`;
}

/**
 * Pesan ringkasan kepatuhan hari ini untuk admin (FR-30).
 * @param {{
 *   tanggal: string,
 *   total: number,
 *   tepatWaktu: number,
 *   terlambat: number,
 *   menunggu: number,
 *   tidakKonfirmasi: number,
 *   terlewatSistem: number
 * }} stats
 * @returns {string}
 */
export function getAdminRekapMessage({
  tanggal,
  total,
  tepatWaktu,
  terlambat,
  menunggu,
  tidakKonfirmasi,
  terlewatSistem
}) {
  return `*Rekap Kepatuhan Hari Ini*
Tanggal: ${tanggal} WIB

- Tepat Waktu: ${tepatWaktu}
- Terlambat: ${terlambat}
- Menunggu: ${menunggu}
- Tidak Konfirmasi: ${tidakKonfirmasi}
- Terlewat Sistem: ${terlewatSistem}
Total Jadwal: ${total}

${MESSAGE_FOOTER}`;
}

/**
 * Pesan daftar pasien aktif untuk admin (FR-31).
 * @param {Array<{ nama: string, noRM: string, jamMinum: string }>} patients
 * @returns {string}
 */
export function getAdminPasienMessage(patients = []) {
  if (patients.length === 0) {
    return `*Daftar Pasien Aktif*

Saat ini belum ada pasien yang berstatus aktif.

${MESSAGE_FOOTER}`;
  }

  const listText = patients
    .map(
      (p, i) => `${i + 1}. ${p.nama} (RM: ${p.noRM}) - ${p.jamMinum} WIB`
    )
    .join('\n');

  return `*Daftar Pasien Aktif*
Total: ${patients.length} pasien

${listText}

${MESSAGE_FOOTER}`;
}

/**
 * Pesan berhasil menghentikan pengingat pasien (FR-32).
 * @param {{ nama: string, noRM: string }} patient
 * @returns {string}
 */
export function getAdminStopSuccessMessage(patient) {
  return `Pengingat minum obat untuk pasien *${patient.nama}* (No. RM: ${patient.noRM}) telah berhasil dihentikan (status: stopped).

${MESSAGE_FOOTER}`;
}

/**
 * Pesan jika No. RM tidak ditemukan saat perintah !stop dijalankan.
 * @param {string} noRM
 * @returns {string}
 */
export function getAdminStopNotFoundMessage(noRM) {
  return `Pasien dengan No. Rekam Medis (RM) *${noRM}* tidak ditemukan.

${MESSAGE_FOOTER}`;
}

/**
 * Pesan bantuan panduan perintah admin.
 * @returns {string}
 */
export function getAdminHelpMessage() {
  return `*Panduan Perintah Admin Peneliti:*
- *!rekap* : Ringkasan status kepatuhan hari ini
- *!pasien* : Daftar seluruh pasien aktif beserta jam minum
- *!stop <RM>* : Menghentikan pengingat minum obat pasien

Contoh: !stop 123456

${MESSAGE_FOOTER}`;
}


