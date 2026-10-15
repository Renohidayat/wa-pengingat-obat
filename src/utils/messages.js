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

