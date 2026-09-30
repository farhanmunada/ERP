# RESEARCH.md — Riset Teknis & Domain ERP Modular

> Status: **DRAFT RISET** (Fase 2 selesai). Basis fakta untuk penyusunan `docs/PRD.md`.
> Bahasa: Indonesia (istilah teknis/identifier tetap English).
> Tanggal riset: 2026-02 (sesi inisiasi projek).

---

## 1. Konteks Repositori (Fakta Terverifikasi)

| Aspek | Temuan | Sumber |
|---|---|---|
| Root projek | `D:\Coding\ERP` | `glob`/`read` |
| Isi awal | Hanya `AGENTS.md` (14.626 byte). Tidak ada kode. | `read` direktori |
| Git | Belum ada → diinisialisasi `git init -b main` pada sesi ini | `git init` |
| `docs/` | Belum ada → dibuat (`docs/`, `docs/ADR/`) | `New-Item` |
| Runtime tersedia | Bun `1.4.2`, Node `v24.13.0`, Docker `29.8.1`, Git `2.47.1` | `bun --version` dll |
| Framework aktif | Tidak ada (greenfield murni) | observasi |
| Status PRD | Belum ada → dokumen ini + `PRD.md` menyusul | observasi |

**Kesimpulan:** Projek adalah greenfield. Tidak ada kode lama yang membatasi pilihan. Semua keputusan arsitektur diambil dari nol.

---

## 2. Ruang Lingkup Domain

Sistem adalah **ERP modular** dengan 5 modul P0:

1. Identity, Access & Organization (IAM & Org Unit)
2. Inventory & Warehouse Management
3. Procurement (Procure-to-Pay / P2P)
4. Sales & Distribution (Order-to-Cash / O2C)
5. Finance & General Ledger (GL)

Target industri (keputusan operator): **Retail / Distribusi (merchandising)**.

---

## 3. Riset Domain — COA & Rantai Pasok per Tipe Industri

### 3.1 Perbandingan Tipe Industri

Riset akuntansi manajerial (OpenStax, SPSCC, Penn State) menunjukkan tiga tipe bisnis dengan karakter akuntansi berbeda:

| Aspek | Manufaktur | Merchandising (Retail/Distribusi) | Jasa |
|---|---|---|---|
| Inventory | Bahan baku → WIP → Finished Goods | Barang dagang tunggal (Merchandise Inventory) | Tidak ada |
| COGS | Beginning Inv + Cost of Goods **Manufactured** − Ending | Beginning Inv + **Purchases** − Ending | Tidak ada COGS (Cost of Services) |
| Akun kunci tambahan | WIP, Raw Material, Finished Goods, Overhead Applied, Variance | Hanya Merchandise Inventory | Tidak ada |
| BOM / Work Order | Wajib (multi-level BOM, routing) | Tidak ada | Tidak ada |
| Akun yang dipakai P0 | + WIP + RM + FG + Overhead | Cukup akun inventory tunggal | Tidak relevan |

**Implikasi:** Untuk retail/distribusi, skema COA **tidak** memerlukan akun WIP/Raw Material/Finished Goods, tidak ada BOM, dan COGS dihitung dari purchases. Ini memangkas kompleksitas P0 secara signifikan.

### 3.2 Skema COA Retail/Distribusi (Usulan)

Mengikuti konvensi umum (NetSuite, Sage, Microsoft Business Central):

```
1xxxx  ASSETS
  11xxx   Cash & Bank
  12xxx   Accounts Receivable (AR)
  13xxx   Inventory (Merchandise Inventory)
  14xxx   Prepaid / Other Current Assets
  15xxx   Fixed Assets
2xxxx  LIABILITIES
  21xxx   Accounts Payable (AP)
  22xxx   Tax Payable (PPN Keluaran / PPN Masukan)
  23xxx   Accrued Liabilities
3xxxx  EQUITY
  31xxx   Capital
  32xxx   Retained Earnings
4xxxx  REVENUE
  41xxx   Sales Revenue
  42xxx   Sales Returns / Discounts
5xxxx  EXPENSES
  51xxx   Cost of Goods Sold (COGS)
  52xxx   Operating Expenses (Salaries, Rent, Utilities)
  53xxx   Other Expenses
```

### 3.3 Alur Rantai Pasok

**Procure-to-Pay (P2P):**
`Purchase Requisition (PR)` → `Purchase Order (PO)` → `Goods Receipt (GRN)` → `Vendor Bill` → (P1: Payment)

**Order-to-Cash (O2C):**
`Quotation` → `Sales Order (SO)` → `Delivery Order (DO)` → `Customer Invoice` → (P1: Payment)

**Pemicu Jurnal (Double-Entry) — Retail:**
| Event | Debit | Credit |
|---|---|---|
| GRN (penerimaan barang) | Inventory | GRN Accrual / AP |
| Vendor Bill | GRN Accrual / AP | Accounts Payable |
| DO + Invoice (penjualan) | AR | Sales Revenue |
| HPP atas penjualan | COGS | Inventory |
| Retur penjualan | Sales Returns + Inventory | AR + COGS |

> Catatan: detail jurnal final difinalkan di `ARCHITECTURE.md` (Fase 4) setelah PRD disetujui.

---

## 4. Riset Teknis — MySQL vs PostgreSQL (BRIEF BERBEDA DENGAN KEPUTUSAN)

### 4.1 Fakta Penting

- Brief awal merekomendasikan **PostgreSQL** ("handle JSONB + complex ACID constraint").
- Operator memilih **MySQL lokal**. Ini dicatat sebagai **penyimpangan yang disengaja** dan wajib terdokumentasi di ADR.
- **Syarat keras: MySQL 8.0.16+** (keputusan operator: "MySQL 8.0.16+").

### 4.2 Matriks Kemampuan (Terverifikasi via Dokumentasi Resmi MySQL 8.0)

| Kebutuhan P0 | PostgreSQL | MySQL 8.0+ | Verifikasi |
|---|---|---|---|
| Pessimistic lock `SELECT ... FOR UPDATE` | ✅ | ✅ | MySQL Manual 17.7.2.4 |
| `SKIP LOCKED` / `NOWAIT` (deadlock prevention) | ✅ | ✅ **sejak 8.0.1** | MySQL Blog "Using SKIP LOCKED and NOWAIT" |
| JSON + operator query | ✅ JSONB native | ⚠️ `JSON` type; `->`, `->>`, `JSON_CONTAINS`, `JSON_EXTRACT` | MySQL Manual |
| `RETURNING` (INSERT/UPDATE ... RETURNING) | ✅ | ❌ (tidak ada) → gunakan `LAST_INSERT_ID()` / re-SELECT | MySQL Manual |
| `ON CONFLICT DO NOTHING` (idempotency) | ✅ | ⚠️ `INSERT ... ON DUPLICATE KEY UPDATE` / `INSERT IGNORE` | MySQL Manual |
| CHECK constraint enforced | ✅ | ✅ **sejak 8.0.16** | MySQL Release Notes 8.0.16 |
| CTE (`WITH`) & window function (reporting GL) | ✅ | ✅ **sejak 8.0** | MySQL Manual |
| Partial index | ✅ | ❌ (tidak ada partial index) | MySQL Manual |
| Composite index | ✅ | ✅ | MySQL Manual |
| Row-level lock via index | ✅ | ✅ (wajib index agar lock tidak jadi gap/table lock) | MySQL Manual 17.7.5.3 |

### 4.3 Konsekuensi Desain MySQL (Wajib Dipatuhi)

1. **`RETURNING` tidak ada.** Untuk insert-returning (mis. outbox, sequence), gunakan `LAST_INSERT_ID()` atau `SELECT` ulang dalam transaksi yang sama. **Dilarang menulis kode yang mengandalkan `RETURNING`.**
2. **Idempotency** memakai `UNIQUE KEY` pada kolom `idempotency_key` + `INSERT ... ON DUPLICATE KEY UPDATE` (bukan `ON CONFLICT`).
3. **Locking wajib lewat index.** `SELECT ... FOR UPDATE` pada kolom non-index → InnoDB bisa mengunci range/gap besar → risiko deadlock. Semua locking read harus mengenai index (PK atau unique key).
4. **Deadlock adalah normal.** InnoDB mendeteksi & rollback satu transaksi. **Aplikasi WAJIB menangani retry** (bukan menganggap error fatal). Sumber: MySQL Manual 17.7.5.3.
5. **Urutan locking konsisten.** Semua transaksi multi-tabel harus lock resource dalam urutan sama (mis. urut `item_id` ascending) untuk mencegah deadlock.
6. **JSON terbatas.** Simpan `before`/`after` audit sebagai `JSON` (kolom), tapi jangan andalkan query JSON kompleks; gunakan kolom terpisah untuk yang perlu di-filter.
7. **Isolation level.** Gunakan `READ COMMITTED` untuk locking read (rekomendasi MySQL Manual untuk mengurangi deadlock), bukan default `REPEATABLE READ`.

---

## 5. Riset Teknis — Stack Terpilih

### 5.1 Backend

| Komponen | Pilihan | Justifikasi / Sumber |
|---|---|---|
| Runtime | **Bun 1.4.2** | Terpasang; cepat; TypeScript native |
| HTTP Framework | **Fastify** | Ringan, plugin-based, performa tinggi |
| Bahasa | **TypeScript (strict)** | Sesuai AGENTS.md (no `any`) |
| DB Driver | **mysql2** | Didukung resmi Drizzle; matang |
| ORM / Query Builder | **Drizzle ORM** (dialect `mysql2`) | Dukungan MySQL resmi (docs.drizzle.team/docs/mysql) |
| Migrasi | **drizzle-kit** | Generate & apply migration dari schema TS |
| Validasi DTO | **Zod** | Type-safe boundary validation (rujukan vault: system-design) |
| Event Broker | **RabbitMQ** (via `amqplib`) — *ditunda ke P1 (ADR-0002)* | Sesuai brief; vault punya memori bug amqplib (lihat §6) |
| Cache / Lock | **Redis** — *tidak dipakai di P0 (ADR-0002)* | Untuk cache read & distributed lock opsional |
| Auth | **JWT + refresh token (httpOnly cookie)** | Keputusan operator |

> **Catatan Bun.SQL vs mysql2:** Bun 1.2.21+ menyediakan driver MySQL native (`bun:sql`). Namun Drizzle hanya mengikat resmi ke `mysql2` untuk dialect MySQL. **Keputusan: pakai `mysql2`** agar integrasi Drizzle stabil. (Riset: Bun Blog v1.2.21, Drizzle docs.)

### 5.2 Frontend

| Komponen | Pilihan | Justifikasi |
|---|---|---|
| Build tool | **Vite** | Cepat, SPA-first |
| Library | **React + TypeScript** | Ekosistem luas |
| Styling | **Tailwind CSS** | Utility-first |
| Komponen | **shadcn/ui** | Komponen headless, dapat dikustom, bukan template klise |
| Server state | **TanStack Query** | Caching, retry, dedup request |
| Tabel | **TanStack Table** | Grid ERP (sorting, filter, pagination) |
| Routing | **React Router** | SPA routing |
| Form | **React Hook Form + Zod** | Validasi selaras dengan DTO backend |

### 5.3 Infrastruktur

| Komponen | Pilihan |
|---|---|
| Database dev | **MySQL lokal via Laragon** (`127.0.0.1:3306`) |
| Aplikasi | Dijalankan di host (Bun) |

> **Revisi (ADR-0002):** rencana awal **docker-compose (MySQL/Redis/RabbitMQ)** dibatalkan. Audit Slice P0a menemukan Redis tak terpakai dan broker hanya dipakai relay yang belum dibutuhkan P0. Dev kini **tanpa Docker**; relay outbox ke broker ditunda ke P1. Lihat `docs/ADR/0002-tanpa-docker-lokal.md`.

---

## 6. Riset Bug Memory Vault (Retrieval Gate)

Hasil `grep` di `C:\Users\vola\agentVault\06-Bug-Solutions\INDEX-BUGS.md`: **7 arsip**, seluruhnya stack **Bun + PostgreSQL**:

| ID | Masalah | Relevansi ke projek ini |
|---|---|---|
| BUG-20260929-01 | Bun.sql kembalikan BIGINT sebagai string | ⚠️ Relevan → MySQL juga bisa kembalikan BIGINT sebagai string di driver JS. Wajib normalisasi tipe. |
| BUG-20260929-02 | Race publisher RabbitMQ: channel dibuat ulang per request | ⚠️ **Sangat relevan** → pakai **satu channel publisher singleton**, jangan buat channel per request. |
| BUG-20260929-03 | Worker simpan bookingId sebagai idempotency_key | ⚠️ Sangat relevan → idempotency_key HARUS berasal dari klien, bukan ID internal. |
| BUG-20260929-04 | Bun.sql tidak serialize array JS ke literal array PostgreSQL | ⚠️ Postgres-specific; di MySQL tidak ada array native → gunakan tabel relasi/JSON. |
| BUG-20260929-05 | k6 hitung 410 sebagai error | ℹ️ Relevan saat load test P1. |
| BUG-20260929-06 | Provisioning token via argon2id terlalu lambat | ℹ️ Relevan saat hashing password (pilih cost factor wajar). |
| BUG-20260929-07 | /health tidak laporkan status dependency | ⚠️ Relevan → endpoint health wajib cek MySQL/Redis/RabbitMQ. |

**Kesimpulan:** Tidak ada bug yang cocok persis (stack berbeda: Postgres vs MySQL), tetapi 4 pola (**publisher channel race, idempotency key semantics, BIGINT string, health dependency check**) adalah **pelajaran lintas-projek** yang wajib diterapkan sejak P0. Bukan "hit" solusi siap pakai, melainkan "hit" pola pencegahan.

---

## 7. Riset Pola Kritis (Wajib Masuk PRD/Arsitektur)

### 7.1 Idempotency
- Setiap endpoint mutasi kritis (submit order, approval, payment) menerima header **`Idempotency-Key`** dari klien.
- Simpan di tabel `idempotency_keys(key UNIQUE, user_id, endpoint, request_hash, response_body, status, created_at)`.
- `INSERT ... ON DUPLICATE KEY UPDATE` untuk klaim atomic; permintaan duplikat mengembalikan respons tersimpan.
- **Bug memory check:** key dari klien, bukan ID internal (BUG-20260929-03).

### 7.2 Transactional Outbox (Keputusan Operator)
- Event bisnis ditulis ke tabel `outbox_events` **dalam transaksi DB yang sama** dengan data bisnis → atomic.
- Relay worker polling `SELECT ... FOR UPDATE SKIP LOCKED` (aman multi-instance) → publish ke RabbitMQ → tandai `published_at`.
- Consumer wajib idempotent (tabel `processed_events(event_id UNIQUE)` + `INSERT IGNORE`).
- Sumber: MySQL outbox pattern (OneUptime, AWS Prescriptive Guidance).
- **Skema referensi (MySQL):**
  ```sql
  CREATE TABLE outbox_events (
    id             BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    event_id       CHAR(36) NOT NULL,
    event_type     VARCHAR(100) NOT NULL,
    aggregate_type VARCHAR(50) NOT NULL,
    aggregate_id   VARCHAR(100) NOT NULL,
    payload        JSON NOT NULL,
    published_at   TIMESTAMP NULL,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_event_id (event_id),
    INDEX idx_unpublished (published_at, created_at)
  ) ENGINE=InnoDB;
  ```

### 7.3 Append-Only Ledger
- Tabel `journal_entries` (header) + `journal_lines` (detail, debit/credit) bersifat **append-only**: dilarang `UPDATE`/`DELETE`.
- Koreksi hanya via **reversal entry** (jurnal balik) yang mereferensikan jurnal asal (`reversal_of_id`).
- Constraint: total debit = total kredit per entry (dicek di service + CHECK/validasi aplikasi).

### 7.4 Locking & Deadlock Prevention
- Mutasi stok & saldo akun: `SELECT ... FOR UPDATE` pada baris target via PK/unique index.
- Urutan lock konsisten: urutkan resource by ID ascending sebelum lock.
- Tangani error deadlock (MySQL error code **1213**) dengan **retry** terbatas (mis. 3x, exponential backoff).
- Untuk saldo akun: pertimbangkan optimistic locking via kolom `version` sebagai alternatif.

### 7.5 Reversal / Pembatalan Parsial
- Void invoice yang sudah terjurnal → buat reversal journal, bukan hapus.
- Retur penjualan sebagian → credit note + jurnal balik COGS & Inventory proporsional.
- GRN return ke vendor → jurnal balik penerimaan.

### 7.6 Penomoran Dokumen
- Tabel `document_sequences(company_id, doc_type, prefix, next_number, ...)`.
- Ambil nomor via `SELECT ... FOR UPDATE` pada baris sequence (row lock) di dalam transaksi → atomic & anti-duplikat.

### 7.7 Audit Trail
- Tabel tunggal `audit_logs(id, company_id, user_id, action, entity_type, entity_id, state_before JSON, state_after JSON, ip_address, created_at)`.
- Ditulis untuk setiap mutasi data sensitif (transaksional & master data kritis).

### 7.8 Reporting (P0)
- P0: query langsung ke `journal_lines` dengan index tepat; saldo via agregasi/materizlied view (jika perlu) — **CQRS ditunda** sampai beban terbukti.

---

## 8. Riset Standar Akuntansi & Pajak

- **PPN Indonesia:** tarif saat ini 12% (dengan mekanisme DPP nilai lain untuk barang tertentu). Sistem P0 menyimpan tarif pajak **configurable per item/transaksi**, tidak hardcode, agar perubahan tarif tidak merusak data historis.
- **Faktur pajak / e-Faktur:** integrasi ke API pajak masuk P1 (brief menyebut Tax API sebagai integrasi eksternal).
- **Mata uang:** IDR tunggal (keputusan operator) → tidak perlu tabel FX rate di P0.

---

## 9. Risiko & Asumsi Terbuka

| # | Risiko | Dampak | Mitigasi |
|---|---|---|---|
| R1 | Brief menyarankan Postgres, dipakai MySQL | Fitur JSON/RETURNING terbatas | ADR + pola desain §4.3 |
| R2 | Event async vs atomic journal (tension di brief) | Inkonsistensi GL | Transactional Outbox (§7.2) |
| R3 | Retur/reversal parsial kompleks | Salah jurnal | Desain reversal eksplisit (§7.5) |
| R4 | Deadlock saat mass stock reservation | Transaksi gagal | Urutan lock + retry (§7.4) |
| R5 | Reporting GL membebani OLTP | Latensi | Index + defer CQRS (§7.8) |
| R6 | Driver JS kembalikan DECIMAL/BIGINT sebagai string | Bug kalkulasi uang | Normalisasi tipe eksplisit (BUG-20260929-01) |
| R7 | RabbitMQ channel race | Publisher error sporadis | Channel singleton (BUG-20260929-02) |

---

## 10. Kesimpulan Riset

1. Projek greenfield; stack backend **Bun + Fastify + Drizzle(mysql2) + MySQL 8.0.16+** (Redis/RabbitMQ **ditunda ke P1** — ADR-0002), frontend **React + Vite + Tailwind + shadcn**.
2. Target industri **retail/distribusi** menyederhanakan COA (tanpa WIP/BOM).
3. Penyimpangan Postgres→MySQL **layak** selama 8.0.16+ dan pola §4.3 dipatuhi.
4. Empat pola kritis (Idempotency, Outbox, Append-only ledger, Locking order) menjadi tulang punggung P0.
5. Pelajaran bug-memory lintas-projek (§6) wajib diterapkan sejak awal.

**Basis fakta ini menjadi input langsung untuk `docs/PRD.md` (Fase 3).**
