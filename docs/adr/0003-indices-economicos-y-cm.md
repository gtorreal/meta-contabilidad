# ADR-0003: Índices económicos y corrección monetaria

## Estado

Aceptada (MVP).

## Contexto

El Excel histórico mezcla factores de CM por fila y moneda funcional implícita. El producto debe tener **una sola fuente** para tasas e índices.

## Decisión

- Tabla `EconomicIndex` como serie de tiempo con tipos `USD_OBSERVED`, `UF`, `IPC`.
- Unicidad lógica `(type, date)`; ingreso manual en MVP con validación en API.
- **Conversión USD → CLP** en alta de activo: monto original × `USD_OBSERVED` en la **fecha exacta** de adquisición.
- **CM en snapshots de cierre (MVP)**: factor = `IPC(período)` / `IPC(mes de adquisición)`, usando el último IPC registrado en cada mes civil. Cualquier ajuste normativo posterior debe seguir leyendo solo de `EconomicIndex`, no de constantes en código.

## Consecuencias

- La calidad del cierre depende de la completitud de las series cargadas.
- Una capa de ingesta automática (BCCh, CMF, INE) puede alimentar la misma tabla sin cambiar el contrato de lectura del dominio.
