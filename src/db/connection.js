/**
 * Manajemen koneksi database MongoDB via Mongoose sesuai PRD §10 dan §11.
 */

import mongoose from 'mongoose';
import dns from 'node:dns';

/**
 * Memastikan resolver DNS Node.js memiliki server yang dapat dihubungi.
 * Mengatasi masalah umum pada Windows di mana resolver c-ares bawaan hanya mendeteksi loopback (127.0.0.1)
 * saat terdapat adapter virtual/VPN, sehingga querySrv MongoDB Atlas menghasilkan ECONNREFUSED.
 * @param {string[]} [customServers]
 */
export function ensureDnsServers(customServers = []) {
  try {
    if (Array.isArray(customServers) && customServers.length > 0) {
      dns.setServers(customServers);
      return;
    }

    const currentServers = dns.getServers();
    if (
      !currentServers ||
      currentServers.length === 0 ||
      (currentServers.length === 1 && currentServers[0] === '127.0.0.1')
    ) {
      dns.setServers(['1.1.1.1', '8.8.8.8']);
    }
  } catch {
    // Abaikan jika sandbox atau izin sistem tidak memperbolehkan perubahan DNS
  }
}

/**
 * Menghubungkan ke database MongoDB.
 * @param {string} uri
 * @param {object} [options={}]
 * @param {string[]} [options.dnsServers]
 * @returns {Promise<typeof mongoose>}
 */
export async function connectDb(uri, options = {}) {
  if (!uri) {
    throw new Error('URI koneksi MongoDB tidak boleh kosong');
  }

  // Jika sudah terhubung, kembalikan instance mongoose
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  ensureDnsServers(options.dnsServers);

  try {
    await mongoose.connect(uri, {
      autoIndex: true
    });
    return mongoose;
  } catch (error) {
    throw new Error(`Gagal terhubung ke MongoDB: ${error.message}`);
  }
}

/**
 * Memutuskan koneksi database MongoDB.
 * @returns {Promise<void>}
 */
export async function disconnectDb() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
