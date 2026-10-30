/**
 * Service pencatatan konfirmasi dan penentuan status kepatuhan (FR-14 s.d. FR-16, FR-19).
 */

import { Patient, ReminderLog } from '../db/models.js';
import { PATIENT_STATE, REMINDER_STATUS } from '../utils/constants.js';
import { formatDateWib } from '../utils/time.js';
import { isConfirmationTrigger } from '../utils/parser.js';
import {
  getAdherenceConfirmedMessage,
  getAlreadyConfirmedMessage,
  getNoActiveReminderMessage
} from '../utils/messages.js';
import { send } from '../bot/client.js';
import { logger } from '../utils/logger.js';

/**
 * Fungsi murni untuk menentukan status kepatuhan berdasarkan ada tidaknya reminder2At (FR-15).
 * - Konfirmasi sebelum pengingat 2 -> Tepat Waktu
 * - Konfirmasi sesudah pengingat 2 -> Terlambat
 * @param {any} log Dokumen ReminderLog
 * @returns {{ alreadyConfirmed: boolean, newStatus?: string, status?: string }}
 */
export function determineAdherenceStatus(log) {
  if (!log) {
    return { alreadyConfirmed: false, newStatus: null };
  }

  // Jika sudah terkonfirmasi sebelumnya
  if (
    log.status === REMINDER_STATUS.TEPAT_WAKTU ||
    log.status === REMINDER_STATUS.TERLAMBAT
  ) {
    return { alreadyConfirmed: true, status: log.status };
  }

  // Jika reminder ke-2 sudah dikirimkan -> Terlambat
  if (log.reminder2At) {
    return {
      alreadyConfirmed: false,
      newStatus: REMINDER_STATUS.TERLAMBAT
    };
  }

  // Jika reminder ke-2 belum dikirimkan -> Tepat Waktu
  return {
    alreadyConfirmed: false,
    newStatus: REMINDER_STATUS.TEPAT_WAKTU
  };
}

/**
 * Menangani pesan konfirmasi kepatuhan minum obat dari pasien (SUDAH / SUDAH MINUM / SDH / UDAH).
 * @param {string} jid WhatsApp JID pengirim
 * @param {string} text Teks pesan
 * @param {object} [options={}]
 * @returns {Promise<{ handled: boolean, action?: string, status?: string, confirmedAt?: Date }>}
 */
export async function handleAdherenceConfirmation(jid, text, options = {}) {
  // Hanya proses jika pesan cocok dengan pemicu konfirmasi (FR-14)
  if (!isConfirmationTrigger(text)) {
    return { handled: false };
  }

  const sendFn = options.sendFn || send;
  const now = options.now || new Date();
  const todayStr = formatDateWib(now);

  const patient = await Patient.findOne({ jid });

  // Pasien tidak ditemukan atau belum aktif
  if (!patient || patient.state !== PATIENT_STATE.ACTIVE) {
    await sendFn(jid, getNoActiveReminderMessage(''));
    return { handled: true, action: 'no_active_patient' };
  }

  // Ambil semua log hari ini yang masih Menunggu, ambil jadwal terbesar (terlambat) sebagai prioritas konfirmasi
  const pendingLogs = await ReminderLog.find({
    patientId: patient._id,
    tanggal: todayStr,
    status: REMINDER_STATUS.MENUNGGU
  });
  // Sort descending by jadwal di memory (kompatibel dengan mock test)
  pendingLogs.sort((a, b) => (b.jadwal || '').localeCompare(a.jadwal || ''));
  const todayLog = pendingLogs[0] || null;

  // FR-19: Pesan SUDAH tanpa ada pengingat aktif pada hari ini
  if (!todayLog) {
    // Cek apakah ada log hari ini (sudah dikonfirmasi semuanya)
    const anyTodayLog = await ReminderLog.findOne({
      patientId: patient._id,
      tanggal: todayStr
    });

    if (anyTodayLog &&
      (anyTodayLog.status === REMINDER_STATUS.TEPAT_WAKTU ||
       anyTodayLog.status === REMINDER_STATUS.TERLAMBAT)) {
      // Semua jadwal sudah dikonfirmasi
      logger.debug({ patientId: patient._id }, 'Konfirmasi ganda di hari yang sama diabaikan');
      await sendFn(jid, getAlreadyConfirmedMessage(patient.nama));
      return { handled: true, action: 'already_confirmed', status: anyTodayLog.status };
    }

    await sendFn(jid, getNoActiveReminderMessage(patient.nama));
    return { handled: true, action: 'no_active_reminder' };
  }

  // todayLog pasti berstatus Menunggu karena query sudah filter (FR-15)
  const { newStatus } = determineAdherenceStatus(todayLog);

  todayLog.status = newStatus;
  todayLog.confirmedAt = now;
  await todayLog.save();

  logger.info(
    { patientId: patient._id, jadwal: todayLog.jadwal, status: todayLog.status },
    'Konfirmasi kepatuhan berhasil dicatat'
  );

  await sendFn(jid, getAdherenceConfirmedMessage(patient.nama));
  return {
    handled: true,
    action: 'confirmed',
    status: todayLog.status,
    confirmedAt: now
  };
}

export {
  finalizeDailyUnconfirmedLogs,
  evaluateFinalizationEligibility
} from './reminder.js';

