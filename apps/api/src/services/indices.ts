import type { EconomicIndexType } from "@prisma/client";
import { prisma } from "../db.js";

function monthStart(y: number, m: number): Date {
  return new Date(Date.UTC(y, m - 1, 1));
}

function monthEnd(y: number, m: number): Date {
  return new Date(Date.UTC(y, m, 0));
}

/**
 * Último índice IPC del mes civil (fecha almacenada como cualquier día del mes).
 */
export async function getLatestIpcInMonth(year: number, month: number) {
  const start = monthStart(year, month);
  const end = monthEnd(year, month);
  return prisma.economicIndex.findFirst({
    where: { type: "IPC", date: { gte: start, lte: end } },
    orderBy: { date: "desc" },
  });
}

export async function getUsdObservedOnDate(date: Date) {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return prisma.economicIndex.findUnique({
    where: {
      type_date: { type: "USD_OBSERVED", date: day },
    },
  });
}

export async function requireUsdObservedOnDate(date: Date) {
  const row = await getUsdObservedOnDate(date);
  if (!row) {
    throw new Error(
      `No hay dólar observado (USD_OBSERVED) para la fecha ${date.toISOString().slice(0, 10)}. Cargue la serie en Índices económicos.`,
    );
  }
  return row;
}

export async function getUfOnDate(date: Date) {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return prisma.economicIndex.findUnique({
    where: {
      type_date: { type: "UF", date: day },
    },
  });
}

export async function requireUfOnDate(date: Date) {
  const row = await getUfOnDate(date);
  if (!row) {
    throw new Error(
      `No hay UF para la fecha ${date.toISOString().slice(0, 10)}. Cargue la serie en Índices económicos.`,
    );
  }
  return row;
}

export async function listIndices(type: EconomicIndexType, from?: Date, to?: Date) {
  return prisma.economicIndex.findMany({
    where: {
      type,
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
    orderBy: { date: "asc" },
  });
}
