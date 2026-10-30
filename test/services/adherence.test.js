import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  determineAdherenceStatus,
  handleAdherenceConfirmation
} from '../../src/services/adherence.js';
import { Patient, ReminderLog } from '../../src/db/models.js';
import { PATIENT_STATE, REMINDER_STATUS } from '../../src/utils/constants.js';

describe('Adherence Confirmation & Status (FR-14 s.d. FR-16, FR-19)', () => {
  describe('determineAdherenceStatus (Fungsi Murni)', () => {
    it('mengembalikan status Tepat Waktu jika pengingat 2 belum dikirim (reminder2At null)', () => {
      const log = {
        status: REMINDER_STATUS.MENUNGGU,
        reminder2At: null
      };
      const res = determineAdherenceStatus(log);
      assert.equal(res.alreadyConfirmed, false);
      assert.equal(res.newStatus, REMINDER_STATUS.TEPAT_WAKTU);
    });

    it('mengembalikan status Terlambat jika pengingat 2 sudah dikirim (reminder2At ada)', () => {
      const log = {
        status: REMINDER_STATUS.MENUNGGU,
        reminder2At: new Date('2026-10-15T00:30:00Z')
      };
      const res = determineAdherenceStatus(log);
      assert.equal(res.alreadyConfirmed, false);
      assert.equal(res.newStatus, REMINDER_STATUS.TERLAMBAT);
    });

    it('mengindikasikan alreadyConfirmed jika log sudah berstatus Tepat Waktu atau Terlambat', () => {
      const res1 = determineAdherenceStatus({ status: REMINDER_STATUS.TEPAT_WAKTU });
      assert.equal(res1.alreadyConfirmed, true);
      assert.equal(res1.status, REMINDER_STATUS.TEPAT_WAKTU);

      const res2 = determineAdherenceStatus({ status: REMINDER_STATUS.TERLAMBAT });
      assert.equal(res2.alreadyConfirmed, true);
      assert.equal(res2.status, REMINDER_STATUS.TERLAMBAT);
    });
  });

  describe('handleAdherenceConfirmation', () => {
    let origFindPatient;
    let origFindLog;
    let origFindOneLog;

    beforeEach(() => {
      origFindPatient = Patient.findOne;
      origFindLog = ReminderLog.find;
      origFindOneLog = ReminderLog.findOne;
    });

    afterEach(() => {
      Patient.findOne = origFindPatient;
      ReminderLog.find = origFindLog;
      ReminderLog.findOne = origFindOneLog;
    });

    it('mengabaikan pesan yang bukan pemicu konfirmasi (handled: false)', async () => {
      const res = await handleAdherenceConfirmation('6281@s.whatsapp.net', 'BELUM');
      assert.equal(res.handled, false);
    });

    it('membalas pesan netral jika pasien tidak aktif atau belum terdaftar', async () => {
      Patient.findOne = async () => null;

      const sent = [];
      const res = await handleAdherenceConfirmation('6281@s.whatsapp.net', 'SUDAH', {
        sendFn: async (jid, text) => sent.push({ jid, text })
      });

      assert.equal(res.handled, true);
      assert.equal(res.action, 'no_active_patient');
      assert.equal(sent.length, 1);
      assert.match(sent[0].text, /tidak ada jadwal pengingat/);
    });

    it('membalas pesan netral jika tidak ada pengingat aktif pada hari ini (FR-19)', async () => {
      Patient.findOne = async () => ({
        _id: 'p1',
        nama: 'Sukanti',
        state: PATIENT_STATE.ACTIVE
      });
      ReminderLog.find = async () => []; // Tidak ada log Menunggu hari ini
      ReminderLog.findOne = async () => null; // Tidak ada log apapun hari ini

      const sent = [];
      const res = await handleAdherenceConfirmation('6281@s.whatsapp.net', 'SUDAH', {
        sendFn: async (jid, text) => sent.push({ jid, text })
      });

      assert.equal(res.handled, true);
      assert.equal(res.action, 'no_active_reminder');
      assert.equal(sent.length, 1);
      assert.match(sent[0].text, /tidak ada jadwal pengingat/);
    });

    it('mencatat konfirmasi sebelum pengingat 2 sebagai Tepat Waktu (FR-15)', async () => {
      const now = new Date('2026-10-15T00:15:00Z');
      Patient.findOne = async () => ({
        _id: 'p1',
        nama: 'Sukanti',
        state: PATIENT_STATE.ACTIVE
      });

      let saveCalled = false;
      const mockLog = {
        _id: 'log-1',
        jadwal: '07:00',
        status: REMINDER_STATUS.MENUNGGU,
        reminder2At: null,
        confirmedAt: null,
        save: async () => {
          saveCalled = true;
        }
      };
      ReminderLog.find = async () => [mockLog];

      const sent = [];
      const res = await handleAdherenceConfirmation('6281@s.whatsapp.net', 'SUDAH MINUM', {
        now,
        sendFn: async (jid, text) => sent.push({ jid, text })
      });

      assert.equal(res.handled, true);
      assert.equal(res.action, 'confirmed');
      assert.equal(res.status, REMINDER_STATUS.TEPAT_WAKTU);
      assert.equal(mockLog.status, REMINDER_STATUS.TEPAT_WAKTU);
      assert.equal(mockLog.confirmedAt, now);
      assert.equal(saveCalled, true);
      assert.equal(sent.length, 1);
      assert.match(sent[0].text, /Kepatuhan Bapak\/Ibu hari ini sudah kami catat/);
    });

    it('mencatat konfirmasi setelah pengingat 2 sebagai Terlambat (FR-15)', async () => {
      const now = new Date('2026-10-15T00:45:00Z');
      Patient.findOne = async () => ({
        _id: 'p1',
        nama: 'Sukanti',
        state: PATIENT_STATE.ACTIVE
      });

      let saveCalled = false;
      const mockLog = {
        _id: 'log-1',
        jadwal: '07:00',
        status: REMINDER_STATUS.MENUNGGU,
        reminder2At: new Date('2026-10-15T00:30:00Z'), // Pengingat 2 sudah dikirim
        confirmedAt: null,
        save: async () => {
          saveCalled = true;
        }
      };
      ReminderLog.find = async () => [mockLog];

      const sent = [];
      const res = await handleAdherenceConfirmation('6281@s.whatsapp.net', 'sdh', {
        now,
        sendFn: async (jid, text) => sent.push({ jid, text })
      });

      assert.equal(res.handled, true);
      assert.equal(res.action, 'confirmed');
      assert.equal(res.status, REMINDER_STATUS.TERLAMBAT);
      assert.equal(mockLog.status, REMINDER_STATUS.TERLAMBAT);
      assert.equal(mockLog.confirmedAt, now);
      assert.equal(saveCalled, true);
      assert.equal(sent.length, 1);
      assert.match(sent[0].text, /Kepatuhan Bapak\/Ibu hari ini sudah kami catat/);
    });

    it('konfirmasi ganda di hari yang sama TIDAK mengubah log (FR-16)', async () => {
      const originalConfirmedAt = new Date('2026-10-15T00:15:00Z');
      const secondConfirmationNow = new Date('2026-10-15T01:00:00Z');

      Patient.findOne = async () => ({
        _id: 'p1',
        nama: 'Sukanti',
        state: PATIENT_STATE.ACTIVE
      });

      // Tidak ada log yang Menunggu (sudah dikonfirmasi)
      ReminderLog.find = async () => [];
      // Tapi ada log dengan status TEPAT_WAKTU
      const mockLog = {
        _id: 'log-1',
        status: REMINDER_STATUS.TEPAT_WAKTU,
        confirmedAt: originalConfirmedAt
      };
      ReminderLog.findOne = async () => mockLog;

      const sent = [];
      const res = await handleAdherenceConfirmation('6281@s.whatsapp.net', 'UDAH', {
        now: secondConfirmationNow,
        sendFn: async (jid, text) => sent.push({ jid, text })
      });

      assert.equal(res.handled, true);
      assert.equal(res.action, 'already_confirmed');
      assert.equal(sent.length, 1);
      assert.match(sent[0].text, /sudah tercatat sebelumnya/);
    });

    it('membalas pesan netral jika log sudah difinalisasi Tidak Konfirmasi atau Terlewat Sistem', async () => {
      Patient.findOne = async () => ({
        _id: 'p1',
        nama: 'Sukanti',
        state: PATIENT_STATE.ACTIVE
      });

      // Tidak ada log Menunggu
      ReminderLog.find = async () => [];
      // Tidak ada log apapun hari ini
      ReminderLog.findOne = async () => null;

      const sent = [];
      const res = await handleAdherenceConfirmation('6281@s.whatsapp.net', 'SUDAH', {
        sendFn: async (jid, text) => sent.push({ jid, text })
      });

      assert.equal(res.handled, true);
      assert.equal(res.action, 'no_active_reminder');
      assert.equal(sent.length, 1);
      assert.match(sent[0].text, /tidak ada jadwal pengingat/);
    });

    it('determineAdherenceStatus menangani parameter null secara aman', () => {
      const res = determineAdherenceStatus(null);
      assert.equal(res.alreadyConfirmed, false);
      assert.equal(res.newStatus, null);
    });
  });
});

