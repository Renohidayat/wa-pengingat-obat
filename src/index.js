/**
 * Entry point aplikasi WhatsApp Bot Pengingat Minum Obat.
 * Inisialisasi koneksi database, bot WhatsApp, dan scheduler.
 * Menangani graceful shutdown (SIGINT, SIGTERM) dan error isolation.
 */

import { getConfig } from './config.js';
import { connectDb, disconnectDb } from './db/connection.js';
import { createBot, disconnectWhatsApp } from './bot/client.js';
import { setupMessageHandlers } from './bot/handlers.js';
import { startScheduler, stopScheduler } from './scheduler/index.js';
import { logger } from './utils/logger.js';

let isShuttingDown = false;

/**
 * Menjalankan prosedur pematian aplikasi secara aman dan rapi (graceful shutdown).
 * Menutup scheduler, koneksi WhatsApp, dan koneksi MongoDB.
 * @param {string} [signal='SIGTERM'] Nama sinyal pemicu (SIGINT, SIGTERM, dll)
 * @param {object} [options={}]
 * @returns {Promise<void>}
 */
export async function gracefulShutdown(signal = 'SIGTERM', options = {}) {
  if (isShuttingDown) {
    logger.warn('Pematian aplikasi sudah sedang berlangsung...');
    return;
  }
  isShuttingDown = true;
  logger.info({ signal }, 'Menerima sinyal pematian aplikasi (graceful shutdown)...');

  const stopSchedulerFn = options.stopScheduler || stopScheduler;
  const disconnectWhatsAppFn = options.disconnectWhatsApp || disconnectWhatsApp;
  const disconnectDbFn = options.disconnectDb || disconnectDb;

  try {
    // 1. Hentikan scheduler pengingat
    stopSchedulerFn();

    // 2. Tutup koneksi socket WhatsApp
    await disconnectWhatsAppFn();

    // 3. Putuskan koneksi database MongoDB
    await disconnectDbFn();

    logger.info('Semua layanan dan koneksi telah ditutup dengan aman.');
  } catch (error) {
    logger.error({ err: error.message }, 'Terjadi error saat proses graceful shutdown');
  }
}

/**
 * Mengatur ulang status flag shutdown (untuk pengujian).
 */
export function resetShutdownState() {
  isShuttingDown = false;
}

/**
 * Mendaftarkan event listener sinyal sistem untuk graceful shutdown.
 */
export function setupShutdownHandlers() {
  process.on('SIGINT', async () => {
    await gracefulShutdown('SIGINT');
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await gracefulShutdown('SIGTERM');
    process.exit(0);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason: reason instanceof Error ? reason.message : reason }, 'Unhandled Rejection terdeteksi');
  });

  process.on('uncaughtException', async (error) => {
    logger.fatal({ err: error.message, stack: error.stack }, 'Uncaught Exception fatal terdeteksi');
    await gracefulShutdown('uncaughtException');
    process.exit(1);
  });
}

/**
 * Memulai aplikasi utama bot WhatsApp pengingat obat.
 * @param {object} [options={}]
 * @returns {Promise<{ sock: any, schedulerTask: any }>}
 */
export async function bootstrap(options = {}) {
  logger.info('Memulai bootstrap aplikasi WhatsApp Bot Pengingat Minum Obat...');
  const config = options.config || getConfig();

  const connectDbFn = options.connectDb || connectDb;
  const createBotFn = options.createBot || createBot;
  const setupMessageHandlersFn = options.setupMessageHandlers || setupMessageHandlers;
  const startSchedulerFn = options.startScheduler || startScheduler;

  // 1. Hubungkan ke database MongoDB
  logger.info('Menghubungkan ke database MongoDB...');
  await connectDbFn(config.MONGODB_URI, { dnsServers: options.dnsServers || config.DNS_SERVERS });

  // 2. Buat koneksi Baileys WhatsApp dengan auto-attach handler saat inisialisasi & reconnect
  const sock = options.sock || (await createBotFn({
    authDir: config.AUTH_DIR,
    onSocketCreated: (newSock) => {
      setupMessageHandlersFn(newSock);
    }
  }));

  // 3. Daftarkan event listener jika sock di-inject secara manual (misal testing)
  if (options.sock) {
    setupMessageHandlersFn(options.sock);
  }

  // 4. Jalankan cron scheduler harian (Asia/Jakarta)
  const schedulerTask = startSchedulerFn(options);

  // 5. Daftarkan handler sinyal shutdown
  if (!options.skipSignals) {
    setupShutdownHandlers();
  }

  logger.info('Aplikasi WhatsApp Bot Pengingat Minum Obat siap dan berjalan');
  return { sock, schedulerTask };
}


const isDirectRun = Boolean(
  process.argv[1] && (
    process.argv[1].endsWith('src/index.js') ||
    process.argv[1].endsWith('src\\index.js')
  )
);

if (isDirectRun) {
  bootstrap().catch((err) => {
    logger.fatal({ err: err.message }, 'Gagal menjalankan aplikasi saat bootstrap');
    process.exit(1);
  });
}
