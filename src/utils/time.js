/**
 * Utilitas manipulasi waktu murni (Asia/Jakarta WIB) sesuai PRD §4, §8, dan AGENTS.md.
 */

export const TIMEZONE = 'Asia/Jakarta';

/**
 * Mendapatkan komponen waktu lokal Asia/Jakarta (WIB) dari objek Date UTC.
 * @param {Date} [now=new Date()]
 * @returns {{ year: number, month: number, day: number, hour: number, minute: number, second: number }}
 */
export function getWibParts(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });

  const parts = formatter.formatToParts(now);
  const partMap = {};
  for (const { type, value } of parts) {
    partMap[type] = value;
  }

  return {
    year: parseInt(partMap.year, 10),
    month: parseInt(partMap.month, 10),
    day: parseInt(partMap.day, 10),
    hour: parseInt(partMap.hour, 10),
    minute: parseInt(partMap.minute, 10),
    second: parseInt(partMap.second, 10)
  };
}

/**
 * Format tanggal dalam zona waktu WIB (Asia/Jakarta) dengan format YYYY-MM-DD.
 * @param {Date} [now=new Date()]
 * @returns {string} Contoh: '2026-10-15'
 */
export function formatDateWib(now = new Date()) {
  const { year, month, day } = getWibParts(now);
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/**
 * Format jam dalam zona waktu WIB (Asia/Jakarta) dengan format HH:mm.
 * @param {Date} [now=new Date()]
 * @returns {string} Contoh: '07:00'
 */
export function formatTimeWib(now = new Date()) {
  const { hour, minute } = getWibParts(now);
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Mendapatkan salam dinamis berdasarkan jam di zona waktu WIB (PRD §8):
 * - Pagi (< 11)
 * - Siang (11–14)
 * - Sore (15–17)
 * - Malam (≥ 18)
 * @param {Date} [now=new Date()]
 * @returns {'Pagi' | 'Siang' | 'Sore' | 'Malam'}
 */
export function getGreeting(now = new Date()) {
  const { hour } = getWibParts(now);
  if (hour < 11) {
    return 'Pagi';
  }
  if (hour < 15) {
    return 'Siang';
  }
  if (hour < 18) {
    return 'Sore';
  }
  return 'Malam';
}

/**
 * Mengonversi string jam HH:mm ke jumlah menit sejak tengah malam (00:00).
 * @param {string} timeStr Format HH:mm
 * @returns {number}
 */
export function timeStringToMinutes(timeStr) {
  const [hh, mm] = timeStr.split(':').map((v) => parseInt(v, 10));
  return hh * 60 + mm;
}

/**
 * Menghitung selisih menit antara waktu sekarang (WIB) dengan waktu jadwal minum obat pada hari yang sama.
 * Nilai positif: waktu sekarang telah melewati jadwal (terlambat/catch-up).
 * Nilai negatif: waktu sekarang belum mencapai jadwal.
 * @param {string} scheduledTimeStr Format HH:mm (contoh '07:00')
 * @param {Date} [now=new Date()]
 * @returns {number} Selisih dalam menit
 */
export function calculateMinuteDiff(scheduledTimeStr, now = new Date()) {
  const { hour, minute } = getWibParts(now);
  const currentMinutes = hour * 60 + minute;
  const schedMinutes = timeStringToMinutes(scheduledTimeStr);
  return currentMinutes - schedMinutes;
}

