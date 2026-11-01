/**
 * Model Mongoose untuk Patient dan ReminderLog sesuai PRD §9.
 */

import mongoose from 'mongoose';
import { PATIENT_STATE, REMINDER_STATUS } from '../utils/constants.js';

const patientSchema = new mongoose.Schema(
  {
    jid: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    state: {
      type: String,
      enum: Object.values(PATIENT_STATE),
      default: PATIENT_STATE.NEW,
      required: true
    },
    nama: {
      type: String,
      trim: true,
      default: null
    },
    noRM: {
      type: String,
      trim: true,
      default: null
    },
    jamMinum: {
      type: [String],
      default: []
    },
    registeredAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Partial unique index pada noRM: hanya berlaku saat noRM diisi (berupa string)
patientSchema.index(
  { noRM: 1 },
  {
    unique: true,
    partialFilterExpression: {
      noRM: { $type: 'string' }
    }
  }
);

const reminderLogSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true
    },
    tanggal: {
      type: String, // Format YYYY-MM-DD (WIB)
      required: true,
      trim: true
    },
    jadwal: {
      type: String, // Format HH:mm (WIB)
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: Object.values(REMINDER_STATUS),
      default: REMINDER_STATUS.MENUNGGU,
      required: true
    },
    reminder1At: {
      type: Date,
      default: null
    },
    reminder2At: {
      type: Date,
      default: null
    },
    confirmedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Unique compound index pada patientId + tanggal + jadwal: mencegah duplikasi per jadwal per hari (FR-12)
reminderLogSchema.index({ patientId: 1, tanggal: 1, jadwal: 1 }, { unique: true });

export const Patient = mongoose.models.Patient || mongoose.model('Patient', patientSchema);
export const ReminderLog = mongoose.models.ReminderLog || mongoose.model('ReminderLog', reminderLogSchema);

export { patientSchema, reminderLogSchema };
