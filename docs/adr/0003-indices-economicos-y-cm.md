# ADR-0003: Índices económicos y corrección monetaria

## Estado

Aceptada (MVP).

## Contexto

El Excel histórico mezcla factores de CM por fila y moneda funcional implícita. El producto debe tener **una sola fuente** para tasas e índices.

## Decisión

- Tabla `EconomicIndex` como serie de tiempo con tipos `USD_OBSERVED`, `UF`, `IPC`.
- Unicidad lógica `(type, date)`; ingreso manual en MVP con validación en API.
- **Conversión USD → CLP** en alta de activo: monto original × `USD_OBSERVED` en la **fecha exacta** de adquisición.
- **Activos fijos — auxiliar financiero (Budacom)**: los snapshots de cierre (`AssetPeriodSnapshot`) se calculan con **una sola fuente** de IPC en `EconomicIndex`. El numerador del CM no es solo el IPC del mes de cierre sino el **máximo del IPC oficial desde el mes de adquisición hasta el mes del período** (inclusive), de modo que un IPC mensual que **baja** (p. ej. nov > dic) **no** reduce el bruto actualizado ni genera depreciación del mes negativa por esa oscilación. El factor es `IPC_efectivo / IPC(mes de adquisición)` (10 decimales, `ROUND_HALF_UP`). El **bruto actualizado** es `historicalValueClp × CM` a 2 decimales. Depreciación histórica y actualizada: lineal con la misma regla de meses en servicio; `depCmAdjustment` = actualizada − histórica; **dep. del período** = delta del acumulado actualizado. Tests: `budacom-snapshot.test.ts`, `cm-monotonic.test.ts`, `budacom-excel-parity.integration.test.ts` (con `BUDACOM_XLSX_PATH`). Reconciliación: `pnpm reconcile:budacom`.

## Consecuencias

- Debe existir **IPC** en `EconomicIndex` para el **mes civil de adquisición** y para el **mes del período** de cada activo elegible; si falta, el cierre falla con mensaje orientativo (carga de `ipc-monthly.json` / índices).
- Una capa de ingesta automática (BCCh, CMF, INE) puede alimentar la misma tabla sin cambiar el contrato de lectura del dominio.
- IPC mensual histórico inicial se versiona en `apps/api/data/ipc-monthly.json` y se carga con `prisma:seed` o `pnpm import:ipc`; UF y dólar observado se sincronizan desde el SII desde 2024.
