import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  startQrServer,
  stopQrServer,
  updateQr,
  updateStatus,
  getQrState,
  renderQrPage
} from '../../src/bot/qr-server.js';

describe('Live QR Web Server', () => {
  const testPort = 38472;

  before(async () => {
    startQrServer(testPort);
  });

  after(async () => {
    await stopQrServer();
  });

  it('menyajikan halaman HTML pindaian QR pada rute GET /', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/`);
    assert.strictEqual(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    const html = await res.text();
    assert.match(html, /Tautkan Nomor Bot/);
    assert.match(html, /checkStatus/);
  });

  it('mengembalikan status waiting saat pertama kali diinisialisasi pada GET /qr-status', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/qr-status`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.status);
    assert.strictEqual(typeof data.status, 'string');
  });

  it('memperbarui status dan menghasilkan Data URL saat updateQr dipanggil', async () => {
    const dummyQr = '1@dummy-whatsapp-qr-code-payload-test-12345';
    await updateQr(dummyQr);

    const state = getQrState();
    assert.strictEqual(state.status, 'qr_ready');
    assert.strictEqual(state.hasQr, true);

    const res = await fetch(`http://127.0.0.1:${testPort}/qr-status`);
    const data = await res.json();
    assert.strictEqual(data.status, 'qr_ready');
    assert.match(data.qrImage, /^data:image\/png;base64,/);
  });

  it('memperbarui status menjadi connected saat WhatsApp berhasil terhubung', async () => {
    const dummyUser = { id: '62881022926021:1@s.whatsapp.net' };
    updateStatus('open', dummyUser);

    const state = getQrState();
    assert.strictEqual(state.status, 'connected');
    assert.strictEqual(state.hasQr, false);
    assert.strictEqual(state.connectedUser.id, dummyUser.id);

    const res = await fetch(`http://127.0.0.1:${testPort}/qr-status`);
    const data = await res.json();
    assert.strictEqual(data.status, 'connected');
    assert.strictEqual(data.qrImage, null);
  });

  it('merespons health check pada GET /health', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.ok, true);
  });
});
