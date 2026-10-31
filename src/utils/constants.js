/**
 * Konstanta status pasien, log kepatuhan, dan log edukasi sesuai PRD §6.3 dan §9.
 */

export const PATIENT_STATE = Object.freeze({
  NEW: 'new',
  AWAITING_DATA: 'awaiting_data',
  ACTIVE: 'active',
  STOPPED: 'stopped'
});

export const REMINDER_STATUS = Object.freeze({
  MENUNGGU: 'Menunggu',
  TEPAT_WAKTU: 'Tepat Waktu',
  TERLAMBAT: 'Terlambat',
  TIDAK_KONFIRMASI: 'Tidak Konfirmasi',
  TERLEWAT_SISTEM: 'Terlewat Sistem'
});

export const EDUCATION_STATUS = Object.freeze({
  TERKIRIM: 'Terkirim',
  TERLEWAT_SISTEM: 'Terlewat Sistem'
});
