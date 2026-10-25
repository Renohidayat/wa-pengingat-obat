import os
from docx import Document
from docx.shared import Inches, Pt, Cm, RGBColor, Emu
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls, qn

BLACK = RGBColor(0, 0, 0)
DARK = RGBColor(30, 30, 30)
FONT = "Times New Roman"


# ── table helpers ──────────────────────────────────────────────────────

def set_table_borders(table, color="000000", sz="4"):
    """Apply thin black borders to every edge and inner line of a table."""
    tbl = table._tbl
    tblPr = tbl.tblPr if tbl.tblPr is not None else tbl._add_tblPr()
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'  <w:top w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'  <w:left w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'  <w:bottom w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'  <w:right w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'  <w:insideH w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'  <w:insideV w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)


def set_cell_shading(cell, hex_color):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
    tcPr.append(shd)


def set_cell_margins(cell, top=50, bottom=50, left=80, right=80):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(
        f'<w:tcMar {nsdecls("w")}>'
        f'<w:top w:w="{top}" w:type="dxa"/>'
        f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
        f'<w:left w:w="{left}" w:type="dxa"/>'
        f'<w:right w:w="{right}" w:type="dxa"/>'
        f'</w:tcMar>'
    )
    tcPr.append(tcMar)


def write_cell(cell, text, bold=False, size=11, bg=None, color=BLACK):
    if bg:
        set_cell_shading(cell, bg)
    set_cell_margins(cell)
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.space_before = Pt(1)
    p.paragraph_format.space_after = Pt(1)
    r = p.add_run(text)
    r.font.name = FONT
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.color.rgb = color


# ── document helpers ───────────────────────────────────────────────────

def configure_styles(doc):
    """Set up Heading 1 and Heading 2 styles for proper TOC linking."""
    s1 = doc.styles['Heading 1']
    s1.font.name = FONT
    s1.font.size = Pt(14)
    s1.font.bold = True
    s1.font.color.rgb = BLACK
    s1.font.italic = False
    s1.paragraph_format.space_before = Pt(18)
    s1.paragraph_format.space_after = Pt(8)
    s1.paragraph_format.keep_with_next = True
    # Remove underline and any colored highlight
    s1.font.underline = False
    # Fix: override element to remove theme color
    rPr = s1.element.find(qn('w:rPr'))
    if rPr is not None:
        for c_elem in rPr.findall(qn('w:color')):
            rPr.remove(c_elem)
        color_el = parse_xml(f'<w:color {nsdecls("w")} w:val="000000"/>')
        rPr.append(color_el)

    s2 = doc.styles['Heading 2']
    s2.font.name = FONT
    s2.font.size = Pt(12)
    s2.font.bold = True
    s2.font.color.rgb = BLACK
    s2.font.italic = False
    s2.paragraph_format.space_before = Pt(12)
    s2.paragraph_format.space_after = Pt(6)
    s2.paragraph_format.keep_with_next = True
    s2.font.underline = False
    rPr2 = s2.element.find(qn('w:rPr'))
    if rPr2 is not None:
        for c_elem in rPr2.findall(qn('w:color')):
            rPr2.remove(c_elem)
        color_el2 = parse_xml(f'<w:color {nsdecls("w")} w:val="000000"/>')
        rPr2.append(color_el2)

    # Normal style
    sn = doc.styles['Normal']
    sn.font.name = FONT
    sn.font.size = Pt(12)
    sn.font.color.rgb = BLACK
    sn.paragraph_format.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE


def add_toc_field(doc):
    """Insert a live clickable Table of Contents field (updates on Ctrl+A F9 or right-click > Update)."""
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    # fldChar begin
    fc_begin = parse_xml(f'<w:fldChar {nsdecls("w")} w:fldCharType="begin"/>')
    r1 = p.add_run()
    r1._r.append(fc_begin)
    # instrText  –  \\h = hyperlinks, \\u = use heading styles
    r2 = p.add_run()
    instr = parse_xml(f'<w:instrText {nsdecls("w")} xml:space="preserve"> TOC \\o "1-2" \\h \\z \\u </w:instrText>')
    r2._r.append(instr)
    # fldChar separate
    fc_sep = parse_xml(f'<w:fldChar {nsdecls("w")} w:fldCharType="separate"/>')
    r3 = p.add_run()
    r3._r.append(fc_sep)
    # placeholder text
    r4 = p.add_run("(Klik kanan di sini → Perbarui Bidang / Update Field untuk memunculkan daftar isi)")
    r4.font.name = FONT
    r4.font.size = Pt(11)
    r4.font.color.rgb = RGBColor(120, 120, 120)
    r4.font.italic = True
    # fldChar end
    fc_end = parse_xml(f'<w:fldChar {nsdecls("w")} w:fldCharType="end"/>')
    r5 = p.add_run()
    r5._r.append(fc_end)


def para(doc, text, bold=False, indent=False, space_after=6, space_before=0, align=WD_ALIGN_PARAGRAPH.LEFT):
    p = doc.add_paragraph()
    p.alignment = align
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE
    if indent:
        p.paragraph_format.first_line_indent = Cm(1.25)
    r = p.add_run(text)
    r.font.name = FONT
    r.font.size = Pt(12)
    r.font.color.rgb = BLACK
    r.bold = bold
    return p


def add_table(doc, headers, rows):
    t = doc.add_table(rows=1 + len(rows), cols=len(headers))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = True
    set_table_borders(t)

    for i, h in enumerate(headers):
        write_cell(t.cell(0, i), h, bold=True, bg="E0E0E0")

    for r_idx, row_data in enumerate(rows):
        for c_idx, val in enumerate(row_data):
            write_cell(t.cell(r_idx + 1, c_idx), val)

    doc.add_paragraph().paragraph_format.space_after = Pt(4)


# ── main ───────────────────────────────────────────────────────────────

def create_manual():
    doc = Document()

    for section in doc.sections:
        section.top_margin = Cm(2.54)
        section.bottom_margin = Cm(2.54)
        section.left_margin = Cm(3)
        section.right_margin = Cm(3)

    configure_styles(doc)

    # ── HALAMAN JUDUL ──────────────────────────────────────────────────
    for _ in range(5):
        doc.add_paragraph().paragraph_format.space_after = Pt(0)

    for line in ["PANDUAN PENGGUNAAN", "BOT WHATSAPP", "PENGINGAT MINUM OBAT"]:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(2)
        r = p.add_run(line)
        r.font.name = FONT
        r.font.size = Pt(22)
        r.font.bold = True
        r.font.color.rgb = BLACK

    doc.add_paragraph().paragraph_format.space_after = Pt(20)

    for line in ["Disusun oleh:", "Dea Farida", "", "PUSKESMAS Sukarasa", "2026"]:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(4)
        r = p.add_run(line)
        r.font.name = FONT
        r.font.size = Pt(14)
        r.font.color.rgb = BLACK

    doc.add_page_break()

    # ── DAFTAR ISI (live field, clickable) ─────────────────────────────
    h_toc = doc.add_heading("DAFTAR ISI", level=1)
    h_toc.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_toc_field(doc)

    doc.add_page_break()

    # ==================================================================
    # BAB 1
    # ==================================================================
    doc.add_heading("1.  Tentang Bot Ini", level=1)

    para(doc,
         "Bot WhatsApp Pengingat Minum Obat adalah layanan pesan otomatis yang "
         "mengirimkan pengingat minum obat harian kepada pasien melalui WhatsApp. "
         "Bot ini sudah berjalan secara daring dan aktif 24 jam setiap hari, "
         "sehingga tidak perlu dinyalakan atau dimatikan secara manual.",
         indent=True)

    para(doc,
         "Sistem ini dibangun menggunakan Node.js dan MongoDB sebagai teknologi "
         "pendukung. Seluruh data tersimpan di server awan sehingga aman dan "
         "dapat diakses kapan saja.",
         indent=True)

    doc.add_heading("1.1  Kemampuan Utama", level=2)

    kemampuan = [
        "Menerima pendaftaran pasien baru secara mandiri melalui chat.",
        "Mengirim pengingat minum obat secara otomatis sesuai jadwal pasien.",
        "Mencatat kepatuhan pasien (Tepat Waktu, Terlambat, atau Tidak Konfirmasi).",
        "Mengirim pengingat susulan apabila pasien belum membalas dalam 30 menit.",
        "Menutup catatan harian secara otomatis pada pukul 23.59 WIB.",
        "Menyediakan perintah khusus bagi peneliti untuk memantau data dan mengunduh laporan.",
    ]
    for item in kemampuan:
        p = doc.add_paragraph(style='List Bullet')
        r = p.add_run(item)
        r.font.name = FONT
        r.font.size = Pt(12)
        r.font.color.rgb = BLACK

    # ==================================================================
    # BAB 2
    # ==================================================================
    doc.add_heading("2.  Cara Mendaftarkan Pasien Baru", level=1)

    para(doc,
         "Pendaftaran dilakukan langsung oleh pasien atau didampingi oleh "
         "peneliti maupun keluarga pasien melalui chat WhatsApp ke nomor bot. "
         "Berikut langkah-langkahnya.",
         indent=True)

    doc.add_heading("2.1  Langkah Pendaftaran", level=2)

    add_table(doc,
        ["Langkah", "Yang Dilakukan Pasien", "Balasan dari Bot"],
        [
            ["1. Mulai pendaftaran",
             "Kirim pesan berisi kata:\nDAFTAR",
             "Bot membalas dengan meminta data pasien:\n\"Silakan balas pesan ini dengan format:\nNama Lengkap / No. Rekam Medis / Jam Minum Obat\""],
            ["2. Kirim data",
             "Balas sesuai format yang diminta.\n\nContoh:\nSiti Aminah / 012345 / 07.00",
             "Bot memeriksa kelengkapan data.\nJika format salah, bot memberikan contoh yang benar agar pasien dapat mengetik ulang."],
            ["3. Pendaftaran berhasil",
             "(Data benar dan tersimpan)",
             "Bot mengirim pesan konfirmasi:\n\"Registrasi Berhasil. Pengingat minum obat setiap hari pukul 07.00 WIB akan dimulai besok.\""],
        ])

    doc.add_heading("2.2  Ketentuan Pendaftaran", level=2)

    ketentuan = [
        "Format data menggunakan tanda garis miring (/) sebagai pemisah.",
        "Jam minum obat menggunakan format 24 jam (misalnya 07.00 atau 19.30).",
        "Nomor Rekam Medis (RM) bersifat unik. Satu nomor RM hanya dapat digunakan oleh satu pasien.",
        "Pengingat tidak dikirim pada hari pendaftaran. Pengingat mulai aktif pada hari berikutnya.",
    ]
    for item in ketentuan:
        p = doc.add_paragraph(style='List Bullet')
        r = p.add_run(item)
        r.font.name = FONT
        r.font.size = Pt(12)
        r.font.color.rgb = BLACK

    # ==================================================================
    # BAB 3
    # ==================================================================
    doc.add_heading("3.  Cara Kerja Pengingat Harian", level=1)

    para(doc,
         "Setelah pasien terdaftar, bot bekerja secara otomatis setiap hari tanpa "
         "perlu campur tangan siapa pun. Berikut alur yang terjadi setiap harinya.",
         indent=True)

    doc.add_heading("3.1  Pengingat Pertama", level=2)
    para(doc,
         "Tepat pada jam minum obat yang sudah didaftarkan, bot mengirim pesan "
         "pengingat kepada pasien. Pesan tersebut berisi ajakan untuk segera "
         "minum obat dan instruksi agar pasien membalas dengan mengetik SUDAH "
         "setelah minum obat.",
         indent=True)

    doc.add_heading("3.2  Konfirmasi Tepat Waktu", level=2)
    para(doc,
         "Jika pasien membalas SUDAH dalam waktu kurang dari 30 menit setelah "
         "pengingat pertama, status kepatuhan pasien hari itu dicatat sebagai "
         "Tepat Waktu. Bot kemudian mengirim ucapan terima kasih.",
         indent=True)

    doc.add_heading("3.3  Pengingat Kedua", level=2)
    para(doc,
         "Jika setelah 30 menit pasien belum membalas, bot secara otomatis "
         "mengirim pengingat kedua. Apabila pasien baru membalas SUDAH setelah "
         "pengingat kedua ini terkirim, status kepatuhan dicatat sebagai Terlambat.",
         indent=True)

    doc.add_heading("3.4  Batas Akhir Hari", level=2)
    para(doc,
         "Jika hingga pukul 23.59 WIB pasien sama sekali tidak membalas, sistem "
         "secara otomatis menutup catatan hari itu dengan status Tidak Konfirmasi.",
         indent=True)

    doc.add_heading("3.5  Ringkasan Alur Harian", level=2)

    add_table(doc,
        ["Waktu", "Kejadian", "Status Kepatuhan"],
        [
            ["Jam minum obat\n(contoh: 07.00 WIB)",
             "Bot mengirim Pengingat Pertama.",
             "Menunggu"],
            ["0 \u2013 30 menit setelah pengingat",
             "Pasien membalas SUDAH.",
             "Tepat Waktu"],
            ["30 menit setelah pengingat",
             "Bot mengirim Pengingat Kedua\n(jika belum ada balasan).",
             "\u2013"],
            ["Setelah Pengingat Kedua",
             "Pasien membalas SUDAH.",
             "Terlambat"],
            ["Pukul 23.59 WIB",
             "Tidak ada balasan sepanjang hari.",
             "Tidak Konfirmasi"],
        ])

    # ==================================================================
    # BAB 4
    # ==================================================================
    doc.add_heading("4.  Daftar Perintah untuk Pasien", level=1)

    para(doc,
         "Berikut adalah seluruh perintah yang dapat digunakan oleh pasien "
         "melalui chat WhatsApp ke nomor bot. Seluruh perintah tidak membedakan "
         "huruf besar atau kecil.",
         indent=True)

    doc.add_heading("4.1  Perintah Utama Pasien", level=2)

    add_table(doc,
        ["Perintah", "Fungsi", "Keterangan"],
        [
            ["DAFTAR",
             "Memulai proses pendaftaran.",
             "Ketik kata DAFTAR lalu kirim. Bot akan memandu langkah selanjutnya."],
            ["Nama / No. RM / Jam\n\nContoh:\nSiti / 012345 / 07.00",
             "Mengirim data pendaftaran.",
             "Dikirim setelah bot meminta data. Gunakan tanda / sebagai pemisah."],
            ["SUDAH",
             "Mengonfirmasi sudah minum obat.",
             "Dikirim setelah menerima pesan pengingat dari bot."],
            ["SUDAH MINUM",
             "Sama seperti SUDAH.",
             "Alternatif perintah konfirmasi."],
            ["SDH",
             "Sama seperti SUDAH.",
             "Alternatif perintah konfirmasi."],
            ["UDAH",
             "Sama seperti SUDAH.",
             "Alternatif perintah konfirmasi."],
        ])

    doc.add_heading("4.2  Balasan Otomatis dari Bot", level=2)

    para(doc,
         "Selain merespons perintah di atas, bot juga memberikan balasan "
         "otomatis dalam kondisi-kondisi berikut.",
         indent=True)

    add_table(doc,
        ["Kondisi", "Balasan Bot"],
        [
            ["Format pendaftaran salah",
             "Bot memberikan contoh format yang benar tanpa membatalkan proses pendaftaran."],
            ["No. Rekam Medis sudah digunakan pasien lain",
             "Bot menginformasikan bahwa No. RM tersebut sudah terdaftar."],
            ["Pasien mengetik DAFTAR padahal sudah terdaftar",
             "Bot menginformasikan bahwa pasien sudah terdaftar beserta jadwal minum obatnya."],
            ["Pasien mengetik SUDAH tanpa pengingat aktif",
             "Bot membalas bahwa saat ini tidak ada jadwal pengingat yang menunggu konfirmasi."],
            ["Pasien mengetik SUDAH dua kali di hari yang sama",
             "Bot membalas bahwa konfirmasi hari ini sudah tercatat sebelumnya."],
            ["Pengingat pasien sudah dihentikan oleh admin",
             "Bot membalas bahwa pengingat sudah tidak aktif dan menyarankan menghubungi peneliti."],
        ])

    # ==================================================================
    # BAB 5
    # ==================================================================
    doc.add_heading("5.  Daftar Perintah untuk Admin (Peneliti)", level=1)

    para(doc,
         "Perintah admin hanya dapat diakses oleh nomor WhatsApp yang sudah "
         "terdaftar sebagai nomor peneliti di dalam sistem. Seluruh perintah "
         "admin diawali dengan tanda seru (!).",
         indent=True)

    doc.add_heading("5.1  Daftar Perintah Admin", level=2)

    add_table(doc,
        ["Perintah", "Fungsi", "Contoh"],
        [
            ["!rekap",
             "Menampilkan ringkasan kepatuhan seluruh pasien pada hari ini:\njumlah Tepat Waktu, Terlambat, Menunggu, Tidak Konfirmasi, dan Terlewat Sistem.",
             "Ketik:  !rekap"],
            ["!pasien",
             "Menampilkan daftar seluruh pasien aktif beserta nama, nomor rekam medis, dan jadwal minum obat.",
             "Ketik:  !pasien"],
            ["!stop <No. RM>",
             "Menghentikan pengingat untuk pasien tertentu berdasarkan Nomor Rekam Medis.",
             "Ketik:  !stop 012345"],
            ["!export",
             "Meminta bot mengirimkan file Excel (.xlsx) berisi rekapitulasi data kepatuhan seluruh pasien.",
             "Ketik:  !export"],
            ["!download",
             "Sama seperti !export.",
             "Ketik:  !download"],
            ["!help",
             "Menampilkan daftar panduan ringkas seluruh perintah admin.",
             "Ketik:  !help"],
        ])

    doc.add_heading("5.2  Akses Tidak Sah", level=2)
    para(doc,
         "Apabila seseorang yang bukan admin mencoba mengirimkan perintah yang "
         "diawali tanda seru (!), bot akan menolak dan membalas bahwa perintah "
         "tersebut hanya dapat diakses oleh peneliti.",
         indent=True)

    doc.add_heading("5.3  Isi File Excel (!export)", level=2)
    para(doc,
         "File Excel yang dikirim oleh bot terdiri dari dua lembar kerja (sheet).",
         indent=True)

    add_table(doc,
        ["Lembar Kerja", "Isi"],
        [
            ["Rekap Pasien",
             "Daftar seluruh pasien: Nama, No. RM, Jam Minum, Tanggal Registrasi, Status (aktif atau dihentikan), jumlah total hari pencatatan, dan persentase kepatuhan."],
            ["Log Kepatuhan",
             "Catatan harian per pasien: Tanggal, Jadwal, Waktu Pengingat 1, Waktu Pengingat 2, Waktu Konfirmasi, dan Status Kepatuhan."],
        ])

    # ==================================================================
    # BAB 6
    # ==================================================================
    doc.add_heading("6.  Penjelasan Status Kepatuhan", level=1)

    para(doc,
         "Setiap hari, kepatuhan minum obat pasien dicatat dalam salah satu "
         "dari lima status berikut.",
         indent=True)

    add_table(doc,
        ["Status", "Arti"],
        [
            ["Tepat Waktu",
             "Pasien membalas SUDAH dalam waktu kurang dari 30 menit setelah pengingat pertama dikirim."],
            ["Terlambat",
             "Pasien membalas SUDAH setelah lebih dari 30 menit, yaitu setelah pengingat kedua dikirim."],
            ["Menunggu",
             "Pengingat sudah dikirim tetapi pasien belum membalas. Status ini bersifat sementara."],
            ["Tidak Konfirmasi",
             "Pasien tidak membalas sama sekali hingga pukul 23.59 WIB."],
            ["Terlewat Sistem",
             "Pengingat tidak terkirim karena gangguan teknis (server mati lebih dari 60 menit)."],
        ])

    # ==================================================================
    # BAB 7
    # ==================================================================
    doc.add_heading("7.  Tanya Jawab", level=1)

    faqs = [
        ("Apakah pasien harus mengunduh aplikasi tambahan?",
         "Tidak. Pasien cukup menggunakan aplikasi WhatsApp yang sudah ada di ponselnya."),
        ("Kapan pengingat mulai dikirim setelah pasien mendaftar?",
         "Pengingat mulai dikirim pada hari berikutnya setelah tanggal pendaftaran, "
         "sesuai jam minum obat yang telah ditentukan."),
        ("Apakah pasien bisa mendaftar lebih dari satu kali?",
         "Tidak. Jika pasien mengetik DAFTAR padahal sudah terdaftar, bot akan "
         "memberitahukan bahwa pasien tersebut sudah terdaftar."),
        ("Bagaimana jika pasien salah mengetik format pendaftaran?",
         "Bot tidak akan menolak pasien. Bot membalas dengan memberikan contoh "
         "format yang benar agar pasien dapat mengetik ulang."),
        ("Apakah data pasien aman?",
         "Seluruh data tersimpan di server awan yang terlindungi. Hanya peneliti "
         "yang memiliki akses ke data tersebut."),
        ("Bagaimana cara menghentikan pengingat untuk pasien tertentu?",
         "Admin mengirim perintah !stop diikuti Nomor Rekam Medis. "
         "Contoh: !stop 012345."),
        ("Bagaimana cara mengunduh laporan data?",
         "Admin mengirim perintah !export atau !download ke nomor bot. Bot akan "
         "mengirimkan file Excel yang dapat dibuka di Microsoft Excel."),
        ("Apakah bot tetap aktif tanpa ada yang mengoperasikan?",
         "Ya. Bot sudah berjalan di server secara otomatis selama 24 jam setiap hari."),
        ("Apakah huruf besar atau kecil berpengaruh saat mengetik perintah?",
         "Tidak. Mengetik DAFTAR, daftar, atau Daftar akan memberikan hasil yang sama. "
         "Hal ini berlaku juga untuk perintah SUDAH dan seluruh perintah admin."),
        ("Apa yang terjadi jika pasien membalas SUDAH dua kali?",
         "Bot akan membalas bahwa konfirmasi hari ini sudah tercatat sebelumnya. "
         "Status kepatuhan tidak berubah."),
    ]

    for i, (q, a) in enumerate(faqs):
        doc.add_heading(f"7.{i+1}  {q}", level=2)
        para(doc, a, indent=True)

    # ── Simpan ─────────────────────────────────────────────────────────
    output_dir = "docs"
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "Panduan_Bot_WA_Pengingat_Obat_v2.docx")
    doc.save(output_path)
    print(f"Berhasil: {output_path}")


if __name__ == "__main__":
    create_manual()
