/**
 * Handler pesan masuk WhatsApp dan filter pesan (FR-02).
 */

import { logger } from '../utils/logger.js';
import { handleRegistrationMessage } from '../services/registration.js';
import { handleAdherenceConfirmation } from '../services/adherence.js';
import { handleAdminCommand } from '../services/admin.js';

/**
 * Mengecek apakah pesan harus diabaikan sesuai FR-02:
 * 1. Pesan dari bot sendiri (fromMe)
 * 2. Pesan dari grup WhatsApp (@g.us)
 * 3. Pesan status/broadcast (@broadcast)
 * @param {object} m Objek pesan Baileys
 * @returns {boolean} true jika pesan harus diabaikan
 */
export function shouldIgnoreMessage(m) {
  if (!m || !m.key) {
    return true;
  }

  // Abaikan pesan yang dikirim oleh bot sendiri
  if (m.key.fromMe) {
    return true;
  }

  const remoteJid = m.key.remoteJid || '';

  // Abaikan pesan grup WhatsApp
  if (remoteJid.endsWith('@g.us')) {
    return true;
  }

  // Abaikan pesan status atau broadcast
  if (remoteJid.endsWith('@broadcast') || remoteJid === 'status@broadcast') {
    return true;
  }

  return false;
}

/**
 * Mengekstrak teks dari pesan Baileys.
 * @param {object} m Objek pesan Baileys
 * @returns {string} Teks pesan (trim)
 */
export function extractMessageText(m) {
  if (!m || !m.message) {
    return '';
  }

  const text =
    m.message.conversation ||
    m.message.extendedTextMessage?.text ||
    m.message.imageMessage?.caption ||
    '';

  return typeof text === 'string' ? text.trim() : '';
}

/**
 * Dispatcher pesan masuk utama untuk memproses registrasi, konfirmasi, atau perintah admin.
 * @param {{ jid: string, text: string, message?: object }} payload
 * @param {object} [options={}]
 */
export async function handleIncomingMessage({ jid, text, message }, options = {}) {
  // 1. Cek perintah admin peneliti (FR-30 s.d. FR-32)
  const adminResult = await handleAdminCommand(jid, text, options);
  if (adminResult.handled) {
    return adminResult;
  }

  // 2. Cek alur registrasi pasien (FR-03 s.d. FR-07)
  const regResult = await handleRegistrationMessage(jid, text, options);
  if (regResult.handled) {
    return regResult;
  }

  // 3. Cek konfirmasi kepatuhan minum obat (FR-14 s.d. FR-16, FR-19)
  const adhResult = await handleAdherenceConfirmation(jid, text, options);
  if (adhResult.handled) {
    return adhResult;
  }
}

/**
 * Mendaftarkan listener pesan masuk pada socket Baileys.
 * Menerapkan isolasi error per pesan (try/catch) agar kegagalan satu pesan tidak mengganggu pesan lain.
 * @param {any} sock Instance socket Baileys
 * @param {(payload: { jid: string, text: string, message: object }) => Promise<void>} [handler=handleIncomingMessage]
 */
export function setupMessageHandlers(sock, handler = handleIncomingMessage) {
  sock.ev.on('messages.upsert', async (upsert) => {
    // Hanya proses pesan notifikasi baru
    if (upsert.type !== 'notify' || !Array.isArray(upsert.messages)) {
      return;
    }

    for (const m of upsert.messages) {
      if (shouldIgnoreMessage(m)) {
        continue;
      }

      const text = extractMessageText(m);
      if (!text) {
        continue;
      }

      const jid = m.key.remoteJid;

      // Isolasi error per pasien/pesan
      try {
        logger.debug({ jid }, 'Menerima pesan masuk valid');
        if (typeof handler === 'function') {
          await handler({ jid, text, message: m });
        }
      } catch (error) {
        logger.error({ err: error.message }, 'Gagal memproses pesan masuk');
      }
    }
  });
}

