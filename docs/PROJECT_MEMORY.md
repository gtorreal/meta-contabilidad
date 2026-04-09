# meta-contabilidad — memoria de proyecto

## Convenciones vivas

- **Monorepo** (`apps/web`, `apps/api`, `packages/shared`). Prisma solo en `apps/api/prisma`.
- **Histórico contable en CLP**: el maestro de activos persiste `historicalValueClp` siempre en pesos. Si la moneda de origen es **USD**, ese valor se calcula con el **dólar observado** del día calendario de adquisición tomado de `EconomicIndex` (tipo `USD_OBSERVED`). No hay tasas hardcodeadas en lógica de negocio.
- **Corrección monetaria (CM)**: en el MVP el factor se deriva del cociente **IPC** (`EconomicIndex`) entre el mes de adquisición y el mes del período de cierre. La fórmula normativa detallada puede evolucionar; la **fuente de datos** sigue siendo únicamente `EconomicIndex` (ver ADR de índices).
- **Odoo**: campos de referencia texto en activos (`odooAssetRef`, `odooMoveRef`). Sin API, jobs ni sincronización automática en esta fase.
- **Cierres**: un período **cerrado** es inmutable para el flujo operativo; **reapertura** solo con rol Admin (MVP: header `X-Admin-Key` = `ADMIN_API_KEY`) y **motivo obligatorio** registrado en `AuditLog`.
- **Auditoría**: `AuditLog` desde el MVP; actor puede ser usuario sistema hasta haber autenticación real.
- **Decimales**: montos persistidos como `Decimal` en Postgres; no usar `float` en dominio contable.

## Cómo arrancar en local

1. `cp .env.example .env` y ajustar `DATABASE_URL` (usuario Postgres local o `meta:meta` en puerto 5433 con Docker).
2. Opción A: `docker compose up -d postgres`. Opción B: Postgres local y `createdb meta_contabilidad` (o equivalente).
3. `pnpm install` en la raíz
4. `pnpm db:generate && pnpm --filter @meta-contabilidad/api exec prisma migrate deploy`
5. `pnpm --filter @meta-contabilidad/api prisma:seed`
6. `pnpm dev` (API en 8787, web en 5173 con proxy `/api`).

Para reapertura de períodos desde el navegador, definir en `apps/web` `VITE_ADMIN_API_KEY` igual a `ADMIN_API_KEY` del API.
