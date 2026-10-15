import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  gracefulShutdown,
  resetShutdownState,
  bootstrap
} from '../src/index.js';
import * as dbModule from '../src/db/connection.js';
import * as clientModule from '../src/bot/client.js';
import * as schedulerModule from '../src/scheduler/index.js';
import { handleRegistrationMessage } from '../src/services/registration.js';
import { handleAdminCommand } from '../src/services/admin.js';
import { Patient, ReminderLog } from '../src/db/models.js';
import { logger } from '../src/utils/logger.js';

describe('Hardening & Graceful Shutdown (Issue #15)', () => {
  beforeEach(() => {
    resetShutdownState();
  });

  describe('Graceful Shutdown', () => {
    it('gracefulShutdown menghentikan scheduler, menutup socket WA, dan memutuskan koneksi DB', async () => {
      let schedulerStopped = false;
      let waDisconnected = false;
      let dbDisconnected = false;

      await gracefulShutdown('SIGTERM', {
        stopScheduler: () => {
          schedulerStopped = true;
        },
        disconnectWhatsApp: async () => {
          waDisconnected = true;
        },
        disconnectDb: async () => {
          dbDisconnected = true;
        }
      });

      assert.equal(schedulerStopped, true, 'Scheduler harus dihentikan');
      assert.equal(waDisconnected, true, 'Koneksi WhatsApp harus ditutup');
      assert.equal(dbDisconnected, true, 'Koneksi database harus diputuskan');
    });

    it('gracefulShutdown mencegah eksekusi berulang (idempoten)', async () => {
      let callCount = 0;
      const opts = {
        stopScheduler: () => {
          callCount++;
        },
        disconnectWhatsApp: async () => {},
        disconnectDb: async () => {}
      };

      await gracefulShutdown('SIGINT', opts);
      await gracefulShutdown('SIGINT', opts);

      assert.equal(callCount, 1, 'Hanya boleh dieksekusi sekali');
    });
  });

  describe('Bootstrap Flow', () => {
    it('bootstrap berhasil menginisialisasi komponen utama aplikasi', async () => {
      let dbConnected = false;
      let handlersRegistered = false;

      const mockSock = {
        ev: {
          on: (event) => {
            if (event === 'messages.upsert') {
              handlersRegistered = true;
            }
          }
        }
      };

      const result = await bootstrap({
        config: {
          MONGODB_URI: 'mongodb://localhost:27017/test',
          AUTH_DIR: './test_auth'
        },
        connectDb: async () => {
          dbConnected = true;
        },
        sock: mockSock,
        skipSignals: true,
        sendFn: async () => {}
      });

      assert.equal(dbConnected, true);
      assert.equal(handlersRegistered, true);
      assert.ok(result.sock);
      assert.ok(result.schedulerTask);

      // Hentikan task scheduler yang baru dimulai
      schedulerModule.stopScheduler();
    });
  });

  describe('Privacy in Logging (Tanpa Data Pasien di Level Info ke Atas)', () => {
    it('registrasi pasien baru tidak mencatat nomor JID / telepon pada level info', async () => {
      const origFindOne = Patient.findOne;
      const origSave = Patient.prototype.save;
      Patient.findOne = async () => null;
      Patient.prototype.save = async function () {
        this._id = 'mock-id-123';
      };

      const loggedInfo = [];
      const origInfo = logger.info;
      logger.info = function (...args) {
        loggedInfo.push(args);
        return origInfo.apply(this, args);
      };

      try {
        await handleRegistrationMessage('628199999999@s.whatsapp.net', 'DAFTAR', {
          sendFn: async () => {}
        });

        // Verifikasi tidak ada nomor telepon di loggedInfo metadata
        const sensitiveLeak = loggedInfo.some(([meta]) => {
          if (typeof meta === 'object' && meta !== null) {
            return meta.jid || meta.nama || meta.noRM;
          }
          return false;
        });

        assert.equal(sensitiveLeak, false, 'Tidak boleh ada jid/nama/noRM di log level info');
      } finally {
        Patient.findOne = origFindOne;
        Patient.prototype.save = origSave;
        logger.info = origInfo;
      }
    });

    it('perintah !stop admin tidak mencatat noRM pada level info', async () => {
      const origFindOne = Patient.findOne;
      const mockPatient = {
        _id: 'mock-p-id',
        nama: 'Sukanti Rahasia',
        noRM: 'RM-SECRET-999',
        save: async () => {}
      };
      Patient.findOne = async () => mockPatient;

      const loggedInfo = [];
      const origInfo = logger.info;
      logger.info = function (...args) {
        loggedInfo.push(args);
        return origInfo.apply(this, args);
      };

      try {
        await handleAdminCommand('628123456789@s.whatsapp.net', '!stop RM-SECRET-999', {
          adminNumbers: ['628123456789'],
          sendFn: async () => {}
        });

        const sensitiveLeak = loggedInfo.some(([meta]) => {
          if (typeof meta === 'object' && meta !== null) {
            return meta.nama || meta.noRM || meta.jid;
          }
          return false;
        });

        assert.equal(sensitiveLeak, false, 'Tidak boleh ada data sensitif pasien di level info saat stop');
      } finally {
        Patient.findOne = origFindOne;
        logger.info = origInfo;
      }
    });
  });
});
