/**
 * Service pemrosesan perintah admin untuk peneliti (FR-30 s.d. FR-32).
 * Dibatasi ketat hanya untuk nomor yang terdaftar pada ADMIN_NUMBERS.
 */

import { Patient, ReminderLog } from '../db/models.js';
import { PATIENT_STATE, REMINDER_STATUS } from '../utils/constants.js';
import { formatDateWib } from '../utils/time.js';
import {
  getAdminUnauthorizedMessage,
  getAdminRekapMessage,
  getAdminPasienMessage,
  getAdminStopSuccessMessage,
  getAdminStopNotFoundMessage,
  getAdminHelpMessage
} from '../utils/messages.js';
import { send } from '../bot/client.js';
import { getConfig } from '../config.js';
import { logger } from '../utils/logger.js';

/**
 * Menormalisasi nomor telepon ke format numerik standar Indonesia (awalan 62).
 * @param {string} phone
 * @returns {string}
 */
export function normalizePhoneNumber(phone = '') {
  const digits = String(phone).replace(/[^0-9]/g, '');
  if (digits.startsWith('0')) {
    return '62' + digits.slice(1);
  }
  return digits;
}

/**
 * Memeriksa apakah nomor pengirim terdaftar pada daftar whitelist ADMIN_NUMBERS.
 * @param {string} jid WhatsApp JID pengirim
 * @param {Array<string>} [adminNumbers] Daftar nomor admin
 * @returns {boolean}
 */
export function isAdminNumber(jid, adminNumbers) {
  if (!jid) return false;

  const numbersToCheck = adminNumbers || getConfig().ADMIN_NUMBERS || [];
  const senderPhone = normalizePhoneNumber(jid.replace('@s.whatsapp.net', ''));

  return numbersToCheck.some((adminNum) => {
    const cleanAdmin = normalizePhoneNumber(adminNum);
    return senderPhone === cleanAdmin;
  });
}

/**
 * Mem-parsing perintah admin dari pesan teks berawalan '!'.
 * @param {string} text Teks pesan
 * @returns {{ isCommand: boolean, command?: string, args?: string } | null}
 */
export function parseAdminCommand(text = '') {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed.startsWith('!')) {
    return null;
  }

  const content = trimmed.slice(1).trim();
  const [cmd, ...rest] = content.split(/\s+/);
  const command = (cmd || '').toLowerCase();
  const args = rest.join(' ').trim();

  return {
    isCommand: true,
    command,
    args
  };
}

/**
 * Menangani eksekusi perintah admin (!rekap, !pasien, !stop <RM>).
 * @param {string} jid WhatsApp JID pengirim
 * @param {string} text Teks pesan
 * @param {object} [options={}]
 * @returns {Promise<{ handled: boolean, action?: string, [key: string]: any }>}
 */
export async function handleAdminCommand(jid, text, options = {}) {
  const parsed = parseAdminCommand(text);
  if (!parsed) {
    return { handled: false };
  }

  const sendFn = options.sendFn || send;
  const now = options.now || new Date();
  const adminNumbers = options.adminNumbers;

  // Verifikasi otorisasi nomor admin (FR-30 s.d. FR-32)
  const isAuthorized = isAdminNumber(jid, adminNumbers);
  if (!isAuthorized) {
    logger.warn({ jid }, 'Akses perintah admin ditolak: nomor tidak terdaftar');
    if (options.silentReject) {
      return { handled: true, action: 'unauthorized_silent' };
    }
    await sendFn(jid, getAdminUnauthorizedMessage());
    return { handled: true, action: 'unauthorized' };
  }

  const { command, args } = parsed;

  try {
    // 1. Perintah !rekap (FR-30)
    if (command === 'rekap') {
      const todayStr = formatDateWib(now);
      const logs = await ReminderLog.find({ tanggal: todayStr });

      const stats = {
        tanggal: todayStr,
        total: logs.length,
        tepatWaktu: 0,
        terlambat: 0,
        menunggu: 0,
        tidakKonfirmasi: 0,
        terlewatSistem: 0
      };

      for (const log of logs) {
        if (log.status === REMINDER_STATUS.TEPAT_WAKTU) stats.tepatWaktu++;
        else if (log.status === REMINDER_STATUS.TERLAMBAT) stats.terlambat++;
        else if (log.status === REMINDER_STATUS.MENUNGGU) stats.menunggu++;
        else if (log.status === REMINDER_STATUS.TIDAK_KONFIRMASI) stats.tidakKonfirmasi++;
        else if (log.status === REMINDER_STATUS.TERLEWAT_SISTEM) stats.terlewatSistem++;
      }

      await sendFn(jid, getAdminRekapMessage(stats));
      return { handled: true, action: 'rekap', stats };
    }

    // 2. Perintah !pasien (FR-31)
    if (command === 'pasien') {
      const activePatients = await Patient.find({
        state: PATIENT_STATE.ACTIVE
      }).sort({ jamMinum: 1, noRM: 1 });

      await sendFn(jid, getAdminPasienMessage(activePatients));
      return { handled: true, action: 'pasien', count: activePatients.length };
    }

    // 3. Perintah !stop <RM> (FR-32)
    if (command === 'stop') {
      const noRM = args.trim();
      if (!noRM) {
        await sendFn(
          jid,
          `Format salah. Gunakan: *!stop <No. RM>*\nContoh: *!stop 123456*`
        );
        return { handled: true, action: 'stop_missing_arg' };
      }

      const patient = await Patient.findOne({ noRM });
      if (!patient) {
        await sendFn(jid, getAdminStopNotFoundMessage(noRM));
        return { handled: true, action: 'stop_not_found', noRM };
      }

      patient.state = PATIENT_STATE.STOPPED;
      await patient.save();

      logger.info(
        { patientId: patient._id, noRM: patient.noRM },
        'Pengingat pasien berhasil dihentikan oleh admin'
      );

      await sendFn(jid, getAdminStopSuccessMessage(patient));
      return {
        handled: true,
        action: 'stop_success',
        noRM: patient.noRM,
        patientId: patient._id
      };
    }

    // 4. Perintah bantuan / tidak dikenal
    await sendFn(jid, getAdminHelpMessage());
    return { handled: true, action: 'help' };
  } catch (error) {
    logger.error({ err: error.message, command }, 'Gagal memproses perintah admin');
    throw error;
  }
}
