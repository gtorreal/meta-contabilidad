# ADR-0003: Índices económicos y corrección monetaria

## Estado

Aceptada (MVP).

## Contexto

El Excel histórico mezcla factores de CM por fila y moneda funcional implícita. El producto debe tener **una sola fuente** para tasas e índices.

## Decisión

- Tabla `EconomicIndex` como serie de tiempo con tipos `USD_OBSERVED`, `UF`, `IPC`.
- Unicidad lógica `(type, date)`; ingreso manual en MVP con validación en API.
- **Conversión USD → CLP** en alta de activo: monto original × `USD_OBSERVED` en la **fecha exacta** de adquisición.
- **Activos fijos — auxiliar financiero (MVP)**: los snapshots de cierre (`AssetPeriodSnapshot`) llevan **valor histórico** sin corrección monetaria en bruto ni en depreciación (`cmFactor` = 1, `depCmAdjustment` = 0). La depreciación es lineal sobre `historicalValueClp` del activo. El IPC en `EconomicIndex` no interviene en ese cierre; puede usarse en otros flujos o evoluciones futuras (p. ej. vista tributaria) leyendo solo de `EconomicIndex`.

## Consecuencias

- La completitud de la serie IPC sigue siendo relevante para conversión USD y para futuros informes que usen CM; **no** es requisito para generar el auxiliar de AF en valor histórico.
- Una capa de ingesta automática (BCCh, CMF, INE) puede alimentar la misma tabla sin cambiar el contrato de lectura del dominio.
- IPC mensual histórico inicial se versiona en `apps/api/data/ipc-monthly.json` y se carga con `prisma:seed` o `pnpm import:ipc`; UF y dólar observado se sincronizan desde el SII desde 2024.
