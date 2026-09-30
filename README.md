# ERP Modular — Retail/Distribusi

Sistem ERP modular berbasis web/API sebagai *single source of truth* operasional enterprise (retail/distribusi). Mencakup IAM & Org Unit, Inventory, Procurement (P2P), Sales (O2C), dan Finance & General Ledger.

## Status

- **Fase:** Slice P0a (IAM + Org + GL Engine + Approval) — **selesai & terverifikasi**.
- **Infra:** MySQL lokal (Laragon). **Tanpa Docker** — lihat `docs/ADR/0002`.
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
# 1. Database: MySQL 8.0.16+ (lokal via Laragon). Docker TIDAK dipakai (lihat docs/ADR/0002).
#    Laragon default: root tanpa password, buat database `erp`.

# 2. Backend
cd backend
Copy-Item .env.example .env   # sesuaikan DATABASE_URL ke MySQL lokal
bun install
bun run db:migrate            # buat tabel
bun run db:seed               # company DEMO + admin + 10 akun COA
bun run dev                   # http://localhost:3000  (predev otomatis bebaskan port 3000)

# 3. Frontend
cd frontend
bun install
bun run dev                   # http://localhost:5173
```

**Login seed:** company `00000000-0000-4000-8000-000000000001`, email `admin@erp.local`, password `admin12345`.

## Verifikasi

- **Backend:** `cd backend; bunx tsc --noEmit; bun test; bun run db:smoke; bun run src/db/api-smoke.ts`
- **Frontend:** `cd frontend; bunx tsc --noEmit; bun run build`

## Troubleshooting

| Gejala | Penyebab | Solusi |
|---|---|---|
| `502 Bad Gateway` saat login | Backend (port 3000) mati; Vite hidup tapi tak bisa meneruskan | Jalankan backend (`cd backend; bun run dev`) |
| `401` saat login | Backend hidup, tapi Company ID salah/kosong | Isi Company ID `00000000-0000-4000-8000-000000000001` |
| `Failed to start server. Is port 3000 in use?` | Proses lama (zombie) masih mengunci port | Otomatis ditangani `predev`; manual: `bun run ../scripts/free-port.ts 3000 5173` |
| Log menampilkan 3 baris "Server listening at ..." (127.0.0.1 / 10.x / 172.x) | **Normal** — satu server bind ke semua network interface (`0.0.0.0`) | Pakai `http://localhost:3000` |
| Butuh Redis/RabbitMQ? | **Tidak.** Docker & broker tidak dipakai di P0 (lihat `docs/ADR/0002`) | Cukup MySQL Laragon |

**Catatan:** `bun run dev` di backend & frontend otomatis menjalankan `predev` yang membebaskan port 3000/5173 dari proses zombie sebelum start.
