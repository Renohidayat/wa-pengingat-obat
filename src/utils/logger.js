/**
 * Logger terpusat menggunakan pino sesuai PRD §11 dan AGENTS.md §4.
 * Catatan privasi: Dilarang mencatat nama, noRM, atau nomor telepon pasien pada level info ke atas.
 */

import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  timestamp: pino.stdTimeFunctions.isoTime
});

export default logger;
