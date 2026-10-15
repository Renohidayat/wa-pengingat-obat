/**
 * Inisialisasi klien WhatsApp Baileys, manajemen sesi persisten, auto-reconnect,
 * dan fungsi pengiriman pesan dengan jeda acak (FR-01, FR-20).
 */

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import { logger } from '../utils/logger.js';
import { getConfig } from '../config.js';

let sock = null;

/**
 * Menghitung jeda acak antara minMs dan maxMs (default 1500–4000 ms sesuai FR-20).
 * @param {number} [minMs=1500]
 * @param {number} [maxMs=4000]
 * @returns {number}
 */
export function getRandomDelay(minMs = 1500, maxMs = 4000) {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

/**
 * Fungsi helper jeda asinkron.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mengirim pesan teks ke WhatsApp dengan penerapan jeda acak (FR-20) untuk mengurangi risiko pemblokiran.
 * @param {string} jid WhatsApp JID tujuan
 * @param {string} text Teks pesan
 * @param {object} [options={}] Opsi tambahan
 * @param {boolean} [options.skipDelay=false] Lewati jeda (berguna untuk pengujian)
 * @param {number} [options.minDelay=1500]
 * @param {number} [options.maxDelay=4000]
 * @returns {Promise<any>}
 */
export async function send(jid, text, options = {}) {
  if (!sock) {
    throw new Error('Koneksi WhatsApp belum terinisialisasi');
  }

  if (!options.skipDelay) {
    const delay = getRandomDelay(options.minDelay || 1500, options.maxDelay || 4000);
    logger.debug({ delayMs: delay }, 'Menerapkan jeda acak sebelum pengiriman pesan');
    await sleep(delay);
  }

  return await sock.sendMessage(jid, { text });
}

/**
 * Menginisialisasi koneksi klien WhatsApp Baileys.
 * @param {object} [customOptions={}] Opsi kustom untuk pengujian/eksternal
 * @returns {Promise<any>}
 */
export async function createBot(customOptions = {}) {
  const config = getConfig();
  const authDir = customOptions.authDir || config.AUTH_DIR || './auth_info';

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version, isLatest } = await fetchLatestBaileysVersion();

  logger.info({ version, isLatest }, 'Memulai koneksi Baileys WhatsApp');

  sock = makeWASocket({
    version,
    auth: state,
    logger: logger.child({ module: 'baileys' }),
    printQRInTerminal: false, // Ditangani manual lewat qrcode-terminal
    ...customOptions
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info('Silakan scan QR code berikut untuk menghubungkan WhatsApp:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      logger.warn(
        { statusCode, shouldReconnect },
        'Koneksi WhatsApp terputus'
      );

      if (shouldReconnect) {
        logger.info('Mencoba menghubungkan kembali ke WhatsApp...');
        createBot(customOptions);
      } else {
        logger.error('WhatsApp logout secara eksplisit. Hapus auth_info/ dan scan ulang.');
      }
    } else if (connection === 'open') {
      logger.info('Koneksi WhatsApp berhasil tersambung!');
    }
  });

  return sock;
}

/**
 * Mendapatkan instance socket Baileys yang sedang aktif.
 * @returns {any}
 */
export function getSocket() {
  return sock;
}

/**
 * Mengatur instance socket Baileys (untuk kebutuhan unit testing).
 * @param {any} newSock
 */
export function setSocket(newSock) {
  sock = newSock;
}
