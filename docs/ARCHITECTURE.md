# ARCHITECTURE.md — ERP Modular (Retail/Distribusi)

> Status: **APPROVED ✅ (Gerbang 2 lulus) — Slice P0a SELESAI; Slice P0b (Inventory) SELESAI; Slice P0c (Procurement) SELESAI; Slice P0d (Sales/O2C) SELESAI diimplementasi (kode di `backend/` & `frontend/`)**
> Bahasa: Indonesia (istilah teknis/identifier tetap English).
> Basis: `docs/PRD.md` (APPROVED), `docs/RESEARCH.md`, `docs/ADR/`.
> Versi: 1.0.0 · Fase: 4 (Task Decomposition & Architecture Planning)

---

## 1. Gambaran Arsitektur Tingkat Tinggi

Arsitektur **decoupled**: SPA frontend + REST API backend, dihubungkan via HTTP/JSON. Backend menulis **Transactional Outbox** (`outbox_events`) dalam transaksi bisnis; relay ke broker **ditunda ke P1** (lihat `docs/ADR/0002`).

```text
┌──────────────────────────────────────────────────────────────┐
│                     BROWSER (React SPA)                       │
│   Vite + TS + Tailwind + shadcn/ui + TanStack Query/Table     │
└───────────────────────────┬──────────────────────────────────┘
                            │ HTTPS / REST JSON (Bearer JWT)
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                    BACKEND API (Bun + Fastify)                │
│                                                               │
│   Router → Controller → Service → Repository → (MySQL)        │
│                  │                                            │
│                  └──► Outbox (same DB tx)                     │
│                          └── relay ke broker: P1 (ADR-0002)   │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  MySQL 8.0.16+│  (lokal via Laragon, tanpa Docker)
                    └───────────────┘
```

---

## 2. Alur Data (Route → Controller → Service → Repository → DB)

```text
HTTP Request
     │
     ▼
[ ROUTER ]        ← path mapping, bind middleware (auth, rbac, idempotency)
     │
     ▼
[ CONTROLLER ]    ← parse req, validasi Input DTO (Zod), panggil Service, format Output DTO
     │
     ▼
[ SERVICE ]       ← logika bisnis murni, orkestrasi transaksi (db.transaction), panggil modul lain via public interface
     │
     ▼
[ REPOSITORY ]    ← eksekusi query Drizzle, locking (FOR UPDATE), mapping entity
     │
     ▼
[ DATABASE ]      ← MySQL (InnoDB)
```

**Aturan Layer (dari vault, wajib):**
- Router: hanya path + middleware. DILARANG logika bisnis.
- Controller: DILARANG query DB langsung. Hanya DTO → Service → response.
- Service: DILARANG tahu HTTP (`req`/`res`). Orkestrasi transaksi & business rule.
- Repository: DILARANG tahu HTTP/business rule. Hanya data access.
- Validator (Zod): format & batasan; validasi lintas-entitas (mis. credit limit) di Service.

---

## 3. Struktur Folder (Decoupled)

```text
D:\Coding\ERP\
├── AGENTS.md
├── README.md
├── docs/
│   ├── RESEARCH.md
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   └── ADR/
│
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── drizzle.config.ts
│   ├── .env.example
│   └── src/
│       ├── core/                   # Kernel bersama
│       │   ├── config/env.ts       # Validasi .env via Zod
│       │   ├── database/client.ts  # Drizzle + mysql2 pool
│       │   ├── errors/app-error.ts # Domain error classes
│       │   ├── http/response.ts    # Format response/error standar
│       │   ├── middleware/
│       │   │   ├── auth.middleware.ts
│       │   │   ├── rbac.middleware.ts
│       │   │   ├── idempotency.middleware.ts
│       │   │   └── error.middleware.ts
│       │   ├── audit/audit-log.ts  # Helper tulis audit trail
│       │   ├── outbox/             # Tulis event ke outbox (relay ke broker: P1)
│       │   │   └── outbox-writer.ts
│       │   └── sequence/doc-number.ts # Penomoran dokumen (row lock)
│       │
│       ├── db/
│       │   ├── schema/             # Skema Drizzle per modul
│       │   │   ├── iam.schema.ts
│       │   │   ├── inventory.schema.ts
│       │   │   ├── procurement.schema.ts
│       │   │   ├── sales.schema.ts
│       │   │   ├── finance.schema.ts
│       │   │   └── shared.schema.ts   # audit_logs, outbox_events, idempotency_keys, document_sequences
│       │   └── migrations/
│       │
│       ├── modules/                # Modul fitur independen
│       │   ├── iam/
│       │   │   ├── iam.routes.ts
│       │   │   ├── iam.controller.ts
│       │   │   ├── iam.service.ts
│       │   │   ├── iam.repository.ts
│       │   │   ├── iam.schema.ts   # Zod DTO
│       │   │   ├── iam.types.ts
│       │   │   ├── iam.spec.ts
│       │   │   └── index.ts        # Public interface
│       │   ├── org/
│       │   ├── finance/            # COA + journal engine + reports
│       │   ├── inventory/
│       │   ├── procurement/
│       │   └── sales/
│       │
│       ├── app.ts                  # Registrasi plugin & route
│       └── server.ts               # Entry point
│
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── app/
        │   ├── App.tsx
        │   ├── router.tsx
        │   └── providers.tsx       # QueryClient, AuthProvider
        ├── features/
        │   ├── auth/
        │   │   ├── components/
        │   │   ├── hooks/useAuth.ts
        │   │   ├── api/auth.api.ts
        │   │   ├── types.ts
        │   │   └── index.ts
        │   ├── iam/ org/ inventory/ procurement/ sales/ finance/ audit/
        └── shared/
            ├── components/ui/      # shadcn primitives
            ├── hooks/
            ├── lib/api-client.ts   # fetch wrapper + auth + error handling
            └── types/
```

**Aturan batas modul:** antar-modul hanya impor via `index.ts` (public interface). DILARANG deep-piercing (`modules/x/internal/...`).

---

## 4. Keputusan Komponen Kritis

### 4.1 Transaksi & Locking
- Semua mutasi stok/saldo dalam `db.transaction()`.
- Locking: `SELECT ... FOR UPDATE` via PK/unique index.
- Urutan lock: resource diurut `id` ascending (anti-deadlock).
- Retry otomatis saat MySQL error **1213** (deadlock) — max 3x, exponential backoff.

### 4.2 Append-Only Ledger
- `journal_entries` + `journal_lines`: dilarang UPDATE/DELETE (enforced di repository — tidak ada method update/delete).
- Koreksi via `reversal_of_id`.
- `stock_movements`: append-only juga.

### 4.3 Transactional Outbox
- Service menulis event ke `outbox_events` **dalam transaksi yang sama** dengan data bisnis (atomic).
- **Relay ke broker ditunda ke P1** (ADR-0002). Saat dihidupkan: worker polling `SELECT ... FOR UPDATE SKIP LOCKED` → publish → set `published_at`.
- Consumer idempotent via `processed_events(event_id UNIQUE)`.
- **Pelajaran bug-memory:** saat relay ditambahkan kembali, publisher broker wajib pakai **channel singleton** (BUG-20260929-02), bukan per-request.

### 4.4 Idempotency
- Middleware membaca `Idempotency-Key`; simpan di `idempotency_keys` dengan `UNIQUE KEY`.
- Klaim atomic via `INSERT ... ON DUPLICATE KEY UPDATE`.
- Request duplikat (key sama) → kembalikan respons tersimpan.
- Key dari klien (BUG-20260929-03).

### 4.5 Audit Trail
- Helper `writeAuditLog()` dipanggil service untuk mutasi sensitif.
- Satu tabel `audit_logs` (generik).

### 4.6 Penomoran Dokumen
- `document_sequences(company_id, doc_type, prefix, next_number)`.
- Ambil nomor via `SELECT ... FOR UPDATE` di dalam transaksi.

### 4.7 Auth & RBAC
- JWT access (15 menit) + refresh token httpOnly cookie.
- Middleware `auth` memvalidasi token; `rbac` cek permission `resource:action` + scope org-unit.
- Password hash: Argon2id (cost factor wajar).

### 4.8 Reporting
- P0: query langsung `journal_lines` dengan index; CQRS ditunda.

---

## 5. Skema Database (Ringkas — Slice P0a)

> Detail penuh ditulis di `db/schema/*.ts` saat implementasi. Ringkasan tabel:

**Shared / Cross-cutting**
- `companies`, `branches`, `warehouses`
- `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `user_scopes`
- `approval_rules`, `approval_requests`
- `audit_logs`, `outbox_events`, `processed_events`, `idempotency_keys`, `document_sequences`

**Finance**
- `accounts` (COA: id, company_id, code, name, parent_id, type, is_active)
- `journal_entries` (id, company_id, doc_number, date, description, status, reversal_of_id, created_by, created_at)
- `journal_lines` (id, entry_id, account_id, debit, credit, description)

**Konvensi kolom wajib:**
- `id` CHAR(36) UUID (atau BIGINT auto-increment untuk tabel log).
- `company_id` untuk isolasi multi-entity.
- `created_at`, `updated_at` TIMESTAMP UTC.
- `created_by`, `updated_by` (FK users).
- Uang `DECIMAL(18,2)`, qty `DECIMAL(18,4)`.

---

## 6. Kontrak Error & Response

Selaras PRD §8.1. Error middleware terpusat → payload seragam:
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] } }
```

---

## 7. Rencana Eksekusi — Slice P0a (IAM + Org + GL Engine)

> Slice pertama. Fokus: fondasi jurnal yang dipakai semua modul. **Estimasi: ~40+ file.**

### 7.1 Sub-tugas & Urutan Eksekusi

| # | Sub-tugas | Output |
|---|---|---|
| T1 | Bootstrap backend (package.json, tsconfig, Fastify app, env config) | `backend/` skeleton |
| T2 | Konfigurasi infra dev: `.env.example` + MySQL lokal (Laragon, tanpa Docker — ADR-0002) | infra dev |
| T3 | Core: errors, response formatter, error middleware | `core/errors`, `core/http` |
| T4 | Core: DB client (Drizzle + mysql2) + shared schema (audit/outbox/idempotency/sequence) | `core/database`, `db/schema/shared` |
| T5 | Migrasi awal shared + IAM + org + finance schema | `db/migrations` |
| T6 | Modul IAM: auth (login/refresh/logout), users, roles, permissions | `modules/iam` |
| T7 | Modul Org: companies, branches, warehouses | `modules/org` |
| T8 | Middleware: auth, rbac, idempotency | `core/middleware` |
| T9 | Core: audit helper + outbox writer + doc-number | `core/audit`, `core/outbox`, `core/sequence` |
| T10 | Modul Finance: COA (CRUD + tree) | `modules/finance` |
| T11 | Modul Finance: journal engine (create/post/reverse, validasi balance, append-only) | `modules/finance` |
| T12 | Modul Finance: reports (trial balance, balance sheet, P&L, GL) | `modules/finance` |
| T13 | Approval rules (config + submit/approve/reject) | `modules/iam` atau modul `approval` |
| T14 | Outbox writer (transactional, same DB tx). Relay ke broker **ditunda ke P1** (ADR-0002) | `core/outbox/outbox-writer.ts` |
| T15 | Bootstrap frontend (Vite, Tailwind, shadcn, router, providers, api-client) | `frontend/` skeleton |
| T16 | Frontend: auth (login) + layout shell + dashboard | `frontend/src/features/auth` |
| T17 | Frontend: IAM/Org settings pages + COA tree + journal pages + reports | `frontend/src/features/*` |
| T18 | Tier 1 & Tier 2 verification (typecheck, lint, unit test, migration smoke test) | test suite |

### 7.2 Berkas yang Dibuat (ringkas)

- **Backend core:** ~15 file (`core/*`).
- **Backend schema:** ~6 file (`db/schema/*`) + migrasi.
- **Backend modul:** IAM (~8), Org (~5), Finance (~8), Approval (~4).
- **Frontend:** ~20 file (shell, auth, iam, org, finance, shared).
- **Infra:** `.env.example`, config files (MySQL lokal via Laragon; tanpa Docker — ADR-0002).

### 7.3 Pola Arsitektur
- Decoupled (backend/ + frontend/).
- Backend: module-based, Route→Controller→Service→Repository.
- Frontend: feature-first, container/presentational split.
- Event: Transactional Outbox.
- Data: append-only ledger.

### 7.4 Dependensi Baru (butuh konfirmasi manusia)

**Backend:**
| Package | Alasan | Alternatif native? |
|---|---|---|
| `fastify` | HTTP framework | Bun.serve native — tapi Fastify lebih terstruktur (plugin, validation, hooks) untuk ERP besar |
| `@fastify/cookie` | Refresh token httpOnly | — |
| `@fastify/jwt` | JWT | `jose` manual |
| `drizzle-orm` + `drizzle-kit` | ORM + migrasi MySQL | SQL mentah — lebih rawan, tanpa type-safety |
| `mysql2` | Driver MySQL resmi Drizzle | Bun.SQL native (belum terikat resmi ke Drizzle) |
| `zod` | Validasi DTO | — |
| `pino` | Logging terstruktur | `console` — kurang terstruktur |

**Frontend:**
| Package | Alasan |
|---|---|
| `react`, `react-dom` | UI |
| `react-router-dom` | Routing |
| `@tanstack/react-query` | Server state |
| `@tanstack/react-table` | Grid ERP |
| `tailwindcss` | Styling |
| `shadcn/ui` (copy-in) | Komponen |
| `react-hook-form` + `zod` | Form + validasi |

> **Catatan Dependency Ladder:** `argon2` digantikan `Bun.password` (native). `amqplib`/`ioredis` **dihapus** (tak terpakai; ADR-0002). `pino` dipertimbangkan karena logging terstruktur dibutuhkan untuk observability.

### 7.5 Strategi Verifikasi
- **Tier 1:** `bunx tsc --noEmit`, lint, `bun test` (unit: journal balance, idempotency, doc-number).
- **Tier 2:** jalankan migrasi nyata ke MySQL lokal (Laragon), smoke test (insert company → user → COA → journal → trial balance).

---

## 8. Batasan & Aturan Modul (Import Rules)

```text
core/  ← boleh diimpor semua modul; TIDAK boleh impor modules/
db/    ← boleh diimpor semua; TIDAK impor modules/
modules/iam      → boleh impor core, db
modules/org      → boleh impor core, db, modules/iam (public)
modules/finance  → boleh impor core, db, modules/org (public)
modules/inventory→ boleh impor core, db, modules/finance (public), modules/org
modules/procurement → core, db, finance, inventory, org
modules/sales    → core, db, finance, inventory, org
```
DILARANG circular dependency. Antar-modul hanya via `index.ts`.

---

## 9. Referensi
- `docs/PRD.md` — kebutuhan & kriteria penerimaan.
- `docs/RESEARCH.md` — riset & pola kritis.
- `docs/ADR/0001-mysql-over-postgres.md`.
- `docs/ADR/0002-tanpa-docker-lokal.md`.
- Vault: `03-Implementation-and-Clean-Code/*`.

---

> **Catatan Gerbang 2:** Rencana ini mencakup ≥ 3 file → **WAJIB STOP & WAIT**. DILARANG menulis kode sebelum operator menyetujui.

---

## 10. Status Implementasi Slice P0a (Per 2026-09-30)

| Task | Status | Bukti |
|---|---|---|
| T1 Bootstrap backend | ✅ | `bunx tsc --noEmit` = 0 |
| T2 Infra dev (MySQL lokal, tanpa Docker) | ✅ | ADR-0002; Docker & broker dihapus |
| T3 Core errors/response/logger | ✅ | test hijau |
| T4 DB client + shared schema | ✅ | 5 tabel |
| T5 Schema IAM/Org/Finance + migrasi | ✅ | 20 tabel, migrasi `0000_silky_cammi.sql` ter-generate |
| T6-T9 IAM (auth/users/company/rbac/audit/outbox/doc-number) | ✅ | tsc 0 |
| T10-T12 Finance (COA, journal engine, reports) | ✅ | unit test journal + money hijau |
| T13 Approval rules (engine submit/approve/reject multi-tier) | ✅ | smoke test 2-tier hijau |
| T14 Outbox writer (transactional). Relay ke broker ditunda ke P1 | ✅ | tsc 0 |
| T15-T17 Frontend (shell, auth, dashboard, COA/Jurnal/Laporan) | ✅ | `vite build` sukses |
| T18 Verifikasi Tier 1 | ✅ | typecheck 0, 17 unit test pass, build sukses |
| T18 Verifikasi Tier 2 (migrasi + smoke DB nyata) | ✅ | MySQL 8.4.3; 21 tabel; DB smoke + API smoke hijau |

### Blocker Terbuka
- **Tidak ada.** Redis/RabbitMQ & Docker tidak dipakai di P0 (ADR-0002); relay outbox dihidupkan kembali di P1 saat dibutuhkan.

### Catatan Environment
- **MySQL lokal via Laragon 8.4.3** di `127.0.0.1:3306` (root tanpa password), database `erp`. **Tanpa Docker** — lihat `docs/ADR/0002-tanpa-docker-lokal.md`.
- Seed: `bun run db:seed` → company `DEMO`, admin `admin@erp.local` / `admin12345`, 10 akun COA.

### Bug terarsip (Harvester Gate)
- `BUG-20260930-01` pino-pretty transport hang di bun test
- `BUG-20260930-02` TypeScript 7 hapus `baseUrl`
- `BUG-20260930-03` import path spec co-located
- `BUG-20260930-04` domain validation plain Error → 500 (harus 422)

---

## 11. Status Implementasi Slice P0b — Inventory (Per 2026-09-30)

| Task | Status | Bukti |
|---|---|---|
| Schema inventory (8 tabel: items, warehouse_stock, stock_movements, item_cost_layers, item_serials, stock_transfers, stock_opnames, stock_opname_lines) | ✅ | `0001_wide_kate_bishop.sql` + `0002_jazzy_kid_colt.sql` ter-generate |
| Core helpers (qty fixed-point, dead-lock retry, stock-row locking) | ✅ | `core/qty.ts`, `core/database/transaction.ts`, `stock.helpers.ts` |
| Costing engine (Moving Average + FIFO pure functions) | ✅ | 7 unit tests pass (PRD 2.3.1 + 2.3.2) |
| Item service (CRUD master item) | ✅ | tsc 0 |
| Stock service (stock-in/out + costing + audit + outbox) | ✅ | DB smoke: MA avg=11000, FIFO COGS=1600000 |
| Transfer service (create in-transit + complete) | ✅ | DB smoke: available=170 saat in-transit, A=170 B=30 saat complete |
| Opname service (adjustment + auto journal) | ✅ | DB smoke: opname journal ter-generate, TB balanced |
| Batch/serial tracking (validation + storage) | ✅ | API smoke: tanpa Idempotency-Key→400 |
| Idempotency middleware (withIdempotency pattern) | ✅ | API smoke: replay mengembalikan movementId sama |
| Endpoint warehouses dropdown | ✅ | GET /api/v1/warehouses |
| Frontend: Items, Stock, Movements, Transfer, Opname pages | ✅ | vite build OK (94 modules) |
| Verifikasi Tier 1 & Tier 2 | ✅ | tsc 0 · 24 unit test · DB smoke LULUS · API smoke LULUS · vite build OK |

### Bug P0b (ditemukan & diperbaiki)
- **BUG-20260930-09** FIFO layer non-deterministik (created_at tie → UUID sort membalik urutan layer → HPP salah). Perbaikan: kolom `seq BIGINT AUTO_INCREMENT` pada `stock_movements` dan `item_cost_layers` untuk urutan total pasti.
- **BUG-20260930-10** Idempotency replay mengeksekusi side-effect dobel (`replyIdempotent` memanggil `produce()` dulu baru cek replay). Perbaikan: pola `withIdempotency` yang cek replay **sebelum** `produce()`.
- **BUG-20260930-11** Migrasi 0002 gagal separuh di MySQL (`ALTER TABLE ADD seq AUTO_INCREMENT` tanpa UNIQUE di statement terpisah → error 1075). Perbaikan: gabung kolom + constraint dalam satu `ALTER TABLE`; repair manual DB live.

---

## 12. Status Implementasi Slice P0c — Procurement (Procure-to-Pay) (Per 2026-09-30)

> **Gerbang 2 lulus (2026-09-30):** Operator menyetujui eksekusi **P0c utuh** (tidak dipecah), toleransi default **2% qty / 2% harga**, dan **PPN opsional** pada Vendor Bill (default 0). Rencana di bawah sudah diimplementasi penuh.

### 12.0 Tabel Status

| Task | Status | Bukti |
|---|---|---|
| Schema procurement (10 tabel incl. `procurement_settings`) | ✅ | `db/schema/procurement.schema.ts` + migrasi `0003_organic_nextwave.sql` (39 tabel total) |
| Migrasi 0003 ter-generate, direview, ter-apply | ✅ | `bun run db:migrate` sukses; lihat **BUG-20260930-12** (replay 0002 diperbaiki) |
| Seed (COA `2130` GRN Accrual, permission, vendor sample, rule approval PO, settings 2/2) | ✅ | `db/seed-data.ts` + `db/seed.ts`; API smoke: COA 11 akun, toleransi 2.00 |
| Matching engine 3-way (pure function + unit test) | ✅ | `matching.ts` + `matching.spec.ts` (6 test baru) |
| Vendor service + CRUD `/vendors` | ✅ | API smoke: vendor dibuat 201 |
| PR service (DRAFT→APPROVED→CONVERTED) + konversi ke PO | ✅ | API smoke: PR dibuat → approve → PO 201 |
| PO service + submit/approve/reject via approval matrix | ✅ | DB smoke [7][8][16]; API smoke: submit→APPROVED (<100jt auto) |
| GRN atomic (`stockInTx` + jurnal + idempotent) | ✅ | DB smoke [17][18] (parsial 60→40, PO RECEIVED); API smoke replay idempotent |
| Vendor Bill + match + override + post (PPN opsional) | ✅ | DB smoke [19][20][21]; jurnal Debit 2130+2120 / Credit 2100 |
| Controller + routes + permission (`vendor:manage`, `pr:*`, `grn:create`, `bill:*`) | ✅ | tsc 0; API smoke: 400 tanpa key, 403 tanpa permission |
| Frontend: Vendors/PR/PO/GRN/Bill pages + modal + nav "Pengadaan" | ✅ | `frontend/src/features/procurement/*`; vite build OK (102 modul) |
| Verifikasi Tier 1 & Tier 2 | ✅ | tsc 0 · **30 unit test pass** · DB smoke **LULUS (21 langkah)** · API smoke **LULUS** · vite build OK |

### Bug P0c (ditemukan & diperbaiki)
- **BUG-20260930-12** Migrasi Drizzle replay gagal (`Duplicate column name 'seq'`, errno 1060) karena migrasi `0002` di-apply **manual** (perbaikan BUG-11) namun barisnya **tidak tercatat** di `__drizzle_migrations` → migrator me-replay `0002` saat menjalankan `0003`. Perbaikan: catat baris `0002` (hash SHA-256 `baa33d74…` + `created_at` = `when` journal `1790738951124`); lihat [[06-Bug-Solutions/drizzle-migration-manual-apply-not-recorded]].

### 12.1 Ruang Lingkup

Alur P2P: **PR → PO → GRN → Vendor Bill + 3-way matching**. Mengacu PRD Modul 3 (Story 3.1–3.3) dan PRD §8.2.

- Master **Vendor** (kode, nama, kontak, NPWP, termin).
- **PR** (Purchase Requisition) + konversi ke PO.
- **PO** + approval matrix multi-tier (integrasi modul `approval` yang sudah ada).
- **GRN** (Goods Receipt): menambah stok **dan** men-generate jurnal (Debit Inventory / Credit GRN Accrual) **secara atomic**; mendukung penerimaan parsial.
- **Vendor Bill** + **3-way matching** bertoleransi (qty & harga, configurable per company) + **override approval** + posting jurnal (Debit GRN Accrual / Credit AP).

### 12.2 Keputusan Kunci

1. **Atomic GRN:** modul `inventory` mengekspor varian transaksional `stockInTx(tx, input)` (pola sama seperti `postJournalTx`). GRN memanggil `stockInTx` di dalam transaksi yang sama dengan penulisan dokumen GRN + jurnal. Fungsi `stockIn(input)` lama menjadi pembungkus `runInTransaction(stockInTx)` — tidak ada perubahan perilaku endpoint lama.
2. **Harga GRN = harga PO** (sesuai PRD 3.2.1: 100 @ 10.000 → Inventory 1.000.000). Cost layer/avg-cost mengikuti `stockInTx` yang sudah ada.
3. **Akun COA baru:** `2130 GRN Accrual` (LIABILITY) ditambahkan ke `DEFAULT_COA` + seed. Akun existing: `1300` Inventory, `2100` Utang Usaha (AP), `2120` PPN Masukan.
4. **Toleransi 3-way match** disimpan per company di tabel `procurement_settings` (default qty 2%, harga 2%) dan dapat diubah via endpoint. Fungsi matching adalah **pure function** (`matching.ts`) → unit-testable.
5. **Posting bill:** Debit `2130 GRN Accrual` (subtotal) + Debit `2120 PPN Masukan` (pajak) / Credit `2100 Utang Usaha` (total). Selisih harga (variance) pada bill override dibiarkan sebagai residu akun GRN Accrual di P0 (dicatat, dirapikan di P1).
6. **Status PO** dikendalikan endpoint procurement yang memanggil engine `approval` (bukan endpoint `/approval/*`): `POST /procurement/po/:id/submit|approve|reject`. Modul `approval` ditambah helper publik `findApprovalByDocument(companyId, documentType, documentId)` (di `approval.service.ts`) + `selectApprovalRule(companyId, documentType, amount)`, keduanya diekspor dari `approval/index.ts`.
7. **Vendor master** berada di modul `procurement` (endpoint `/vendors`, halaman `/master/vendors`).
8. **PR** ringan: `DRAFT → APPROVED → CONVERTED` (approval PR tanpa matrix; PO yang memakai matrix).

### 12.3 Skema Database Baru (10 tabel) — `db/schema/procurement.schema.ts`

| Tabel | Kolom inti | Constraint |
|---|---|---|
| `vendors` | id, company_id, code, name, email, phone, address, npwp, payment_term_days, is_active | unique(company_id, code) |
| `purchase_requisitions` | id, company_id, doc_number, pr_date, status, notes, created_by | unique(company_id, doc_number) |
| `purchase_requisition_lines` | id, pr_id, item_id, qty, notes | index(pr_id) |
| `purchase_orders` | id, company_id, doc_number, po_date, vendor_id, warehouse_id, status, pr_id, subtotal, tax, total, approval_request_id, created_by | unique(company_id, doc_number), index(company_id, vendor_id) |
| `purchase_order_lines` | id, po_id, item_id, qty, unit_price, received_qty, billed_qty | index(po_id) |
| `goods_receipts` | id, company_id, doc_number, grn_date, po_id, warehouse_id, status, journal_entry_id, created_by | unique(company_id, doc_number) |
| `goods_receipt_lines` | id, grn_id, po_line_id, item_id, qty_received, unit_cost, batch_no | index(grn_id) |
| `vendor_bills` | id, company_id, doc_number, bill_date, vendor_id, po_id, status, subtotal, tax, total, match_result(JSON), override_reason, overridden_by, journal_entry_id, created_by | unique(company_id, doc_number) |
| `vendor_bill_lines` | id, bill_id, po_line_id, item_id, qty, unit_price, amount | index(bill_id) |
| `procurement_settings` | company_id (PK), qty_tolerance_pct, price_tolerance_pct | — |

> Prefiks nomor dokumen: `PR`, `PO`, `GRN`, `BILL` via `nextDocNumber` (row lock). Tabel append-only: tidak ada (semua dokumen punya status yang boleh berubah).

### 12.4 Endpoint REST (`/api/v1`)

| Method | Path | Permission | Catatan |
|---|---|---|---|
| POST/GET | `/vendors` | `vendor:manage` / auth | Master vendor |
| POST/GET | `/procurement/pr` | `pr:create` / auth | Buat & list PR |
| POST | `/procurement/pr/:id/approve` | `pr:approve` | PR → APPROVED |
| POST | `/procurement/pr/:id/convert-to-po` | `po:create` | PR → PO (status CONVERTED) |
| POST/GET | `/procurement/po` | `po:create` / auth | Buat & list PO |
| GET | `/procurement/po/:id` | auth | Detail + lines + sisa |
| POST | `/procurement/po/:id/submit` | `po:create` | Masuk approval matrix |
| POST | `/procurement/po/:id/approve` | `po:approve` | Approve per level |
| POST | `/procurement/po/:id/reject` | `po:approve` | Reject |
| POST | `/procurement/grn` | `grn:create` | **Idempotent** (withIdempotency) |
| GET | `/procurement/grn` | auth | List GRN |
| POST/GET | `/procurement/bills` | `bill:create` / auth | Buat & list bill |
| GET | `/procurement/bills/:id/match` | auth | Hasil 3-way matching |
| POST | `/procurement/bills/:id/override` | `bill:override` | Override exception (alasan wajib) |
| POST | `/procurement/bills/:id/post` | `bill:post` | Posting jurnal |
| GET/PUT | `/procurement/settings` | auth / `bill:override` | Toleransi qty & harga |

### 12.5 Berkas Backend

**Baru — `backend/src/modules/procurement/`:**
`procurement.types.ts` · `procurement.schema.ts` (Zod) · `procurement.repository.ts` · `vendor.service.ts` · `pr.service.ts` · `po.service.ts` · `grn.service.ts` · `bill.service.ts` · `matching.ts` (pure) · `matching.spec.ts` (unit) · `procurement.controller.ts` · `procurement.routes.ts` · `index.ts`

**Diubah:**
- `db/schema/procurement.schema.ts` (baru) + `db/schema/index.ts` (export).
- `modules/inventory/stock.service.ts` (ekstrak `stockInTx`) + `modules/inventory/index.ts` (export `stockInTx`).
- `modules/approval/approval.service.ts` (+`findApprovalByDocument`, +`selectApprovalRule`) + `approval/approval.repository.ts` (+`findRequestByDocument`) + `modules/approval/index.ts` (export).
- `db/seed-data.ts` (+`2130` COA, +permission baru, +rule approval default PO, +vendor sample, +settings default) + `db/seed.ts`.
- `app.ts` (register `procurementRoutes`).
- `db/smoke-test.ts` & `db/api-smoke.ts` (skenario P2P end-to-end).
- Migrasi baru `0003_*.sql` (generate drizzle-kit; **review SQL manual** sebelum `db:migrate` — lihat BUG-11).

**Permission baru:** `vendor:manage`, `pr:create`, `pr:approve`, `grn:create`, `bill:create`, `bill:override`, `bill:post`.

### 12.6 Berkas Frontend

**Baru — `frontend/src/features/procurement/`:**
`procurement.api.ts` · `VendorsPage.tsx` · `PrPage.tsx` · `PoPage.tsx` · `GrnPage.tsx` · `BillPage.tsx` · `index.ts`

**Diubah:** `app/router.tsx` (5 rute) · `app/AppShell.tsx` (section nav "Pengadaan" + badge `P0c`) · `shared/components/icons.tsx` (ikon baru).

Rute: `/master/vendors` · `/procurement/pr` · `/procurement/po` · `/procurement/grn` · `/procurement/bills` (+ `/procurement/bills/:id/match` panel 3-way).

### 12.7 Pola Arsitektur
Route → Controller → Service → Repository; pure logic (`matching.ts`, `costing`) dipisah untuk unit test; mutasi dalam `runInTransaction`; audit log + outbox ditulis dalam transaksi yang sama; idempotency via `withIdempotency`; nomor dokumen via `nextDocNumber` (row lock).

### 12.8 Verifikasi (Tier 1 & 2)
- **Tier 1:** `tsc --noEmit` = 0; unit test `matching.spec.ts` (skenario PRD 3.3.1 PASS, 3.3.2 exception 5%>2%) + regresi 24 test lama; `vite build` OK.
- **Tier 2:** migrasi nyata ke MySQL Laragon; DB smoke end-to-end: PR→PO(submit→approve 2 level)→GRN parsial 60→sisa 40→GRN 40→Bill match PASS→post→trial balance seimbang; skenario exception + override. API smoke: idempotency replay GRN, 400 tanpa key, 403 tanpa `po:approve`.
- Frontend: build + smoke manual.

### 12.9 Keputusan Operator (Gerbang 2 — DISETUJUI 2026-09-30)
1. **Pemecahan slice:** eksekusi **P0c utuh** (PR→PO→GRN→Bill + 3-way matching) dalam satu slice. ✅ Disetujui.
2. **Toleransi default:** **2% qty / 2% harga** (dapat diubah per company via `procurement_settings`). ✅ Disetujui.
3. **PPN pada Vendor Bill:** field pajak **opsional** (default 0) yang memposting Debit `2120 PPN Masukan`. ✅ Disetujui.

---

## 13. Status Implementasi Slice P0d — Sales & Distribution (Order-to-Cash) (Per 2026-09-30)

> **Gerbang 2:** ✅ DISETUJUI 2026-09-30. Rencana & implementasi tuntas.

### 13.0 Status Verifikasi (Tier 1 & 2)

| Item | Hasil |
|---|---|
| `tsc --noEmit` (backend) | 0 error |
| Unit test backend | 36 pass / 0 fail (+6 baru: `credit.spec.ts`) |
| DB smoke Tier 2 | LULUS (28 langkah; +7 langkah O2C) |
| API smoke | LULUS (idempotency DO & Invoice, replay, void) |
| `tsc --noEmit` (frontend) | 0 error |
| `vite build` | OK (110 modul) |
| Migrasi | `0004_clammy_runaways.sql` (50 tabel total) |
| Bug | Tidak ada bug baru ditemukan pada slice ini |

### 13.1 Ruang Lingkup

Alur O2C: **Quotation → Sales Order (credit check + soft reserve) → Delivery Order (stock out) → Customer Invoice (AR + revenue + COGS)** + void/credit note. Mengacu PRD Modul 4 (Story 4.1–4.3), PRD §8.2, §5.3.1–5.3.2.

- Master **Customer** (kode, nama, kontak, NPWP, **credit limit**, termin).
- **Quotation** ringan (DRAFT → ACCEPTED → CONVERTED) + konversi ke SO.
- **Sales Order** + **credit check** saat confirm + **soft reserve** stok per (item, warehouse).
- **Delivery Order** (idempotent): melepas reserve lalu **stock out** (COGS dari costing engine) — atomic.
- **Customer Invoice** (idempotent): jurnal **Debit AR 1200** / **Credit Sales 4100** (+ **Credit PPN Keluaran 2110** opsional) dan **Debit COGS 5100** / **Credit Inventory 1300** secara atomic.
- **Void invoice** → reversal journal (`reverseJournal`, `reversal_of_id`). **Credit note** (retur parsial) → jurnal balik proporsional.

### 13.2 Keputusan Kunci

1. **Customer master** di modul `sales` (endpoint `/customers`, halaman `/master/customers`), menyimpan `credit_limit`. Tidak ada akun COA baru (semua akun Sales sudah ada di `DEFAULT_COA`: `1200`, `2110`, `4100`, `5100`, `1300`).
2. **Credit check** saat `POST /sales/orders/:id/confirm`: `outstanding AR` = Σ `total` invoice berstatus `POSTED` (belum di-void) − Σ credit note. Jika `outstanding + SO.total > credit_limit` → **422 "Melebihi credit limit customer"** (PRD 4.1.2). Outstanding dihitung dari tabel dokumen (bukan saldo GL) agar deterministik di P0; rekonsiliasi GL di P1.
3. **Soft reserve** saat SO `CONFIRMED`: `warehouse_stock.reserved += qty` (tanpa mengubah `on_hand`/`avg_cost`). Validasi `available = on_hand − reserved ≥ qty` → jika gagal **422 "Stok tidak cukup"** (PRD 4.2.1). Baris stok dikunci berurutan (pola `lockStockRowsOrdered`).
4. **Delivery Order** (idempotent via `withIdempotency`): untuk tiap baris → **release reserve** (`reserved -= qty`) lalu `stockOutTx` (COGS nyata dari MA/FIFO). Efek akhir: `on_hand −= qty`, `reserved` kembali 0 (PRD 4.2.2). `delivered_qty` pada SO line bertambah; status SO → `PARTIALLY_DELIVERED`/`DELIVERED`.
5. **Inventory helper baru** (modul `inventory`):
   - Ekstrak `stockOutTx(tx, input)` dari `stockOut` (pola sama seperti `stockInTx`); `stockOut(input)` jadi pembungkus `runInTransaction`.
   - `reserveStockTx(tx, {companyId,itemId,warehouseId,qty})` dan `releaseStockTx(tx, {companyId,itemId,warehouseId,qty})` — memvalidasi ketersediaan, menulis `warehouse_stock.reserved`. Diekspor dari `inventory/index.ts`.
6. **Customer Invoice** (idempotent): dibuat dari DO (qty terkirim). Satu **journal entry** berisi 5 baris: Debit `1200` AR (total) · Credit `4100` Sales (subtotal) · Credit `2110` PPN Keluaran (pajak, jika > 0) · Debit `5100` COGS · Credit `1300` Inventory (COGS). Balanced. `sourceType = SALES`.
   - **PPN opsional** (default 0) — konsisten dengan keputusan P0c.
   - COGS diambil dari `total_cost` movement stock-out DO yang direferensikan.
7. **Void invoice** → `reverseJournal` (buat jurnal reversal, jurnal asal tidak diubah) + status `VOID` (PRD 5.3.1). **Credit note** (retur parsial) → jurnal balik proporsional: Debit `4100` Sales + Credit `1200` AR (nilai jual) dan Debit `1300` Inventory + Credit `5100` COGS (nilai HPP) (PRD 5.3.2). **Stok tidak dikembalikan fisik di P0** (limitation, lihat 13.9).
8. **Status dokumen:**
   - Quotation: `DRAFT → ACCEPTED → CONVERTED`.
   - Sales Order: `DRAFT → CONFIRMED → PARTIALLY_DELIVERED → DELIVERED → INVOICED → CLOSED`; `CANCELLED` (melepas reserve).
   - Delivery Order: `POSTED` (dibuat = posted, idempotent).
   - Customer Invoice: `POSTED → VOID`.
9. **Idempotency:** DO dan Invoice memakai `withIdempotency` (replay dicek **sebelum** side-effect — pola BUG-10). SO confirm/cancel & quotation convert memakai lock baris (`SELECT ... FOR UPDATE`) untuk cegah dobel.
10. **Nomor dokumen** via `nextDocNumber` (row lock): prefix `QT`, `SO`, `DO`, `INV`, `CN`.
11. **Permission baru:** `customer:manage`, `quotation:create`, `so:create`, `so:confirm`, `do:create`, `invoice:create`, `invoice:void`, `invoice:credit-note`.

### 13.3 Skema Database Baru (11 tabel) — `db/schema/sales.schema.ts`

| Tabel | Kolom inti | Constraint |
|---|---|---|
| `customers` | id, company_id, code, name, email, phone, address, npwp, credit_limit, payment_term_days, is_active | unique(company_id, code) |
| `quotations` | id, company_id, doc_number, quote_date, customer_id, status, subtotal, tax, total, valid_until, created_by | unique(company_id, doc_number) |
| `quotation_lines` | id, quotation_id, item_id, qty, unit_price, discount, subtotal | index(quotation_id) |
| `sales_orders` | id, company_id, doc_number, so_date, customer_id, warehouse_id, status, quotation_id, subtotal, tax, total, created_by | unique(company_id, doc_number), index(company_id, customer_id) |
| `sales_order_lines` | id, so_id, item_id, qty, unit_price, discount, subtotal, delivered_qty, invoiced_qty | index(so_id) |
| `delivery_orders` | id, company_id, doc_number, do_date, so_id, warehouse_id, status, created_by | unique(company_id, doc_number) |
| `delivery_order_lines` | id, do_id, so_line_id, item_id, qty_delivered, unit_cost, batch_no | index(do_id) |
| `customer_invoices` | id, company_id, doc_number, invoice_date, customer_id, do_id, status, subtotal, tax, total, cogs, journal_entry_id, created_by | unique(company_id, doc_number) |
| `customer_invoice_lines` | id, invoice_id, so_line_id, item_id, qty, unit_price, amount, unit_cost, cogs_amount | index(invoice_id) |
| `credit_notes` | id, company_id, doc_number, cn_date, customer_id, invoice_id, subtotal, tax, total, cogs, journal_entry_id, created_by | unique(company_id, doc_number) |
| `credit_note_lines` | id, cn_id, invoice_line_id, item_id, qty, unit_price, amount, unit_cost, cogs_amount | index(cn_id) |

> Prefiks nomor dokumen: `QT`, `SO`, `DO`, `INV`, `CN`. Tidak ada tabel append-only baru (dokumen punya status yang boleh berubah); ledger stok tetap `stock_movements` (append-only).

### 13.4 Endpoint REST (`/api/v1`)

| Method | Path | Permission | Catatan |
|---|---|---|---|
| POST/GET | `/customers` | `customer:manage` / auth | Master customer (termasuk credit limit) |
| GET | `/customers/:id/credit` | auth | Ringkasan limit/outstanding/available |
| POST/GET | `/sales/quotations` | `quotation:create` / auth | Buat & list quotation |
| POST | `/sales/quotations/:id/accept` | `quotation:create` | Quotation → ACCEPTED |
| POST | `/sales/quotations/:id/convert-to-so` | `so:create` | Quotation → SO (CONVERTED) |
| POST/GET | `/sales/orders` | `so:create` / auth | Buat & list SO |
| GET | `/sales/orders/:id` | auth | Detail + lines + sisa kirim |
| POST | `/sales/orders/:id/confirm` | `so:confirm` | Credit check + soft reserve |
| POST | `/sales/orders/:id/cancel` | `so:create` | Cancel + lepas reserve |
| POST/GET | `/sales/deliveries` | `do:create` / auth | **Idempotent** (withIdempotency) |
| POST/GET | `/sales/invoices` | `invoice:create` / auth | **Idempotent**; posting jurnal AR+revenue+COGS |
| GET | `/sales/invoices/:id` | auth | Detail + lines |
| POST | `/sales/invoices/:id/void` | `invoice:void` | Reversal journal |
| POST | `/sales/invoices/:id/credit-note` | `invoice:credit-note` | Retur parsial (jurnal balik) |

### 13.5 Berkas Backend

**Baru — `backend/src/modules/sales/`:**
`sales.types.ts` · `sales.schema.ts` (Zod) · `sales.repository.ts` · `credit.ts` (pure, cek kredit) · `credit.spec.ts` (unit) · `amounts.ts` · `customer.service.ts` · `quotation.service.ts` · `so.service.ts` · `do.service.ts` · `invoice.service.ts` · `credit-note.service.ts` · `sales.controller.ts` · `sales.routes.ts` · `index.ts`

**Diubah:**
- `db/schema/sales.schema.ts` (baru) + `db/schema/index.ts` (export).
- `modules/inventory/stock.service.ts` (ekstrak `stockOutTx`) + `modules/inventory/reservation.service.ts` (baru: reserve/release) + `modules/inventory/index.ts` (export).
- `db/seed-data.ts` (+permission baru, +customer sample) + `db/seed.ts`.
- `app.ts` (register `salesRoutes`).
- `db/smoke-test.ts` & `db/api-smoke.ts` (skenario O2C end-to-end).
- Migrasi baru `0004_*.sql` (generate drizzle-kit; **review SQL manual** sebelum `db:migrate` — lihat BUG-11 & BUG-12).

**Permission baru:** `customer:manage`, `quotation:create`, `so:create`, `so:confirm`, `do:create`, `invoice:create`, `invoice:void`, `invoice:credit-note`.

### 13.6 Berkas Frontend

**Baru — `frontend/src/features/sales/`:**
`sales.api.ts` · `CustomersPage.tsx` · `QuotationsPage.tsx` · `OrdersPage.tsx` · `DeliveriesPage.tsx` · `InvoicesPage.tsx` · `index.ts`

**Diubah:** `app/router.tsx` (5 rute) · `app/AppShell.tsx` (section nav "Penjualan" + badge `P0d`) · `shared/components/icons.tsx` (ikon baru: customer, quotation, delivery, invoice).

Rute: `/master/customers` · `/sales/quotations` · `/sales/orders` · `/sales/deliveries` · `/sales/invoices`.

### 13.7 Pola Arsitektur
Route → Controller → Service → Repository; pure logic (`credit.ts`, `amounts.ts`) dipisah untuk unit test; mutasi dalam `runInTransaction`; audit log + outbox ditulis dalam transaksi yang sama; idempotency via `withIdempotency` (DO & Invoice); nomor dokumen via `nextDocNumber` (row lock); reserve/release lewat helper inventory transaksional.

### 13.8 Verifikasi (Tier 1 & 2)
- **Tier 1:** `tsc --noEmit` = 0; unit test baru (`credit.spec.ts` — limit terlampaui/lolos; `amounts.spec.ts` — subtotal+PPN=total) + regresi 30 test lama; `vite build` OK.
- **Tier 2:** migrasi nyata ke MySQL Laragon; DB smoke O2C: Quotation 200 @ 15.000 → SO → confirm (credit check lolos) → soft reserve (reserved 200, available turun) → DO 200 (on_hand −200, reserved 0) → Invoice (jurnal AR/Sales/COGS/Inventory, TB seimbang) → void (reversal) → credit note parsial. Skenario gagal: confirm melebihi credit limit → 422. API smoke: idempotency replay DO & Invoice, 400 tanpa key, 403 tanpa permission.
- Frontend: build + smoke manual.

### 13.9 Keputusan Operator (Gerbang 2 — DISETUJUI 2026-09-30)
1. **Pemecahan slice:** eksekusi **P0d utuh** (Quotation→SO→DO→Invoice + credit + reserve + void/credit note, 11 tabel) dalam satu slice. ✅ Disetujui.
2. **PPN penjualan:** field pajak **opsional** (default 0) yang memposting Credit `2110 PPN Keluaran`. ✅ Disetujui.
3. **Credit note & stok:** credit note **hanya** memposting jurnal balik (revenue+AR & COGS+Inventory) **tanpa** mengembalikan stok fisik (limitation; retur stok fisik → P1). ✅ Disetujui.
4. **Sumber "outstanding AR":** dihitung dari **tabel dokumen** (Σ invoice POSTED − credit note) untuk determinisme P0. ✅ Disetujui.
