# ADR-0002: Tanpa Docker untuk Lingkungan Pengembangan (MySQL Lokal)

> Status: **APPROVED** (keputusan operator, didokumentasikan).
> Tanggal: 2026-02-14.
> Bahasa: Indonesia (istilah teknis tetap English).

---

## Konteks

Rencana awal arsitektur menyertakan `docker-compose.yml` yang menyediakan tiga service:
MySQL 8.0, Redis, dan RabbitMQ. Namun setelah audit implementasi Slice P0a:

1. **MySQL** dijalankan lokal via **Laragon 8.4.3** (`127.0.0.1:3306`, root tanpa password, db `erp`).
2. **Redis** sama sekali tidak dipakai — `ioredis` terpasang tetapi tidak pernah di-import di kode produksi.
3. **RabbitMQ** hanya dipakai oleh relay outbox (`amqplib`), yang merupakan worker terpisah dan belum
   dibutuhkan oleh alur P0 (outbox baru bermanfaat saat ada konsumen lintas-modul di P1).
4. Server utama (`bun run dev`) hanya membuka koneksi ke **MySQL**. Tidak ada koneksi ke Redis/RabbitMQ.
5. `env.ts` mewajibkan `REDIS_URL` & `RABBITMQ_URL` — padahal tak dipakai, menimbulkan kesan keliru
   bahwa proyek butuh infra tambahan.

## Keputusan

**Hapus Docker sepenuhnya dari lingkungan pengembangan.** Database cukup MySQL lokal (Laragon).

Konsekuensi teknis yang diterapkan:

| Aksi | Detail |
|---|---|
| Hapus `backend/docker-compose.yml` | Tidak ada orkestrasi container. |
| Hapus dependensi `ioredis` | Redis tidak dipakai. |
| Hapus `amqplib` + modul relay outbox | `rabbit-publisher.ts`, `outbox-relay.ts`, `relay-main.ts` dihapus; script `relay` dihapus. |
| `env.ts` | `REDIS_URL` & `RABBITMQ_URL` dihapus dari skema wajib. |
| Outbox writer | **Tetap dipertahankan** (`core/outbox/outbox-writer.ts`) — tabel `outbox_events` tetap ditulis dalam transaksi bisnis (transactional outbox). |
| `.env` / `.env.example` | Blok Redis/RabbitMQ dihapus. |

## Konsekuensi

### Positif
1. **Setup minimal:** hanya butuh MySQL (Laragon). Tidak ada Docker Desktop, tidak ada container.
2. **Tidak ada dependensi mati:** `ioredis` & `amqplib` dihapus (YAGNI).
3. **Konfigurasi jujur:** `env.ts` hanya mewajibkan variabel yang benar-benar dipakai.

### Negatif & Mitigasi
| Konsekuensi | Mitigasi |
|---|---|
| Event outbox belum ter-publish ke broker | Tabel `outbox_events` tetap terisi; relay + broker dihidupkan kembali di **P1** saat integrasi lintas-modul dibutuhkan. |
| Kehilangan paritas lingkungan produksi berbasis container | Deployment produksi (bila container) direncanakan terpisah di P1/P2, bukan bagian dari alur dev P0. |

## Risiko

- **R1:** Relay outbox yang dihapus harus ditulis ulang saat P1. **Mitigasi:** pola sudah terdokumentasi di
  `docs/ARCHITECTURE.md` & `docs/RESEARCH.md`; `outbox-writer.ts` tetap dipertahankan sehingga jalur tulis tak hilang.
- **R2:** Redis di masa depan (cache/distributed lock). **Mitigasi:** tambahkan kembali saat benar-benar dibutuhkan,
  dengan ADR baru.

## Status

- Diterapkan: Ya, sejak audit Slice P0a.
- Dapat direvisi: Jika P1 membutuhkan event broker / cache, hidupkan kembali RabbitMQ/Redis dengan ADR baru.
