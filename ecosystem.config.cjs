/**
 * Konfigurasi PM2 Process Manager untuk lingkungan produksi.
 * Sesuai panduan di docs/DEPLOY.md (Issue #14).
 */

module.exports = {
  apps: [
    {
      name: 'wa-bot',
      script: 'src/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        TZ: 'Asia/Jakarta'
      }
    }
  ]
};
