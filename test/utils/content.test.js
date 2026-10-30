import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadEdukasi,
  getTotalMateri,
  getMateri,
  resetEdukasiCache
} from '../../src/utils/content.js';

// Path ke file asli untuk test integrasi
const REAL_PATH = new URL('../../content/edukasi.json', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

describe('Content Loader - edukasi.json (FR-50)', () => {
  beforeEach(() => {
    resetEdukasiCache();
  });

  describe('loadEdukasi', () => {
    it('membaca file edukasi.json asli dan mengembalikan array', () => {
      const data = loadEdukasi(REAL_PATH);
      assert.ok(Array.isArray(data), 'harus array');
      assert.ok(data.length > 0, 'tidak boleh kosong');
    });

    it('setiap materi punya field judul dan isi berupa string tidak kosong', () => {
      const data = loadEdukasi(REAL_PATH);
      for (const [i, item] of data.entries()) {
        assert.ok(typeof item.judul === 'string' && item.judul.trim() !== '', `materi #${i + 1}: judul harus ada`);
        assert.ok(typeof item.isi === 'string' && item.isi.trim() !== '', `materi #${i + 1}: isi harus ada`);
      }
    });

    it('file asli berisi tepat 22 materi', () => {
      const data = loadEdukasi(REAL_PATH);
      assert.equal(data.length, 22);
    });

    it('melempar error jika file tidak ditemukan', () => {
      assert.throws(
        () => loadEdukasi('/path/tidak/ada/edukasi.json'),
        /ENOENT|no such file/i
      );
    });

    it('melempar error jika konten bukan array', () => {
      const tmp = join(tmpdir(), 'test-edukasi-invalid.json');
      writeFileSync(tmp, JSON.stringify({ bukan: 'array' }));
      assert.throws(
        () => loadEdukasi(tmp),
        /harus berupa array/
      );
    });
  });

  describe('getTotalMateri', () => {
    it('mengembalikan 22 untuk file asli', () => {
      assert.equal(getTotalMateri(REAL_PATH), 22);
    });

    it('mengembalikan jumlah sesuai isi file kustom', () => {
      const tmp = join(tmpdir(), 'test-edukasi-2.json');
      writeFileSync(tmp, JSON.stringify([
        { judul: 'A', isi: 'Isi A.' },
        { judul: 'B', isi: 'Isi B.' }
      ]));
      assert.equal(getTotalMateri(tmp), 2);
    });
  });

  describe('getMateri', () => {
    it('mengembalikan materi pertama pada index 0', () => {
      const materi = getMateri(0, REAL_PATH);
      assert.ok(materi !== null);
      assert.ok(typeof materi.judul === 'string');
      assert.ok(typeof materi.isi === 'string');
    });

    it('mengembalikan materi terakhir pada index 21', () => {
      const materi = getMateri(21, REAL_PATH);
      assert.ok(materi !== null);
      assert.equal(materi.judul, 'Terus Semangat, Sehat Itu Proses');
    });

    it('mengembalikan null jika index >= total (materi habis)', () => {
      assert.equal(getMateri(22, REAL_PATH), null);
      assert.equal(getMateri(100, REAL_PATH), null);
    });

    it('mengembalikan null jika index negatif', () => {
      assert.equal(getMateri(-1, REAL_PATH), null);
    });

    it('urutan materi konsisten (index 0 = materi ke-1, dst)', () => {
      const m0 = getMateri(0, REAL_PATH);
      const m1 = getMateri(1, REAL_PATH);
      assert.equal(m0.judul, 'Pentingnya Minum Obat Secara Teratur');
      assert.equal(m1.judul, 'Minum Obat pada Waktu yang Sama Setiap Hari');
    });
  });
});
