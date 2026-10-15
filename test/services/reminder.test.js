import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateReminder1Eligibility,
  processReminder1ForPatient,
  checkAndSendDailyReminders,
  evaluateReminder2Eligibility,
  processReminder2ForLog,
  checkAndSendReminder2,
  evaluateFinalizationEligibility,
  finalizeDailyUnconfirmedLogs
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

  describe('Reminder 2 Service (FR-17: Setelah 30 Menit)', () => {
    describe('evaluateReminder2Eligibility (Fungsi Murni)', () => {
      const activePatient = { state: PATIENT_STATE.ACTIVE };
      const reminder1Time = new Date('2026-10-15T00:00:00Z'); // 07:00 WIB

      it('menolak jika status log bukan Menunggu (misal sudah Tepat Waktu)', () => {
        const res = evaluateReminder2Eligibility({
          log: { status: REMINDER_STATUS.TEPAT_WAKTU, reminder1At: reminder1Time },
          patient: activePatient,
          now: new Date('2026-10-15T00:35:00Z')
        });
        assert.equal(res.eligible, false);
        assert.equal(res.reason, 'STATUS_NOT_MENUNGGU');
      });

      it('menolak jika pengingat 2 sudah pernah dikirim (reminder2At ada / idempoten)', () => {
        const res = evaluateReminder2Eligibility({
          log: {
            status: REMINDER_STATUS.MENUNGGU,
            reminder1At: reminder1Time,
            reminder2At: new Date('2026-10-15T00:30:00Z')
          },
          patient: activePatient,
          now: new Date('2026-10-15T00:35:00Z')
        });
        assert.equal(res.eligible, false);
        assert.equal(res.reason, 'REMINDER_2_ALREADY_SENT');
      });

      it('menolak jika belum mencapai 30 menit dari pengingat 1', () => {
        // 25 menit setelah pengingat 1 (07:25 WIB)
        const now25m = new Date('2026-10-15T00:25:00Z');
        const res = evaluateReminder2Eligibility({
          log: { status: REMINDER_STATUS.MENUNGGU, reminder1At: reminder1Time },
          patient: activePatient,
          now: now25m
        });
        assert.equal(res.eligible, false);
        assert.equal(res.reason, 'TIME_NOT_ARRIVED');
        assert.equal(res.elapsedMinutes, 25);
      });

      it('menolak jika pasien tidak aktif', () => {
        const now30m = new Date('2026-10-15T00:30:00Z');
        const res = evaluateReminder2Eligibility({
          log: { status: REMINDER_STATUS.MENUNGGU, reminder1At: reminder1Time },
          patient: { state: PATIENT_STATE.STOPPED },
          now: now30m
        });
        assert.equal(res.eligible, false);
        assert.equal(res.reason, 'PATIENT_NOT_ACTIVE');
      });

      it('menyetujui pengiriman pengingat 2 jika sudah >= 30 menit dan masih Menunggu', () => {
        // Tepat 30 menit setelah pengingat 1 (07:30 WIB)
        const now30m = new Date('2026-10-15T00:30:00Z');
        const res = evaluateReminder2Eligibility({
          log: { status: REMINDER_STATUS.MENUNGGU, reminder1At: reminder1Time },
          patient: activePatient,
          now: now30m
        });
        assert.equal(res.eligible, true);
        assert.equal(res.action, 'SEND_REMINDER_2');
        assert.equal(res.elapsedMinutes, 30);
      });
    });

    describe('processReminder2ForLog & checkAndSendReminder2', () => {
      it('menyimpan reminder2At dan mengirim naskah pengingat 2 tanpa placeholder [Nama Obat]', async () => {
        const patient = {
          _id: 'p1',
          jid: '6281@s.whatsapp.net',
          nama: 'Sukanti',
          state: PATIENT_STATE.ACTIVE
        };

        const now = new Date('2026-10-15T00:35:00Z');
        let saveCalled = false;
        const mockLog = {
          _id: 'log-1',
          status: REMINDER_STATUS.MENUNGGU,
          reminder1At: new Date('2026-10-15T00:00:00Z'),
          reminder2At: null,
          save: async () => {
            saveCalled = true;
          }
        };

        const sent = [];
        const res = await processReminder2ForLog(mockLog, patient, now, {
          sendFn: async (jid, text) => sent.push({ jid, text })
        });

        assert.equal(res.handled, true);
        assert.equal(res.action, 'sent_reminder_2');
        assert.equal(saveCalled, true);
        assert.equal(mockLog.reminder2At, now);
        assert.equal(sent.length, 1);
        assert.match(sent[0].text, /Kami mengingatkan kembali/);
        assert.match(sent[0].text, /obat Bapak\/Ibu/);
        assert.doesNotMatch(sent[0].text, /\[Nama Obat\]/);
      });

      it('checkAndSendReminder2 memproses log yang menunggu dan mengisolasi error', async () => {
        const origFind = ReminderLog.find;

        const mockLogs = [
          {
            _id: 'log-1',
            status: REMINDER_STATUS.MENUNGGU,
            reminder1At: new Date('2026-10-15T00:00:00Z'),
            reminder2At: null,
            patientId: {
              _id: 'p1',
              jid: '6281@s.whatsapp.net',
              nama: 'Sukanti',
              state: PATIENT_STATE.ACTIVE
            },
            save: async () => {}
          },
          {
            _id: 'log-2',
            status: REMINDER_STATUS.MENUNGGU,
            reminder1At: new Date('2026-10-15T00:00:00Z'),
            reminder2At: null,
            patientId: {
              _id: 'p2',
              jid: '6282@s.whatsapp.net',
              nama: 'Budi Gagal',
              state: PATIENT_STATE.ACTIVE
            },
            save: async () => {
              throw new Error('Save error');
            }
          }
        ];

        ReminderLog.find = () => ({
          populate: async () => mockLogs
        });

        try {
          const now = new Date('2026-10-15T00:35:00Z');
          const sent = [];
          const results = await checkAndSendReminder2(now, {
            sendFn: async (jid, text) => sent.push({ jid, text })
          });

          assert.equal(results.length, 2);
          assert.equal(results[0].success, true);
          assert.equal(results[0].action, 'sent_reminder_2');
          assert.equal(results[1].success, false);
          assert.match(results[1].error, /Save error/);
          assert.equal(sent.length, 1);
        } finally {
          ReminderLog.find = origFind;
        }
      });
    });
  });

  describe('Daily Finalization (FR-18: 23:59 WIB Tidak Konfirmasi)', () => {
    describe('evaluateFinalizationEligibility (Fungsi Murni)', () => {
      it('menolak jika log null', () => {
        const res = evaluateFinalizationEligibility({ log: null });
        assert.equal(res.eligible, false);
        assert.equal(res.reason, 'NO_LOG');
      });

      it('menolak jika status log bukan Menunggu (misal Tepat Waktu atau Terlambat)', () => {
        const res1 = evaluateFinalizationEligibility({
          log: { status: REMINDER_STATUS.TEPAT_WAKTU, tanggal: '2026-10-15' },
          now: new Date('2026-10-15T16:59:00Z') // 23:59 WIB
        });
        assert.equal(res1.eligible, false);
        assert.equal(res1.reason, 'STATUS_NOT_MENUNGGU');

        const res2 = evaluateFinalizationEligibility({
          log: { status: REMINDER_STATUS.TIDAK_KONFIRMASI, tanggal: '2026-10-15' },
          now: new Date('2026-10-15T16:59:00Z')
        });
        assert.equal(res2.eligible, false);
        assert.equal(res2.reason, 'STATUS_NOT_MENUNGGU');
      });

      it('menolak jika log hari ini tapi waktu belum mencapai 23:59 WIB', () => {
        // 23:58 WIB (16:58 UTC)
        const now2358 = new Date('2026-10-15T16:58:00Z');
        const res = evaluateFinalizationEligibility({
          log: { status: REMINDER_STATUS.MENUNGGU, tanggal: '2026-10-15' },
          now: now2358
        });
        assert.equal(res.eligible, false);
        assert.equal(res.reason, 'TIME_NOT_ARRIVED');
        assert.equal(res.currentTime, '23:58');
      });

      it('menyetujui jika log hari ini dan waktu tepat 23:59 WIB', () => {
        // 23:59 WIB (16:59 UTC)
        const now2359 = new Date('2026-10-15T16:59:00Z');
        const res = evaluateFinalizationEligibility({
          log: { status: REMINDER_STATUS.MENUNGGU, tanggal: '2026-10-15' },
          now: now2359
        });
        assert.equal(res.eligible, true);
        assert.equal(res.action, 'FINALIZE_UNCONFIRMED');
        assert.equal(res.reason, 'END_OF_DAY_REACHED');
      });

      it('menyetujui jika opsi force aktif meskipun belum 23:59 WIB', () => {
        // 14:00 WIB (07:00 UTC)
        const now1400 = new Date('2026-10-15T07:00:00Z');
        const res = evaluateFinalizationEligibility({
          log: { status: REMINDER_STATUS.MENUNGGU, tanggal: '2026-10-15' },
          now: now1400,
          options: { force: true }
        });
        assert.equal(res.eligible, true);
        assert.equal(res.action, 'FINALIZE_UNCONFIRMED');
      });

      it('menyetujui jika log berasal dari hari-hari sebelumnya (catch-up saat server restart)', () => {
        // Hari ini: 16 Okt 2026 08:00 WIB, Log: 15 Okt 2026
        const nowNextDay = new Date('2026-10-16T01:00:00Z');
        const res = evaluateFinalizationEligibility({
          log: { status: REMINDER_STATUS.MENUNGGU, tanggal: '2026-10-15' },
          now: nowNextDay
        });
        assert.equal(res.eligible, true);
        assert.equal(res.action, 'FINALIZE_UNCONFIRMED');
        assert.equal(res.reason, 'PAST_DAY_UNCONFIRMED');
      });
    });

    describe('finalizeDailyUnconfirmedLogs (Database & Idempotensi)', () => {
      it('berhasil memfinalisasi log Menunggu menjadi Tidak Konfirmasi pada 23:59 WIB', async () => {
        const mockLog1 = {
          _id: 'log-waiting-1',
          patientId: 'p1',
          tanggal: '2026-10-15',
          status: REMINDER_STATUS.MENUNGGU,
          save: async function () {
            this.saved = true;
          }
        };
        const mockLog2 = {
          _id: 'log-waiting-2',
          patientId: 'p2',
          tanggal: '2026-10-15',
          status: REMINDER_STATUS.MENUNGGU,
          save: async function () {
            this.saved = true;
          }
        };

        const origFind = ReminderLog.find;
        ReminderLog.find = async (query) => {
          assert.equal(query.status, REMINDER_STATUS.MENUNGGU);
          return [mockLog1, mockLog2];
        };

        try {
          // 23:59 WIB (16:59 UTC)
          const now = new Date('2026-10-15T16:59:00Z');
          const result = await finalizeDailyUnconfirmedLogs(now);

          assert.equal(result.targetDate, '2026-10-15');
          assert.equal(result.modifiedCount, 2);
          assert.equal(mockLog1.status, REMINDER_STATUS.TIDAK_KONFIRMASI);
          assert.equal(mockLog2.status, REMINDER_STATUS.TIDAK_KONFIRMASI);
          assert.equal(mockLog1.saved, true);
          assert.equal(mockLog2.saved, true);
        } finally {
          ReminderLog.find = origFind;
        }
      });

      it('idempoten dan aman dijalankan ulang (tidak mengubah yang sudah Tidak Konfirmasi)', async () => {
        const origFind = ReminderLog.find;
        // Pada pemanggilan kedua, tidak ada lagi log Menunggu
        ReminderLog.find = async () => [];

        try {
          const now = new Date('2026-10-15T16:59:30Z');
          const result = await finalizeDailyUnconfirmedLogs(now);

          assert.equal(result.targetDate, '2026-10-15');
          assert.equal(result.modifiedCount, 0);
          assert.deepEqual(result.logIds, []);
        } finally {
          ReminderLog.find = origFind;
        }
      });

      it('mengisolasi error jika salah satu dokumen log gagal disimpan', async () => {
        const mockLogSuccess = {
          _id: 'log-ok',
          patientId: 'p1',
          tanggal: '2026-10-15',
          status: REMINDER_STATUS.MENUNGGU,
          save: async function () {
            this.saved = true;
          }
        };
        const mockLogFail = {
          _id: 'log-fail',
          patientId: 'p2',
          tanggal: '2026-10-15',
          status: REMINDER_STATUS.MENUNGGU,
          save: async () => {
            throw new Error('Database disk error');
          }
        };

        const origFind = ReminderLog.find;
        ReminderLog.find = async () => [mockLogFail, mockLogSuccess];

        try {
          const now = new Date('2026-10-15T16:59:00Z');
          const result = await finalizeDailyUnconfirmedLogs(now);

          // log-ok berhasil diproses meski log-fail error
          assert.equal(result.modifiedCount, 1);
          assert.equal(mockLogSuccess.status, REMINDER_STATUS.TIDAK_KONFIRMASI);
          assert.equal(mockLogSuccess.saved, true);
        } finally {
          ReminderLog.find = origFind;
        }
      });

      it('dapat menerima opsi targetDate spesifik', async () => {
        let queriedTanggal = null;
        const origFind = ReminderLog.find;
        ReminderLog.find = async (query) => {
          queriedTanggal = query.tanggal;
          return [];
        };

        try {
          const result = await finalizeDailyUnconfirmedLogs(new Date(), {
            date: '2026-10-10'
          });
          assert.equal(queriedTanggal, '2026-10-10');
          assert.equal(result.targetDate, '2026-10-10');
        } finally {
          ReminderLog.find = origFind;
        }
      });
    });
  });
});


