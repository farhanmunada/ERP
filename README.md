# ERP Modular — Retail/Distribusi

Sistem ERP modular berbasis web/API sebagai *single source of truth* operasional enterprise (retail/distribusi). Mencakup IAM & Org Unit, Inventory, Procurement (P2P), Sales (O2C), dan Finance & General Ledger.

## Status

- **Fase:** Slice P0a (IAM + Org + GL Engine + Approval) — **selesai & terverifikasi**.
- **Tier 1:** typecheck 0 error, 17 unit test pass, frontend build sukses.
- **Tier 2:** migrasi + smoke test DB nyata **LULUS** (MySQL 8.4.3, 21 tabel, API smoke hijau).

## Dokumen

| Berkas | Isi |
|---|---|
| `AGENTS.md` | Aturan rekayasa & lifecycle agen. |
| `docs/RESEARCH.md` | Riset domain & teknis (Fase 2). |
| `docs/PRD.md` | Product Requirements Document (APPROVED). |
| `docs/ARCHITECTURE.md` | Arsitektur & status implementasi. |
| `docs/ADR/` | Architecture Decision Records. |

## Struktur

```text
backend/    Bun + Fastify + Drizzle (MySQL) — REST API
frontend/   React + Vite + Tailwind — SPA
docs/       Dokumen proyek
```

## Menjalankan (dev)

```powershell
# 1. Database: MySQL 8.0.16+ (lokal via Laragon, atau `docker compose up -d mysql redis rabbitmq`)
#    Laragon default: root tanpa password, buat database `erp`.

# 2. Backend
cd backend
Copy-Item .env.example .env   # sesuaikan DATABASE_URL ke MySQL lokal
bun install
bun run db:migrate            # buat 20 tabel
bun run db:seed               # company DEMO + admin + 10 akun COA
bun run dev                   # http://localhost:3000

# 3. Outbox relay (terminal terpisah, butuh RabbitMQ)
cd backend; bun run relay

# 4. Frontend
cd frontend
bun install
bun run dev                   # http://localhost:5173
```

**Login seed:** company `00000000-0000-4000-8000-000000000001`, email `admin@erp.local`, password `admin12345`.

## Verifikasi

- **Backend:** `cd backend; bunx tsc --noEmit; bun test; bun run db:smoke; bun run src/db/api-smoke.ts`
- **Frontend:** `cd frontend; bunx tsc --noEmit; bun run build`
