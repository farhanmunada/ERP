# Product Requirements Document (PRD) — ERP Modular (Retail/Distribusi)

> **Status: APPROVED ✅ (Gerbang 1 lulus — disetujui operator)**
> Bahasa: Indonesia (istilah teknis/identifier tetap English).
> Basis fakta: `docs/RESEARCH.md`. Keputusan arsitektur: `docs/ADR/`.
> Versi: 1.0.0 · Fase: 3 (Spec & Behavior Definition)

---

## 1. Problem Statement

Organisasi retail/distribusi enterprise menjalankan operasional lintas divisi (gudang, procurement, sales, finance) dengan sistem terpisah. Akibatnya:

- **Silo data:** stok di gudang tidak sinkron dengan catatan finance; penjualan tidak otomatis menghasilkan jurnal.
- **Tidak ada audit trail kepatuhan:** sulit membuktikan `siapa mengubah apa, kapan` untuk kebutuhan audit finansial.
- **Rawan kesalahan manual:** perhitungan HPP, 3-way matching, dan penjurnalan dilakukan manual → selisih & fraud.
- **Tidak ada isolasi logika:** perubahan di satu divisi merusak divisi lain.

**Dampak jika tidak diselesaikan:** laporan keuangan tidak dapat dipercaya, keputusan bisnis salah, dan audit kepatuhan gagal.

**Solusi:** ERP modular berbasis web/API sebagai *single source of truth*, dengan double-entry ledger otomatis, audit trail global, dan isolasi logika per domain.

---

## 2. Target Goals & Non-Goals

### 2.1 Goals (In-Scope P0)

1. **IAM & Org Unit:** multi-entity (banyak legal entity), multi-branch, multi-warehouse; RBAC berbasis permission + scope org-unit; approval matrix dinamis multi-tier.
2. **Inventory:** multi-lokasi (bin), batch/serial tracking, valuasi otomatis (default Moving Average, per-item configurable), mutasi (Stock In/Out/Transfer/Opname), reorder point.
3. **Procurement (P2P):** PR → PO → GRN → Vendor Bill, dengan 3-way matching bertoleransi (configurable) + override approval.
4. **Sales (O2C):** Quotation → SO → DO → Customer Invoice, credit limit lock, soft-reserve stok saat SO confirmed.
5. **Finance & GL:** COA hierarkis, double-entry engine atomic, reversal entry, laporan (Balance Sheet, P&L, Trial Balance, General Ledger).
6. **Cross-cutting:** Global audit trail, idempotency, transactional outbox, append-only ledger, anti-deadlock locking.

### 2.2 Non-Goals (Out-of-Scope — eksplisit)

1. **Manufaktur:** TIDAK ada BOM, Work Order, routing, WIP, atau overhead absorption. (Target retail/distribusi.)
2. **Pembayaran (AR/AP payment) & Payment Gateway:** TIDAK dicatat di P0; berhenti di Invoice. Payment masuk P1.
3. **Multi-currency:** TIDAK ada. Hanya IDR tunggal.
4. **Integrasi eksternal (Tax API, Shipping Aggregator, e-Faktur):** TIDAK di P0; hanya kontrak REST disiapkan untuk P1.
5. **gRPC:** TIDAK di P0; hanya REST.
6. **Field-level & row-level RBAC:** TIDAK di P0 (ditunda P1); P0 = permission + org-unit scope.
7. **CQRS / read replica:** TIDAK di P0; reporting pakai query langsung + index.
8. **Mobile app native:** TIDAK di P0; hanya web SPA responsif.
9. **Payroll, HR, Fixed Asset management, Project accounting:** TIDAK di P0.

---

## 3. Aktor & Peran

| Aktor | Deskripsi |
|---|---|
| Super Admin | Mengelola company, user, role, permission, konfigurasi sistem. |
| Finance Manager | Mengelola COA, approval jurnal, laporan keuangan. |
| Procurement Officer | Membuat PR, PO, menerima GRN. |
| Warehouse Staff | Mutasi stok, opname, transfer. |
| Sales Officer | Quotation, SO, DO, invoice. |
| Approver | Menyetujui dokumen sesuai approval matrix. |
| Auditor (read-only) | Melihat audit trail & laporan. |
| External System | Klien API (dengan token) untuk integrasi P1. |

---

## 4. User Stories & Kriteria Penerimaan (GIVEN/WHEN/THEN)

> Setiap kriteria dapat dibuatkan unit/integration test otomatis.

### Modul 1 — Identity, Access & Organization (IAM & Org Unit)

**Story 1.1:** Sebagai Super Admin, saya ingin membuat struktur organisasi (company → branch → warehouse) agar operasional terisolasi per unit.

- **1.1.1**
  - GIVEN company "PT Retail A" belum punya branch
  - WHEN Super Admin membuat branch "Jakarta" dengan kode `JKT`
  - THEN sistem menyimpan branch dengan `company_id` PT Retail A, dan branch muncul di daftar branch company tersebut.
- **1.1.2**
  - GIVEN branch "Jakarta" sudah ada
  - WHEN Super Admin membuat warehouse "Gudang Utama" di bawah branch Jakarta
  - THEN warehouse tersimpan dengan `branch_id` Jakarta, dan tidak terlihat oleh company lain.
- **1.1.3**
  - GIVEN kode branch `JKT` sudah dipakai di company yang sama
  - WHEN Super Admin membuat branch baru dengan kode `JKT`
  - THEN sistem menolak dengan error `409 CONFLICT` dan pesan "Kode branch sudah digunakan".

**Story 1.2:** Sebagai Super Admin, saya ingin mendefinisikan role & permission agar akses terkendali.

- **1.2.1**
  - GIVEN role "Procurement Officer" ada tanpa permission `po:approve`
  - WHEN user dengan role tersebut mencoba approve PO
  - THEN sistem menolak dengan `403 FORBIDDEN`.
- **1.2.2**
  - GIVEN user punya permission `inventory:read` dengan scope warehouse "Gudang Utama"
  - WHEN user membaca stok warehouse "Gudang Cabang"
  - THEN sistem menolak dengan `403 FORBIDDEN` (scope di luar wewenang).

**Story 1.3:** Sebagai Finance Manager, saya ingin mengonfigurasi approval matrix multi-tier agar dokumen besar butuh persetujuan berjenjang.

- **1.3.1**
  - GIVEN aturan: PO dengan nominal > 100.000.000 butuh approval level 1 (Manager) lalu level 2 (Director)
  - WHEN Procurement Officer submit PO senilai 150.000.000
  - THEN status PO = `PENDING_APPROVAL` level 1, dan approver level 1 menerima notifikasi/task.
- **1.3.2**
  - GIVEN PO di level 1 sudah di-approve Manager
  - WHEN Director meng-approve level 2
  - THEN status PO = `APPROVED` dan PO dapat dilanjutkan ke GRN.
- **1.3.3**
  - GIVEN PO senilai 150.000.000 di level 1
  - WHEN approver level 1 menolak (reject)
  - THEN status PO = `REJECTED` dan tidak lanjut ke level 2.

### Modul 2 — Inventory & Warehouse Management

**Story 2.1:** Sebagai Warehouse Staff, saya ingin mencatat Stock In/Out agar stok akurat.

- **2.1.1**
  - GIVEN item "Kopi Arabika" qty on-hand 100 di "Gudang Utama"
  - WHEN Staff mencatat Stock In qty 50 dengan referensi GRN
  - THEN on-hand menjadi 150 dan tercatat 1 baris stock movement (append-only).
- **2.1.2**
  - GIVEN on-hand 150
  - WHEN Staff mencatat Stock Out qty 200
  - THEN sistem menolak dengan `422 UNPROCESSABLE` "Stok tidak cukup" dan on-hand tetap 150.

**Story 2.2:** Sebagai Warehouse Staff, saya ingin transfer antar-gudang agar distribusi tercatat.

- **2.2.1**
  - GIVEN "Gudang Utama" punya 100 unit, "Gudang Cabang" punya 20 unit
  - WHEN Staff membuat transfer 30 unit Utama → Cabang dan menyelesaikannya
  - THEN Utama = 70, Cabang = 50, dan tercatat 2 movement (OUT di Utama, IN di Cabang) dalam satu transaksi.
- **2.2.2**
  - GIVEN transfer 30 unit dibuat tetapi belum diselesaikan (in-transit)
  - WHEN sistem menghitung stok available
  - THEN 30 unit di Utama berstatus `in_transit` (tidak available) sampai transfer selesai.

**Story 2.3:** Sebagai Finance Manager, saya ingin valuasi stok otomatis agar HPP benar.

- **2.3.1**
  - GIVEN item memakai metode Moving Average, on-hand 100 @ 10.000 (total 1.000.000)
  - WHEN Stock In 100 @ 12.000
  - THEN average cost baru = (1.000.000 + 1.200.000) / 200 = 11.000, dan tersimpan di record item-warehouse.
- **2.3.2**
  - GIVEN item dikonfigurasi metode FIFO dengan 2 layer (100@10.000, 100@12.000)
  - WHEN Stock Out 150 unit
  - THEN 100 diambil dari layer 10.000 dan 50 dari layer 12.000; total COGS = 1.600.000.

**Story 2.4:** Sebagai Warehouse Staff, saya ingin Stock Opname agar selisih terkoreksi.

- **2.4.1**
  - GIVEN sistem mencatat 100 unit, hasil hitung fisik 95 unit
  - WHEN Staff submit opname dengan qty fisik 95
  - THEN sistem mencatat adjustment −5 unit, dan men-generate jurnal selisih opname.
- **2.4.2**
  - GIVEN item punya reorder point 20 dan on-hand 15
  - WHEN sistem menjalankan job reorder check
  - THEN sistem menandai item sebagai `below_reorder` dan (opsional) membuat draft PR.

**Story 2.5:** Sebagai Warehouse Staff, saya ingin tracking batch/serial agar traceability terjaga.

- **2.5.1**
  - GIVEN item dikonfigurasi `track_batch = true`
  - WHEN Stock In tanpa nomor batch
  - THEN sistem menolak dengan `422` "Nomor batch wajib untuk item ini".
- **2.5.2**
  - GIVEN item `track_serial = true`
  - WHEN Stock In 3 unit dengan 3 serial number berbeda
  - THEN tersimpan 3 baris serial yang dapat dilacak per unit.

### Modul 3 — Procurement (Procure-to-Pay)

**Story 3.1:** Sebagai Procurement Officer, saya ingin membuat PR lalu PO agar pengadaan terkontrol.

- **3.1.1**
  - GIVEN PR "Butuh 100 unit Kopi" disetujui
  - WHEN Officer mengubah PR menjadi PO untuk vendor "Supplier X"
  - THEN PO tersimpan dengan status `DRAFT` dan baris item mengacu ke PR.
- **3.1.2**
  - GIVEN PO senilai 150.000.000 dibuat
  - WHEN Officer submit PO
  - THEN PO masuk alur approval matrix (lihat 1.3.1).

**Story 3.2:** Sebagai Warehouse Staff, saya ingin menerima barang (GRN) agar stok & jurnal naik.

- **3.2.1**
  - GIVEN PO `APPROVED` untuk 100 unit @ 10.000
  - WHEN Staff membuat GRN qty 100
  - THEN stok bertambah 100, dan sistem men-generate jurnal (Debit Inventory 1.000.000 / Credit GRN Accrual 1.000.000) secara atomic.
- **3.2.2**
  - GIVEN PO 100 unit, GRN parsial 60 unit
  - WHEN Staff submit GRN 60
  - THEN sisa PO menjadi 40 unit `open`, dan jurnal dihitung untuk 60 unit saja.

**Story 3.3:** Sebagai Finance Manager, saya ingin 3-way matching agar tagihan vendor tervalidasi.

- **3.3.1**
  - GIVEN PO 100 unit @ 10.000, GRN 100 unit, Vendor Bill 100 unit @ 10.000 (toleransi 0%)
  - WHEN Finance memproses bill
  - THEN matching PASS, bill dapat diposting.
- **3.3.2**
  - GIVEN PO 100 @ 10.000, GRN 100, Vendor Bill 100 @ 10.500 (selisih harga 5%, toleransi 2%)
  - WHEN Finance memproses bill
  - THEN sistem menandai `MATCH_EXCEPTION` dan memblokir posting sampai override approval diberikan.
- **3.3.3**
  - GIVEN bill `MATCH_EXCEPTION` sudah di-override oleh approver berwenang
  - WHEN bill diposting
  - THEN jurnal (Debit GRN Accrual / Credit AP) dibuat dan alasan override tercatat di audit trail.

### Modul 4 — Sales & Distribution (Order-to-Cash)

**Story 4.1:** Sebagai Sales Officer, saya ingin membuat Quotation → SO agar penjualan tercatat.

- **4.1.1**
  - GIVEN Quotation "200 unit Kopi @ 15.000" disetujui customer
  - WHEN Officer mengubahnya menjadi SO
  - THEN SO tersimpan `DRAFT` dengan total 3.000.000.
- **4.1.2**
  - GIVEN customer "Toko B" punya credit limit 5.000.000 dan outstanding AR 4.500.000
  - WHEN Officer mengonfirmasi SO senilai 1.000.000
  - THEN sistem menolak dengan `422` "Melebihi credit limit customer".
- **4.1.3**
  - GIVEN customer "Toko B" credit limit 5.000.000, outstanding 4.500.000
  - WHEN Officer mengonfirmasi SO senilai 400.000
  - THEN SO `CONFIRMED` dan stok di-soft-reserve (lihat 4.2.1).

**Story 4.2:** Sebagai Warehouse Staff, saya ingin soft-reserve stok saat SO confirmed agar tidak oversell.

- **4.2.1**
  - GIVEN stok available 500, tidak ada reserve
  - WHEN SO 200 unit di-`CONFIRMED`
  - THEN `reserved_qty` = 200, `available` = 300, `on_hand` tetap 500.
- **4.2.2**
  - GIVEN SO 200 unit ter-reserve
  - WHEN Staff membuat DO 200 unit dan mengirim
  - THEN `on_hand` berkurang 200 (jadi 300) dan `reserved_qty` kembali 0.

**Story 4.3:** Sebagai Finance Manager, saya ingin invoice otomatis berjurnal agar AR & revenue tercatat.

- **4.3.1**
  - GIVEN DO 200 unit terkirim, harga 15.000, HPP 11.000
  - WHEN Customer Invoice dibuat
  - THEN sistem generate jurnal: (Debit AR 3.000.000 / Credit Sales 3.000.000) dan (Debit COGS 2.200.000 / Credit Inventory 2.200.000) secara atomic.

### Modul 5 — Finance & General Ledger

**Story 5.1:** Sebagai Finance Manager, saya ingin COA hierarkis agar struktur akun fleksibel.

- **5.1.1**
  - GIVEN akun "1100 Cash" ada
  - WHEN Manager membuat akun anak "1101 Petty Cash" di bawah 1100
  - THEN hierarki terbentuk dan laporan dapat mengagregasi parent → child.
- **5.1.2**
  - GIVEN akun "1100" punya saldo (dipakai transaksi)
  - WHEN Manager mencoba menghapus akun 1100
  - THEN sistem menolak `409` "Akun dengan transaksi tidak dapat dihapus".

**Story 5.2:** Sebagai Finance Manager, saya ingin double-entry engine atomic agar setiap transaksi selalu balance.

- **5.2.1**
  - GIVEN jurnal dengan Debit 1.000.000 dan Credit 900.000
  - WHEN sistem mencoba posting
  - THEN ditolak `422` "Jurnal tidak balance (debit ≠ kredit)".
- **5.2.2**
  - GIVEN jurnal balance (Debit 1.000.000 = Credit 1.000.000)
  - WHEN posting
  - THEN jurnal tersimpan `POSTED`, append-only (tidak dapat di-UPDATE/DELETE).

**Story 5.3:** Sebagai Finance Manager, saya ingin reversal entry agar koreksi tanpa menghapus data.

- **5.3.1**
  - GIVEN invoice terjurnal `POSTED` senilai 3.000.000
  - WHEN Manager melakukan void invoice
  - THEN sistem membuat reversal journal (Debit Sales 3.000.000 / Credit AR 3.000.000) dengan `reversal_of_id` menunjuk jurnal asal; jurnal asal TIDAK diubah.
- **5.3.2**
  - GIVEN retur penjualan sebagian 50 unit dari 200 unit
  - WHEN Manager membuat credit note 50 unit
  - THEN sistem generate jurnal balik proporsional (revenue & COGS & inventory).

**Story 5.4:** Sebagai Finance Manager, saya ingin laporan keuangan agar dapat mengambil keputusan.

- **5.4.1**
  - GIVEN periode Januari 2026 punya jurnal POSTED
  - WHEN Manager membuka Trial Balance periode tersebut
  - THEN total debit = total credit dan tiap akun menampilkan saldo yang benar.
- **5.4.2**
  - GIVEN data jurnal tersedia
  - WHEN Manager membuka Balance Sheet per tanggal X
  - THEN Assets = Liabilities + Equity (balance).

### Cross-Cutting — Audit, Idempotency, Event

**Story 6.1:** Sebagai Auditor, saya ingin audit trail lengkap agar setiap mutasi dapat dilacak.

- **6.1.1**
  - GIVEN user "budi" mengubah harga PO dari 10.000 → 12.000
  - WHEN perubahan tersimpan
  - THEN tercatat 1 baris `audit_logs` dengan `user_id=budi`, `action=UPDATE`, `entity=PO`, `state_before` & `state_after` JSON, dan `ip_address`.

**Story 6.2:** Sebagai Sales Officer, saya ingin double-submit order tidak membuat duplikat.

- **6.2.1**
  - GIVEN request submit SO dikirim dengan `Idempotency-Key: abc-123`
  - WHEN request yang sama dikirim ulang (retry) dengan key `abc-123`
  - THEN sistem mengembalikan respons pertama tanpa membuat SO kedua.
- **6.2.2**
  - GIVEN key `abc-123` sudah dipakai untuk payload berbeda
  - WHEN dikirim dengan payload berbeda
  - THEN ditolak `409` "Idempotency-Key sudah digunakan untuk request berbeda".

**Story 6.3:** Sebagai System Architect, saya ingin event terkirim andal (Transactional Outbox).

- **6.3.1**
  - GIVEN GRN diposting (transaksi DB sukses)
  - WHEN transaksi commit
  - THEN 1 baris `outbox_events` (`GoodsReceived`) ikut ter-commit; jika transaksi rollback, event TIDAK ada.
- **6.3.2** *(P1 — relay ke broker)*
  - GIVEN `outbox_events` punya 10 baris belum terpublish
  - WHEN relay worker berjalan (multi-instance)
  - THEN tiap event diproses tepat satu kali (via `FOR UPDATE SKIP LOCKED`) dan ditandai `published_at`.
  - **Catatan:** Di P0 hanya jalur tulis outbox yang aktif (transactional, same DB tx). Relay & broker dihidupkan kembali di P1 (`docs/ADR/0002-tanpa-docker-lokal.md`).

---

## 5. Batasan Teknis & Keamanan

### 5.1 Stack (final)

- **Backend:** Bun 1.4.2 + Fastify + TypeScript (strict) + Drizzle ORM (`mysql2`) + Zod.
- **Database:** MySQL **8.0.16+** (wajib). Lihat `docs/ADR/0001-mysql-over-postgres.md`.
- **Broker/Cache:** RabbitMQ/Redis **tidak dipakai di P0** — relay outbox ke broker ditunda ke P1 (`docs/ADR/0002-tanpa-docker-lokal.md`).
- **Frontend:** React + Vite + TypeScript + Tailwind + shadcn/ui + TanStack Query/Table.
- **Infra:** MySQL lokal (Laragon). **Tanpa Docker** (`docs/ADR/0002-tanpa-docker-lokal.md`).

### 5.2 Integritas Transaksi

- Pessimistic locking `SELECT ... FOR UPDATE` (via PK/unique index) untuk mutasi stok & saldo.
- Optimistic locking (kolom `version`) sebagai alternatif pada resource tertentu.
- **Append-only ledger:** `journal_entries`/`journal_lines` & `stock_movements` dilarang UPDATE/DELETE.
- Koreksi via **reversal entry**.
- **Deadlock handling:** retry terbatas (3x, exponential backoff) saat MySQL error **1213**.
- **Lock ordering:** resource di-lock urut `id` ascending.

### 5.3 Keamanan

- Auth: **JWT access token** (short-lived, ~15 menit) + **refresh token** di `httpOnly` cookie (Secure, SameSite=Strict).
- Password: hash dengan algoritma kuat (Argon2id dengan cost factor wajar — hindari bottleneck BUG-20260929-06).
- RBAC: permission `resource:action` + scope org-unit (company/branch/warehouse).
- Input validation di boundary (Zod) — data eksternal DILARANG masuk service sebelum validasi.
- Output DTO: DILARANG mengekspos `password_hash`, token, dsb.
- Secret: hanya dari `.env` (terproteksi `.gitignore`).
- Audit trail: setiap mutasi sensitif tercatat (`user_id`, `timestamp`, `ip_address`, `action`, `state_before`, `state_after`).
- Idempotency-Key untuk endpoint mutasi kritis.

### 5.4 Presisi & Waktu

- Uang: `DECIMAL(18,2)`. Qty: `DECIMAL(18,4)`. Persentase/kurs: `DECIMAL(9,6)`.
- Waktu: disimpan **UTC** (`TIMESTAMP`), ditampilkan **WIB (Asia/Jakarta)**.
- Format UI: Rupiah (`Rp1.000,00`), tanggal `DD/MM/YYYY`, Bahasa Indonesia.

### 5.5 Performa (target awal P0)

- Endpoint read sederhana: p95 < 300 ms (data 100k baris).
- Endpoint mutasi transaksional: p95 < 800 ms.
- Posting jurnal batch (100 baris): < 2 s.

---

## 6. Definition of Done (DoD)

Fitur dinyatakan selesai bila:

1. Seluruh kriteria penerimaan (GIVEN/WHEN/THEN) lulus unit/integration test otomatis.
2. `tsc --noEmit` 0 error; linter bersih (0 warning).
3. Migrasi DB (Tier 2) dijalankan nyata terhadap MySQL 8.0.16+ dan smoke test lulus.
4. Tidak ada `any`, tidak ada magic number, batas kompleksitas (file ≤ 300 baris, fungsi ≤ 30 baris) terpenuhi.
5. Audit trail & idempotency terpasang untuk endpoint mutasi terkait.
6. Tidak ada secret di kode; `.env` terproteksi.
7. Dokumentasi (`docs/`) disinkronkan.

---

## 7. Spesifikasi Antarmuka Frontend

### 7.1 Design Token

**Palet warna ("Ink & Ledger" — konsol keuangan retail/distribusi, sengaja menghindari biru SaaS generik):**
| Token | Nilai | Pemakaian |
|---|---|---|
| `--color-ink` | `#0B1220` | Sidebar, panel gelap (chrome) |
| `--color-ink-soft` | `#1A2336` | Elevasi di atas ink |
| `--color-canvas` | `#EEF1F5` | Latar halaman (dingin, bukan cream) |
| `--color-surface` | `#FFFFFF` | Panel, tabel |
| `--color-border` | `#D6DDE6` | Garis rambut pemisah |
| `--color-text` | `#101826` | Teks utama |
| `--color-muted` | `#5B6675` | Teks sekunder |
| `--color-accent` | `#0F766E` (teal-700) | Aksen tanda tangan: tombol utama, angka uang |
| `--color-success` | `#15803D` | Status APPROVED/POSTED |
| `--color-warning` | `#B45309` | PENDING, MATCH_EXCEPTION |
| `--color-danger` | `#B91C1C` | REJECTED, void, error |

**Tipografi:** `Inter Tight` (UI), monospace `JetBrains Mono` untuk angka/kode.
- Skala: `--text-xs 12px`, `--text-sm 14px`, `--text-base 16px`, `--text-lg 18px`, `--text-xl 24px`, `--text-2xl 30px`.
- Angka uang pakai `font-variant-numeric: tabular-nums` (kelas `.tabular`).

**Spacing:** basis 4px (`4/8/12/16/24/32/48`). Radius: `--radius-base 6px`, `--radius-lg 10px`. Garis rambut (`border`) menggantikan shadow lembut — hindari "kartu SaaS" seragam.

**Aksesibilitas:** focus ring teal jelas (`:focus-visible`), kontras WCAG AA, hormati `prefers-reduced-motion`.

### 7.2 Daftar Halaman & Rute

| Rute | Halaman | Aktor |
|---|---|---|
| `/login` | Login | Semua |
| `/dashboard` | Dashboard ringkasan (stok rendah, dokumen pending approval, AR/AP summary) | Semua |
| `/settings/company` | Manajemen Company/Branch/Warehouse | Super Admin |
| `/settings/users` | Manajemen User & Role | Super Admin |
| `/settings/permissions` | Manajemen Permission & Scope | Super Admin |
| `/settings/approval-rules` | Konfigurasi Approval Matrix | Super Admin |
| `/master/items` | Master Item (kode, nama, UoM, metode costing, track batch/serial) | Admin/Inventory |
| `/master/vendors` | Master Vendor | Procurement |
| `/master/customers` | Master Customer (termasuk credit limit) | Sales |
| `/master/coa` | Chart of Accounts (tree) | Finance |
| `/inventory/stock` | Stok per warehouse/bin (on-hand, reserved, available) | Warehouse/Finance |
| `/inventory/movements` | Riwayat stock movement (append-only, read-only) | Warehouse/Finance |
| `/inventory/transfer` | Transfer antar-gudang | Warehouse |
| `/inventory/opname` | Stock Opname | Warehouse |
| `/procurement/pr` | Purchase Requisition (list + form) | Procurement |
| `/procurement/po` | Purchase Order (list + form + approval) | Procurement |
| `/procurement/grn` | Goods Receipt | Warehouse |
| `/procurement/bills` | Vendor Bill + 3-way matching | Finance |
| `/sales/quotations` | Quotation | Sales |
| `/sales/orders` | Sales Order | Sales |
| `/sales/deliveries` | Delivery Order | Warehouse/Sales |
| `/sales/invoices` | Customer Invoice | Finance |
| `/finance/journals` | Journal Entries (list + detail, reversal) | Finance |
| `/finance/reports/trial-balance` | Trial Balance | Finance |
| `/finance/reports/balance-sheet` | Balance Sheet | Finance |
| `/finance/reports/profit-loss` | Profit & Loss | Finance |
| `/finance/reports/general-ledger` | General Ledger | Finance |
| `/audit/logs` | Audit Trail (read-only, filter) | Auditor/Admin |

### 7.3 Wireframe Deskriptif (halaman kunci)

**A. Login (`/login`)**
```
┌─────────────────────────────────────┐
│            [LOGO ERP]                │
│   ┌───────────────────────────────┐  │
│   │ Email                         │  │
│   │ [___________________________] │  │
│   │ Password                      │  │
│   │ [___________________________] │  │
│   │ [       Masuk        ]        │  │
│   └───────────────────────────────┘  │
└─────────────────────────────────────┘
```
Komponen: `Input`, `Button`, `FormError`. State: loading (spinner di tombol), error (pesan merah), success (redirect `/dashboard`).

**B. Dashboard (`/dashboard`)**
```
┌───────────────────────────────────────────────────────┐
│ Sidebar │  Header (Company switcher, user menu)        │
│         ├──────────────────────────────────────────────┤
│  [Nav]  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  │
│         │  │ Stok   │ │ PO     │ │ AR     │ │ AP     │  │
│         │  │ Rendah │ │Pending │ │ Total  │ │ Total  │  │
│         │  └────────┘ └────────┘ └────────┘ └────────┘  │
│         │  ┌─────────────────────────────────────────┐  │
│         │  │ Tabel: Dokumen menunggu approval Anda    │  │
│         │  └─────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────┘
```
Komponen: `StatCard`, `DataTable`, `CompanySwitcher`. State: loading skeleton, empty ("Tidak ada data"), error (retry).

**C. Sales Order form (`/sales/orders/new`)**
```
Header: [Nomor: SO/2026/00001] [Tanggal] [Customer ▼] [Status: DRAFT]
─────────────────────────────────────────────────────────────
Baris Item:
| Item ▼ | Qty | Harga | Diskon | Subtotal | [x] |
|--------|-----|-------|--------|----------|-----|
| [+] Tambah baris                                    |
─────────────────────────────────────────────────────────────
Ringkasan: Subtotal / PPN / Total
Credit check: Limit 5.000.000 | Outstanding 4.500.000 | Available 500.000
[Simpan Draft] [Konfirmasi SO]
```
Komponen: `Form`, `LineItemTable` (editable), `Select` (customer/item), `SummaryCard`, `Alert` (credit warning). State: validating, submitting (disable tombol), error inline.

**D. 3-Way Matching (`/procurement/bills/:id/match`)**
```
PO: 100 @ 10.000 | GRN: 100 | Bill: 100 @ 10.500
──────────────────────────────────────────────
Kolom: [Qty PO] [Qty GRN] [Qty Bill] [Harga PO] [Harga Bill] [Δ%] [Status]
Baris:  100      100       100       10.000      10.500       5%   ⚠ MATCH_EXCEPTION
──────────────────────────────────────────────
Toleransi: qty 2% | harga 2%
[Request Override] [Post Bill] (disabled jika exception belum override)
```

### 7.4 Perilaku Interaktif (global)

- **Loading state:** skeleton untuk tabel/kartu, spinner untuk aksi tombol.
- **Empty state:** ilustrasi + teks + CTA ("Belum ada data. Buat baru?").
- **Error state:** pesan ramah + tombol retry; error validasi inline per-field.
- **Konfirmasi destruktif:** modal konfirmasi untuk void/reject (dengan alasan wajib).
- **Feedback:** toast sukses/gagal untuk setiap mutasi.
- **Tabel ERP:** sorting, filter, pagination server-side, kolom angka right-aligned + tabular-nums.

---

## 8. Spesifikasi API & Kontrak Data

### 8.1 Konvensi Umum

- Base path: `/api/v1`.
- Auth: `Authorization: Bearer <access_token>`.
- Format waktu: ISO-8601 UTC (contoh `2026-02-14T07:30:00Z`).
- Content-Type: `application/json`.
- Semua endpoint mutasi kritis menerima header `Idempotency-Key` (wajib untuk POST dokumen transaksional).
- Multi-company: header/query `X-Company-Id` (atau dari konteks user) menentukan company aktif.

**Format error standar:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Qty harus lebih dari 0",
    "details": [{ "field": "lines[0].qty", "issue": "must be > 0" }]
  }
}
```
Kode: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `UNPROCESSABLE` (422), `INTERNAL_ERROR` (500).

**Pagination/filter/sort:**
- `?page=1&limit=25&sort=-created_at&filter[status]=POSTED`
- Respons list: `{ "data": [...], "meta": { "page": 1, "limit": 25, "total": 123, "totalPages": 5 } }`

### 8.2 Daftar Endpoint (P0)

**Auth & IAM**
| Method | Path | Deskripsi |
|---|---|---|
| POST | `/auth/login` | Login → access token + set refresh cookie |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Hapus refresh token |
| GET | `/me` | Profil user + permission + scope |
| POST | `/companies` | Buat company |
| GET | `/companies` | List company |
| POST | `/branches` | Buat branch |
| POST | `/warehouses` | Buat warehouse |
| POST | `/users` | Buat user |
| GET | `/users` | List user |
| POST | `/roles` | Buat role |
| PUT | `/roles/:id/permissions` | Set permission role |
| POST | `/approval-rules` | Buat approval rule |
| GET | `/approval-rules` | List approval rule |

**Master Data**
| Method | Path | Deskripsi |
|---|---|---|
| POST/GET | `/items` | Buat/list item |
| GET/PUT | `/items/:id` | Detail/ubah item |
| POST/GET | `/vendors` | Vendor |
| POST/GET | `/customers` | Customer |
| POST/GET | `/coa` | Chart of Accounts (tree) |
| PUT | `/coa/:id` | Ubah akun |

**Inventory**
| Method | Path | Deskripsi |
|---|---|---|
| GET | `/inventory/stock` | Stok (filter warehouse/bin/item) |
| POST | `/inventory/stock-in` | Stock In (idempotent) |
| POST | `/inventory/stock-out` | Stock Out (idempotent) |
| POST | `/inventory/transfer` | Transfer antar-gudang |
| POST | `/inventory/transfer/:id/complete` | Selesaikan transfer |
| POST | `/inventory/opname` | Stock Opname |
| GET | `/inventory/movements` | Riwayat movement (read-only) |

**Procurement**
| Method | Path | Deskripsi |
|---|---|---|
| POST/GET | `/procurement/pr` | Purchase Requisition |
| POST | `/procurement/pr/:id/convert-to-po` | Konversi PR → PO |
| POST/GET | `/procurement/po` | Purchase Order |
| POST | `/procurement/po/:id/submit` | Submit PO (masuk approval) |
| POST | `/procurement/po/:id/approve` | Approve PO (level) |
| POST | `/procurement/po/:id/reject` | Reject PO |
| POST | `/procurement/grn` | Goods Receipt (idempotent) |
| POST/GET | `/procurement/bills` | Vendor Bill |
| GET | `/procurement/bills/:id/match` | Hasil 3-way matching |
| POST | `/procurement/bills/:id/override` | Override match exception |
| POST | `/procurement/bills/:id/post` | Post bill (generate jurnal) |

**Sales**
| Method | Path | Deskripsi |
|---|---|---|
| POST/GET | `/sales/quotations` | Quotation |
| POST | `/sales/quotations/:id/convert-to-so` | Quotation → SO |
| POST/GET | `/sales/orders` | Sales Order |
| POST | `/sales/orders/:id/confirm` | Confirm SO (credit check + soft reserve) |
| POST | `/sales/orders/:id/cancel` | Cancel SO |
| POST | `/sales/deliveries` | Delivery Order (idempotent) |
| POST/GET | `/sales/invoices` | Customer Invoice |
| POST | `/sales/invoices/:id/void` | Void invoice (reversal) |
| POST | `/sales/invoices/:id/credit-note` | Credit note (retur parsial) |

**Finance**
| Method | Path | Deskripsi |
|---|---|---|
| POST/GET | `/finance/journals` | Journal Entry |
| POST | `/finance/journals/:id/reverse` | Reversal entry |
| GET | `/finance/reports/trial-balance` | Trial Balance |
| GET | `/finance/reports/balance-sheet` | Balance Sheet |
| GET | `/finance/reports/profit-loss` | P&L |
| GET | `/finance/reports/general-ledger` | General Ledger |

**Cross-cutting**
| Method | Path | Deskripsi |
|---|---|---|
| GET | `/audit/logs` | Audit trail (filter) |
| GET | `/health` | Health check (MySQL) |

### 8.3 Contoh Kontrak (kunci)

**POST `/sales/orders` (create)**
```json
// Request
{
  "customer_id": "uuid",
  "order_date": "2026-02-14",
  "lines": [
    { "item_id": "uuid", "qty": 200, "unit_price": 15000, "discount": 0 }
  ]
}
// Response 201
{
  "data": {
    "id": "uuid",
    "doc_number": "SO/2026/00001",
    "status": "DRAFT",
    "customer_id": "uuid",
    "subtotal": 3000000,
    "tax": 330000,
    "total": 3330000,
    "lines": [
      { "id": "uuid", "item_id": "uuid", "qty": 200, "unit_price": 15000, "subtotal": 3000000 }
    ]
  }
}
```

**POST `/sales/orders/:id/confirm`**
```json
// Response 200
{
  "data": {
    "id": "uuid",
    "status": "CONFIRMED",
    "reserved": [{ "item_id": "uuid", "warehouse_id": "uuid", "qty": 200 }]
  }
}
// Response 422 (credit limit)
{
  "error": { "code": "UNPROCESSABLE", "message": "Melebihi credit limit customer" }
}
```

**POST `/procurement/grn` (idempotent)**
```json
// Headers: Idempotency-Key: <uuid>
// Request
{
  "po_id": "uuid",
  "warehouse_id": "uuid",
  "received_date": "2026-02-14",
  "lines": [{ "po_line_id": "uuid", "qty_received": 100, "batch_no": "B-001" }]
}
// Response 201
{
  "data": {
    "id": "uuid",
    "doc_number": "GRN/2026/00001",
    "status": "POSTED",
    "journal_entry_id": "uuid"
  }
}
```

**GET `/finance/reports/trial-balance?period=2026-01`**
```json
{
  "data": {
    "period": "2026-01",
    "lines": [
      { "account_code": "1100", "account_name": "Cash", "debit": 5000000, "credit": 0, "balance": 5000000 }
    ],
    "total_debit": 5000000,
    "total_credit": 5000000
  }
}
```

---

## 9. Rencana Rilis Bertahap (Vertical Slice)

| Slice | Isi | Status |
|---|---|---|
| **P0a** | Bootstrap + IAM & Org Unit + COA + GL double-entry engine + Audit Trail + Outbox | Slice pertama (setelah Gerbang 1 & 2) |
| P0b | Inventory (stock, movement, transfer, opname, valuasi) | Menyusul |
| P0c | Procurement (PR→PO→GRN→Bill + 3-way matching) | Menyusul |
| P0d | Sales (Quotation→SO→DO→Invoice + credit + reserve) | Menyusul |
| P1 | Payment AR/AP, Payment Gateway, gRPC, Tax API, field/row-level RBAC, CQRS | Di luar P0 |

---

## 10. Referensi

- `docs/RESEARCH.md` — riset domain & teknis.
- `docs/ADR/0001-mysql-over-postgres.md` — keputusan DB.
- `AGENTS.md` — aturan rekayasa & lifecycle.

---

> **Catatan:** PRD ini berstatus **APPROVED** (Gerbang 1 lulus). Rencana arsitektur & eksekusi ada di `docs/ARCHITECTURE.md`.
