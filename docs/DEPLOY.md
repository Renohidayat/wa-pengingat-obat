# Panduan Deployment & Operasional

Dokumentasi ini akan dilengkapi pada Issue #14 (Panduan deploy pm2/VM dan backup sesi WA).

## Rencana Operasional
- Menjalankan bot via PM2 untuk menjaga proses selalu hidup (auto-restart).
- Menjaga persistensi folder `auth_info/` dan backup berkala.
- Monitoring log melalui file output log atau pino.
