import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';

describe('Config Loader & Validation', () => {
  it('melempar error jika MONGODB_URI tidak diatur', () => {
    assert.throws(
      () => {
        loadConfig({
          MONGODB_URI: ''
        });
      },
      {
        message: /MONGODB_URI/
      }
    );
  });

  it('berhasil memuat konfigurasi default dan mem-parsing ADMIN_NUMBERS', () => {
    const mockEnv = {
      MONGODB_URI: 'mongodb://localhost:27017/test-db',
      ADMIN_NUMBERS: '6281234567890, 6289876543210'
    };

    const config = loadConfig(mockEnv);
    assert.equal(config.MONGODB_URI, 'mongodb://localhost:27017/test-db');
    assert.equal(config.NODE_ENV, 'development');
    assert.equal(config.TZ, 'Asia/Jakarta');
    assert.equal(config.LOG_LEVEL, 'info');
    assert.equal(config.AUTH_DIR, './auth_info');
    assert.deepEqual(config.ADMIN_NUMBERS, ['6281234567890', '6289876543210']);
  });

  it('membersihkan nomor admin dari karakter non-numerik', () => {
    const mockEnv = {
      MONGODB_URI: 'mongodb://localhost:27017/test-db',
      ADMIN_NUMBERS: '+62 812-3456-7890, +62 899-0000-1111'
    };

    const config = loadConfig(mockEnv);
    assert.deepEqual(config.ADMIN_NUMBERS, ['6281234567890', '6289900001111']);
  });
});
