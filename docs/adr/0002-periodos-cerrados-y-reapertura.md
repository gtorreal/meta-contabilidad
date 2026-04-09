# ADR-0002: Períodos cerrados y reapertura auditada

## Estado

Aceptada.

## Contexto

Los cierres mensuales deben ser **estables** para auditoría; no se permiten cambios silenciosos sobre datos ya cerrados sin un flujo explícito.

## Decisión

- `AccountingPeriod` tiene estado `OPEN` o `CLOSED`.
- Al **cerrar**, se registra `closedAt` y opcionalmente `closedById` (usuario Admin del seed en MVP).
- Mientras el período está `CLOSED`:
  - No se recalculan snapshots vía endpoint de cierre.
  - Los activos que tengan snapshot en algún período `CLOSED` no pueden editarse ni eliminarse hasta **reabrir** el período afectado.
- La **reapertura** solo la puede iniciar un **Admin** (MVP: header `X-Admin-Key`). Es obligatorio un **motivo** en texto; se persiste en `AuditLog` con acción `PERIOD_REOPENED`, referencia al período y metadatos de año/mes.

## Consecuencias

- Coherencia con expectativas de contabilidad y revisiones externas.
- Reapertura es un evento raro y visible; no hay “ediciones ocultas” tras cierre.
