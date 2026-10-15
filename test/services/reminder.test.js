import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateReminder1Eligibility,
  processReminder1ForPatient,
  checkAndSendDailyReminders
} from '../../src/services/reminder.js';
import { Patient, ReminderLog } from '../../src/db/models.js';
import { PATIENT_STATE, REMINDER_STATUS } from '../../src/utils/constants.js';

describe('Daily Reminder Service (FR-10 s.d. FR-13)', () => {
  describe('evaluateReminder1Eligibility (Fungsi Murni)', () => {
    const basePatient = {
      _id: 'mock-id-1',
      nama: 'Sukanti',
      jamMinum: '07:00',
      state: PATIENT_STATE.ACTIVE,
      registeredAt: new Date('2026-10-14T01:00:00Z') // Terdaftar kemarin
    };

    it('menolak pasien yang statusnya bukan ACTIVE', () => {
      const res = evaluateReminder1Eligibility({
        patient: { ...basePatient, state: PATIENT_STATE.STOPPED },
        now: new Date('2026-10-15T00:00:00Z') // 07:00 WIB
      });
      assert.equal(res.eligible, false);
      assert.equal(res.reason, 'NOT_ACTIVE');
    });

    it('menolak pengiriman pada hari yang sama dengan registrasi (FR-11)', () => {
      const registeredTodayPatient = {
        ...basePatient,
        registeredAt: new Date('2026-10-15T01:00:00Z') // Terdaftar hari ini (15 Okt)
      };

      const res = evaluateReminder1Eligibility({
        patient: registeredTodayPatient,
        now: new Date('2026-10-15T00:00:00Z') // 07:00 WIB (15 Okt)
      });

      assert.equal(res.eligible, false);
      assert.equal(res.reason, 'SAME_DAY_REGISTRATION');
    });

    it('menolak pengiriman jika log hari ini sudah ada (FR-12 idempoten)', () => {
      const todayLog = { status: REMINDER_STATUS.MENUNGGU };
      const res = evaluateReminder1Eligibility({
        patient: basePatient,
        now: new Date('2026-10-15T00:00:00Z'), // 07:00 WIB
        todayLog
      });

      assert.equal(res.eligible, false);
      assert.equal(res.reason, 'ALREADY_LOGGED');
    });

    it('menolak pengiriman jika waktu jadwal belum tiba', () => {
      // 06:45 WIB (15 menit sebelum 07:00)
      const nowBefore = new Date('2026-10-14T23:45:00Z');
      const res = evaluateReminder1Eligibility({
        patient: basePatient,
        now: nowBefore
      });

      assert.equal(res.eligible, false);
      assert.equal(res.reason, 'TIME_NOT_ARRIVED');
    });

    it('menyetujui pengiriman saat tepat jam jadwal (diff = 0 menit)', () => {
      // 07:00 WIB
      const nowExact = new Date('2026-10-15T00:00:00Z');
      const res = evaluateReminder1Eligibility({
        patient: basePatient,
        now: nowExact
      });

      assert.equal(res.eligible, true);
      assert.equal(res.action, 'SEND_REMINDER_1');
      assert.equal(res.diffMinutes, 0);
    });

    it('menyetujui pengiriman catch-up jika server mati dan terlewat <= 60 menit (FR-13)', () => {
      // 07:35 WIB (terlewat 35 menit)
      const nowCatchup = new Date('2026-10-15T00:35:00Z');
      const res = evaluateReminder1Eligibility({
        patient: basePatient,
        now: nowCatchup
      });

      assert.equal(res.eligible, true);
      assert.equal(res.action, 'SEND_REMINDER_1');
      assert.equal(res.diffMinutes, 35);
    });

    it('mencatat Terlewat Sistem jika terlewat > 60 menit dan TIDAK mengirim pesan (FR-13)', () => {
      // 08:30 WIB (terlewat 90 menit)
      const nowMissed = new Date('2026-10-15T01:30:00Z');
      const res = evaluateReminder1Eligibility({
        patient: basePatient,
        now: nowMissed
      });

      assert.equal(res.eligible, true);
      assert.equal(res.action, 'RECORD_SYSTEM_MISSED');
      assert.equal(res.diffMinutes, 90);
    });
  });

  describe('processReminder1ForPatient & Idempotensi', () => {
    let origFindOne;
    let origCreate;

    beforeEach(() => {
      origFindOne = ReminderLog.findOne;
      origCreate = ReminderLog.create;
    });

    afterEach(() => {
      ReminderLog.findOne = origFindOne;
      ReminderLog.create = origCreate;
    });

    it('membuat log Menunggu dan mengirim pesan saat jadwal tiba', async () => {
      const patient = {
        _id: 'mock-patient-id',
        jid: '62811111111@s.whatsapp.net',
        nama: 'Sukanti',
        jamMinum: '07:00',
        state: PATIENT_STATE.ACTIVE,
        registeredAt: new Date('2026-10-14T00:00:00Z')
      };

      const now = new Date('2026-10-15T00:00:00Z'); // 07:00 WIB
      const sentMessages = [];
      const mockSend = async (jid, text) => {
        sentMessages.push({ jid, text });
      };

      ReminderLog.findOne = async () => null;

      let createdPayload = null;
      ReminderLog.create = async (payload) => {
        createdPayload = payload;
        return { _id: 'mock-log-id', ...payload };
      };

      const res = await processReminder1ForPatient(patient, now, { sendFn: mockSend });

      assert.equal(res.handled, true);
      assert.equal(res.action, 'sent');
      assert.equal(createdPayload.status, REMINDER_STATUS.MENUNGGU);
      assert.equal(createdPayload.jadwal, '07:00');
      assert.equal(sentMessages.length, 1);
      assert.match(sentMessages[0].text, /Sudah waktunya untuk minum obat/);
    });

    it('mencatat status Terlewat Sistem dan TIDAK mengirim pesan saat terlewat > 60 menit', async () => {
      const patient = {
        _id: 'mock-patient-id',
        jid: '62811111111@s.whatsapp.net',
        nama: 'Sukanti',
        jamMinum: '07:00',
        state: PATIENT_STATE.ACTIVE,
        registeredAt: new Date('2026-10-14T00:00:00Z')
      };

      const now = new Date('2026-10-15T02:00:00Z'); // 09:00 WIB (terlewat 120 menit)
      const sentMessages = [];
      const mockSend = async (jid, text) => {
        sentMessages.push({ jid, text });
      };

      ReminderLog.findOne = async () => null;

      let createdPayload = null;
      ReminderLog.create = async (payload) => {
        createdPayload = payload;
        return { _id: 'mock-log-id', ...payload };
      };

      const res = await processReminder1ForPatient(patient, now, { sendFn: mockSend });

      assert.equal(res.handled, true);
      assert.equal(res.action, 'missed_system');
      assert.equal(createdPayload.status, REMINDER_STATUS.TERLEWAT_SISTEM);
      assert.equal(sentMessages.length, 0); // Tidak ada pesan yang dikirim
    });

    it('menangani bentrok duplicate key (code 11000) secara idempoten tanpa error', async () => {
      const patient = {
        _id: 'mock-patient-id',
        jid: '62811111111@s.whatsapp.net',
        nama: 'Sukanti',
        jamMinum: '07:00',
        state: PATIENT_STATE.ACTIVE,
        registeredAt: new Date('2026-10-14T00:00:00Z')
      };

      const now = new Date('2026-10-15T00:00:00Z'); // 07:00 WIB
      ReminderLog.findOne = async () => null;

      ReminderLog.create = async () => {
        const err = new Error('E11000 duplicate key error');
        err.code = 11000;
        throw err;
      };

      const res = await processReminder1ForPatient(patient, now, {
        sendFn: async () => {}
      });

      assert.equal(res.handled, false);
      assert.equal(res.reason, 'DUPLICATE_KEY_IDEMPOTENT');
    });
  });

  describe('checkAndSendDailyReminders Error Isolation', () => {
    let origFind;
    let origFindOne;

    beforeEach(() => {
      origFind = Patient.find;
      origFindOne = ReminderLog.findOne;
    });

    afterEach(() => {
      Patient.find = origFind;
      ReminderLog.findOne = origFindOne;
    });

    it('mengisolasi error per pasien sehingga kegagalan satu pasien tidak membatalkan yang lain', async () => {
      const patients = [
        {
          _id: 'p1',
          jid: '6281@s.whatsapp.net',
          nama: 'Pasien Normal 1',
          jamMinum: '07:00',
          state: PATIENT_STATE.ACTIVE,
          registeredAt: new Date('2026-10-14T00:00:00Z')
        },
        {
          _id: 'p2-error',
          jid: '6282@s.whatsapp.net',
          nama: 'Pasien Gagal',
          jamMinum: '07:00',
          state: PATIENT_STATE.ACTIVE,
          registeredAt: new Date('2026-10-14T00:00:00Z')
        },
        {
          _id: 'p3',
          jid: '6283@s.whatsapp.net',
          nama: 'Pasien Normal 2',
          jamMinum: '07:00',
          state: PATIENT_STATE.ACTIVE,
          registeredAt: new Date('2026-10-14T00:00:00Z')
        }
      ];

      Patient.find = async () => patients;
      ReminderLog.findOne = async () => null;

      const origCreate = ReminderLog.create;
      ReminderLog.create = async (payload) => {
        if (payload.patientId === 'p2-error') {
          throw new Error('Database timeout untuk pasien 2');
        }
        return { _id: 'log-' + payload.patientId, ...payload };
      };

      try {
        const now = new Date('2026-10-15T00:00:00Z');
        const results = await checkAndSendDailyReminders(now, {
          sendFn: async () => {}
        });

        assert.equal(results.length, 3);
        assert.equal(results[0].success, true);
        assert.equal(results[0].action, 'sent');
        assert.equal(results[1].success, false);
        assert.match(results[1].error, /Database timeout/);
        assert.equal(results[2].success, true);
        assert.equal(results[2].action, 'sent');
      } finally {
        ReminderLog.create = origCreate;
      }
    });
  });
});
