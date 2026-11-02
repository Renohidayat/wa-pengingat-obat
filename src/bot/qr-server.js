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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tautkan WhatsApp - Bot Pengingat Minum Obat</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: #111827;
      --card-border: #1f2937;
      --primary: #2563eb;
      --success: #10b981;
      --warning: #f59e0b;
      --text: #f3f4f6;
      --text-muted: #9ca3af;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Plus Jakarta Sans', sans-serif;
    }
    body {
      background: radial-gradient(circle at 50% 0%, #1e293b 0%, var(--bg) 75%);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .container {
      width: 100%;
      max-width: 480px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      padding: 32px 28px;
      box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.6);
      text-align: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 20px;
    }
    .badge.ready {
      background: rgba(37, 99, 235, 0.15);
      color: #60a5fa;
      border: 1px solid rgba(37, 99, 235, 0.3);
    }
    .badge.connected {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .badge.waiting {
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }
    h1 {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin-bottom: 8px;
    }
    .subtitle {
      font-size: 14px;
      color: var(--text-muted);
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .qr-frame {
      background: #ffffff;
      padding: 16px;
      border-radius: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 280px;
      min-height: 280px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
      position: relative;
    }
    .qr-frame img {
      width: 280px;
      height: 280px;
      display: block;
      border-radius: 8px;
    }
    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid #e2e8f0;
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .instructions {
      text-align: left;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      padding: 16px;
      margin-top: 24px;
      font-size: 13px;
      color: var(--text-muted);
    }
    .instructions ol {
      padding-left: 20px;
      line-height: 1.7;
    }
    .instructions strong {
      color: var(--text);
    }
    .success-box {
      display: none;
      padding: 32px 16px;
    }
    .success-icon {
      font-size: 56px;
      margin-bottom: 16px;
    }
    .success-title {
      font-size: 20px;
      font-weight: 700;
      color: var(--success);
      margin-bottom: 8px;
    }
    .success-desc {
      font-size: 14px;
      color: var(--text-muted);
      line-height: 1.6;
    }
    .footer {
      margin-top: 24px;
      font-size: 12px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="container">
    <div id="badgeStatus" class="badge waiting">
      <span class="pulse-dot"></span>
      <span id="badgeText">Menghubungkan ke WhatsApp...</span>
    </div>

    <h1>Tautkan Nomor Bot</h1>
    <p class="subtitle">Pindai kode QR berikut menggunakan WhatsApp di ponsel Anda agar bot dapat aktif.</p>

    <div id="qrSection">
      <div class="qr-frame">
        <div id="loadingSpinner" class="spinner"></div>
        <img id="qrImage" style="display:none;" alt="Kode QR WhatsApp">
      </div>

      <div class="instructions">
        <ol>
          <li>Buka aplikasi <strong>WhatsApp</strong> di ponsel Anda</li>
          <li>Ketuk <strong>Titik Tiga / Pengaturan</strong> di pojok atas</li>
          <li>Pilih <strong>Perangkat Tertaut (Linked Devices)</strong></li>
          <li>Ketuk <strong>Tautkan Perangkat</strong> lalu arahkan kamera ke barcode di atas</li>
        </ol>
      </div>
    </div>

    <div id="successSection" class="success-box">
      <div class="success-icon">🎉</div>
      <div class="success-title">WhatsApp Berhasil Terhubung!</div>
      <p class="success-desc">
        Sesi bot pengingat obat sudah aktif di server.<br>
        Anda dapat menutup halaman ini sekarang.
      </p>
    </div>

    <p class="footer">Kode QR otomatis diperbarui secara live setiap saat</p>
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
          badge.className = 'badge connected';
          badgeText.textContent = 'WhatsApp Terhubung';
          qrSection.style.display = 'none';
          successSection.style.display = 'block';
          return;
        }

        if (data.status === 'qr_ready' && data.qrImage) {
          badge.className = 'badge ready';
          badgeText.textContent = 'Kode QR Siap Di-scan';
          if (currentDataUrl !== data.qrImage) {
            currentDataUrl = data.qrImage;
            qrImage.src = data.qrImage;
            spinner.style.display = 'none';
            qrImage.style.display = 'block';
          }
        } else {
          badge.className = 'badge waiting';
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
