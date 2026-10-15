/**
 * Scheduler cron job tiap menit (Asia/Jakarta) sesuai PRD §7 (FR-10) dan §10.
 */

import cron from 'node-cron';
import { TIMEZONE } from '../utils/time.js';
import { checkAndSendDailyReminders, checkAndSendReminder2 } from '../services/reminder.js';
import { logger } from '../utils/logger.js';

let cronTask = null;

/**
 * Menjalankan scheduler pengingat obat dengan frekuensi tiap menit pada zona Asia/Jakarta.
 * @param {object} [options={}]
 * @returns {cron.ScheduledTask}
 */
export function startScheduler(options = {}) {
  logger.info({ timezone: TIMEZONE }, 'Memulai scheduler pengingat obat (cron tiap menit)');

  cronTask = cron.schedule(
    '* * * * *',
    async () => {
      try {
        const now = options.now ? options.now() : new Date();
        logger.debug('Menjalankan pengecekan pengingat harian (Pengingat 1 & 2)...');
        // 1. Pengingat 1 pada jam pasien (FR-11)
        await checkAndSendDailyReminders(now, options);
        // 2. Pengingat 2 setelah 30 menit tanpa respons (FR-17)
        await checkAndSendReminder2(now, options);
      } catch (error) {
        logger.error({ err: error.message }, 'Gagal dalam eksekusi cron pengingat harian');
      }
    },
    {
      timezone: TIMEZONE
    }
  );

  return cronTask;
}

/**
 * Menghentikan scheduler jika sedang berjalan.
 */
export function stopScheduler() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    logger.info('Scheduler pengingat obat telah dihentikan');
  }
}
