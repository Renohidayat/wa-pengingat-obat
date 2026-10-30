/**
 * UAT Test Suite - User Acceptance Testing (PRD §13 & Issue #16)
 * Menguji skenario end-to-end dengan 3 nomor uji pasien dan 1 nomor admin.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleIncomingMessage, shouldIgnoreMessage } from '../src/bot/handlers.js';
import { handleRegistrationMessage } from '../src/services/registration.js';
import {
  evaluateReminder1Eligibility,
  evaluateReminder2Eligibility,
  evaluateFinalizationEligibility
} from '../src/services/reminder.js';
import { handleAdherenceConfirmation } from '../src/services/adherence.js';
import { handleAdminCommand } from '../src/services/admin.js';
import { createExportWorkbook } from '../src/services/export.js';
import { Patient, ReminderLog } from '../src/db/models.js';
import { PATIENT_STATE, REMINDER_STATUS } from '../src/utils/constants.js';

describe('UAT - User Acceptance Testing (PRD §13 & Issue #16)', () => {
  // 3 Nomor Uji Pasien & 1 Nomor Admin
  const TEST_PATIENTS = {
    P1: {
      jid: '628111111111@s.whatsapp.net',
      nama: 'Sukanti UAT',
      noRM: 'RM-UAT-001',
      jamMinum: '07:00'
    },
    P2: {
      jid: '628222222222@s.whatsapp.net',
      nama: 'Budi Santoso UAT',
      noRM: 'RM-UAT-002',
      jamMinum: '07:00'
    },
    P3: {
      jid: '628333333333@s.whatsapp.net',
      nama: 'Siti Aminah UAT',
      noRM: 'RM-UAT-003',
      jamMinum: '07:00'
    }
  };

  const TEST_ADMIN = {
    jid: '628999999999@s.whatsapp.net',
    number: '628999999999'
  };

  /**
   * PRD §13 Poin 1:
   * Pasien baru: DAFTAR -> data valid -> "Registrasi Berhasil" tanpa kata "edukasi".
   */
  describe('Poin 1: Registrasi Pasien Baru', () => {
    it('alur registrasi lengkap berhasil dan pesan sukses bebas dari kata edukasi', async () => {
      let patientDoc = null;
      const origFindOne = Patient.findOne;
      const origSave = Patient.prototype.save;

      Patient.findOne = async (query) => {
        if (!patientDoc) return null;
        if (query.jid && patientDoc.jid === query.jid) return patientDoc;
        if (query.noRM && patientDoc.noRM === query.noRM) return patientDoc;
        return null;
      };

      Patient.prototype.save = async function () {
        patientDoc = this;
        return this;
      };

      const outMessages = [];
      const sendFn = async (to, text) => {
        outMessages.push({ to, text });
      };

      try {
        // 1. Kirim DAFTAR
        const resDaftar = await handleRegistrationMessage(TEST_PATIENTS.P1.jid, 'DAFTAR', { sendFn });

        assert.equal(resDaftar.handled, true);
        assert.equal(resDaftar.action, 'awaiting_data_requested');
        assert.equal(patientDoc.state, PATIENT_STATE.AWAITING_DATA);
        assert.equal(outMessages.length, 1);
        assert.match(outMessages[0].text, /Nama Lengkap/);

        // 2. Kirim data yang valid
        const regInput = `${TEST_PATIENTS.P1.nama} / ${TEST_PATIENTS.P1.noRM} / ${TEST_PATIENTS.P1.jamMinum}`;
        const resData = await handleRegistrationMessage(TEST_PATIENTS.P1.jid, regInput, { sendFn });

        assert.equal(resData.handled, true);
        assert.equal(resData.action, 'registration_success');
        assert.equal(patientDoc.state, PATIENT_STATE.ACTIVE);
        assert.equal(outMessages.length, 2);

        const successMsg = outMessages[1].text;
        assert.match(successMsg, /Registrasi Berhasil/);
        assert.match(successMsg, /Hormat Kami,\s*Dea Farida\s*PUSKESMAS Sukarasa/);
        // Memastikan TIDAK ADA kata edukasi, modul, atau silabus
        assert.doesNotMatch(successMsg, /edukasi/i);
        assert.doesNotMatch(successMsg, /modul/i);
        assert.doesNotMatch(successMsg, /silabus/i);
      } finally {
        Patient.findOne = origFindOne;
        Patient.prototype.save = origSave;
      }
    });
  });

  /**
   * PRD §13 Poin 2:
   * Format salah (Sukanti 123456, jam 25.00) -> balasan contoh format, state tidak berubah.
   */
  describe('Poin 2: Penanganan Format Registrasi Salah', () => {
    it('format salah memberikan contoh format dan state tetap awaiting_data', async () => {
      const mockPatient = {
        _id: 'mock-p2-id',
        jid: TEST_PATIENTS.P2.jid,
        state: PATIENT_STATE.AWAITING_DATA,
        save: async () => {}
      };

      const origFindOne = Patient.findOne;
      Patient.findOne = async () => mockPatient;

      const outMessages = [];
      const sendFn = async (to, text) => {
        outMessages.push({ to, text });
      };

      try {
        // Kasus A: Format tanpa pemisah garing /
        const resA = await handleRegistrationMessage(TEST_PATIENTS.P2.jid, 'Sukanti 123456', { sendFn });

        assert.equal(resA.handled, true);
        assert.equal(resA.action, 'invalid_format');
        assert.equal(mockPatient.state, PATIENT_STATE.AWAITING_DATA);
        assert.match(outMessages[0].text, /Format yang Bapak\/Ibu kirimkan belum sesuai/);
        assert.match(outMessages[0].text, /Sukanti \/ 123456 \/ 07.00/);

        // Kasus B: Jam tidak valid (25.00)
        const resB = await handleRegistrationMessage(TEST_PATIENTS.P2.jid, 'Sukanti / 123456 / 25.00', { sendFn });

        assert.equal(resB.handled, true);
        assert.equal(resB.action, 'invalid_format');
        assert.equal(mockPatient.state, PATIENT_STATE.AWAITING_DATA);
        assert.match(outMessages[1].text, /Format yang Bapak\/Ibu kirimkan belum sesuai/);
      } finally {
        Patient.findOne = origFindOne;
      }
    });
  });

  /**
   * PRD §13 Poin 3:
   * Pengingat tiba ±1 menit dari jam jadwal; tidak ada pada hari registrasi.
   */
  describe('Poin 3: Jadwal Pengingat & Hari Registrasi', () => {
    it('menolak pengingat pada hari yang sama dengan pendaftaran', () => {
      const patient = {
        _id: 'p1',
        nama: TEST_PATIENTS.P1.nama,
        jamMinum: ['07:00'],
        state: PATIENT_STATE.ACTIVE,
        registeredAt: new Date('2026-10-16T08:00:00+07:00') // Daftar hari ini
      };

      // Waktu sekarang 07:00 WIB di hari yang sama
      const nowSameDay = new Date('2026-10-16T07:00:00+07:00');
      const evalSameDay = evaluateReminder1Eligibility({ patient, jadwal: '07:00', now: nowSameDay });

      assert.equal(evalSameDay.eligible, false);
      assert.equal(evalSameDay.reason, 'SAME_DAY_REGISTRATION');
    });

    it('menyetujui pengingat pada hari berikutnya tepat pada jam jadwal (toleransi <= 1 menit)', () => {
      const patient = {
        _id: 'p1',
        nama: TEST_PATIENTS.P1.nama,
        jamMinum: ['07:00'],
        state: PATIENT_STATE.ACTIVE,
        registeredAt: new Date('2026-10-15T08:00:00+07:00') // Terdaftar kemarin
      };

      // Tepat 07:00 WIB
      const nowExact = new Date('2026-10-16T07:00:00+07:00');
      const evalExact = evaluateReminder1Eligibility({ patient, jadwal: '07:00', now: nowExact });
      assert.equal(evalExact.eligible, true);
      assert.equal(evalExact.diffMinutes, 0);

      // Selisih 1 menit (07:01 WIB)
      const now1Min = new Date('2026-10-16T07:01:00+07:00');
      const eval1Min = evaluateReminder1Eligibility({ patient, jadwal: '07:00', now: now1Min });
      assert.equal(eval1Min.eligible, true);
      assert.equal(eval1Min.diffMinutes, 1);
    });
  });

  /**
   * PRD §13 Poin 4:
   * SUDAH sebelum 30 menit -> Tepat Waktu;
   * setelah pengingat 2 -> Terlambat;
   * tidak ada -> Tidak Konfirmasi pukul 23:59.
   */
  describe('Poin 4: Konfirmasi Adherence, Reminder 2, & Finalisasi 23:59', () => {
    it('konfirmasi SUDAH sebelum 30 menit menghasilkan status Tepat Waktu', async () => {
      const reminder1Time = new Date('2026-10-16T07:00:00+07:00');
      const confirmTime = new Date('2026-10-16T07:15:00+07:00'); // 15 menit kemudian

      const patient = {
        _id: 'p1',
        nama: TEST_PATIENTS.P1.nama,
        jid: TEST_PATIENTS.P1.jid,
        state: PATIENT_STATE.ACTIVE
      };
      const log = {
        _id: 'log1',
        patientId: 'p1',
        tanggal: '2026-10-16',
        status: REMINDER_STATUS.MENUNGGU,
        reminder1At: reminder1Time,
        reminder2At: null,
        save: async () => {}
      };

      const origPatientFindOne = Patient.findOne;
      const origLogFind = ReminderLog.find;

      Patient.findOne = async () => patient;
      ReminderLog.find = async () => [log];

      const outMessages = [];
      const sendFn = async (to, text) => outMessages.push({ to, text });

      try {
        const res = await handleAdherenceConfirmation(patient.jid, 'SUDAH', {
          now: confirmTime,
          sendFn
        });

        assert.equal(res.handled, true);
        assert.equal(res.status, REMINDER_STATUS.TEPAT_WAKTU);
        assert.equal(log.status, REMINDER_STATUS.TEPAT_WAKTU);
        assert.match(outMessages[0].text, /Kepatuhan Bapak\/Ibu hari ini sudah kami catat/);
      } finally {
        Patient.findOne = origPatientFindOne;
        ReminderLog.find = origLogFind;
      }
    });

    it('reminder 2 aktif setelah 30 menit, dan konfirmasi sesudahnya berstatus Terlambat', async () => {
      const reminder1Time = new Date('2026-10-16T07:00:00+07:00');
      const reminder2Time = new Date('2026-10-16T07:30:00+07:00'); // 30 menit kemudian

      const patient = { _id: 'p2', nama: TEST_PATIENTS.P2.nama, jid: TEST_PATIENTS.P2.jid, state: PATIENT_STATE.ACTIVE };
      const log = {
        _id: 'log2',
        patientId: 'p2',
        tanggal: '2026-10-16',
        status: REMINDER_STATUS.MENUNGGU,
        reminder1At: reminder1Time,
        reminder2At: null,
        save: async () => {}
      };

      // 1. Evaluasi Reminder 2
      const evalR2 = evaluateReminder2Eligibility({ log, patient, now: reminder2Time });
      assert.equal(evalR2.eligible, true);
      log.reminder2At = reminder2Time;

      // 2. Pasien konfirmasi setelah Reminder 2 (misal 07:45 WIB)
      const confirmTime = new Date('2026-10-16T07:45:00+07:00');
      const outMessages = [];
      const sendFn = async (to, text) => outMessages.push({ to, text });

      const origPatientFindOne = Patient.findOne;
      const origLogFind = ReminderLog.find;

      Patient.findOne = async () => patient;
      ReminderLog.find = async () => [log];

      try {
        const res = await handleAdherenceConfirmation(patient.jid, 'SUDAH', {
          now: confirmTime,
          sendFn
        });

        assert.equal(res.handled, true);
        assert.equal(res.status, REMINDER_STATUS.TERLAMBAT);
        assert.equal(log.status, REMINDER_STATUS.TERLAMBAT);
      } finally {
        Patient.findOne = origPatientFindOne;
        ReminderLog.find = origLogFind;
      }
    });

    it('jika tidak ada respons, log Menunggu difinalisasi menjadi Tidak Konfirmasi pada 23:59 WIB', () => {
      const log = {
        _id: 'log3',
        tanggal: '2026-10-16',
        status: REMINDER_STATUS.MENUNGGU
      };

      // Sebelum 23:59 (misal 23:50 WIB)
      const nowBefore = new Date('2026-10-16T23:50:00+07:00');
      const evalBefore = evaluateFinalizationEligibility({ log, now: nowBefore });
      assert.equal(evalBefore.eligible, false);

      // Tepat 23:59 WIB
      const now2359 = new Date('2026-10-16T23:59:00+07:00');
      const eval2359 = evaluateFinalizationEligibility({ log, now: now2359 });
      assert.equal(eval2359.eligible, true);
      assert.equal(eval2359.reason, 'END_OF_DAY_REACHED');
    });
  });

  /**
   * PRD §13 Poin 5:
   * Server di-restart di tengah hari: tidak ada pengingat ganda;
   * pengingat yang terlewat <= 60 menit tetap terkirim;
   * lebih dari 60 menit dicatat Terlewat Sistem.
   */
  describe('Poin 5: Uji Restart Server di Tengah Hari & Catch-up', () => {
    it('tidak ada pengingat ganda jika server di-restart (idempoten)', () => {
      const patient = {
        _id: 'p1',
        nama: TEST_PATIENTS.P1.nama,
        jamMinum: ['07:00'],
        state: PATIENT_STATE.ACTIVE,
        registeredAt: new Date('2026-10-15T08:00:00+07:00')
      };

      const existingLog = {
        _id: 'log-exist',
        status: REMINDER_STATUS.MENUNGGU,
        reminder1At: new Date('2026-10-16T07:00:00+07:00')
      };

      // Server restart jam 07:10 WIB dan scheduler berjalan kembali
      const nowAfterRestart = new Date('2026-10-16T07:10:00+07:00');
      const evalRestart = evaluateReminder1Eligibility({
        patient,
        jadwal: '07:00',
        now: nowAfterRestart,
        todayLog: existingLog
      });

      assert.equal(evalRestart.eligible, false);
      assert.equal(evalRestart.reason, 'ALREADY_LOGGED');
    });

    it('pengingat yang terlewat <= 60 menit karena restart tetap terkirim (catch-up)', () => {
      const patient = {
        _id: 'p2',
        nama: TEST_PATIENTS.P2.nama,
        jamMinum: ['07:00'],
        state: PATIENT_STATE.ACTIVE,
        registeredAt: new Date('2026-10-15T08:00:00+07:00')
      };

      // Server mati dari 06:55 dan baru hidup kembali 07:25 WIB (terlewat 25 menit)
      const nowCatchup = new Date('2026-10-16T07:25:00+07:00');
      const evalCatchup = evaluateReminder1Eligibility({
        patient,
        jadwal: '07:00',
        now: nowCatchup,
        todayLog: null
      });

      assert.equal(evalCatchup.eligible, true);
      assert.equal(evalCatchup.diffMinutes, 25);
      assert.equal(evalCatchup.action, 'SEND_REMINDER_1');
    });

    it('pengingat yang terlewat > 60 menit dicatat Terlewat Sistem dan TIDAK dikirim', () => {
      const patient = {
        _id: 'p3',
        nama: TEST_PATIENTS.P3.nama,
        jamMinum: ['07:00'],
        state: PATIENT_STATE.ACTIVE,
        registeredAt: new Date('2026-10-15T08:00:00+07:00')
      };

      // Server mati dan baru hidup 08:30 WIB (terlewat 90 menit)
      const nowTooLate = new Date('2026-10-16T08:30:00+07:00');
      const evalTooLate = evaluateReminder1Eligibility({
        patient,
        jadwal: '07:00',
        now: nowTooLate,
        todayLog: null
      });

      assert.equal(evalTooLate.eligible, true);
      assert.equal(evalTooLate.action, 'RECORD_SYSTEM_MISSED');
    });
  });

  /**
   * PRD §13 Poin 6:
   * npm run export menghasilkan Excel yang cocok dengan isi database.
   */
  describe('Poin 6: Ekspor Log Kepatuhan ke Excel', () => {
    it('menghasilkan file Excel dengan sheet Log Kepatuhan dan Rekap Pasien secara akurat', async () => {
      const mockPatients = [
        {
          _id: 'p1',
          nama: TEST_PATIENTS.P1.nama,
          noRM: TEST_PATIENTS.P1.noRM,
          jamMinum: TEST_PATIENTS.P1.jamMinum,
          jid: TEST_PATIENTS.P1.jid,
          state: PATIENT_STATE.ACTIVE,
          registeredAt: new Date('2026-10-15T08:00:00+07:00')
        },
        {
          _id: 'p2',
          nama: TEST_PATIENTS.P2.nama,
          noRM: TEST_PATIENTS.P2.noRM,
          jamMinum: TEST_PATIENTS.P2.jamMinum,
          jid: TEST_PATIENTS.P2.jid,
          state: PATIENT_STATE.ACTIVE,
          registeredAt: new Date('2026-10-15T08:00:00+07:00')
        }
      ];

      const mockLogs = [
        {
          _id: 'log1',
          patientId: mockPatients[0],
          tanggal: '2026-10-16',
          jadwal: '07:00',
          status: REMINDER_STATUS.TEPAT_WAKTU,
          reminder1At: new Date('2026-10-16T07:00:00+07:00'),
          reminder2At: null,
          confirmedAt: new Date('2026-10-16T07:15:00+07:00')
        },
        {
          _id: 'log2',
          patientId: mockPatients[1],
          tanggal: '2026-10-16',
          jadwal: '07:00',
          status: REMINDER_STATUS.TERLAMBAT,
          reminder1At: new Date('2026-10-16T07:00:00+07:00'),
          reminder2At: new Date('2026-10-16T07:30:00+07:00'),
          confirmedAt: new Date('2026-10-16T07:45:00+07:00')
        }
      ];

      const workbook = createExportWorkbook({
        patients: mockPatients,
        reminderLogs: mockLogs
      });

      const sheetLog = workbook.getWorksheet('Log Kepatuhan');
      const sheetRekap = workbook.getWorksheet('Rekap Pasien');

      assert.ok(sheetLog, 'Sheet Log Kepatuhan harus ada');
      assert.ok(sheetRekap, 'Sheet Rekap Pasien harus ada');

      // Verifikasi baris sheet Log Kepatuhan
      assert.equal(sheetLog.rowCount, 3); // 1 Header + 2 Baris Log
      const row1 = sheetLog.getRow(2);
      assert.equal(row1.getCell(4).value, TEST_PATIENTS.P1.nama);
      assert.equal(row1.getCell(9).value, REMINDER_STATUS.TEPAT_WAKTU);

      const row2 = sheetLog.getRow(3);
      assert.equal(row2.getCell(4).value, TEST_PATIENTS.P2.nama);
      assert.equal(row2.getCell(9).value, REMINDER_STATUS.TERLAMBAT);
    });
  });

  /**
   * PRD §13 Poin 7:
   * Pesan grup dan nomor non-admin yang mengirim !rekap diabaikan/ditolak.
   */
  describe('Poin 7: Filter Pesan Grup & Otorisasi Admin', () => {
    it('mengabaikan pesan dari grup WhatsApp (@g.us)', () => {
      const groupMsg = {
        key: {
          fromMe: false,
          remoteJid: '120363023456789@g.us'
        },
        message: { conversation: '!rekap' }
      };

      assert.equal(shouldIgnoreMessage(groupMsg), true);
    });

    it('menolak perintah !rekap dari nomor non-admin (pasien)', async () => {
      const outMessages = [];
      const sendFn = async (to, text) => outMessages.push({ to, text });

      const res = await handleAdminCommand(TEST_PATIENTS.P1.jid, '!rekap', {
        adminNumbers: [TEST_ADMIN.number],
        sendFn
      });

      assert.equal(res.handled, true);
      assert.equal(res.action, 'unauthorized');
      assert.match(outMessages[0].text, /hanya dapat diakses oleh peneliti\/admin/i);
    });

    it('menerima dan memproses perintah !rekap dari nomor admin yang sah', async () => {
      const outMessages = [];
      const sendFn = async (to, text) => outMessages.push({ to, text });

      const mockLogs = [
        { status: REMINDER_STATUS.TEPAT_WAKTU },
        { status: REMINDER_STATUS.TERLAMBAT }
      ];

      const origLogFind = ReminderLog.find;
      ReminderLog.find = async () => mockLogs;

      try {
        const res = await handleAdminCommand(TEST_ADMIN.jid, '!rekap', {
          adminNumbers: [TEST_ADMIN.number],
          sendFn
        });

        assert.equal(res.handled, true);
        assert.equal(res.action, 'rekap');
        assert.match(outMessages[0].text, /Rekap Kepatuhan Hari Ini/i);
        assert.match(outMessages[0].text, /Tepat Waktu: 1/);
        assert.match(outMessages[0].text, /Terlambat: 1/);
      } finally {
        ReminderLog.find = origLogFind;
      }
    });
  });
});
