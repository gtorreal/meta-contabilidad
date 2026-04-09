# ADR-0001: Stack local-first y autenticación diferida

## Estado

Aceptada.

## Contexto

Se necesita un MVP contable local (activos fijos) con trazabilidad, PostgreSQL y evolución hacia producción sin reescribir el núcleo.

## Decisión

- **Front-end**: Vite, React, TypeScript, React Router, TanStack Query, Tailwind.
- **Back-end**: Node.js, Hono, Prisma, PostgreSQL en Docker Compose.
- **Validación**: Zod en `packages/shared` para payloads compartidos entre capas.
- **Autenticación**: no implementada en el primer sprint; se reservan `createdById` nullable, `AuditLog` y comprobación de **Admin** vía `X-Admin-Key` para reapertura de períodos hasta integrar proveedor OAuth.

## Consecuencias

- Menor fricción en desarrollo local.
- Cuando exista auth real, sustituir el stub de Admin por autorización basada en usuario sin cambiar el modelo de períodos ni auditoría.
