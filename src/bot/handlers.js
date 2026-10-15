/**
 * Handler pesan masuk WhatsApp dan filter pesan (FR-02).
 */

import { logger } from '../utils/logger.js';

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
 * Mendaftarkan listener pesan masuk pada socket Baileys.
 * Menerapkan isolasi error per pesan (try/catch) agar kegagalan satu pesan tidak mengganggu pesan lain.
 * @param {any} sock Instance socket Baileys
 * @param {(payload: { jid: string, text: string, message: object }) => Promise<void>} handler
 */
export function setupMessageHandlers(sock, handler) {
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
