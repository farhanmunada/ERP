# ERP Modular — Retail/Distribusi

Sistem ERP modular berbasis web/API sebagai *single source of truth* operasional enterprise (retail/distribusi). Mencakup IAM & Org Unit, Inventory, Procurement (P2P), Sales (O2C), dan Finance & General Ledger.

## Status

- **Fase:** Slice P0a (IAM + Org + GL Engine) — **kode terimplementasi**.
- **Tier 1:** typecheck 0 error, 11 unit test pass, frontend build sukses.
- **Tier 2:** migrasi & smoke test DB **tertunda** (Docker/MySQL belum aktif).

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
# 1. Infra (butuh Docker Desktop aktif)
cd backend; docker compose up -d

# 2. Backend
cd backend
Copy-Item .env.example .env
bun install
bun run db:migrate    # jalankan migrasi ke MySQL
bun run dev           # http://localhost:3000

# 3. Outbox relay (terminal terpisah)
cd backend; bun run relay

# 4. Frontend
cd frontend
bun install
bun run dev           # http://localhost:5173
```

## Verifikasi

- **Backend:** `cd backend; bunx tsc --noEmit; bun test`
- **Frontend:** `cd frontend; bunx tsc --noEmit; bun run build`
