import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MESSAGE_FOOTER,
  getRegistrationSuccessMessage,
  getReminder1Message,
  getReminder2Message,
  getRequestDataMessage,
  getInvalidFormatMessage,
  getAdherenceConfirmedMessage
} from '../../src/utils/messages.js';

describe('Message Templates (PRD §8 & Ruang Lingkup v1)', () => {
  it('semua pesan menggunakan footer standar peneliti', () => {
    assert.match(MESSAGE_FOOTER, /Dea Farida/);
    assert.match(MESSAGE_FOOTER, /PUSKESMAS Sukarasa/);

    const regMsg = getRegistrationSuccessMessage('Sukanti', '07:00');
    assert.ok(regMsg.endsWith(MESSAGE_FOOTER));

    const rem1 = getReminder1Message('Sukanti');
    assert.ok(rem1.endsWith(MESSAGE_FOOTER));

    const rem2 = getReminder2Message('Sukanti');
    assert.ok(rem2.endsWith(MESSAGE_FOOTER));
  });

  it('pesan Registrasi Berhasil TIDAK memuat kata edukasi, silabus, atau tombol', () => {
    const regMsg = getRegistrationSuccessMessage('Sukanti', '07:00');

    // Sesuai FR-07 dan PRD §8
    assert.match(regMsg, /Registrasi Berhasil/);
    assert.match(regMsg, /Pengingat minum obat setiap hari pukul 07:00 WIB/);

    // Wajib: tidak ada edukasi otomatis di v1
    assert.doesNotMatch(regMsg, /edukasi/i);
    assert.doesNotMatch(regMsg, /silabus/i);
    assert.doesNotMatch(regMsg, /Senin, Rabu/i);
  });

  it('pesan Pengingat 1 memuat ajakan mengetik SUDAH dan tanpa tombol interaktif', () => {
    const rem1 = getReminder1Message('Sukanti', new Date('2026-10-15T00:00:00Z')); // 07:00 WIB (Pagi)
    assert.match(rem1, /Selamat Pagi, Bapak\/Ibu Sukanti/);
    assert.match(rem1, /Sudah waktunya untuk minum obat/);
    assert.match(rem1, /mengetik: \*SUDAH\*/);
    assert.doesNotMatch(rem1, /\[ SUDAH MINUM \]/);
  });

  it('pesan Pengingat 2 memuat frasa "obat Bapak/Ibu" tanpa placeholder [Nama Obat]', () => {
    const rem2 = getReminder2Message('Sukanti', new Date('2026-10-15T06:00:00Z')); // 13:00 WIB (Siang)
    assert.match(rem2, /Selamat Siang, Bapak\/Ibu Sukanti/);
    assert.match(rem2, /obat Bapak\/Ibu/);
    assert.doesNotMatch(rem2, /\[Nama Obat\]/);
    assert.match(rem2, /mengetik: \*SUDAH\*/);
  });

  it('pesan konfirmasi kepatuhan mencatat apresiasi', () => {
    const confirmMsg = getAdherenceConfirmedMessage('Sukanti');
    assert.match(confirmMsg, /Kepatuhan Bapak\/Ibu hari ini sudah kami catat/);
    assert.match(confirmMsg, /Pertahankan ya!/);
  });
});
