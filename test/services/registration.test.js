import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { handleRegistrationMessage } from '../../src/services/registration.js';
import { Patient } from '../../src/db/models.js';
import { PATIENT_STATE } from '../../src/utils/constants.js';

describe('Registration Service Flow (FR-03 s.d. FR-07)', () => {
  let originalFindOne;

  beforeEach(() => {
    originalFindOne = Patient.findOne;
  });

  afterEach(() => {
    Patient.findOne = originalFindOne;
  });

  it('DAFTAR memulai registrasi dan meminta data pasien (FR-03)', async () => {
    const jid = '62811111111@s.whatsapp.net';
    const sentMessages = [];
    const mockSend = async (to, text) => {
      sentMessages.push({ to, text });
    };

    // Pasien belum terdaftar di DB
    Patient.findOne = async () => null;

    let savedPatient = null;
    const origSave = Patient.prototype.save;
    Patient.prototype.save = async function () {
      savedPatient = this;
      return this;
    };

    try {
      const res = await handleRegistrationMessage(jid, 'daftar', { sendFn: mockSend });

      assert.equal(res.handled, true);
      assert.equal(res.action, 'awaiting_data_requested');
      assert.equal(savedPatient.jid, jid);
      assert.equal(savedPatient.state, PATIENT_STATE.AWAITING_DATA);
      assert.equal(sentMessages.length, 1);
      assert.match(sentMessages[0].text, /Nama Lengkap/);
      assert.match(sentMessages[0].text, /Sukanti \/ 123456 \/ 07.00/);
    } finally {
      Patient.prototype.save = origSave;
    }
  });

  it('format salah membalas contoh format dan state TETAP awaiting_data (FR-05)', async () => {
    const jid = '62811111111@s.whatsapp.net';
    const sentMessages = [];
    const mockSend = async (to, text) => {
      sentMessages.push({ to, text });
    };

    const mockPatient = {
      jid,
      state: PATIENT_STATE.AWAITING_DATA,
      save: async () => {}
    };

    Patient.findOne = async ({ jid: queryJid }) => {
      if (queryJid === jid) return mockPatient;
      return null;
    };

    const res = await handleRegistrationMessage(jid, 'Sukanti 123456 07.00', { sendFn: mockSend });

    assert.equal(res.handled, true);
    assert.equal(res.action, 'invalid_format');
    assert.equal(mockPatient.state, PATIENT_STATE.AWAITING_DATA);
    assert.equal(sentMessages.length, 1);
    assert.match(sentMessages[0].text, /Format yang Bapak\/Ibu kirimkan belum sesuai/);
    assert.match(sentMessages[0].text, /Sukanti \/ 123456 \/ 07.00/);
  });

  it('No RM duplikat dari nomor lain ditolak dengan sopan (FR-06)', async () => {
    const jid = '62811111111@s.whatsapp.net';
    const sentMessages = [];
    const mockSend = async (to, text) => {
      sentMessages.push({ to, text });
    };

    const currentPatient = {
      jid,
      state: PATIENT_STATE.AWAITING_DATA,
      save: async () => {}
    };

    const existingOtherPatient = {
      jid: '62899999999@s.whatsapp.net',
      noRM: '123456',
      state: PATIENT_STATE.ACTIVE
    };

    Patient.findOne = async (query) => {
      if (query.jid === jid) return currentPatient;
      if (query.noRM === '123456') return existingOtherPatient;
      return null;
    };

    const res = await handleRegistrationMessage(jid, 'Sukanti / 123456 / 07.00', { sendFn: mockSend });

    assert.equal(res.handled, true);
    assert.equal(res.action, 'duplicate_rm');
    assert.equal(currentPatient.state, PATIENT_STATE.AWAITING_DATA);
    assert.equal(sentMessages.length, 1);
    assert.match(sentMessages[0].text, /123456 sudah terdaftar/);
  });

  it('data valid mengaktifkan pasien dan mengirim pesan sukses tanpa edukasi (FR-07)', async () => {
    const jid = '62811111111@s.whatsapp.net';
    const sentMessages = [];
    const mockSend = async (to, text) => {
      sentMessages.push({ to, text });
    };

    let saveCalled = false;
    const currentPatient = {
      jid,
      state: PATIENT_STATE.AWAITING_DATA,
      save: async () => {
        saveCalled = true;
      }
    };

    Patient.findOne = async (query) => {
      if (query.jid === jid) return currentPatient;
      return null;
    };

    const res = await handleRegistrationMessage(jid, 'Sukanti / 123456 / 7.00', { sendFn: mockSend });

    assert.equal(res.handled, true);
    assert.equal(res.action, 'registration_success');
    assert.equal(saveCalled, true);
    assert.equal(currentPatient.nama, 'Sukanti');
    assert.equal(currentPatient.noRM, '123456');
    assert.deepEqual(currentPatient.jamMinum, ['07:00']);
    assert.equal(currentPatient.state, PATIENT_STATE.ACTIVE);
    assert.ok(currentPatient.registeredAt instanceof Date);

    assert.equal(sentMessages.length, 1);
    assert.match(sentMessages[0].text, /Registrasi Berhasil/);
    assert.match(sentMessages[0].text, /07:00 WIB/);
    assert.doesNotMatch(sentMessages[0].text, /edukasi/i);
  });

  it('pasien aktif mengirim DAFTAR kembali diberi informasi sudah terdaftar', async () => {
    const jid = '62811111111@s.whatsapp.net';
    const sentMessages = [];
    const mockSend = async (to, text) => {
      sentMessages.push({ to, text });
    };

    const activePatient = {
      jid,
      nama: 'Sukanti',
      jamMinum: ['07:00'],
      state: PATIENT_STATE.ACTIVE,
      save: async () => {}
    };

    Patient.findOne = async () => activePatient;

    const res = await handleRegistrationMessage(jid, 'DAFTAR', { sendFn: mockSend });

    assert.equal(res.handled, true);
    assert.equal(res.action, 'already_active');
    assert.equal(sentMessages.length, 1);
    assert.match(sentMessages[0].text, /sudah terdaftar/);
  });
});
