#!/usr/bin/env bash
# Membuat label, milestone, dan 16 issue awal sesuai docs/PRD.md §15.
# Jalankan SEKALI dari dalam repo yang sudah punya remote GitHub:  bash scripts/setup-github.sh
set -euo pipefail

command -v gh >/dev/null || { echo "gh CLI belum terpasang"; exit 1; }
gh auth status >/dev/null || { echo "Belum login: jalankan 'gh auth login'"; exit 1; }
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo "Repo: $REPO"

# --- Label ---
mk_label() { gh label create "$1" --color "$2" --description "$3" --force >/dev/null; }
mk_label "type:feat"      "0e8a16" "Fitur baru"
mk_label "type:fix"       "d73a4a" "Perbaikan bug"
mk_label "type:chore"     "c5def5" "Setup/konfigurasi"
mk_label "type:docs"      "0075ca" "Dokumentasi"
mk_label "type:test"      "fbca04" "Pengujian"
mk_label "type:refactor"  "d4c5f9" "Rapikan kode"
mk_label "area:registration" "1d76db" "Registrasi pasien (A)"
mk_label "area:reminder"  "5319e7" "Pengingat obat (B)"
mk_label "area:data"      "bfd4f2" "Database/ekspor"
mk_label "area:admin"     "e99695" "Perintah admin"
mk_label "area:infra"     "ededed" "Infrastruktur/deploy"
mk_label "priority:P0"    "b60205" "Wajib v1"
mk_label "priority:P1"    "ff9f1c" "Penting"

# --- Milestone ---
mk_ms() { gh api "repos/$REPO/milestones" -f title="$1" -f description="$2" >/dev/null 2>&1 || true; }
mk_ms "M0 Fondasi"           "Repo, CI, config, database"
mk_ms "M1 Registrasi (A)"    "Koneksi WA dan alur registrasi"
mk_ms "M2 Pengingat (B)"     "Pengingat harian, konfirmasi, status"
mk_ms "M3 Data & Admin"      "Ekspor Excel dan perintah admin"
mk_ms "M4 Kualitas & Rilis"  "Test, deploy, hardening, UAT"

# --- Issue ---
mk_issue() { # title milestone labels body
  gh issue create --title "$1" --milestone "$2" --label "$3" --body "$4" >/dev/null
  echo "dibuat: $1"
}
FOOT=$'\n\nRujukan: docs/PRD.md. Ikuti AGENTS.md (1 issue = 1 branch = 1 PR).'

mk_issue "chore: setup repo, struktur folder, CI, README" "M0 Fondasi" "type:chore,area:infra,priority:P0" \
"Siapkan struktur sesuai PRD §10, .gitignore (node_modules, .env, auth_info, exports), .env.example, README, workflow CI.

- [ ] Struktur folder sesuai PRD
- [ ] .gitignore mencegah rahasia masuk
- [ ] CI berjalan hijau di PR$FOOT"

mk_issue "refactor: impor kerangka awal dan hapus fitur edukasi/penutup" "M0 Fondasi" "type:refactor,area:reminder,priority:P0" \
"Impor kerangka awal (wa-pengingat-obat.zip) sebagai baseline, lalu sesuaikan ke scope v1.

- [ ] Hapus edukasi (scheduler, silabus, template) dan pesan penutup
- [ ] Pesan Registrasi Berhasil hanya menyebut pengingat harian
- [ ] Pecah ke struktur folder PRD §10
- [ ] Ubah aturan status sesuai PRD §6.2 (Tidak Konfirmasi di 23:59)$FOOT"

mk_issue "feat(db): config env, koneksi MongoDB, model patient & reminder_log" "M0 Fondasi" "type:feat,area:data,priority:P0" \
"- [ ] src/config.js memvalidasi env wajib
- [ ] Model sesuai PRD §9
- [ ] Unique index patientId+tanggal dan noRM (partial)$FOOT"

mk_issue "feat(bot): koneksi WhatsApp Baileys, sesi persisten, auto-reconnect" "M1 Registrasi (A)" "type:feat,area:registration,priority:P0" \
"- [ ] Scan QR di terminal, sesi di auth_info/
- [ ] Reconnect otomatis, logout ditangani jelas
- [ ] Abaikan grup/status/fromMe (FR-02)
- [ ] Fungsi send() dengan jeda acak (FR-20)$FOOT"

mk_issue "feat(registration): alur DAFTAR, parser Nama/RM/Jam, validasi" "M1 Registrasi (A)" "type:feat,area:registration,priority:P0" \
"FR-03 s.d. FR-07.

- [ ] DAFTAR memulai registrasi
- [ ] Parser jam 07.00 / 7.00 / 07:00, validasi 00:00-23:59
- [ ] Format salah -> contoh format, state tidak berubah
- [ ] RM duplikat ditolak sopan
- [ ] Pesan Registrasi Berhasil tanpa edukasi$FOOT"

mk_issue "docs: link/QR wa.me dan naskah perkenalan peneliti" "M1 Registrasi (A)" "type:docs,area:registration,priority:P1" \
"- [ ] docs/ONBOARDING.md: cara membuat link wa.me?text=DAFTAR dan QR
- [ ] Naskah perkenalan A.1 siap salin$FOOT"

mk_issue "feat(scheduler): pengingat 1 harian, idempoten, catch-up" "M2 Pengingat (B)" "type:feat,area:reminder,priority:P0" \
"FR-10 s.d. FR-13.

- [ ] Cron tiap menit, TZ Asia/Jakarta
- [ ] Tidak dikirim pada hari registrasi
- [ ] Maksimal 1 log per pasien per hari
- [ ] Catch-up <= 60 menit; lebih dari itu status Terlewat Sistem$FOOT"

mk_issue "feat(adherence): konfirmasi SUDAH dan penentuan status" "M2 Pengingat (B)" "type:feat,area:reminder,priority:P0" \
"FR-14 s.d. FR-16, FR-19.

- [ ] Varian SUDAH/SUDAH MINUM/SDH/UDAH
- [ ] Tepat Waktu vs Terlambat, simpan confirmedAt
- [ ] Konfirmasi ganda tidak mengubah log$FOOT"

mk_issue "feat(scheduler): pengingat ke-2 setelah 30 menit" "M2 Pengingat (B)" "type:feat,area:reminder,priority:P0" \
"FR-17.

- [ ] Kirim hanya jika status masih Menunggu
- [ ] Sekali per hari per pasien
- [ ] Teks tanpa placeholder [Nama Obat]$FOOT"

mk_issue "feat(scheduler): finalisasi harian Tidak Konfirmasi (23:59)" "M2 Pengingat (B)" "type:feat,area:reminder,priority:P0" \
"FR-18.

- [ ] Log Menunggu -> Tidak Konfirmasi pada 23:59 WIB
- [ ] Aman dijalankan ulang$FOOT"

mk_issue "feat(export): ekspor log kepatuhan ke Excel" "M3 Data & Admin" "type:feat,area:data,priority:P0" \
"FR-40.

- [ ] npm run export membuat .xlsx
- [ ] Sheet Log Kepatuhan dan Rekap Pasien
- [ ] Jumlah baris cocok dengan database$FOOT"

mk_issue "feat(admin): perintah !rekap, !pasien, !stop <RM>" "M3 Data & Admin" "type:feat,area:admin,priority:P1" \
"FR-30 s.d. FR-32.

- [ ] Hanya nomor di ADMIN_NUMBERS
- [ ] Nomor lain diabaikan/ditolak$FOOT"

mk_issue "test: unit test parser, waktu WIB, status, idempotensi" "M4 Kualitas & Rilis" "type:test,priority:P0" \
"- [ ] node --test dijalankan di CI
- [ ] Cakupan: parser, fungsi waktu, penentuan status, catch-up, idempotensi$FOOT"

mk_issue "docs: panduan deploy (pm2/VM) dan backup sesi WA" "M4 Kualitas & Rilis" "type:docs,area:infra,priority:P0" \
"- [ ] docs/DEPLOY.md: pm2, auto-start, update kode
- [ ] Prosedur backup/restore auth_info/ dan re-scan QR
- [ ] Peringatan: hosting yang tidur tidak cocok$FOOT"

mk_issue "chore: hardening (logging, graceful shutdown, isolasi error)" "M4 Kualitas & Rilis" "type:chore,area:infra,priority:P1" \
"- [ ] pino, tanpa data pasien di level info
- [ ] SIGTERM menutup koneksi rapi
- [ ] Error satu pasien tidak menghentikan batch$FOOT"

mk_issue "test: UAT dengan 2-3 nomor uji + checklist PRD §13" "M4 Kualitas & Rilis" "type:test,priority:P0" \
"- [ ] Semua poin PRD §13 dijalankan dan dicatat hasilnya
- [ ] Uji restart server di tengah hari
- [ ] Hasil UAT ditulis di komentar issue$FOOT"

echo "Selesai. Lihat: gh issue list"
