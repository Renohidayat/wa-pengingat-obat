#!/usr/bin/env node

/**
 * Script CLI untuk mengekspor data kepatuhan ke Excel sesuai PRD §7 (FR-40).
 * Penggunaan:
 *   npm run export
 *   node scripts/export-excel.js [optional-output-path.xlsx]
 */

import { getConfig } from '../src/config.js';
import { connectDb, disconnectDb } from '../src/db/connection.js';
import { exportAdherenceToExcel } from '../src/services/export.js';
import { logger } from '../src/utils/logger.js';

async function main() {
  const config = getConfig();
  const outputPath = process.argv[2];

  logger.info('Menghubungkan ke database MongoDB...');
  await connectDb(config.MONGODB_URI);

  try {
    logger.info('Memulai proses ekspor data kepatuhan ke Excel...');
    const result = await exportAdherenceToExcel(outputPath);

    console.log('\n========================================');
    console.log('  EKSPOR DATA KEPATUHAN BERHASIL');
    console.log('========================================');
    console.log(`Lokasi File   : ${result.filePath}`);
    console.log(`Total Pasien  : ${result.totalPatients}`);
    console.log(`Total Log     : ${result.totalLogs}`);
    console.log('========================================\n');
  } catch (error) {
    logger.error({ err: error.message }, 'Gagal mengekspor data kepatuhan');
    process.exitCode = 1;
  } finally {
    await disconnectDb();
    logger.info('Koneksi database telah ditutup');
  }
}

main().catch((err) => {
  console.error('Fatal error saat ekspor:', err);
  process.exit(1);
});
