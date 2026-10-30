/**
 * Utilitas parser pesan murni untuk alur registrasi pasien (FR-03, FR-04).
 */

/**
 * Memvalidasi dan memformat string jam ke format standar HH:mm.
 * Menerima format:
 * - 07.00, 7.00, 07:00, 7:00, 23.59, 00:00
 * Rentang valid: 00:00 s.d. 23:59.
 * @param {string} rawTime
 * @returns {string | null} Format 'HH:mm' jika valid, atau null jika tidak valid
 */
export function parseTimeString(rawTime) {
  if (typeof rawTime !== 'string') {
    return null;
  }

  const trimmed = rawTime.trim();
  const match = trimmed.match(/^([0-1]?[0-9]|2[0-3])[.:]([0-5][0-9])$/);
  if (!match) {
    return null;
  }

  const hours = match[1].padStart(2, '0');
  const minutes = match[2].padStart(2, '0');

  return `${hours}:${minutes}`;
}

/**
 * Mengecek apakah pesan adalah pemicu registrasi "DAFTAR" (FR-03, case-insensitive, trim).
 * @param {string} text
 * @returns {boolean}
 */
export function isRegistrationTrigger(text) {
  if (typeof text !== 'string') {
    return false;
  }
  return text.trim().toUpperCase() === 'DAFTAR';
}

export const CONFIRMATION_VARIANTS = Object.freeze([
  'SUDAH',
  'SUDAH MINUM',
  'SDH',
  'UDAH'
]);

/**
 * Mengecek apakah pesan merupakan konfirmasi minum obat (FR-14: SUDAH, SUDAH MINUM, SDH, UDAH).
 * Case-insensitive dan toleran terhadap spasi / tanda baca akhir (. atau !).
 * @param {string} text
 * @returns {boolean}
 */
export function isConfirmationTrigger(text) {
  if (typeof text !== 'string') {
    return false;
  }

  const cleaned = text.trim().toUpperCase().replace(/[.!]+$/, '').trim();
  return CONFIRMATION_VARIANTS.includes(cleaned);
}


/**
 * Mengurai pesan data registrasi dengan format:
 * - 1 jadwal: "Nama / No. RM / Jam1" (FR-04)
 * - 2 jadwal: "Nama / No. RM / Jam1 / Jam2"
 * Pemisah garis miring (/), jam menerima format 07.00, 7.00, 07:00.
 * Nama dan RM tidak boleh kosong. Jika 2 jam, keduanya harus valid dan tidak boleh sama.
 * @param {string} text
 * @returns {{ valid: true, nama: string, noRM: string, jamMinum: string[] } | { valid: false, reason: string }}
 */
export function parseRegistrationText(text) {
  if (typeof text !== 'string') {
    return { valid: false, reason: 'TIPE_DATA_SALAH' };
  }

  const parts = text.split('/');
  if (parts.length < 3 || parts.length > 4) {
    return { valid: false, reason: 'JUMLAH_BAGIAN_TIDAK_SESUAI' };
  }

  const nama = parts[0].trim();
  const noRM = parts[1].trim();
  const rawJam1 = parts[2].trim();

  if (!nama) {
    return { valid: false, reason: 'NAMA_KOSONG' };
  }

  if (!noRM) {
    return { valid: false, reason: 'RM_KOSONG' };
  }

  const jam1 = parseTimeString(rawJam1);
  if (!jam1) {
    return { valid: false, reason: 'JAM_TIDAK_VALID' };
  }

  // Jika ada bagian ke-4 (jam kedua)
  if (parts.length === 4) {
    const rawJam2 = parts[3].trim();
    const jam2 = parseTimeString(rawJam2);
    if (!jam2) {
      return { valid: false, reason: 'JAM2_TIDAK_VALID' };
    }
    if (jam1 === jam2) {
      return { valid: false, reason: 'JAM_SAMA' };
    }
    // Urutkan jadwal (ASC) agar konsisten
    const jamMinum = [jam1, jam2].sort();
    return { valid: true, nama, noRM, jamMinum };
  }

  return {
    valid: true,
    nama,
    noRM,
    jamMinum: [jam1]
  };
}
