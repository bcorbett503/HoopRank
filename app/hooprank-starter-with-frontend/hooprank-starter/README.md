# HoopRank — Starter Monorepo (Fixed)

This starter aligns with the Phase I / Phase 2 / Phase 3A / Phase 3B docs and the Development Plan.
It gives you:
- **backend/** NestJS + Swagger (in-memory services by default; Postgres migrations included)
- **mobile/** Flutter UI stubs (tabs)
- **docker-compose.yml** for Postgres, Redis, RabbitMQ

**This build includes**:
- Exported `Match` interface and typed controller returns (fixes TS4053).
- CORS enabled by default in `main.ts` (so web builds can call the API).
