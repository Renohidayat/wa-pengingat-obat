/**
 * Konfigurasi dan validasi environment variables sesuai PRD §4, §11, dan Issue #3.
 */

import dotenv from 'dotenv';

dotenv.config();

/**
 * Memuat dan memvalidasi konfigurasi dari environment variables.
 * @param {Record<string, string | undefined>} [env=process.env]
 * @returns {{
 *   NODE_ENV: string,
 *   TZ: string,
 *   LOG_LEVEL: string,
 *   MONGODB_URI: string,
 *   ADMIN_NUMBERS: string[],
 *   AUTH_DIR: string,
 *   DNS_SERVERS: string[]
 * }}
 */
export function loadConfig(env = process.env) {
  const NODE_ENV = env.NODE_ENV || 'development';
  const TZ = env.TZ || 'Asia/Jakarta';
  const LOG_LEVEL = env.LOG_LEVEL || 'info';
  const AUTH_DIR = env.AUTH_DIR || './auth_info';

  const MONGODB_URI = env.MONGODB_URI?.trim();
  if (!MONGODB_URI) {
    throw new Error('Variabel lingkungan wajib MONGODB_URI belum diatur');
  }

  const rawAdmin = env.ADMIN_NUMBERS || '';
  const ADMIN_NUMBERS = rawAdmin
    .split(',')
    .map((num) => num.trim().replace(/[^0-9]/g, ''))
    .filter(Boolean);

  const rawDns = env.DNS_SERVERS || '';
  const DNS_SERVERS = rawDns
    ? rawDns.split(',').map((item) => item.trim()).filter(Boolean)
    : [];

  return {
    NODE_ENV,
    TZ,
    LOG_LEVEL,
    MONGODB_URI,
    ADMIN_NUMBERS,
    AUTH_DIR,
    DNS_SERVERS
  };
}

/**
 * Objek konfigurasi aktif (lazy/safe getter agar tidak langsung melempar error saat diimpor tanpa env di lingkungan uji).
 */
let cachedConfig = null;

export function getConfig() {
  if (!cachedConfig) {
    cachedConfig = loadConfig(process.env);
  }
  return cachedConfig;
}

export default getConfig;
