# PANDUAN.md — Panduan Bahasa Awam

> **Untuk siapa dokumen ini:** pemilik proyek yang **tidak harus** paham teknis. Ditulis dengan bahasa manusia, tanpa asumsi latar belakang IT.
> **Sifat:** dokumen penjelas (onboarding). Sumber kebenaran teknis tetap `docs/PRD.md` & `docs/ARCHITECTURE.md`.
> **Bahasa:** Indonesia; istilah teknis tetap English (sesuai `AGENTS.md`).
> **Versi:** 1.0.0.

---

## Daftar Isi

1. [ERP Ini Apa & Untuk Siapa](#1-erp-ini-apa--untuk-siapa)
2. [Peta Empat Alur Utama](#2-peta-empat-alur-utama)
3. [Contoh Nyata: Satu Barang dari Beli sampai Jual](#3-contoh-nyata-satu-barang-dari-beli-sampai-jual)
4. [Kenapa Sekali Transaksi Bisa Nyambung ke Mana-mana](#4-kenapa-sekali-transaksi-bisa-nyambung-ke-mana-mana)
5. [Kamus Istilah & Singkatan](#5-kamus-istilah--singkatan)
6. [Apa yang Sudah Jadi vs Belum](#6-apa-yang-sudah-jadi-vs-belum)
7. [Cara Menjalankan Sistem](#7-cara-menjalankan-sistem)
8. [Cara Membaca Laporan Keuangan](#8-cara-membaca-laporan-keuangan)
9. [Kenapa Tanpa Docker](#9-kenapa-tanpa-docker)
10. [Glosarium "Enterprise"](#10-glosarium-enterprise)

---

## 1. ERP Ini Apa & Untuk Siapa

### ERP itu apa?

**ERP = Enterprise Resource Planning.** Terjemahan bebasnya: **"satu sistem terpusat untuk mengelola seluruh operasional perusahaan."**

Bayangkan sebuah toko grosir/distributor. Setiap hari mereka:

- **Beli** barang dari supplier.
- **Simpan** barang di gudang.
- **Jual** barang ke toko-toko lain.
- **Catat uang** yang masuk dan keluar.

Kalau semua itu dicatat terpisah — pembelian di Excel A, stok di Excel B, penjualan di buku C, keuangan di aplikasi D — muncul masalah besar: **file-file itu tidak saling bicara**. Stok di komputer bilang "ada 100", padahal di gudang tinggal 80. Uang di buku tidak pernah cocok dengan kenyataan.

Masalah ini disebut **"silo data"** (data terkunci di masing-masing tempat).

**ERP menyatukan semuanya jadi satu "otak".** Sekali Anda jual barang, sistem **otomatis**:
- Mengurangi stok di gudang.
- Mencatat penjualan.
- Mengisi pembukuan keuangan.

Itulah inti ERP: **semua bagian perusahaan bekerja di atas satu data yang sama**, sehingga selalu akurat dan bisa dipercaya.

### Sistem ini untuk bisnis seperti apa?

**Retail / Distribusi** — bisnis yang **membeli barang jadi, lalu menjualnya kembali** (tanpa mengubah bentuknya):

- Toko grosir.
- Distributor (mis. distributor kopi, sembako, elektronik, kosmetik).
- Toko ritel dengan beberapa cabang/gudang.

**BUKAN untuk pabrik/manufaktur** (yang mengolah bahan mentah menjadi produk baru). Karena itu, sistem ini **sengaja tidak punya** fitur resep produk (BOM), perintah produksi, atau perhitungan biaya pabrik. Batasan ini tercatat di `docs/PRD.md §2.2` — supaya sistem fokus dan tidak kebanyakan fitur.

### Nilai jualnya apa?

1. **Data akurat & terpusat** — stok, penjualan, dan keuangan selalu sinkron.
2. **Audit trail** — semua perubahan tercatat (siapa mengubah apa, kapan). Penting untuk audit pajak/keuangan.
3. **Jurnal otomatis** — tidak ada lagi hitung manual yang rawan salah.
4. **Kontrol** — hak akses per jabatan + persetujuan berjenjang untuk transaksi besar.

---

## 2. Peta Empat Alur Utama

Seluruh sistem sebenarnya hanya mengalirkan **4 hal**: barang masuk, barang disimpan, barang keluar, dan uang. Berikut petanya.

### A. Alur BELI (barang masuk) — istilah: **P2P** (Procure-to-Pay)

```
Butuh barang        Pesan ke supplier      Barang tiba          Tagihan supplier
   (PR)       →         (PO)          →    & dicek (GRN)   →        (Bill)
                                          │
                                          ▼
                              Stok gudang naik OTOMATIS
                              Utang ke supplier muncul OTOMATIS
```

### B. Alur JUAL (barang keluar) — istilah: **O2C** (Order-to-Cash)

```
Tawar harga         Pesanan toko        Barang dikirim       Tagihan ke toko
(Quotation)   →        (SO)        →        (DO)        →       (Invoice)
                                          │
                                          ▼
                              Stok gudang turun OTOMATIS
                              Piutang (uang ditagih) muncul OTOMATIS
```

### C. Alur SIMPAN (gudang) — istilah: **Inventory**

```
Stock In   ──┐
Stock Out  ──┤──►  Stok per gudang/bin, Transfer antar-gudang,
Transfer   ──┤     Stock Opname (hitung fisik), Nilai stok (MA/FIFO)
Opname     ──┘
```

### D. Alur UANG (pembukuan) — istilah: **Finance & GL**

```
Setiap kejadian di atas (A/B/C)
            │
            ▼
  OTOMATIS jadi catatan pembukuan (double-entry)
            │
            ▼
  Laporan: Neraca, Laba-Rugi, Neraca Saldo, Buku Besar
```

> **Intinya:** Anda bekerja di alur A/B/C (dokumen bisnis). Sistem diam-diam mengisi alur D (keuangan) untuk Anda.

---

## 3. Contoh Nyata: Satu Barang dari Beli sampai Jual

Mari ikuti **1 karung kopi** dari dibeli sampai dijual. (Angka dibuat sederhana.)

| Langkah | Anda lakukan | Sistem otomatis |
|---|---|---|
| **1. Butuh kopi** | Buat **PR** (permintaan beli internal) | Tercatat sebagai permintaan |
| **2. Pesan ke supplier** | Buat **PO** ke "PT Sumber Kopi", 100 kg @ Rp10.000 | PO menunggu persetujuan (kalau nilainya besar) |
| **3. Barang tiba** | Buat **GRN** (bukti terima), 100 kg | ✅ Stok gudang **+100 kg**; ✅ Catatan utang ke supplier **Rp1.000.000** |
| **4. Tagihan datang** | Buat **Bill** dari supplier | ✅ Sistem cek "3-way match" (PO vs GRN vs Bill cocok?) |
| **5. Toko pesan** | Buat **SO** (pesanan toko), 50 kg @ Rp15.000 | ✅ Cek "credit limit" toko; ✅ Stok **di-reserve** 50 kg |
| **6. Kirim barang** | Buat **DO** (surat jalan), 50 kg | ✅ Stok gudang **−50 kg**; ✅ Modal barang terjual dihitung (HPP) |
| **7. Tagih toko** | Buat **Invoice** ke toko | ✅ Piutang toko **+Rp750.000**; ✅ Pendapatan **+Rp750.000**; ✅ HPP **−Rp500.000**, Stok **−Rp500.000** |
| **8. Toko bayar** | *(P1a — belum ada di P0)* | Nanti: Piutang turun, Kas naik |

**Perhatikan:** Anda cuma membuat dokumen bisnis (PR, PO, GRN, dst.). **Semua angka keuangan muncul sendiri.** Itu keajaiban ERP.

---

## 4. Kenapa Sekali Transaksi Bisa Nyambung ke Mana-mana

Kuncinya satu konsep: **Double-Entry** (pembukuan berpasangan).

Aturan mainnya sederhana: **setiap transaksi keuangan selalu punya 2 sisi — yang "keluar" dan yang "masuk" — dan keduanya harus sama besar.** Ini standar akuntansi dunia.

Contoh saat barang tiba (GRN):

| Sisi | Akun | Jumlah |
|---|---|---|
| **Debit** (bertambah di sisi ini) | Persediaan (stok) | Rp1.000.000 |
| **Kredit** (bertambah di sisi ini) | GRN Accrual (utang) | Rp1.000.000 |

Debit = Kredit = Rp1.000.000 → **seimbang**. Kalau tidak seimbang, sistem **menolak** menyimpan. Jadi mustahil ada pembukuan yang "timpang".

Contoh saat jual barang (Invoice):

| Sisi | Akun | Jumlah |
|---|---|---|
| Debit | Piutang Usaha | Rp750.000 |
| Kredit | Penjualan | Rp750.000 |
| Debit | HPP (modal barang) | Rp500.000 |
| Kredit | Persediaan | Rp500.000 |

Sekali invoice dibuat → **4 baris pembukuan** muncul otomatis, dan semuanya seimbang.

**Kenapa ini penting?** Karena dengan aturan ini, laporan keuangan (Neraca, Laba-Rugi) **tidak bisa bohong** — angkanya selalu bisa ditelusuri balik ke transaksi aslinya.

---

## 5. Kamus Istilah & Singkatan

Simpan tabel ini sebagai contekan. Ini semua singkatan yang muncul di sistem.

### 5.1 Dokumen Bisnis

| Singkatan | Arti (English) | Bahasa manusia |
|---|---|---|
| **PR** | Purchase Requisition | Permintaan beli (internal) |
| **PO** | Purchase Order | Surat pesanan ke supplier |
| **GRN** | Goods Receipt Note | Bukti barang diterima |
| **SO** | Sales Order | Pesanan dari toko/customer |
| **DO** | Delivery Order | Surat jalan (barang dikirim) |
| **INV** | Invoice | Tagihan ke customer |
| **CN** | Credit Note | Nota kredit (retur/potongan penjualan) |
| **BILL** | Vendor Bill | Tagihan dari supplier |
| **QT** | Quotation | Penawaran harga ke calon customer |
| **JE** | Journal Entry | Entri jurnal (catatan pembukuan manual) |
| **RCP** | Receipt (AR) | Bukti terima pembayaran customer *(P1a)* |
| **PAY** | Payment (AP) | Bukti bayar ke supplier *(P1a)* |

### 5.2 Keuangan

| Singkatan | Arti (English) | Bahasa manusia |
|---|---|---|
| **AR** | Accounts Receivable | Piutang — uang yang harus **ditagih ke customer** |
| **AP** | Accounts Payable | Utang — uang yang harus **kita bayar ke supplier** |
| **COA** | Chart of Accounts | Daftar semua akun (Kas, Piutang, Utang, dst.) |
| **GL** | General Ledger | Buku besar — catatan induk semua transaksi uang |
| **HPP / COGS** | Cost of Goods Sold | Harga Pokok Penjualan — modal barang yang terjual |
| **PPN** | Pajak Pertambahan Nilai | Pajak Indonesia. **Keluaran** = pajak saat kita jual; **Masukan** = pajak saat kita beli |
| **IDR** | Indonesian Rupiah | Mata uang kita |
| **Debit** | (sisi kiri akun) | Penambahan aset/beban, atau pengurangan utang/modal |
| **Kredit** | (sisi kanan akun) | Penambahan utang/modal/pendapatan, atau pengurangan aset |

### 5.3 Teknis

| Singkatan | Arti (English) | Bahasa manusia |
|---|---|---|
| **API** | Application Programming Interface | "Jalan" agar frontend & backend saling bicara |
| **REST** | Representational State Transfer | Gaya umum API lewat HTTP |
| **SPA** | Single Page Application | Website modern (tak reload tiap klik) |
| **RBAC** | Role-Based Access Control | Hak akses berdasarkan jabatan/role |
| **JWT** | JSON Web Token | "Kartu identitas" digital saat login |
| **MA** | Moving Average | Cara hitung nilai stok: rata-rata bergerak |
| **FIFO** | First In First Out | Cara hitung nilai stok: barang masuk dulu, keluar dulu |
| **P2P** | Procure-to-Pay | Alur beli (PR → PO → GRN → Bill) |
| **O2C** | Order-to-Cash | Alur jual (Quotation → SO → DO → Invoice) |
| **UoM** | Unit of Measure | Satuan (KG, PCS, UNIT, dst.) |

### 5.4 Proyek & Arsitektur

| Singkatan | Arti (English) | Bahasa manusia |
|---|---|---|
| **PRD** | Product Requirements Document | Dokumen kebutuhan — apa yang mau dibangun |
| **ADR** | Architecture Decision Record | Catatan keputusan — kenapa kita pilih sesuatu |
| **P0/P1** | Prioritas 0 / Prioritas 1 | P0 = wajib dulu; P1 = nanti |
| **MVP** | Minimum Viable Product | Versi paling minimal yang sudah berguna |
| **3-Way Match** | (kontrol pengadaan) | Cocokkan PO vs GRN vs Bill (pesan vs terima vs tagih) |
| **Credit Limit** | (kontrol penjualan) | Batas maksimal utang seorang customer |

---

## 6. Apa yang Sudah Jadi vs Belum

### 6.1 Sudah jadi (P0) — siap dipakai

| Slice | Isi | Status |
|---|---|---|
| **P0a** | Login & hak akses, struktur organisasi, COA, mesin jurnal, audit, outbox | ✅ Selesai |
| **P0b** | Inventory: stok, mutasi, transfer, opname, valuasi (MA + FIFO), batch/serial | ✅ Selesai |
| **P0c** | Procurement: PR → PO → GRN → Bill + 3-way matching | ✅ Selesai |
| **P0d** | Sales: Quotation → SO → DO → Invoice + credit check + reserve + void/nota kredit | ✅ Selesai |

Verifikasi sudah lulus semua (typecheck, 36 unit test, smoke test database nyata & API).

### 6.2 Belum jadi (P1) — penyempurnaan

| Slice | Isi | Kenapa |
|---|---|---|
| **P1a** | Payment AR/AP — catat uang masuk (terima dari customer) & uang keluar (bayar supplier) | **Menutup celah terpenting** (lihat bawah) |
| **P1b** | Outbox relay + broker (RabbitMQ/Redis) | Infrastruktur integrasi antar-sistem |
| **P1c** | Payment Gateway, Tax API/e-Faktur, Shipping Aggregator | Integrasi ke pihak eksternal |
| **P1d** | Field-level & row-level RBAC | Hak akses lebih detail |
| **P1e** | CQRS / read replica | Optimasi kalau data sudah sangat besar |

### 6.3 Jawaban jujur: apakah P0 sudah "maksimal"?

**Hampir — tapi ada 1 celah penting.**

P0 sudah **berfungsi penuh sebagai sistem operasional**: Anda bisa beli barang, kelola stok, jual barang, dan **semua otomatis masuk pembukuan keuangan**. Laporan keuangan (Neraca, Laba-Rugi, Neraca Saldo, Buku Besar) sudah jalan.

**Celahnya:** P0 **berhenti di "Invoice/Bill"** — yaitu **mencatat** bahwa customer berutang ke kita (piutang), dan kita berutang ke supplier (utang). Tapi P0 **belum bisa mencatat uang benar-benar masuk/keluar** (pembayaran).

Analogi:
- ✅ "Toko B berutang Rp3 juta ke kita" → tercatat.
- ❌ "Toko B sudah transfer Rp3 juta" → belum bisa dicatat.

**Itulah persis kenapa P1a jadi langkah berikutnya.** Setelah P1a selesai, loop-nya **lengkap**: beli → jual → terima/bayar uang → laporan kas.

**Kesimpulan praktis:**
- Untuk **operasional + pembukuan** (accrual): **P0 sudah cukup.**
- Untuk **manajemen kas/pembayaran sungguhan**: butuh **P1a**.
- P1b–P1e adalah **penyempurnaan**, bukan penghambat pemakaian sehari-hari.

---

## 7. Cara Menjalankan Sistem

Sistem ini **tidak butuh Docker** (lihat [bagian 9](#9-kenapa-tanpa-docker)). Cukup 3 langkah.

### Prasyarat

- **Bun** sudah terpasang (runtime backend & frontend).
- **MySQL** dari **Laragon** sudah jalan (port `3306`), database bernama `erp`.
  - Laragon default: user `root`, tanpa password.

### Langkah

```powershell
# 1. Database — nyalakan MySQL di Laragon, buat database `erp`.

# 2. Backend (buka terminal 1)
cd backend
Copy-Item .env.example .env     # sesuaikan DATABASE_URL ke MySQL lokal
bun install
bun run db:migrate              # buat semua tabel
bun run db:seed                 # isi data demo (company, admin, COA, gudang, item, vendor, customer)
bun run dev                     # jalan di http://localhost:3000

# 3. Frontend (buka terminal 2)
cd frontend
bun install
bun run dev                     # jalan di http://localhost:5173
```

### Login

Buka `http://localhost:5173`, lalu masuk dengan data demo:

| Kolom | Nilai |
|---|---|
| Company ID | `00000000-0000-4000-8000-000000000001` |
| Email | `admin@erp.local` |
| Password | `admin12345` |

### Kalau ada masalah

| Gejala | Penyebab | Solusi |
|---|---|---|
| `502 Bad Gateway` saat login | Backend (port 3000) mati | Jalankan backend (`cd backend; bun run dev`) |
| `401` saat login | Company ID salah/kosong | Isi Company ID seperti tabel di atas |
| Port 3000 bentrok | Proses lama masih mengunci port | Otomatis ditangani; manual: `bun run ../scripts/free-port.ts 3000 5173` |
| Butuh Redis/RabbitMQ? | **Tidak** — tidak dipakai | Cukup MySQL Laragon |

---

## 8. Cara Membaca Laporan Keuangan

Empat laporan utama, dijelaskan sederhana:

### 8.1 Neraca Saldo (Trial Balance)
**"Daftar semua akun beserta saldonya."** Menunjukkan total Debit = total Kredit. Kalau tidak sama, ada yang salah catat. Ini laporan **paling dasar** untuk cek kesehatan pembukuan.

### 8.2 Neraca (Balance Sheet)
**"Foto kekayaan perusahaan di satu titik waktu."** Isinya:
- **Aset** (yang dimiliki: kas, stok, piutang) =
- **Liabilitas** (yang diutang: utang supplier) + **Ekuitas** (modal).

Rumusnya selalu: **Aset = Liabilitas + Ekuitas.** Kalau tidak sama, ada masalah.

### 8.3 Laba-Rugi (Profit & Loss)
**"Apakah perusahaan untung atau rugi di satu periode?"** Isinya:
- **Pendapatan** (hasil penjualan) − **Beban** (HPP + biaya operasional) = **Laba/Rugi**.

### 8.4 Buku Besar (General Ledger)
**"Rincian semua transaksi per akun."** Kalau Anda penasaran "kenapa saldo Kas jadi segini?", buka Buku Besar akun Kas — semua transaksi yang membentuk saldo itu terlihat.

---

## 9. Kenapa Tanpa Docker

**Docker itu apa?** Alat untuk **mengemas** sebuah aplikasi beserta semua dependensinya jadi satu "kotak" (container), agar jalan sama persis di komputer mana pun.

**Penting dipahami:** Docker adalah **cara menjalankan**, bukan **syarat agar bisa jalan**. Aplikasi yang sama bisa dijalankan **langsung di sistem operasi (native)** tanpa Docker.

### Kenapa proyek ini memilih native (tanpa Docker)

Diputuskan resmi di `docs/ADR/0002-tanpa-docker-lokal.md`. Alasannya:

1. **MySQL** sudah jalan native via Laragon.
2. **Redis** ternyata tidak dipakai sama sekali → dependensi mati.
3. **RabbitMQ** hanya dipakai relay outbox yang **belum dibutuhkan P0**.
4. Server utama hanya butuh koneksi ke MySQL.

→ Docker hanya menambah beban (memori, penyimpanan) tanpa manfaat. **Dihapus.**

### Konsekuensi

| Hal | Status |
|---|---|
| Butuh Docker Desktop? | **Tidak.** |
| Butuh resource besar? | **Tidak** — cukup Laragon yang sudah ada. |
| Bisa jalan tanpa Docker? | **Ya** — dan memang begitu cara proyek ini dirancang. |

> **Catatan masa depan:** kalau nanti (P1b) butuh RabbitMQ/Redis, itu **opsi** — bisa di-install native, bisa juga Docker. Anda putuskan saat itu, dengan ADR baru. **Belum relevan sekarang.**

---

## 10. Glosarium "Enterprise"

Yang membuat sebuah sistem disebut **"enterprise-grade"** (kelas perusahaan besar) **bukan** seberapa banyak istilah yang Anda hafal, melainkan **sifat sistemnya**. Proyek ini sudah punya semua sifat itu — Anda tinggal tahu namanya:

| Istilah | Arti sederhana | Kenapa penting |
|---|---|---|
| **Audit Trail** | Catatan semua perubahan (siapa, kapan, apa) | Untuk audit pajak/keuangan; bukti kepatuhan |
| **Double-Entry Ledger** | Pembukuan berpasangan (Debit = Kredit) | Standar akuntansi dunia; laporan tak bisa "bohong" |
| **Append-Only** | Data lama tidak diubah/dihapus, koreksi lewat catatan baru | Riwayat tidak bisa dimanipulasi |
| **Reversal Entry** | Jurnal balik untuk membatalkan (bukan hapus) | Koreksi tetap terekam jejaknya |
| **Modular** | Tiap bagian terpisah (IAM, Inventory, Procurement, Sales, Finance) | Perubahan di satu bagian tak merusak bagian lain |
| **Idempotency** | Klik dua kali tidak bikin data ganda | Aman dari double-submit / retry jaringan |
| **Transactional Outbox** | Event bisnis ditulis atomik bersama datanya | Jaminan event tidak hilang untuk integrasi nanti |
| **RBAC + Approval Matrix** | Hak akses per jabatan + persetujuan berjenjang | Kontrol internal; transaksi besar butuh 2 level persetujuan |
| **Optimistic/Pessimistic Locking** | Penguncian data saat bersamaan diakses | Mencegah salah hitung saat banyak user |
| **Multi-Entity / Multi-Warehouse** | Banyak perusahaan/cabang/gudang dalam satu sistem | Skalabilitas organisasi |

**Kesimpulan:** Anda sudah punya sistem dengan kualitas enterprise. Yang belum dimiliki hanya **kosakata** untuk menjelaskannya — dan itu bisa dipelajari kapan saja.

---

## Penutup

Dokumen ini penjelas tingkat tinggi. Untuk detail teknis:

- `docs/PRD.md` — kebutuhan lengkap (fitur, aturan, kontrak API).
- `docs/ARCHITECTURE.md` — rancangan teknis & status implementasi.
- `docs/RESEARCH.md` — riset & alasan di balik pilihan teknologi.
- `docs/ADR/` — catatan keputusan arsitektur.
- `README.md` — cara menjalankan & troubleshooting.
