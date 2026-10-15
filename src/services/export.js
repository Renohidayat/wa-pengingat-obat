/**
 * Service ekspor log kepatuhan dan rekap pasien ke file Excel (.xlsx) sesuai PRD §7 (FR-40).
 */

import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { Patient, ReminderLog } from '../db/models.js';
import { REMINDER_STATUS } from '../utils/constants.js';
import { formatDateWib, formatDateTimeWib } from '../utils/time.js';
import { logger } from '../utils/logger.js';

/**
 * Menyusun data baris untuk sheet Log Kepatuhan (FR-40).
 * @param {Array<any>} reminderLogs
 * @returns {Array<object>}
 */
export function buildAdherenceRows(reminderLogs = []) {
  // Urutkan berdasarkan tanggal (ASC), jadwal (ASC)
  const sortedLogs = [...reminderLogs].sort((a, b) => {
    const dateComp = (a.tanggal || '').localeCompare(b.tanggal || '');
    if (dateComp !== 0) return dateComp;
    return (a.jadwal || '').localeCompare(b.jadwal || '');
  });

  return sortedLogs.map((log, index) => {
    const patient = log.patientId && typeof log.patientId === 'object' ? log.patientId : {};
    return {
      no: index + 1,
      tanggal: log.tanggal || '-',
      noRM: patient.noRM || '-',
      nama: patient.nama || '-',
      jadwal: log.jadwal || '-',
      reminder1At: formatDateTimeWib(log.reminder1At),
      reminder2At: formatDateTimeWib(log.reminder2At),
      confirmedAt: formatDateTimeWib(log.confirmedAt),
      status: log.status || '-'
    };
  });
}

/**
 * Menyusun data baris untuk sheet Rekap Pasien (FR-40).
 * @param {Array<any>} patients
 * @param {Array<any>} reminderLogs
 * @returns {Array<object>}
 */
export function buildPatientSummaryRows(patients = [], reminderLogs = []) {
  // Urutkan pasien berdasarkan noRM (ASC)
  const sortedPatients = [...patients].sort((a, b) => {
    return (a.noRM || '').localeCompare(b.noRM || '', undefined, { numeric: true });
  });

  return sortedPatients.map((patient, index) => {
    const pIdStr = patient._id ? patient._id.toString() : '';

    const pLogs = reminderLogs.filter((log) => {
      const logPid =
        log.patientId && typeof log.patientId === 'object'
          ? log.patientId._id?.toString()
          : log.patientId?.toString();
      return logPid === pIdStr;
    });

    const totalJadwal = pLogs.length;
    let tepatWaktu = 0;
    let terlambat = 0;
    let tidakKonfirmasi = 0;
    let terlewatSistem = 0;
    let menunggu = 0;

    for (const log of pLogs) {
      if (log.status === REMINDER_STATUS.TEPAT_WAKTU) tepatWaktu++;
      else if (log.status === REMINDER_STATUS.TERLAMBAT) terlambat++;
      else if (log.status === REMINDER_STATUS.TIDAK_KONFIRMASI) tidakKonfirmasi++;
      else if (log.status === REMINDER_STATUS.TERLEWAT_SISTEM) terlewatSistem++;
      else if (log.status === REMINDER_STATUS.MENUNGGU) menunggu++;
    }

    const totalPatuh = tepatWaktu + terlambat;
    const persenTepatWaktu =
      totalJadwal > 0 ? `${((tepatWaktu / totalJadwal) * 100).toFixed(1)}%` : '0.0%';
    const persenTotalPatuh =
      totalJadwal > 0 ? `${((totalPatuh / totalJadwal) * 100).toFixed(1)}%` : '0.0%';

    const cleanPhone = patient.jid ? patient.jid.replace('@s.whatsapp.net', '') : '-';
    const regDateStr = patient.registeredAt ? formatDateWib(patient.registeredAt) : '-';

    return {
      no: index + 1,
      noRM: patient.noRM || '-',
      nama: patient.nama || '-',
      nomorWa: cleanPhone,
      state: patient.state || '-',
      jamMinum: patient.jamMinum || '-',
      registeredAt: regDateStr,
      totalJadwal,
      tepatWaktu,
      terlambat,
      tidakKonfirmasi,
      terlewatSistem,
      menunggu,
      persenTepatWaktu,
      persenTotalPatuh
    };
  });
}

/**
 * Menerapkan gaya header tabel pada baris sheet ExcelJS.
 * @param {ExcelJS.Row} row
 */
function applyHeaderStyle(row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E4D2B' } // Hijau bot/Puskesmas
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });
  row.height = 24;
}

/**
 * Membuat objek ExcelJS.Workbook lengkap dengan sheet Log Kepatuhan dan Rekap Pasien.
 * @param {{ patients: Array<any>, reminderLogs: Array<any> }} data
 * @returns {ExcelJS.Workbook}
 */
export function createExportWorkbook({ patients = [], reminderLogs = [] }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Dea Farida - PUSKESMAS Sukarasa';
  workbook.created = new Date();

  // 1. Sheet Log Kepatuhan
  const sheet1 = workbook.addWorksheet('Log Kepatuhan', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  sheet1.columns = [
    { header: 'No', key: 'no', width: 6 },
    { header: 'Tanggal', key: 'tanggal', width: 14 },
    { header: 'No. RM', key: 'noRM', width: 14 },
    { header: 'Nama Pasien', key: 'nama', width: 22 },
    { header: 'Jadwal Minum', key: 'jadwal', width: 14 },
    { header: 'Pengingat 1', key: 'reminder1At', width: 22 },
    { header: 'Pengingat 2', key: 'reminder2At', width: 22 },
    { header: 'Waktu Konfirmasi', key: 'confirmedAt', width: 22 },
    { header: 'Status Kepatuhan', key: 'status', width: 18 }
  ];

  applyHeaderStyle(sheet1.getRow(1));

  const logRows = buildAdherenceRows(reminderLogs);
  for (const rowData of logRows) {
    const row = sheet1.addRow(rowData);
    row.alignment = { vertical: 'middle' };
  }

  // 2. Sheet Rekap Pasien
  const sheet2 = workbook.addWorksheet('Rekap Pasien', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  sheet2.columns = [
    { header: 'No', key: 'no', width: 6 },
    { header: 'No. RM', key: 'noRM', width: 14 },
    { header: 'Nama Pasien', key: 'nama', width: 22 },
    { header: 'Nomor WA', key: 'nomorWa', width: 18 },
    { header: 'Status Pasien', key: 'state', width: 14 },
    { header: 'Jam Minum', key: 'jamMinum', width: 14 },
    { header: 'Tanggal Daftar', key: 'registeredAt', width: 16 },
    { header: 'Total Jadwal', key: 'totalJadwal', width: 14 },
    { header: 'Tepat Waktu', key: 'tepatWaktu', width: 14 },
    { header: 'Terlambat', key: 'terlambat', width: 14 },
    { header: 'Tidak Konfirmasi', key: 'tidakKonfirmasi', width: 16 },
    { header: 'Terlewat Sistem', key: 'terlewatSistem', width: 16 },
    { header: 'Menunggu', key: 'menunggu', width: 12 },
    { header: 'Tepat Waktu (%)', key: 'persenTepatWaktu', width: 16 },
    { header: 'Total Patuh (%)', key: 'persenTotalPatuh', width: 16 }
  ];

  applyHeaderStyle(sheet2.getRow(1));

  const patientRows = buildPatientSummaryRows(patients, reminderLogs);
  for (const rowData of patientRows) {
    const row = sheet2.addRow(rowData);
    row.alignment = { vertical: 'middle' };
  }

  return workbook;
}

/**
 * Mengekspor data kepatuhan ke file Excel pada path yang ditentukan.
 * @param {string} [customOutputPath]
 * @param {object} [options={}]
 * @returns {Promise<{ filePath: string, totalLogs: number, totalPatients: number }>}
 */
export async function exportAdherenceToExcel(customOutputPath, options = {}) {
  let patients = options.patients;
  let reminderLogs = options.reminderLogs;

  if (!patients) {
    patients = await Patient.find().sort({ noRM: 1 });
  }

  if (!reminderLogs) {
    reminderLogs = await ReminderLog.find().populate('patientId').sort({ tanggal: 1, jadwal: 1 });
  }

  const now = options.now || new Date();
  const dateStr = formatDateWib(now);

  const defaultDir = path.resolve('exports');
  const defaultPath = path.join(defaultDir, `rekap-kepatuhan-${dateStr}.xlsx`);
  const finalFilePath = customOutputPath ? path.resolve(customOutputPath) : defaultPath;

  // Pastikan direktori tujuan tersedia
  const targetDir = path.dirname(finalFilePath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const workbook = createExportWorkbook({ patients, reminderLogs });
  await workbook.xlsx.writeFile(finalFilePath);

  logger.info(
    { filePath: finalFilePath, totalPatients: patients.length, totalLogs: reminderLogs.length },
    'Ekspor file Excel berhasil'
  );

  return {
    filePath: finalFilePath,
    totalPatients: patients.length,
    totalLogs: reminderLogs.length
  };
}
