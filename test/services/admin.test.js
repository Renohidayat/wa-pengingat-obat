import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePhoneNumber,
  isAdminNumber,
  parseAdminCommand,
  handleAdminCommand
} from '../../src/services/admin.js';
import { Patient, ReminderLog } from '../../src/db/models.js';
import { PATIENT_STATE, REMINDER_STATUS } from '../../src/utils/constants.js';

describe('Admin Service (FR-30 s.d. FR-32)', () => {
  const adminJid = '628123456789@s.whatsapp.net';
  const nonAdminJid = '628999999999@s.whatsapp.net';
  const adminNumbers = ['08123456789', '628987654321'];

  describe('normalizePhoneNumber & isAdminNumber', () => {
    it('menormalisasi nomor dengan awalan 0 menjadi 62 dan menghapus karakter non-digit', () => {
      assert.equal(normalizePhoneNumber('08123456789'), '628123456789');
      assert.equal(normalizePhoneNumber('+62 812-3456-789'), '628123456789');
      assert.equal(normalizePhoneNumber('628123456789'), '628123456789');
    });

    it('memvalidasi nomor admin yang terdaftar di whitelist', () => {
      assert.equal(isAdminNumber(adminJid, adminNumbers), true);
      assert.equal(isAdminNumber('628987654321@s.whatsapp.net', adminNumbers), true);
      assert.equal(isAdminNumber(nonAdminJid, adminNumbers), false);
      assert.equal(isAdminNumber('', adminNumbers), false);
      assert.equal(isAdminNumber(null, adminNumbers), false);
      // Validasi dengan altJid dan @lid
      assert.equal(isAdminNumber('123456789012345@lid', adminNumbers, adminJid), true);
      assert.equal(isAdminNumber('123456789012345@lid', ['123456789012345']), true);
    });
  });

  describe('parseAdminCommand', () => {
    it('mengembalikan null jika pesan bukan diawali tanda seru (!)', () => {
      assert.equal(parseAdminCommand('DAFTAR'), null);
      assert.equal(parseAdminCommand('SUDAH'), null);
      assert.equal(parseAdminCommand('Halo bot'), null);
      assert.equal(parseAdminCommand(''), null);
    });

    it('berhasil mem-parsing perintah !rekap, !pasien, dan !stop', () => {
      assert.deepEqual(parseAdminCommand('!rekap'), {
        isCommand: true,
        command: 'rekap',
        args: ''
      });
      assert.deepEqual(parseAdminCommand('  !PASIEN  '), {
        isCommand: true,
        command: 'pasien',
        args: ''
      });
      assert.deepEqual(parseAdminCommand('!stop 123456'), {
        isCommand: true,
        command: 'stop',
        args: '123456'
      });
      assert.deepEqual(parseAdminCommand('!stop RM-001 Sukanti'), {
        isCommand: true,
        command: 'stop',
        args: 'RM-001 Sukanti'
      });
    });
  });

  describe('handleAdminCommand Execution', () => {
    it('mengabaikan pesan yang bukan perintah admin (handled: false)', async () => {
      const res = await handleAdminCommand(adminJid, 'Halo');
      assert.equal(res.handled, false);
    });

    it('menolak pengirim non-admin yang mencoba mengeksekusi perintah admin', async () => {
      const sent = [];
      const res = await handleAdminCommand(nonAdminJid, '!rekap', {
        adminNumbers,
        sendFn: async (jid, text) => sent.push({ jid, text })
      });

      assert.equal(res.handled, true);
      assert.equal(res.action, 'unauthorized');
      assert.equal(sent.length, 1);
      assert.match(sent[0].text, /hanya dapat diakses oleh peneliti\/admin/);
    });

    it('dapat mengabaikan secara diam-diam jika silentReject aktif', async () => {
      const sent = [];
      const res = await handleAdminCommand(nonAdminJid, '!rekap', {
        adminNumbers,
        silentReject: true,
        sendFn: async (jid, text) => sent.push({ jid, text })
      });

      assert.equal(res.handled, true);
      assert.equal(res.action, 'unauthorized_silent');
      assert.equal(sent.length, 0);
    });

    it('menjalankan perintah !rekap dan membalas ringkasan status hari ini (FR-30)', async () => {
      const mockTodayLogs = [
        { status: REMINDER_STATUS.TEPAT_WAKTU },
        { status: REMINDER_STATUS.TEPAT_WAKTU },
        { status: REMINDER_STATUS.TERLAMBAT },
        { status: REMINDER_STATUS.MENUNGGU }
      ];

      const origFind = ReminderLog.find;
      ReminderLog.find = async () => mockTodayLogs;

      const sent = [];
      try {
        const now = new Date('2026-10-15T00:00:00Z');
        const res = await handleAdminCommand(adminJid, '!rekap', {
          adminNumbers,
          now,
          sendFn: async (jid, text) => sent.push({ jid, text })
        });

        assert.equal(res.handled, true);
        assert.equal(res.action, 'rekap');
        assert.equal(res.stats.total, 4);
        assert.equal(res.stats.tepatWaktu, 2);
        assert.equal(res.stats.terlambat, 1);
        assert.equal(res.stats.menunggu, 1);
        assert.equal(res.stats.tidakKonfirmasi, 0);

        assert.equal(sent.length, 1);
        assert.match(sent[0].text, /Rekap Kepatuhan Hari Ini/);
        assert.match(sent[0].text, /Tepat Waktu: 2/);
        assert.match(sent[0].text, /Terlambat: 1/);
        assert.match(sent[0].text, /Menunggu: 1/);
      } finally {
        ReminderLog.find = origFind;
      }
    });

    it('menjalankan perintah !pasien dan menampilkan daftar pasien aktif (FR-31)', async () => {
      const mockActivePatients = [
        { nama: 'Sukanti', noRM: '123456', jamMinum: '07:00' },
        { nama: 'Budi Santoso', noRM: '654321', jamMinum: '19:00' }
      ];

      const origFind = Patient.find;
      Patient.find = () => ({
        sort: async () => mockActivePatients
      });

      const sent = [];
      try {
        const res = await handleAdminCommand(adminJid, '!pasien', {
          adminNumbers,
          sendFn: async (jid, text) => sent.push({ jid, text })
        });

        assert.equal(res.handled, true);
        assert.equal(res.action, 'pasien');
        assert.equal(res.count, 2);

        assert.equal(sent.length, 1);
        assert.match(sent[0].text, /Daftar Pasien Aktif/);
        assert.match(sent[0].text, /1\. Sukanti \(RM: 123456\) - 07:00 WIB/);
        assert.match(sent[0].text, /2\. Budi Santoso \(RM: 654321\) - 19:00 WIB/);
      } finally {
        Patient.find = origFind;
      }
    });

    it('menjalankan perintah !pasien saat belum ada pasien aktif', async () => {
      const origFind = Patient.find;
      Patient.find = () => ({
        sort: async () => []
      });

      const sent = [];
      try {
        const res = await handleAdminCommand(adminJid, '!pasien', {
          adminNumbers,
          sendFn: async (jid, text) => sent.push({ jid, text })
        });

        assert.equal(res.handled, true);
        assert.equal(res.count, 0);
        assert.match(sent[0].text, /belum ada pasien yang berstatus aktif/);
      } finally {
        Patient.find = origFind;
      }
    });

    it('menolak perintah !stop jika argumen No. RM tidak diisi (FR-32)', async () => {
      const sent = [];
      const res = await handleAdminCommand(adminJid, '!stop', {
        adminNumbers,
        sendFn: async (jid, text) => sent.push({ jid, text })
      });

      assert.equal(res.handled, true);
      assert.equal(res.action, 'stop_missing_arg');
      assert.equal(sent.length, 1);
      assert.match(sent[0].text, /Format salah/);
    });

    it('memberikan pesan jika pasien No. RM tidak ditemukan saat !stop (FR-32)', async () => {
      const origFindOne = Patient.findOne;
      Patient.findOne = async () => null;

      const sent = [];
      try {
        const res = await handleAdminCommand(adminJid, '!stop 999999', {
          adminNumbers,
          sendFn: async (jid, text) => sent.push({ jid, text })
        });

        assert.equal(res.handled, true);
        assert.equal(res.action, 'stop_not_found');
        assert.equal(sent.length, 1);
        assert.match(sent[0].text, /tidak ditemukan/);
      } finally {
        Patient.findOne = origFindOne;
      }
    });

    it('berhasil menghentikan pengingat pasien dengan perintah !stop <RM> (FR-32)', async () => {
      const mockPatient = {
        _id: 'mock-p-id',
        nama: 'Sukanti',
        noRM: '123456',
        state: PATIENT_STATE.ACTIVE,
        save: async function () {
          this.saved = true;
        }
      };

      const origFindOne = Patient.findOne;
      Patient.findOne = async ({ noRM }) => {
        if (noRM === '123456') return mockPatient;
        return null;
      };

      const sent = [];
      try {
        const res = await handleAdminCommand(adminJid, '!stop 123456', {
          adminNumbers,
          sendFn: async (jid, text) => sent.push({ jid, text })
        });

        assert.equal(res.handled, true);
        assert.equal(res.action, 'stop_success');
        assert.equal(mockPatient.state, PATIENT_STATE.STOPPED);
        assert.equal(mockPatient.saved, true);

        assert.equal(sent.length, 1);
        assert.match(sent[0].text, /berhasil dihentikan \(status: stopped\)/);
      } finally {
        Patient.findOne = origFindOne;
      }
    });

    it('memberikan panduan bantuan untuk perintah admin tidak dikenal', async () => {
      const sent = [];
      const res = await handleAdminCommand(adminJid, '!unknown_command', {
        adminNumbers,
        sendFn: async (jid, text) => sent.push({ jid, text })
      });

      assert.equal(res.handled, true);
      assert.equal(res.action, 'help');
      assert.equal(sent.length, 1);
      assert.match(sent[0].text, /Panduan Perintah Admin Peneliti/);
    });
  });
});
