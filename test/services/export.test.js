import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import {
  buildAdherenceRows,
  buildPatientSummaryRows,
  createExportWorkbook,
  exportAdherenceToExcel
} from '../../src/services/export.js';
import { PATIENT_STATE, REMINDER_STATUS } from '../../src/utils/constants.js';

describe('Export Service (FR-40: Excel Export)', () => {
  const mockPatient1 = {
    _id: 'p-001',
    noRM: 'RM-001',
    nama: 'Sukanti',
    jid: '6281111111@s.whatsapp.net',
    state: PATIENT_STATE.ACTIVE,
    jamMinum: '07:00',
    registeredAt: new Date('2026-10-10T01:00:00Z')
  };

  const mockPatient2 = {
    _id: 'p-002',
    noRM: 'RM-002',
    nama: 'Budi Santoso',
    jid: '6282222222@s.whatsapp.net',
    state: PATIENT_STATE.ACTIVE,
    jamMinum: '19:00',
    registeredAt: new Date('2026-10-11T01:00:00Z')
  };

  const mockLogs = [
    {
      _id: 'l-001',
      patientId: mockPatient1,
      tanggal: '2026-10-11',
      jadwal: '07:00',
      reminder1At: new Date('2026-10-11T00:00:00Z'), // 07:00 WIB
      reminder2At: null,
      confirmedAt: new Date('2026-10-11T00:10:00Z'), // 07:10 WIB
      status: REMINDER_STATUS.TEPAT_WAKTU
    },
    {
      _id: 'l-002',
      patientId: mockPatient1,
      tanggal: '2026-10-12',
      jadwal: '07:00',
      reminder1At: new Date('2026-10-12T00:00:00Z'),
      reminder2At: new Date('2026-10-12T00:30:00Z'),
      confirmedAt: new Date('2026-10-12T00:45:00Z'),
      status: REMINDER_STATUS.TERLAMBAT
    },
    {
      _id: 'l-003',
      patientId: mockPatient2,
      tanggal: '2026-10-12',
      jadwal: '19:00',
      reminder1At: new Date('2026-10-12T12:00:00Z'),
      reminder2At: new Date('2026-10-12T12:30:00Z'),
      confirmedAt: null,
      status: REMINDER_STATUS.TIDAK_KONFIRMASI
    }
  ];

  describe('buildAdherenceRows', () => {
    it('menyusun baris log kepatuhan dengan format yang tepat', () => {
      const rows = buildAdherenceRows(mockLogs);
      assert.equal(rows.length, 3);

      assert.equal(rows[0].no, 1);
      assert.equal(rows[0].tanggal, '2026-10-11');
      assert.equal(rows[0].noRM, 'RM-001');
      assert.equal(rows[0].nama, 'Sukanti');
      assert.equal(rows[0].jadwal, '07:00');
      assert.equal(rows[0].reminder1At, '2026-10-11 07:00:00');
      assert.equal(rows[0].reminder2At, '-');
      assert.equal(rows[0].confirmedAt, '2026-10-11 07:10:00');
      assert.equal(rows[0].status, REMINDER_STATUS.TEPAT_WAKTU);

      assert.equal(rows[2].noRM, 'RM-002');
      assert.equal(rows[2].status, REMINDER_STATUS.TIDAK_KONFIRMASI);
      assert.equal(rows[2].confirmedAt, '-');
    });

    it('mengurutkan log berdasarkan tanggal dan jadwal', () => {
      const unsorted = [
        { tanggal: '2026-10-15', jadwal: '19:00' },
        { tanggal: '2026-10-14', jadwal: '07:00' },
        { tanggal: '2026-10-15', jadwal: '07:00' }
      ];
      const rows = buildAdherenceRows(unsorted);
      assert.equal(rows[0].tanggal, '2026-10-14');
      assert.equal(rows[1].tanggal, '2026-10-15');
      assert.equal(rows[1].jadwal, '07:00');
      assert.equal(rows[2].tanggal, '2026-10-15');
      assert.equal(rows[2].jadwal, '19:00');
    });
  });

  describe('buildPatientSummaryRows', () => {
    it('menghitung statistik kepatuhan per pasien secara akurat', () => {
      const rows = buildPatientSummaryRows([mockPatient1, mockPatient2], mockLogs);
      assert.equal(rows.length, 2);

      // Pasien 1 (Sukanti): 2 log (1 Tepat Waktu, 1 Terlambat)
      const p1 = rows.find((r) => r.noRM === 'RM-001');
      assert.ok(p1);
      assert.equal(p1.nama, 'Sukanti');
      assert.equal(p1.nomorWa, '6281111111');
      assert.equal(p1.totalJadwal, 2);
      assert.equal(p1.tepatWaktu, 1);
      assert.equal(p1.terlambat, 1);
      assert.equal(p1.tidakKonfirmasi, 0);
      assert.equal(p1.persenTepatWaktu, '50.0%');
      assert.equal(p1.persenTotalPatuh, '100.0%');

      // Pasien 2 (Budi): 1 log (1 Tidak Konfirmasi)
      const p2 = rows.find((r) => r.noRM === 'RM-002');
      assert.ok(p2);
      assert.equal(p2.totalJadwal, 1);
      assert.equal(p2.tepatWaktu, 0);
      assert.equal(p2.terlambat, 0);
      assert.equal(p2.tidakKonfirmasi, 1);
      assert.equal(p2.persenTepatWaktu, '0.0%');
      assert.equal(p2.persenTotalPatuh, '0.0%');
    });

    it('menangani pasien baru tanpa riwayat jadwal', () => {
      const patientZero = {
        _id: 'p-zero',
        noRM: 'RM-999',
        nama: 'Pasien Baru',
        jid: '628999@s.whatsapp.net',
        state: PATIENT_STATE.ACTIVE,
        jamMinum: '08:00'
      };

      const rows = buildPatientSummaryRows([patientZero], []);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].totalJadwal, 0);
      assert.equal(rows[0].persenTepatWaktu, '0.0%');
      assert.equal(rows[0].persenTotalPatuh, '0.0%');
    });
  });

  describe('createExportWorkbook', () => {
    it('menghasilkan workbook dengan 2 sheet dan header yang sesuai', () => {
      const wb = createExportWorkbook({
        patients: [mockPatient1, mockPatient2],
        reminderLogs: mockLogs
      });

      assert.ok(wb);
      const sheet1 = wb.getWorksheet('Log Kepatuhan');
      const sheet2 = wb.getWorksheet('Rekap Pasien');

      assert.ok(sheet1, 'Sheet Log Kepatuhan harus ada');
      assert.ok(sheet2, 'Sheet Rekap Pasien harus ada');

      // Header row + 3 data rows = 4 baris
      assert.equal(sheet1.rowCount, 4);
      // Header row + 2 data rows = 3 baris
      assert.equal(sheet2.rowCount, 3);

      // Verifikasi kolom sheet 1
      assert.equal(sheet1.getRow(1).getCell(1).value, 'No');
      assert.equal(sheet1.getRow(1).getCell(2).value, 'Tanggal');
      assert.equal(sheet1.getRow(1).getCell(3).value, 'No. RM');
      assert.equal(sheet1.getRow(1).getCell(4).value, 'Nama Pasien');
      assert.equal(sheet1.getRow(1).getCell(9).value, 'Status Kepatuhan');

      // Verifikasi kolom sheet 2
      assert.equal(sheet2.getRow(1).getCell(1).value, 'No');
      assert.equal(sheet2.getRow(1).getCell(2).value, 'No. RM');
      assert.equal(sheet2.getRow(1).getCell(8).value, 'Total Jadwal');
      assert.equal(sheet2.getRow(1).getCell(15).value, 'Total Patuh (%)');
    });
  });

  describe('exportAdherenceToExcel (Menulis File)', () => {
    const testOutputPath = path.resolve('exports/test-export.xlsx');

    afterEach(() => {
      if (fs.existsSync(testOutputPath)) {
        fs.unlinkSync(testOutputPath);
      }
    });

    it('berhasil menulis file .xlsx yang valid dan dapat dibaca kembali', async () => {
      const result = await exportAdherenceToExcel(testOutputPath, {
        patients: [mockPatient1, mockPatient2],
        reminderLogs: mockLogs
      });

      assert.equal(result.totalPatients, 2);
      assert.equal(result.totalLogs, 3);
      assert.ok(fs.existsSync(testOutputPath), 'File output harus ada di disk');

      // Baca kembali file untuk verifikasi integritas
      const readWb = new ExcelJS.Workbook();
      await readWb.xlsx.readFile(testOutputPath);

      const s1 = readWb.getWorksheet('Log Kepatuhan');
      const s2 = readWb.getWorksheet('Rekap Pasien');

      assert.ok(s1);
      assert.ok(s2);
      assert.equal(s1.rowCount, 4);
      assert.equal(s2.rowCount, 3);
    });
  });
});
