/**
 * Manajemen koneksi database MongoDB via Mongoose sesuai PRD §10 dan §11.
 */

import mongoose from 'mongoose';

/**
 * Menghubungkan ke database MongoDB.
 * @param {string} uri
 * @returns {Promise<typeof mongoose>}
 */
export async function connectDb(uri) {
  if (!uri) {
    throw new Error('URI koneksi MongoDB tidak boleh kosong');
  }

  // Jika sudah terhubung, kembalikan instance mongoose
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

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
