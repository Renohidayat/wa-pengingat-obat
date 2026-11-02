/**
 * Web Server Ringan untuk Menampilkan Live QR Code WhatsApp (FR-01).
 * Memungkinkan client men-scan QR code melalui browser kapan saja tanpa perlu tangkapan layar terminal.
 */

import http from 'node:http';
import QRCode from 'qrcode';
import { logger } from '../utils/logger.js';

let server = null;
let currentQr = null;
let currentQrDataUrl = null;
let connectionStatus = 'waiting'; // 'waiting' | 'qr_ready' | 'connected' | 'disconnected'
let connectedUser = null;
let lastUpdatedAt = null;

/**
 * Memperbarui kode QR terbaru dan menghasilkan representasi Data URL (PNG).
 * @param {string} qr String raw QR code dari Baileys
 */
export async function updateQr(qr) {
  try {
    currentQr = qr;
    currentQrDataUrl = await QRCode.toDataURL(qr, {
      width: 340,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });
    connectionStatus = 'qr_ready';
    lastUpdatedAt = new Date().toISOString();
    logger.info('Live Web QR Code berhasil diperbarui');
  } catch (err) {
    logger.error({ err: err.message }, 'Gagal mengonversi QR code ke Data URL');
  }
}

/**
 * Memperbarui status koneksi WhatsApp.
 * @param {'open' | 'close' | 'connecting'} status
 * @param {object} [user] Informasi akun bot saat terhubung
 */
export function updateStatus(status, user = null) {
  if (status === 'open') {
    connectionStatus = 'connected';
    connectedUser = user;
    currentQr = null;
    currentQrDataUrl = null;
    lastUpdatedAt = new Date().toISOString();
    logger.info({ user: user?.id }, 'Status Live Web QR: WhatsApp Connected');
  } else if (status === 'close') {
    connectionStatus = 'disconnected';
    lastUpdatedAt = new Date().toISOString();
  } else if (status === 'connecting') {
    connectionStatus = 'waiting';
    lastUpdatedAt = new Date().toISOString();
  }
}

/**
 * Mendapatkan state QR dan koneksi saat ini (untuk pengujian atau API).
 */
export function getQrState() {
  return {
    status: connectionStatus,
    hasQr: Boolean(currentQrDataUrl),
    connectedUser,
    lastUpdatedAt
  };
}

/**
 * Menghasilkan markup HTML halaman pemindaian QR Code.
 * @returns {string}
 */
export function renderQrPage() {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>Tautkan WhatsApp - Bot Pengingat Minum Obat</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --card-border: #e2e8f0;
      --text-main: #0f172a;
      --text-muted: #475569;
      --text-subtle: #64748b;
      --primary: #0f766e;
      --primary-light: #f0fdfa;
      --primary-border: #ccfbf1;
      --status-waiting-bg: #fefce8;
      --status-waiting-text: #854d0e;
      --status-waiting-border: #fef08a;
      --status-ready-bg: #f0fdf4;
      --status-ready-text: #166534;
      --status-ready-border: #bbf7d0;
      --status-connected-bg: #ecfdf5;
      --status-connected-text: #065f46;
      --status-connected-border: #a7f3d0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    body {
      background-color: var(--bg);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      max-width: 440px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 28px 24px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05), 0 10px 25px -5px rgba(15, 23, 42, 0.04);
      text-align: center;
    }
    .header-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      background: var(--primary-light);
      color: var(--primary);
      border: 1px solid var(--primary-border);
      margin-bottom: 16px;
    }
    h1 {
      font-size: 20px;
      font-weight: 700;
      color: var(--text-main);
      letter-spacing: -0.01em;
      margin-bottom: 6px;
    }
    .subtitle {
      font-size: 13px;
      color: var(--text-muted);
      line-height: 1.5;
      margin-bottom: 20px;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 18px;
      transition: all 0.2s ease;
    }
    .status-badge.waiting {
      background: var(--status-waiting-bg);
      color: var(--status-waiting-text);
      border: 1px solid var(--status-waiting-border);
    }
    .status-badge.ready {
      background: var(--status-ready-bg);
      color: var(--status-ready-text);
      border: 1px solid var(--status-ready-border);
    }
    .status-badge.connected {
      background: var(--status-connected-bg);
      color: var(--status-connected-text);
      border: 1px solid var(--status-connected-border);
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
    }
    .qr-container {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 12px;
      width: 100%;
      max-width: 260px;
      aspect-ratio: 1;
      margin: 0 auto 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .qr-container img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }
    .spinner {
      width: 36px;
      height: 36px;
      border: 3px solid #e2e8f0;
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .steps-card {
      text-align: left;
      background: #f8fafc;
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 14px 16px;
      margin-top: 16px;
    }
    .steps-card h2 {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-subtle);
      margin-bottom: 10px;
    }
    .step-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 12.5px;
      color: var(--text-muted);
      line-height: 1.5;
      margin-bottom: 8px;
    }
    .step-item:last-child {
      margin-bottom: 0;
    }
    .step-num {
      flex-shrink: 0;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #e2e8f0;
      color: #334155;
      font-size: 11px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 2px;
    }
    .step-item strong {
      color: var(--text-main);
      font-weight: 600;
    }
    .success-view {
      display: none;
      padding: 16px 8px;
    }
    .success-icon-wrap {
      width: 48px;
      height: 48px;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      color: #059669;
    }
    .success-view h2 {
      font-size: 18px;
      font-weight: 700;
      color: #065f46;
      margin-bottom: 6px;
    }
    .success-view p {
      font-size: 13px;
      color: var(--text-muted);
      line-height: 1.6;
    }
    .page-footer {
      text-align: center;
      margin-top: 16px;
      font-size: 11.5px;
      color: var(--text-subtle);
    }
    @media (max-width: 400px) {
      .card {
        padding: 22px 16px;
      }
      h1 {
        font-size: 18px;
      }
      .qr-container {
        max-width: 220px;
      }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header-tag">Penelitian Kepatuhan Pasien</div>

      <h1>Tautkan Nomor Bot</h1>
      <p class="subtitle">Pindai kode QR berikut melalui WhatsApp di ponsel Anda untuk menyambungkan bot ke sistem.</p>

      <div id="badgeStatus" class="status-badge waiting">
        <span class="status-dot"></span>
        <span id="badgeText">Menyiapkan koneksi WhatsApp...</span>
      </div>

      <div id="qrSection">
        <div class="qr-container">
          <div id="loadingSpinner" class="spinner"></div>
          <img id="qrImage" style="display:none;" alt="Kode QR WhatsApp">
        </div>

        <div class="steps-card">
          <h2>Petunjuk Pemindaian</h2>
          <div class="step-item">
            <span class="step-num">1</span>
            <div>Buka aplikasi <strong>WhatsApp</strong> di ponsel Anda.</div>
          </div>
          <div class="step-item">
            <span class="step-num">2</span>
            <div>Ketuk <strong>Titik Tiga ⋮</strong> (Android) atau <strong>Pengaturan ⚙</strong> (iPhone).</div>
          </div>
          <div class="step-item">
            <span class="step-num">3</span>
            <div>Pilih menu <strong>Perangkat Tertaut</strong>, lalu ketuk <strong>Tautkan Perangkat</strong>.</div>
          </div>
          <div class="step-item">
            <span class="step-num">4</span>
            <div>Arahkan kamera ponsel Anda tepat ke kode QR di atas.</div>
          </div>
        </div>
      </div>

      <div id="successSection" class="success-view">
        <div class="success-icon-wrap">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <h2>WhatsApp Berhasil Terhubung</h2>
        <p>
          Sesi bot pengingat obat sudah aktif di server.<br>
          Halaman ini dapat Anda tutup dengan aman.
        </p>
      </div>
    </div>

    <div class="page-footer">
      Status koneksi otomatis diperbarui secara langsung
    </div>
  </div>

  <script>
    let currentDataUrl = '';

    async function checkStatus() {
      try {
        const res = await fetch('/qr-status');
        const data = await res.json();

        const badge = document.getElementById('badgeStatus');
        const badgeText = document.getElementById('badgeText');
        const qrSection = document.getElementById('qrSection');
        const successSection = document.getElementById('successSection');
        const qrImage = document.getElementById('qrImage');
        const spinner = document.getElementById('loadingSpinner');

        if (data.status === 'connected') {
          badge.className = 'status-badge connected';
          badgeText.textContent = 'WhatsApp Terhubung';
          qrSection.style.display = 'none';
          successSection.style.display = 'block';
          return;
        }

        if (data.status === 'qr_ready' && data.qrImage) {
          badge.className = 'status-badge ready';
          badgeText.textContent = 'Kode QR Siap Dipindai';
          if (currentDataUrl !== data.qrImage) {
            currentDataUrl = data.qrImage;
            qrImage.src = data.qrImage;
            spinner.style.display = 'none';
            qrImage.style.display = 'block';
          }
        } else {
          badge.className = 'status-badge waiting';
          badgeText.textContent = 'Menyiapkan Kode QR...';
        }
      } catch (e) {
        console.warn('Gagal memuat status QR:', e);
      }
    }

    checkStatus();
    setInterval(checkStatus, 1500);
  </script>
</body>
</html>`;
}



/**
 * Memulai HTTP server untuk menampilkan live web QR code.
 * @param {number|string} [port] Port listening
 * @returns {http.Server}
 */
export function startQrServer(port = null) {
  if (server) {
    return server;
  }

  const listenPort = Number(port || process.env.QR_PORT || process.env.PORT || process.env.SERVER_PORT || 3000);

  server = http.createServer((req, res) => {
    const url = req.url || '/';

    if (url === '/' || url === '/index.html') {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      res.end(renderQrPage());
      return;
    }

    if (url === '/qr-status') {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({
        status: connectionStatus,
        qrImage: currentQrDataUrl,
        lastUpdatedAt,
        user: connectedUser?.id || null
      }));
      return;
    }

    if (url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, status: connectionStatus }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  server.listen(listenPort, '0.0.0.0', () => {
    logger.info({ port: listenPort }, `Live QR Web Server aktif pada port ${listenPort}`);
  });

  server.on('error', (err) => {
    logger.error({ err: err.message, port: listenPort }, 'Error pada Live QR Web Server');
  });

  return server;
}

/**
 * Menghentikan HTTP server QR code secara aman.
 * @returns {Promise<void>}
 */
export function stopQrServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        server = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}
