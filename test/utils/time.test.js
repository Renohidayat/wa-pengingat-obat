import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getGreeting,
  formatDateWib,
  formatTimeWib,
  formatDateTimeWib,
  getWibParts,
  timeStringToMinutes,
  calculateMinuteDiff
} from '../../src/utils/time.js';

describe('Time Utilities (Asia/Jakarta WIB)', () => {
  it('menghitung salam dinamis dengan benar sesuai jam WIB', () => {
    // 00:00 UTC = 07:00 WIB (Pagi)
    assert.equal(getGreeting(new Date('2026-10-15T00:00:00Z')), 'Pagi');
    // 03:59 UTC = 10:59 WIB (Pagi)
    assert.equal(getGreeting(new Date('2026-10-15T03:59:00Z')), 'Pagi');

    // 04:00 UTC = 11:00 WIB (Siang)
    assert.equal(getGreeting(new Date('2026-10-15T04:00:00Z')), 'Siang');
    // 07:30 UTC = 14:30 WIB (Siang)
    assert.equal(getGreeting(new Date('2026-10-15T07:30:00Z')), 'Siang');

    // 08:00 UTC = 15:00 WIB (Sore)
    assert.equal(getGreeting(new Date('2026-10-15T08:00:00Z')), 'Sore');
    // 10:59 UTC = 17:59 WIB (Sore)
    assert.equal(getGreeting(new Date('2026-10-15T10:59:00Z')), 'Sore');

    // 11:00 UTC = 18:00 WIB (Malam)
    assert.equal(getGreeting(new Date('2026-10-15T11:00:00Z')), 'Malam');
    // 16:00 UTC = 23:00 WIB (Malam)
    assert.equal(getGreeting(new Date('2026-10-15T16:00:00Z')), 'Malam');
    // 22:00 UTC = 05:00 WIB hari berikutnya (Pagi)
    assert.equal(getGreeting(new Date('2026-10-15T22:00:00Z')), 'Pagi');
  });

  it('memformat tanggal bisnis dalam format YYYY-MM-DD WIB', () => {
    // 2026-10-15 18:00 UTC = 2026-10-16 01:00 WIB
    const dateUtc = new Date('2026-10-15T18:00:00Z');
    assert.equal(formatDateWib(dateUtc), '2026-10-16');
  });

  it('memformat jam dalam format HH:mm WIB', () => {
    const dateUtc = new Date('2026-10-15T00:30:00Z'); // 07:30 WIB
    assert.equal(formatTimeWib(dateUtc), '07:30');
  });

  it('memformat tanggal dan jam dalam format YYYY-MM-DD HH:mm:ss WIB', () => {
    const dateUtc = new Date('2026-10-15T00:30:45Z'); // 07:30:45 WIB
    assert.equal(formatDateTimeWib(dateUtc), '2026-10-15 07:30:45');
    assert.equal(formatDateTimeWib(null), '-');
    assert.equal(formatDateTimeWib(undefined), '-');
  });

  it('menguraikan bagian waktu WIB secara akurat', () => {
    const dateUtc = new Date('2026-10-15T00:05:09Z'); // 07:05:09 WIB
    const parts = getWibParts(dateUtc);
    assert.equal(parts.year, 2026);
    assert.equal(parts.month, 10);
    assert.equal(parts.day, 15);
    assert.equal(parts.hour, 7);
    assert.equal(parts.minute, 5);
    assert.equal(parts.second, 9);
  });

  it('timeStringToMinutes mengonversi jam string ke total menit dengan tepat', () => {
    assert.equal(timeStringToMinutes('00:00'), 0);
    assert.equal(timeStringToMinutes('07:00'), 420);
    assert.equal(timeStringToMinutes('07:30'), 450);
    assert.equal(timeStringToMinutes('23:59'), 1439);
  });

  it('calculateMinuteDiff menghitung selisih waktu WIB terhadap jadwal secara akurat', () => {
    // 00:00 UTC = 07:00 WIB
    const now7Wib = new Date('2026-10-15T00:00:00Z');
    assert.equal(calculateMinuteDiff('07:00', now7Wib), 0);
    assert.equal(calculateMinuteDiff('06:30', now7Wib), 30); // 30 menit lewat jadwal
    assert.equal(calculateMinuteDiff('06:00', now7Wib), 60); // tepat 60 menit batas catch-up
    assert.equal(calculateMinuteDiff('05:59', now7Wib), 61); // lewat 61 menit (terlewat sistem)
    assert.equal(calculateMinuteDiff('08:00', now7Wib), -60); // 60 menit sebelum jadwal
  });

  it('menguji pergantian hari UTC dan WIB secara tepat di tengah malam', () => {
    // 16:59:59 UTC = 23:59:59 WIB pada 15 Okt 2026
    const lateUtc = new Date('2026-10-15T16:59:59Z');
    assert.equal(formatDateWib(lateUtc), '2026-10-15');
    assert.equal(formatTimeWib(lateUtc), '23:59');

    // 17:00:00 UTC = 00:00:00 WIB pada 16 Okt 2026
    const midnightUtc = new Date('2026-10-15T17:00:00Z');
    assert.equal(formatDateWib(midnightUtc), '2026-10-16');
    assert.equal(formatTimeWib(midnightUtc), '00:00');
  });
});


