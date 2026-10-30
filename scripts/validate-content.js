#!/usr/bin/env node

/**
 * Skrip validasi content/edukasi.json (FR-51).
 * Penggunaan: npm run validate:content
 *
 * Aturan validasi:
 * - File JSON valid
 * - Setiap materi punya field `judul` dan `isi` tidak kosong
 * - Isi terdiri dari 2–4 kalimat
 * - Panjang isi <= 600 karakter
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const filePath = join(__dirname, '../content/edukasi.json');

let exitCode = 0;

/**
 * Hitung jumlah kalimat dalam teks.
 * Kalimat dipisahkan oleh . ! ? diikuti spasi atau akhir string.
 * @param {string} text
 * @returns {number}
 */
function countSentences(text) {
  const matches = text.match(/[^.!?]+[.!?]+(\s|$)/g);
  return matches ? matches.length : 0;
}

function fail(msg) {
  console.error(`  ✖ ${msg}`);
  exitCode = 1;
}

function ok(msg) {
  console.log(`  ✔ ${msg}`);
}

console.log(`Memvalidasi ${filePath}...\n`);

let data;
try {
  const raw = readFileSync(filePath, 'utf-8');
  data = JSON.parse(raw);
  ok('File JSON valid dan dapat di-parse');
} catch (err) {
  console.error(`✖ Gagal membaca/parse file: ${err.message}`);
  process.exit(1);
}

if (!Array.isArray(data)) {
  console.error('✖ Konten harus berupa array JSON');
  process.exit(1);
}

ok(`Jumlah materi: ${data.length}`);
console.log('');

data.forEach((item, i) => {
  const no = i + 1;
  console.log(`Materi #${no}:`);

  if (!item.judul || typeof item.judul !== 'string' || item.judul.trim() === '') {
    fail(`judul kosong atau tidak ada`);
  } else {
    ok(`judul: "${item.judul.substring(0, 50)}..."`);
  }

  if (!item.isi || typeof item.isi !== 'string' || item.isi.trim() === '') {
    fail(`isi kosong atau tidak ada`);
  } else {
    const len = item.isi.length;
    const sentences = countSentences(item.isi);

    if (len > 600) {
      fail(`isi terlalu panjang: ${len} karakter (maks 600)`);
    } else {
      ok(`panjang isi: ${len} karakter`);
    }

    if (sentences < 2 || sentences > 4) {
      fail(`jumlah kalimat: ${sentences} (harus 2–4)`);
    } else {
      ok(`jumlah kalimat: ${sentences}`);
    }
  }

  console.log('');
});

if (exitCode === 0) {
  console.log(`✔ Semua ${data.length} materi valid.`);
} else {
  console.error('✖ Validasi gagal. Periksa pesan di atas.');
}

process.exit(exitCode);
