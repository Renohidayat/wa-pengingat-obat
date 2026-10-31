import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { patientSchema, reminderLogSchema, educationLogSchema, Patient, ReminderLog, EducationLog } from '../../src/db/models.js';
import { PATIENT_STATE, REMINDER_STATUS, EDUCATION_STATUS } from '../../src/utils/constants.js';

describe('Database Models Schema & Indexes (PRD §9)', () => {
  it('skema Patient mendefinisikan field wajib dan enum state yang benar', () => {
    assert.ok(patientSchema.paths.jid.isRequired);
    assert.deepEqual(patientSchema.paths.state.enumValues, Object.values(PATIENT_STATE));
    assert.equal(patientSchema.paths.state.defaultValue, PATIENT_STATE.NEW);
  });

  it('skema Patient memiliki field edukasiIndex dengan default 0', () => {
    assert.equal(patientSchema.paths.edukasiIndex.defaultValue, 0);
    assert.equal(patientSchema.paths.edukasiIndex.options.min, 0);
  });

  it('skema Patient memiliki partial unique index pada noRM', () => {
    const indexes = patientSchema.indexes();
    const noRmIndex = indexes.find(([fields]) => fields.noRM === 1);

    assert.ok(noRmIndex, 'Index pada noRM harus ada');
    const [fields, options] = noRmIndex;
    assert.equal(options.unique, true);
    assert.deepEqual(options.partialFilterExpression, {
      noRM: { $type: 'string' }
    });
  });

  it('skema ReminderLog mendefinisikan field wajib dan status yang benar', () => {
    assert.ok(reminderLogSchema.paths.patientId.isRequired);
    assert.ok(reminderLogSchema.paths.tanggal.isRequired);
    assert.ok(reminderLogSchema.paths.jadwal.isRequired);
    assert.deepEqual(reminderLogSchema.paths.status.enumValues, Object.values(REMINDER_STATUS));
    assert.equal(reminderLogSchema.paths.status.defaultValue, REMINDER_STATUS.MENUNGGU);
  });

  it('skema ReminderLog memiliki compound unique index pada patientId + tanggal', () => {
    const indexes = reminderLogSchema.indexes();
    const compoundIndex = indexes.find(
      ([fields]) => fields.patientId === 1 && fields.tanggal === 1
    );

    assert.ok(compoundIndex, 'Compound index patientId + tanggal harus ada');
    const [fields, options] = compoundIndex;
    assert.equal(options.unique, true);
  });

  it('skema EducationLog mendefinisikan field wajib dan status yang benar', () => {
    assert.ok(educationLogSchema.paths.patientId.isRequired);
    assert.ok(educationLogSchema.paths.tanggal.isRequired);
    assert.ok(educationLogSchema.paths.materiKe.isRequired);
    assert.ok(educationLogSchema.paths.judul.isRequired);
    assert.ok(educationLogSchema.paths.status.isRequired);
    assert.deepEqual(educationLogSchema.paths.status.enumValues, Object.values(EDUCATION_STATUS));
  });

  it('skema EducationLog memiliki compound unique index pada patientId + tanggal', () => {
    const indexes = educationLogSchema.indexes();
    const compoundIndex = indexes.find(
      ([fields]) => fields.patientId === 1 && fields.tanggal === 1
    );
    assert.ok(compoundIndex, 'Compound index patientId + tanggal pada EducationLog harus ada');
    const [, options] = compoundIndex;
    assert.equal(options.unique, true);
  });

  it('validasi Patient gagal jika jid tidak diisi', async () => {
    const invalidPatient = new Patient({});
    await assert.rejects(async () => {
      await invalidPatient.validate();
    }, /jid/);
  });

  it('validasi ReminderLog gagal jika field wajib tidak diisi', async () => {
    const invalidLog = new ReminderLog({});
    await assert.rejects(async () => {
      await invalidLog.validate();
    });
  });

  it('validasi EducationLog gagal jika field wajib tidak diisi', async () => {
    const invalidLog = new EducationLog({});
    await assert.rejects(async () => {
      await invalidLog.validate();
    });
  });

  it('EDUCATION_STATUS mendefinisikan Terkirim dan Terlewat Sistem', () => {
    assert.equal(EDUCATION_STATUS.TERKIRIM, 'Terkirim');
    assert.equal(EDUCATION_STATUS.TERLEWAT_SISTEM, 'Terlewat Sistem');
  });
});
