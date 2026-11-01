/**
 * Konstanta status pasien dan log kepatuhan sesuai PRD §6.3 dan §9.
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
