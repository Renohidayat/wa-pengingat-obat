/**
 * Loader materi edukasi dari content/edukasi.json (FR-50).
 * Fungsi murni, mudah diuji.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {Array<{ judul: string, isi: string }> | null} */
let _cache = null;

/**
 * Membaca dan mem-parse file content/edukasi.json.
 * Hasil di-cache setelah pemanggilan pertama.
 * @param {string} [filePath] Path opsional (untuk testing)
 * @returns {Array<{ judul: string, isi: string }>}
 */
export function loadEdukasi(filePath) {
  if (_cache && !filePath) {
    return _cache;
  }

  const resolvedPath = filePath || join(__dirname, '../../content/edukasi.json');
  const raw = readFileSync(resolvedPath, 'utf-8');
  const data = JSON.parse(raw);

  if (!Array.isArray(data)) {
    throw new Error('content/edukasi.json harus berupa array');
  }

  if (!filePath) {
    _cache = data;
  }

  return data;
}

/**
 * Mengembalikan total jumlah materi edukasi.
 * @param {string} [filePath] Path opsional (untuk testing)
 * @returns {number}
 */
export function getTotalMateri(filePath) {
  return loadEdukasi(filePath).length;
}

/**
 * Mengembalikan materi pada indeks tertentu (0-based).
 * Mengembalikan null jika indeks di luar batas (materi habis).
 * @param {number} index Indeks 0-based
 * @param {string} [filePath] Path opsional (untuk testing)
 * @returns {{ judul: string, isi: string } | null}
 */
export function getMateri(index, filePath) {
  const data = loadEdukasi(filePath);
  if (index < 0 || index >= data.length) {
    return null;
  }
  return data[index];
}

/**
 * Mereset cache (dipakai dalam test).
 */
export function resetEdukasiCache() {
  _cache = null;
}
