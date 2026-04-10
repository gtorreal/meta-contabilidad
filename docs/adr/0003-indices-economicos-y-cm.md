# ADR-0003: Índices económicos y corrección monetaria

## Estado

Aceptada (MVP), **enmendada**: IPC ya no entra en cálculos de negocio; la serie IPC se mantiene en `EconomicIndex` y en la UI Índices como referencia.

## Contexto

El Excel histórico mezcla factores de CM por fila y moneda funcional implícita. El producto debe tener **una sola fuente** para tasas e índices.

## Decisión

- Tabla `EconomicIndex` como serie de tiempo con tipos `USD_OBSERVED`, `UF`, `IPC`.
- Unicidad lógica `(type, date)`; ingreso manual en MVP con validación en API.
- **Conversión USD → CLP** en alta de activo: monto original × `USD_OBSERVED` en la **fecha exacta** de adquisición ([`apps/api/src/services/fx.ts`](../../apps/api/src/services/fx.ts)).
- **IPC mensual** en `EconomicIndex`: se carga y edita desde Índices / `ipc-monthly.json` / seed (**datos de referencia**; por ahora **no** los consume el motor de depreciación ni el cierre de mes).
- **Activos fijos — snapshots (`AssetPeriodSnapshot`)**: depreciación **lineal sobre valor histórico CLP** del activo; **bruto actualizado** = histórico (factor CM fijo 1 en snapshot); `depCmAdjustment` = 0; **dep. del período** = delta del acumulado respecto al mes anterior. No se requiere IPC cargado para correr `run-close` / cadena de snapshots.
- La lógica histórica de factor IPC monotónico (máximo desde adquisición hasta período) permanece en [`apps/api/src/services/cm.ts`](../../apps/api/src/services/cm.ts) solo para **tests** (`cm-monotonic.test.ts`), no para el cierre.

## Consecuencias

- La paridad numérica con planillas Budacom que incorporen **CM por IPC** deja de ser objetivo del producto salvo que se reintroduzca CM en snapshots.
- UF y dólar observado siguen sincronizándose desde el SII donde aplica; IPC mensual se versiona en `apps/api/data/ipc-monthly.json` y se carga con `prisma:seed` o `pnpm import:ipc` aunque el cierre no lo lea.
- Una capa de ingesta automática (BCCh, CMF, INE) puede alimentar la misma tabla sin cambiar el contrato de almacenamiento.
