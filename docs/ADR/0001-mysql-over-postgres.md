# ADR-0001: MySQL 8.0+ sebagai Database Engine (bukan PostgreSQL)

> Status: **APPROVED** (keputusan operator, didokumentasikan).
> Tanggal: 2026-02-14.
> Bahasa: Indonesia (istilah teknis tetap English).

---

## Konteks

Brief teknis awal merekomendasikan PostgreSQL dengan alasan:
- JSONB untuk data fleksibel (audit trail, payload event).
- `RETURNING` untuk insert-returning.
- `ON CONFLICT DO NOTHING` untuk idempotency atomic.
- Kompleksitas ACID & locking.

Operator memilih **MySQL lokal** dengan versi minimum **8.0.16+**.

## Keputusan

Gunakan **MySQL 8.0.16+** sebagai engine database.

## Konsekuensi

### Positif

1. **Keakraban & kemudahan setup:** MySQL 8.0 tersedia di semua platform; docker-compose standar.
2. **Ekosistem Drizzle:** Drizzle ORM mendukung MySQL via `mysql2` secara resmi (docs.drizzle.team/docs/mysql).
3. **SKIP LOCKED / NOWAIT:** Tersedia sejak 8.0.1, memungkinkan concurrent relay outbox & anti-deadlock.
4. **CTE & window function:** Tersedia sejak 8.0, cukup untuk laporan GL (Trial Balance, P&L).
5. **CHECK constraint:** Ter-enforce sejak 8.0.16 (sebelumnya di-parse tapi di-abaikan).

### Negatif & Mitigasi

| Konsekuensi | Mitigasi |
|---|---|
| Tidak ada `RETURNING` (INSERT/UPDATE ... RETURNING) | Gunakan `LAST_INSERT_ID()` atau `SELECT` ulang dalam transaksi yang sama. |
| `ON CONFLICT` tidak ada | Gunakan `UNIQUE KEY` + `INSERT ... ON DUPLICATE KEY UPDATE` atau `INSERT IGNORE`. |
| JSON type lebih terbatas daripada JSONB | Gunakan kolom JSON untuk audit/event payload; jangan query JSON kompleks. Filter gunakan kolom terpisah. |
| Partial index tidak ada | Gunakan composite index + kolom flag; atau gunakan `INDEX` penuh dengan cardinality rendah (acceptable untuk P0). |
| `DECIMAL` kembalikan sebagai string di driver JS | Normalisasi tipe eksplisit: `Number()` atau `parseFloat` setelah query, atau gunakan Drizzle mapper. |
| Deadlock detection default (auto-rollback) | Aplikasi wajib handle error code 1213 dengan retry (max 3x). |

## Risiko

- **R1:** Jika versi MySQL < 8.0.16, CHECK constraint tidak ter-enforce dan beberapa fitur hilang. **Mitigasi:** docker-compose wajib image `mysql:8.0`.
- **R2:** Quirk driver JS (DECIMAL/BIGINT jadi string) bisa merusak perhitungan uang. **Mitigasi:** Drizzle mapper + unit test aritmatika uang.

## Status

- Diterapkan: Ya, sejak inisiasi projek.
- Dapat direvisi: Jika beban OLTP reporting terbukti berat, pertimbangkan PostgreSQL di P1 (migrasi data).
