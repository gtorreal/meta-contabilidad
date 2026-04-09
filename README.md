# meta-contabilidad

MVP local para **activos fijos**: maestro único por bien, índices económicos centralizados (`EconomicIndex`), conversión USD→CLP con dólar observado, cierre mensual con snapshots (CM vía IPC en este MVP) y períodos cerrados con reapertura auditada (Admin).

## Requisitos

- Node.js 20+
- pnpm 9+
- PostgreSQL (Docker Compose en puerto **5433** o instalación local en **5432**)

## Arranque

```bash
cp .env.example .env
# Edita DATABASE_URL. Luego, o bien:
# docker compose up -d postgres
# o bien: createdb meta_contabilidad (Postgres local)
pnpm install
pnpm db:generate
pnpm --filter @meta-contabilidad/api exec prisma migrate deploy
pnpm --filter @meta-contabilidad/api prisma:seed
pnpm dev
```

La API carga `.env` desde la raíz del monorepo o desde `apps/api/`.

- API: `http://localhost:8787`
- Web: `http://localhost:5173` (proxy a `/api`)

Documentación viva: [docs/PROJECT_MEMORY.md](docs/PROJECT_MEMORY.md). Decisiones: [docs/adr/](docs/adr/).

## GitHub

Crear el repositorio remoto `meta-contabilidad` y enlazar:

```bash
git remote add origin git@github.com:<usuario>/meta-contabilidad.git
git add -A && git commit -m "Initial monorepo: activos fijos MVP" && git push -u origin main
```

## Licencia

MIT — ver [LICENSE](LICENSE).
