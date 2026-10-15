import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { shouldIgnoreMessage, extractMessageText, setupMessageHandlers } from '../../src/bot/handlers.js';

describe('WhatsApp Message Filters & Handlers (FR-02)', () => {
  it('mengabaikan pesan dari bot sendiri (fromMe: true)', () => {
    const msg = {
      key: {
        fromMe: true,
        remoteJid: '628123456789@s.whatsapp.net'
      }
    };
    assert.equal(shouldIgnoreMessage(msg), true);
  });

  it('mengabaikan pesan dari grup WhatsApp (@g.us)', () => {
    const msg = {
      key: {
        fromMe: false,
        remoteJid: '120363023456789@g.us'
      }
    };
    assert.equal(shouldIgnoreMessage(msg), true);
  });

  it('mengabaikan pesan status/broadcast (@broadcast)', () => {
    const statusMsg = {
      key: {
        fromMe: false,
        remoteJid: 'status@broadcast'
      }
    };
    assert.equal(shouldIgnoreMessage(statusMsg), true);

    const bcastMsg = {
      key: {
        fromMe: false,
        remoteJid: '12345@broadcast'
      }
    };
    assert.equal(shouldIgnoreMessage(bcastMsg), true);
  });

  it('menerima pesan obrolan pribadi yang valid', () => {
    const privateMsg = {
      key: {
        fromMe: false,
        remoteJid: '628123456789@s.whatsapp.net'
      }
    };
    assert.equal(shouldIgnoreMessage(privateMsg), false);
  });

  it('mengekstrak teks dari berbagai format pesan Baileys', () => {
    assert.equal(
      extractMessageText({
        message: { conversation: '  DAFTAR  ' }
      }),
      'DAFTAR'
    );

    assert.equal(
      extractMessageText({
        message: {
          extendedTextMessage: { text: 'SUDAH' }
        }
      }),
      'SUDAH'
    );

    assert.equal(
      extractMessageText({
        message: {
          imageMessage: { caption: 'Foto Resep' }
        }
      }),
      'Foto Resep'
    );

    assert.equal(extractMessageText(null), '');
    assert.equal(extractMessageText({ message: {} }), '');
  });

  it('setupMessageHandlers memproses pesan valid dan mengisolasi error', async () => {
    const events = {};
    const mockSock = {
      ev: {
        on: (event, cb) => {
          events[event] = cb;
        }
      }
    };

    const received = [];
    setupMessageHandlers(mockSock, async (payload) => {
      received.push(payload);
      if (payload.text === 'ERROR') {
        throw new Error('Simulasi kegagalan handler');
      }
    });

    const mockUpsert = {
      type: 'notify',
      messages: [
        {
          key: { fromMe: false, remoteJid: 'user1@s.whatsapp.net' },
          message: { conversation: 'Pesan 1' }
        },
        {
          key: { fromMe: false, remoteJid: 'user2@s.whatsapp.net' },
          message: { conversation: 'ERROR' }
        },
        {
          key: { fromMe: false, remoteJid: 'user3@s.whatsapp.net' },
          message: { conversation: 'Pesan 3' }
        }
      ]
    };

    // Jalankan listener
    await events['messages.upsert'](mockUpsert);

    // Memastikan pesan 1, ERROR, dan pesan 3 tetap diproses (tidak terhenti di ERROR)
    assert.equal(received.length, 3);
    assert.equal(received[0].text, 'Pesan 1');
    assert.equal(received[1].text, 'ERROR');
    assert.equal(received[2].text, 'Pesan 3');
  });
});
