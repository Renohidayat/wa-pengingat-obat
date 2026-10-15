import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PATIENT_STATE, REMINDER_STATUS } from '../../src/utils/constants.js';

describe('Constants (PRD §6.3 & §9)', () => {
  it('mendefinisikan state pasien sesuai PRD §6.3', () => {
    assert.equal(PATIENT_STATE.NEW, 'new');
    assert.equal(PATIENT_STATE.AWAITING_DATA, 'awaiting_data');
    assert.equal(PATIENT_STATE.ACTIVE, 'active');
    assert.equal(PATIENT_STATE.STOPPED, 'stopped');
  });

  it('mendefinisikan status kepatuhan pengingat sesuai PRD §9', () => {
    assert.equal(REMINDER_STATUS.MENUNGGU, 'Menunggu');
    assert.equal(REMINDER_STATUS.TEPAT_WAKTU, 'Tepat Waktu');
    assert.equal(REMINDER_STATUS.TERLAMBAT, 'Terlambat');
    assert.equal(REMINDER_STATUS.TIDAK_KONFIRMASI, 'Tidak Konfirmasi');
    assert.equal(REMINDER_STATUS.TERLEWAT_SISTEM, 'Terlewat Sistem');
  });
});
