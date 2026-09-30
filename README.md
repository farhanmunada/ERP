# ERP Modular — Retail/Distribusi

Sistem ERP modular berbasis web/API sebagai *single source of truth* operasional enterprise (retail/distribusi). Mencakup IAM & Org Unit, Inventory, Procurement (P2P), Sales (O2C), dan Finance & General Ledger.

## Status

- **Fase:** 3 (PRD menunggu approval — Gerbang 1).
- **Kode:** Belum ada. DILARANG menulis kode sebelum `docs/PRD.md` berstatus APPROVED.

## Dokumen

| Berkas | Isi |
|---|---|
| `AGENTS.md` | Aturan rekayasa & lifecycle agen. |
| `docs/RESEARCH.md` | Riset domain & teknis (Fase 2). |
| `docs/PRD.md` | Product Requirements Document (Fase 3, DRAFT). |
| `docs/ADR/` | Architecture Decision Records. |

## Stack (rencana)

- **Backend:** Bun + Fastify + TypeScript (strict) + Drizzle ORM (`mysql2`) + Zod.
- **Database:** MySQL 8.0.16+.
- **Broker/Cache:** RabbitMQ + Redis.
- **Frontend:** React + Vite + Tailwind + shadcn/ui + TanStack Query/Table.
- **Infra dev:** docker-compose (MySQL, Redis, RabbitMQ).

## Instalasi & Menjalankan (menyusul setelah Gerbang 2)

Perintah verifikasi (target):
- Lint: `bun run lint`
- Typecheck: `bunx tsc --noEmit`
- Test: `bun test`
- Build: `bun run build`
