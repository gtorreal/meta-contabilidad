# meta-contabilidad — memoria de proyecto

## Convenciones vivas

- **Monorepo** (`apps/web`, `apps/api`, `packages/shared`). Prisma solo en `apps/api/prisma`.
- **Histórico contable en CLP**: el maestro de activos persiste `historicalValueClp` siempre en pesos. Si la moneda de origen es **USD**, ese valor se calcula con el **dólar observado** del día calendario de adquisición tomado de `EconomicIndex` (tipo `USD_OBSERVED`). No hay tasas hardcodeadas en lógica de negocio.
- **Corrección monetaria (CM) y auxiliar Budacom**: el cierre (`runCloseMonthForPeriod`) usa el **máximo** del IPC mensual desde adquisición hasta el período como numerador del CM (evita caídas mes a mes del índice y depreciaciones negativas espurias). Ver `cm.ts`, ADR-0003.
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

## Importar Excel Budacom (activos + snapshots mensuales)

Desde la raíz, con `DATABASE_URL` cargado (`.env`):

```bash
pnpm --filter @meta-contabilidad/api import:budacom "/ruta/al/archivo.xlsx"
```

Por defecto usa `~/Downloads/Activo fijo Financiero Budacom 2025.xlsx` si no pasas ruta.

El script **borra** activos, períodos y snapshots existentes, actualiza la categoría `EQ_COMP` a 72/24 meses (ítem 23 SII), lee **Apertura** y todas las hojas `YYYY_MM`, crea un activo por cada clave única (fecha + descripción + Nº factura) y carga los valores de cada mes en `AssetPeriodSnapshot` tal como vienen en el Excel. Persiste **CM** y **CM DEP** desde columnas si existen; si no hay `CM DEP`, deriva `depCmAdjustment` como DEP ACTUALIZADA − DEP HISTORICA.

Para volcar filas del Excel a JSON de apoyo a tests: `pnpm --filter @meta-contabilidad/api export:budacom-golden [ruta.xlsx]`.

**Import sin «VIDA UTIL» en Apertura** (activos EQ_COMP): se crea el activo con `acceleratedDepreciation: true` para usar la vida acelerada del catálogo (p. ej. 24 meses tras el import). Si en Apertura viene vida útil en meses, se respeta ese número y no se fuerza acelerada.

Datos ya importados con el criterio anterior (siempre `acceleratedDepreciation: false` y sin `usefulLifeMonths`) pueden estar depreciando a 72 meses en lugar de 24. Para alinear sin reimportar:

```sql
UPDATE "Asset" a
SET "acceleratedDepreciation" = true
FROM "UsefulLifeCategory" c
WHERE a."categoryId" = c.id
  AND c.code = 'EQ_COMP'
  AND a."usefulLifeMonths" IS NULL
  AND a."acceleratedDepreciation" = false;
```

Después, reabra períodos afectados o borre snapshots y ejecute «Generar cadena desde primera compra» hasta el mes deseado.

Atajo (API, con `DATABASE_URL`): `pnpm --filter @meta-contabilidad/api apply:eqcomp-accelerated-backfill [año] [mes]` (por defecto `2025` `12`) — ejecuta el `UPDATE` y `backfillSnapshotsChronologically`.

## Reconciliar y auditar auxiliar vs Excel

- `pnpm --filter @meta-contabilidad/api sync:budacom-snapshots [ruta.xlsx]` — **sobrescribe** los `AssetPeriodSnapshot` de cada hoja `YYYY_MM` con los valores del Excel (misma lectura que `import:budacom`). Omite hojas cuyo período esté **cerrado**. Úsalo cuando la planilla Budacom sea la fuente de verdad y el motor de cierre no deba recalcular esos meses.
- `pnpm --filter @meta-contabilidad/api reconcile:budacom [ruta.xlsx]` — compara, por cada hoja `YYYY_MM` que tenga período en BD, la suma de **DEPRECIACION PERIODO** del Excel vs la suma de `depreciationForPeriod` en snapshots, y exige el **mismo número de filas** Excel vs snapshots. Exit code 1 si no calza; tolerancia de redondeo **0,02 CLP** por período. Por defecto usa `~/Downloads/Activo fijo Financiero Budacom 2025.xlsx`.
- `pnpm --filter @meta-contabilidad/api audit:periods` — tabla TSV: período, cantidad snapshots, elegibles, suma depreciación del período.
- Test de paridad opcional: `BUDACOM_XLSX_PATH=/ruta/al.xlsx pnpm --filter @meta-contabilidad/api test -- src/services/budacom-excel-parity.integration.test.ts` (solo corre si el archivo existe).
