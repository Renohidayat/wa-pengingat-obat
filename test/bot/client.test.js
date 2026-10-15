import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getRandomDelay, send, setSocket } from '../../src/bot/client.js';

describe('WhatsApp Client & Send Delay (FR-20)', () => {
  afterEach(() => {
    setSocket(null);
  });

  it('menghasilkan nilai jeda acak dalam rentang 1500–4000 ms', () => {
    for (let i = 0; i < 20; i++) {
      const delay = getRandomDelay(1500, 4000);
      assert.ok(delay >= 1500 && delay <= 4000, `Delay ${delay} harus berada di antara 1500 dan 4000`);
    }
  });

  it('send melempar error jika socket belum diinisialisasi', async () => {
    await assert.rejects(async () => {
      await send('628123456789@s.whatsapp.net', 'Halo', { skipDelay: true });
    }, /belum terinisialisasi/);
  });

  it('send berhasil memanggil socket.sendMessage dengan parameter yang tepat', async () => {
    let sentJid = null;
    let sentContent = null;

    const mockSock = {
      sendMessage: async (jid, content) => {
        sentJid = jid;
        sentContent = content;
        return { key: { id: 'mock-msg-id' } };
      }
    };

    setSocket(mockSock);

    const res = await send('628123456789@s.whatsapp.net', 'Pesan uji coba', { skipDelay: true });

    assert.equal(sentJid, '628123456789@s.whatsapp.net');
    assert.deepEqual(sentContent, { text: 'Pesan uji coba' });
    assert.equal(res.key.id, 'mock-msg-id');
  });
});
