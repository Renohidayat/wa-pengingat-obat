/**
 * Service pengingat minum obat harian (FR-10 s.d. FR-13).
 * Menerapkan sifat idempoten, isolasi error per pasien, aturan registrasi hari yang sama,
 * dan mekanisme catch-up (<= 60 menit) atau Terlewat Sistem (> 60 menit).
 */

import { Patient, ReminderLog } from '../db/models.js';
import { PATIENT_STATE, REMINDER_STATUS } from '../utils/constants.js';
import { formatDateWib, formatTimeWib, calculateMinuteDiff } from '../utils/time.js';
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

/**
 * Fungsi murni untuk mengevaluasi kelayakan log difinalisasi menjadi Tidak Konfirmasi (FR-18).
 * Syarat:
 * 1. Log harus berstatus Menunggu (REMINDER_STATUS.MENUNGGU).
 * 2. Log milik hari kemarin/sebelumnya (catch-up), ATAU milik hari ini dan waktu sudah mencapai >= 23:59 WIB / opsi force.
 * @param {{
 *   log: { status: string, tanggal: string },
 *   now?: Date,
 *   options?: { force?: boolean }
 * }} params
 * @returns {{
 *   eligible: boolean,
 *   action?: 'FINALIZE_UNCONFIRMED',
 *   reason?: string,
 *   currentTime?: string
 * }}
 */
export function evaluateFinalizationEligibility({ log, now = new Date(), options = {} }) {
  if (!log) {
    return { eligible: false, reason: 'NO_LOG' };
  }

  // Hanya memfinalisasi log yang statusnya masih Menunggu
  if (log.status !== REMINDER_STATUS.MENUNGGU) {
    return { eligible: false, reason: 'STATUS_NOT_MENUNGGU', currentStatus: log.status };
  }

  const todayStr = formatDateWib(now);
  const currentTime = formatTimeWib(now);

  // Jika log dari hari-hari sebelumnya yang tertinggal (catch-up)
  if (log.tanggal < todayStr) {
    return {
      eligible: true,
      action: 'FINALIZE_UNCONFIRMED',
      reason: 'PAST_DAY_UNCONFIRMED'
    };
  }

  // Jika log dari hari ini, harus sudah mencapai 23:59 WIB atau dipaksa
  if (log.tanggal === todayStr) {
    if (currentTime >= '23:59' || options.force) {
      return {
        eligible: true,
        action: 'FINALIZE_UNCONFIRMED',
        reason: 'END_OF_DAY_REACHED'
      };
    }
    return {
      eligible: false,
      reason: 'TIME_NOT_ARRIVED',
      currentTime
    };
  }

  return { eligible: false, reason: 'FUTURE_DATE' };
}

/**
 * Memfinalisasi log pengingat yang masih Menunggu menjadi Tidak Konfirmasi (FR-18).
 * Menjalankan pembaruan secara idempoten dan aman dijalankan berulang kali.
 * @param {Date} [now=new Date()]
 * @param {object} [options={}]
 * @returns {Promise<{ targetDate: string, modifiedCount: number, logIds: Array<any> }>}
 */
export async function finalizeDailyUnconfirmedLogs(now = new Date(), options = {}) {
  const todayStr = formatDateWib(now);
  const currentTime = formatTimeWib(now);
  const force = options.force ?? false;
  const targetDate = options.date;

  let query = { status: REMINDER_STATUS.MENUNGGU };

  if (targetDate) {
    query.tanggal = targetDate;
  } else if (currentTime >= '23:59' || force) {
    // Pada akhir hari (23:59 WIB) atau force, proses log hari ini dan sebelumnya
    query.tanggal = { $lte: todayStr };
  } else {
    // Di luar 23:59, hanya proses log hari-hari sebelumnya yang belum difinalisasi
    query.tanggal = { $lt: todayStr };
  }

  const pendingLogs = await ReminderLog.find(query);
  const updatedLogIds = [];

  for (const log of pendingLogs) {
    const evaluation = evaluateFinalizationEligibility({
      log,
      now,
      options: { force: force || Boolean(targetDate) }
    });

    if (evaluation.eligible) {
      try {
        log.status = REMINDER_STATUS.TIDAK_KONFIRMASI;
        await log.save();
        updatedLogIds.push(log._id);
        logger.info(
          { logId: log._id, patientId: log.patientId, tanggal: log.tanggal },
          'Log pengingat difinalisasi menjadi Tidak Konfirmasi'
        );
      } catch (err) {
        logger.error(
          { err: err.message, logId: log._id },
          'Gagal memfinalisasi log pengingat ke Tidak Konfirmasi'
        );
      }
    }
  }

  if (updatedLogIds.length > 0) {
    logger.info(
      { count: updatedLogIds.length, todayStr, currentTime },
      'Finalisasi harian status Tidak Konfirmasi berhasil diperbarui'
    );
  }

  return {
    targetDate: targetDate || todayStr,
    modifiedCount: updatedLogIds.length,
    logIds: updatedLogIds
  };
}

