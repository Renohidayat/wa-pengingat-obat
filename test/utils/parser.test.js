import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTimeString,
  isRegistrationTrigger,
  isConfirmationTrigger,
  parseRegistrationText
} from '../../src/utils/parser.js';

describe('Registration Parser (FR-03 & FR-04)', () => {
  describe('parseTimeString', () => {
    it('menerima format jam dengan titik atau titik dua dan 1 atau 2 digit jam', () => {
      assert.equal(parseTimeString('07.00'), '07:00');
      assert.equal(parseTimeString('7.00'), '07:00');
      assert.equal(parseTimeString('07:00'), '07:00');
      assert.equal(parseTimeString('7:00'), '07:00');
      assert.equal(parseTimeString('19.30'), '19:30');
      assert.equal(parseTimeString('23:59'), '23:59');
      assert.equal(parseTimeString('00.00'), '00:00');
      assert.equal(parseTimeString('  08.15  '), '08:15');
    });

    it('menolak jam di luar rentang 00:00 s.d. 23:59 atau format tidak valid', () => {
      assert.equal(parseTimeString('24.00'), null);
      assert.equal(parseTimeString('25:00'), null);
      assert.equal(parseTimeString('07.60'), null);
      assert.equal(parseTimeString('07:99'), null);
      assert.equal(parseTimeString('pagi'), null);
      assert.equal(parseTimeString(''), null);
      assert.equal(parseTimeString(null), null);
    });
  });

  describe('isRegistrationTrigger', () => {
    it('mengenali teks DAFTAR secara case-insensitive dan trim', () => {
      assert.equal(isRegistrationTrigger('DAFTAR'), true);
      assert.equal(isRegistrationTrigger('daftar'), true);
      assert.equal(isRegistrationTrigger('  Daftar  '), true);
      assert.equal(isRegistrationTrigger('DaFtAr'), true);
    });

    it('menolak pesan yang bukan kata tunggal DAFTAR', () => {
      assert.equal(isRegistrationTrigger('DAFTAR DONG'), false);
      assert.equal(isRegistrationTrigger('SAYA MAU DAFTAR'), false);
      assert.equal(isRegistrationTrigger('SUDAH'), false);
      assert.equal(isRegistrationTrigger(''), false);
      assert.equal(isRegistrationTrigger(null), false);
    });
  });

  describe('isConfirmationTrigger (FR-14)', () => {
    it('mengenali semua varian konfirmasi SUDAH, SUDAH MINUM, SDH, UDAH secara case-insensitive', () => {
      assert.equal(isConfirmationTrigger('SUDAH'), true);
      assert.equal(isConfirmationTrigger('sudah'), true);
      assert.equal(isConfirmationTrigger('  Sudah  '), true);
      assert.equal(isConfirmationTrigger('SUDAH MINUM'), true);
      assert.equal(isConfirmationTrigger('sudah minum'), true);
      assert.equal(isConfirmationTrigger('SDH'), true);
      assert.equal(isConfirmationTrigger('sdh'), true);
      assert.equal(isConfirmationTrigger('UDAH'), true);
      assert.equal(isConfirmationTrigger('udah'), true);
      assert.equal(isConfirmationTrigger('sudah!'), true);
      assert.equal(isConfirmationTrigger('SUDAH.'), true);
    });

    it('menolak pesan yang bukan varian konfirmasi', () => {
      assert.equal(isConfirmationTrigger('BELUM'), false);
      assert.equal(isConfirmationTrigger('DAFTAR'), false);
      assert.equal(isConfirmationTrigger('SUDAH MAKAN'), false);
      assert.equal(isConfirmationTrigger('SAYA SUDAH MINUM OBAT'), false);
      assert.equal(isConfirmationTrigger(''), false);
      assert.equal(isConfirmationTrigger(null), false);
    });
  });


  describe('parseRegistrationText', () => {
    it('berhasil mem-parsing format Nama / No. RM / Jam yang valid', () => {
      const res = parseRegistrationText('Sukanti / 123456 / 07.00');
      assert.equal(res.valid, true);
      assert.equal(res.nama, 'Sukanti');
      assert.equal(res.noRM, '123456');
      assert.equal(res.jamMinum, '07:00');
    });

    it('menangani spasi berlebih pada tiap bagian', () => {
      const res = parseRegistrationText('  Ahmad Subarjo   /   RM-9901   /   7:30   ');
      assert.equal(res.valid, true);
      assert.equal(res.nama, 'Ahmad Subarjo');
      assert.equal(res.noRM, 'RM-9901');
      assert.equal(res.jamMinum, '07:30');
    });

    it('gagal jika jumlah bagian pemisah / tidak tepat 3', () => {
      const res1 = parseRegistrationText('Sukanti 123456 07.00');
      assert.equal(res1.valid, false);

      const res2 = parseRegistrationText('Sukanti / 123456');
      assert.equal(res2.valid, false);

      const res3 = parseRegistrationText('Sukanti / 123456 / 07.00 / ekstra');
      assert.equal(res3.valid, false);
    });

    it('gagal jika nama atau No. RM kosong', () => {
      const res1 = parseRegistrationText('   / 123456 / 07.00');
      assert.equal(res1.valid, false);
      assert.equal(res1.reason, 'NAMA_KOSONG');

      const res2 = parseRegistrationText('Sukanti /    / 07.00');
      assert.equal(res2.valid, false);
      assert.equal(res2.reason, 'RM_KOSONG');
    });

    it('gagal jika jam minum obat tidak valid', () => {
      const res = parseRegistrationText('Sukanti / 123456 / 25.00');
      assert.equal(res.valid, false);
      assert.equal(res.reason, 'JAM_TIDAK_VALID');
    });
  });
});
