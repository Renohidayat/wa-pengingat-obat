/**
 * Service pendaftaran dan alur registrasi pasien (FR-03 s.d. FR-07).
 */

import { Patient } from '../db/models.js';
import { PATIENT_STATE } from '../utils/constants.js';
import { isRegistrationTrigger, parseRegistrationText } from '../utils/parser.js';
import {
  getRequestDataMessage,
  getInvalidFormatMessage,
  getDuplicateRmMessage,
  getRegistrationSuccessMessage,
  getAlreadyRegisteredMessage,
  getPatientStoppedMessage
} from '../utils/messages.js';
import { send } from '../bot/client.js';
import { logger } from '../utils/logger.js';

/**
 * Menangani alur registrasi pasien berdasarkan pesan masuk.
 * @param {string} jid WhatsApp JID pengirim
 * @param {string} text Teks pesan masuk
 * @param {object} [options={}] Opsi tambahan (seperti mock sendFn untuk testing)
 * @returns {Promise<{ handled: boolean, action?: string }>}
 */
export async function handleRegistrationMessage(jid, text, options = {}) {
  const sendFn = options.sendFn || send;
  const isTrigger = isRegistrationTrigger(text);

  let patient = await Patient.findOne({ jid });

  // 1. Jika pesan adalah trigger "DAFTAR" (FR-03)
  if (isTrigger) {
    if (!patient) {
      patient = new Patient({
        jid,
        state: PATIENT_STATE.AWAITING_DATA
      });
      await patient.save();
      logger.info({ patientId: patient._id }, 'Pasien baru memulai registrasi');
    } else if (patient.state === PATIENT_STATE.ACTIVE) {
      const jadwalTeks = patient.jamMinum.join(' dan ');
      await sendFn(jid, getAlreadyRegisteredMessage(patient.nama, jadwalTeks));
      return { handled: true, action: 'already_active' };
    } else if (patient.state === PATIENT_STATE.STOPPED) {
      await sendFn(jid, getPatientStoppedMessage(patient.nama));
      return { handled: true, action: 'patient_stopped' };
    } else {
      patient.state = PATIENT_STATE.AWAITING_DATA;
      await patient.save();
    }

    await sendFn(jid, getRequestDataMessage());
    return { handled: true, action: 'awaiting_data_requested' };
  }

  // 2. Jika pasien dalam state awaiting_data (menunggu input data: Nama / RM / Jam)
  if (patient && patient.state === PATIENT_STATE.AWAITING_DATA) {
    const parsed = parseRegistrationText(text);

    // Format tidak valid -> kirim contoh format, state TETAP awaiting_data (FR-05)
    if (!parsed.valid) {
      logger.info({ patientId: patient._id, reason: parsed.reason }, 'Format registrasi tidak valid');
      await sendFn(jid, getInvalidFormatMessage());
      return { handled: true, action: 'invalid_format' };
    }

    // Cek duplikasi RM pada pasien lain (FR-06)
    const duplicateRm = await Patient.findOne({
      noRM: parsed.noRM,
      jid: { $ne: jid }
    });

    if (duplicateRm) {
      logger.warn({ patientId: patient._id }, 'No. RM duplikat terdeteksi');
      await sendFn(jid, getDuplicateRmMessage(parsed.noRM));
      return { handled: true, action: 'duplicate_rm' };
    }

    // Registrasi Berhasil -> update state ke active (FR-07)
    patient.nama = parsed.nama;
    patient.noRM = parsed.noRM;
    patient.jamMinum = parsed.jamMinum;
    patient.registeredAt = new Date();
    patient.state = PATIENT_STATE.ACTIVE;

    await patient.save();

    logger.info({ patientId: patient._id }, 'Pasien berhasil terdaftar');
    const jadwalTeks = patient.jamMinum.join(' dan ');
    await sendFn(jid, getRegistrationSuccessMessage(patient.nama, jadwalTeks));
    return { handled: true, action: 'registration_success' };
  }

  return { handled: false };
}
