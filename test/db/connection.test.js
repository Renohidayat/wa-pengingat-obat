import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import dns from 'node:dns';
import { ensureDnsServers, connectDb, disconnectDb } from '../../src/db/connection.js';

describe('Database Connection & DNS Resolver (PRD §10 & §11)', () => {
  it('connectDb melempar error jika URI kosong', async () => {
    await assert.rejects(
      async () => {
        await connectDb('');
      },
      {
        message: /URI koneksi MongoDB tidak boleh kosong/
      }
    );
  });

  it('ensureDnsServers menerapkan server kustom jika diberikan', () => {
    const originalServers = dns.getServers();
    try {
      ensureDnsServers(['1.1.1.1', '8.8.8.8']);
      const current = dns.getServers();
      assert.ok(current.includes('1.1.1.1'));
      assert.ok(current.includes('8.8.8.8'));
    } finally {
      dns.setServers(originalServers);
    }
  });

  it('ensureDnsServers melakukan fallback jika server saat ini loopback 127.0.0.1', () => {
    const originalServers = dns.getServers();
    try {
      dns.setServers(['127.0.0.1']);
      ensureDnsServers([]);
      const current = dns.getServers();
      assert.ok(current.includes('1.1.1.1') || current.includes('8.8.8.8'));
    } finally {
      dns.setServers(originalServers);
    }
  });

  it('disconnectDb dapat dipanggil dengan aman meskipun belum terhubung', async () => {
    await assert.doesNotReject(async () => {
      await disconnectDb();
    });
  });
});
