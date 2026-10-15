/**
 * Service pengingat minum obat harian (FR-10 s.d. FR-13).
 * Menerapkan sifat idempoten, isolasi error per pasien, aturan registrasi hari yang sama,
 * dan mekanisme catch-up (<= 60 menit) atau Terlewat Sistem (> 60 menit).
 */

import { Patient, ReminderLog } from '../db/models.js';
import { PATIENT_STATE, REMINDER_STATUS } from '../utils/constants.js';
import { formatDateWib, calculateMinuteDiff } from '../utils/time.js';
import { getReminder1Message, getReminder2Message } from '../utils/messages.js';
import { send } from '../bot/client.js';
import { logger } from '../utils/logger.js';

/**
 * Fungsi murni untuk mengevaluasi kelayakan pengiriman pengingat 1 pasien.
 * @param {{
 *   patient: { state: string, jamMinum?: string, registeredAt?: Date },
 *   now?: Date,
 *   todayLog?: any
 * }} params
 * @returns {{
 *   eligible: boolean,
 *   action?: 'SEND_REMINDER_1' | 'RECORD_SYSTEM_MISSED',
 *   reason?: string,
 *   diffMinutes?: number,
 *   todayStr?: string
 * }}
 */
export function evaluateReminder1Eligibility({ patient, now = new Date(), todayLog = null }) {
  if (!patient || patient.state !== PATIENT_STATE.ACTIVE) {
    return { eligible: false, reason: 'NOT_ACTIVE' };
  }

  if (!patient.jamMinum) {
    return { eligible: false, reason: 'NO_SCHEDULE' };
  }

  const todayStr = formatDateWib(now);

  // FR-11: Pengingat TIDAK dikirim pada hari registrasi (mulai besok)
  if (patient.registeredAt) {
    const regDateStr = formatDateWib(patient.registeredAt);
    if (todayStr === regDateStr) {
      return { eligible: false, reason: 'SAME_DAY_REGISTRATION', todayStr };
    }
  }

  // FR-12: Idempoten, maksimal 1 log per pasien per tanggal
  if (todayLog) {
    return { eligible: false, reason: 'ALREADY_LOGGED', todayStr };
  }

  // Cek selisih menit jadwal dengan waktu sekarang
  const diffMinutes = calculateMinuteDiff(patient.jamMinum, now);

  // Jadwal belum tiba
  if (diffMinutes < 0) {
    return { eligible: false, reason: 'TIME_NOT_ARRIVED', diffMinutes, todayStr };
  }

  // Tepat jam atau catch-up terlewat <= 60 menit (FR-13)
  if (diffMinutes <= 60) {
    return {
      eligible: true,
      action: 'SEND_REMINDER_1',
      diffMinutes,
      todayStr
    };
  }

  // Terlewat > 60 menit karena server mati (FR-13: catat Terlewat Sistem dan TIDAK dikirim)
  return {
    eligible: true,
    action: 'RECORD_SYSTEM_MISSED',
    diffMinutes,
    todayStr
  };
}

/**
 * Memproses pengingat 1 untuk satu pasien.
 * @param {any} patient Dokumen pasien
 * @param {Date} [now=new Date()]
 * @param {object} [options={}]
 * @returns {Promise<{ handled: boolean, action?: string, reason?: string, logId?: any }>}
 */
export async function processReminder1ForPatient(patient, now = new Date(), options = {}) {
  const sendFn = options.sendFn || send;
  const todayStr = formatDateWib(now);

  // Cek apakah sudah ada log hari ini
  const todayLog = await ReminderLog.findOne({
    patientId: patient._id,
    tanggal: todayStr
  });

  const evaluation = evaluateReminder1Eligibility({ patient, now, todayLog });

  if (!evaluation.eligible) {
    return { handled: false, reason: evaluation.reason };
  }

  if (evaluation.action === 'SEND_REMINDER_1') {
    try {
      // Simpan log dengan status Menunggu (idempoten via unique index)
      const log = await ReminderLog.create({
        patientId: patient._id,
        tanggal: todayStr,
        jadwal: patient.jamMinum,
        status: REMINDER_STATUS.MENUNGGU,
        reminder1At: now
      });

      logger.info(
        { patientId: patient._id, jadwal: patient.jamMinum },
        'Mengirimkan pengingat 1 ke pasien'
      );

      const messageText = getReminder1Message(patient.nama, now);
      await sendFn(patient.jid, messageText);

      return { handled: true, action: 'sent', logId: log._id };
    } catch (error) {
      // Menangani bentrok duplicate index secara aman
      if (error.code === 11000) {
        logger.warn({ patientId: patient._id }, 'Log pengingat hari ini sudah ada (duplicate key prevented)');
        return { handled: false, reason: 'DUPLICATE_KEY_IDEMPOTENT' };
      }
      throw error;
    }
  }

  if (evaluation.action === 'RECORD_SYSTEM_MISSED') {
    try {
      // Simpan log dengan status Terlewat Sistem dan TIDAK kirim pesan (FR-13)
      const log = await ReminderLog.create({
        patientId: patient._id,
        tanggal: todayStr,
        jadwal: patient.jamMinum,
        status: REMINDER_STATUS.TERLEWAT_SISTEM
      });

      logger.warn(
        { patientId: patient._id, diffMinutes: evaluation.diffMinutes },
        'Pengingat terlewat > 60 menit dicatat Terlewat Sistem'
      );

      return { handled: true, action: 'missed_system', logId: log._id };
    } catch (error) {
      if (error.code === 11000) {
        return { handled: false, reason: 'DUPLICATE_KEY_IDEMPOTENT' };
      }
      throw error;
    }
  }

  return { handled: false };
}

/**
 * Mengecek dan memproses pengingat 1 harian untuk semua pasien aktif.
 * Mengisolasi error per pasien (try/catch) agar kegagalan satu pasien tidak membatalkan yang lain.
 * @param {Date} [now=new Date()]
 * @param {object} [options={}]
 * @returns {Promise<Array<any>>}
 */
export async function checkAndSendDailyReminders(now = new Date(), options = {}) {
  const activePatients = await Patient.find({ state: PATIENT_STATE.ACTIVE });
  const results = [];

  for (const patient of activePatients) {
    try {
      const res = await processReminder1ForPatient(patient, now, options);
      results.push({ patientId: patient._id, success: true, ...res });
    } catch (error) {
      logger.error({ err: error.message }, 'Gagal memproses pengingat harian pasien');
      results.push({ patientId: patient._id, success: false, error: error.message });
    }
  }

  return results;
}

/**
 * Fungsi murni untuk mengevaluasi kelayakan pengiriman pengingat ke-2 pasien (FR-17).
 * Syarat:
 * 1. Log berstatus Menunggu
 * 2. reminder2At masih null (belum pernah dikirim)
 * 3. reminder1At ada dan selisih waktu >= 30 menit
 * 4. Pasien masih berstatus ACTIVE
 * @param {{
 *   log: { status: string, reminder1At?: Date, reminder2At?: Date },
 *   patient: { state: string },
 *   now?: Date
 * }} params
 * @returns {{
 *   eligible: boolean,
 *   action?: 'SEND_REMINDER_2',
 *   reason?: string,
 *   elapsedMinutes?: number
 * }}
 */
export function evaluateReminder2Eligibility({ log, patient, now = new Date() }) {
  if (!log) {
    return { eligible: false, reason: 'NO_LOG' };
  }

  // Hanya kirim jika status masih Menunggu (FR-17)
  if (log.status !== REMINDER_STATUS.MENUNGGU) {
    return { eligible: false, reason: 'STATUS_NOT_MENUNGGU', currentStatus: log.status };
  }

  // Sekali per hari per pasien (idempoten)
  if (log.reminder2At) {
    return { eligible: false, reason: 'REMINDER_2_ALREADY_SENT' };
  }

  if (!log.reminder1At) {
    return { eligible: false, reason: 'NO_REMINDER_1' };
  }

  if (!patient || patient.state !== PATIENT_STATE.ACTIVE) {
    return { eligible: false, reason: 'PATIENT_NOT_ACTIVE' };
  }

  const elapsedMs = now.getTime() - new Date(log.reminder1At).getTime();
  const elapsedMinutes = Math.floor(elapsedMs / (1000 * 60));

  // Belum mencapai 30 menit
  if (elapsedMinutes < 30) {
    return { eligible: false, reason: 'TIME_NOT_ARRIVED', elapsedMinutes };
  }

  return {
    eligible: true,
    action: 'SEND_REMINDER_2',
    elapsedMinutes
  };
}

/**
 * Memproses pengiriman pengingat ke-2 untuk satu dokumen ReminderLog.
 * @param {any} log Dokumen ReminderLog
 * @param {any} patient Dokumen Patient terkait
 * @param {Date} [now=new Date()]
 * @param {object} [options={}]
 * @returns {Promise<{ handled: boolean, action?: string, reason?: string, logId?: any }>}
 */
export async function processReminder2ForLog(log, patient, now = new Date(), options = {}) {
  const sendFn = options.sendFn || send;
  const evaluation = evaluateReminder2Eligibility({ log, patient, now });

  if (!evaluation.eligible) {
    return { handled: false, reason: evaluation.reason };
  }

  try {
    // Simpan reminder2At terlebih dahulu untuk mencegah duplikasi (idempoten)
    log.reminder2At = now;
    await log.save();

    logger.info(
      { patientId: patient._id, logId: log._id },
      'Mengirimkan pengingat ke-2 (setelah 30 menit) ke pasien'
    );

    // Teks pesan tanpa placeholder [Nama Obat] (FR-17 & PRD §8)
    const text = getReminder2Message(patient.nama, now);
    await sendFn(patient.jid, text);

    return { handled: true, action: 'sent_reminder_2', logId: log._id };
  } catch (error) {
    logger.error({ err: error.message, logId: log._id }, 'Gagal mengirim pengingat ke-2');
    throw error;
  }
}

/**
 * Mengecek dan memproses pengingat ke-2 (30 menit setelah pengingat 1) untuk log yang masih Menunggu.
 * @param {Date} [now=new Date()]
 * @param {object} [options={}]
 * @returns {Promise<Array<any>>}
 */
export async function checkAndSendReminder2(now = new Date(), options = {}) {
  const todayStr = formatDateWib(now);

  // Ambil log hari ini yang masih Menunggu dan belum dikirim pengingat 2
  const pendingLogs = await ReminderLog.find({
    tanggal: todayStr,
    status: REMINDER_STATUS.MENUNGGU,
    reminder2At: null
  }).populate('patientId');

  const results = [];

  for (const log of pendingLogs) {
    const patient = log.patientId;
    try {
      const res = await processReminder2ForLog(log, patient, now, options);
      results.push({ logId: log._id, success: true, ...res });
    } catch (error) {
      logger.error({ err: error.message, logId: log._id }, 'Gagal memproses pengingat ke-2 pasien');
      results.push({ logId: log._id, success: false, error: error.message });
    }
  }

  return results;
}
