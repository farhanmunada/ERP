# ARCHITECTURE.md — ERP Modular (Retail/Distribusi)

> Status: **DRAFT — MENUNGGU GERBANG 2 (Architecture & Plan Approval)**
> Bahasa: Indonesia (istilah teknis/identifier tetap English).
> Basis: `docs/PRD.md` (APPROVED), `docs/RESEARCH.md`, `docs/ADR/`.
> Versi: 1.0.0 · Fase: 4 (Task Decomposition & Architecture Planning)

---

## 1. Gambaran Arsitektur Tingkat Tinggi

Arsitektur **decoupled**: SPA frontend + REST API backend, dihubungkan via HTTP/JSON. Backend berkomunikasi async antar-modul via **Transactional Outbox → RabbitMQ**.

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
│                  ├──► Outbox (same DB tx) ──► Relay Worker    │
│                  │                                   │        │
│                  ▼                                   ▼        │
│            Redis (cache/lock)                  RabbitMQ       │
│                                                      │        │
│                                              Consumers        │
│                                         (Inventory, GL, dsb.) │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  MySQL 8.0.16+│
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
│   ├── docker-compose.yml          # MySQL, Redis, RabbitMQ (dev)
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
│       │   ├── outbox/             # Tulis event ke outbox
│       │   │   ├── outbox.writer.ts
│       │   │   └── outbox.relay.ts # Worker polling SKIP LOCKED
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
- Service menulis event ke `outbox_events` **dalam transaksi yang sama** dengan data bisnis.
- Relay worker (`outbox.relay.ts`) polling `SELECT ... FOR UPDATE SKIP LOCKED`, publish ke RabbitMQ, set `published_at`.
- Consumer idempotent via `processed_events(event_id UNIQUE)`.
- **Pelajaran bug-memory:** publisher RabbitMQ pakai **channel singleton** (BUG-20260929-02), bukan per-request.

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
| T2 | docker-compose (MySQL 8.0, Redis, RabbitMQ) + `.env.example` | infra dev |
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
| T14 | Outbox relay worker (SKIP LOCKED + RabbitMQ channel singleton) | `core/outbox/outbox.relay.ts` |
| T15 | Bootstrap frontend (Vite, Tailwind, shadcn, router, providers, api-client) | `frontend/` skeleton |
| T16 | Frontend: auth (login) + layout shell + dashboard | `frontend/src/features/auth` |
| T17 | Frontend: IAM/Org settings pages + COA tree + journal pages + reports | `frontend/src/features/*` |
| T18 | Tier 1 & Tier 2 verification (typecheck, lint, unit test, migration smoke test) | test suite |

### 7.2 Berkas yang Dibuat (ringkas)

- **Backend core:** ~15 file (`core/*`).
- **Backend schema:** ~6 file (`db/schema/*`) + migrasi.
- **Backend modul:** IAM (~8), Org (~5), Finance (~8), Approval (~4).
- **Frontend:** ~20 file (shell, auth, iam, org, finance, shared).
- **Infra:** `docker-compose.yml`, `.env.example`, config files.

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
| `amqplib` | RabbitMQ client | — |
| `ioredis` | Redis client | — |
| `argon2` | Hash password | `Bun.password` native (argon2id) — **prefer native** |
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

> **Catatan Dependency Ladder:** `argon2` digantikan `Bun.password` (native) untuk menghindari package tambahan. `pino` dipertimbangkan karena logging terstruktur dibutuhkan untuk observability.

### 7.5 Strategi Verifikasi
- **Tier 1:** `bunx tsc --noEmit`, lint, `bun test` (unit: journal balance, idempotency, doc-number).
- **Tier 2:** jalankan migrasi nyata ke MySQL 8.0 (docker), smoke test (insert company → user → COA → journal → trial balance).

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
- Vault: `03-Implementation-and-Clean-Code/*`.

---

> **Catatan Gerbang 2:** Rencana ini mencakup ≥ 3 file → **WAJIB STOP & WAIT**. DILARANG menulis kode sebelum operator menyetujui.
