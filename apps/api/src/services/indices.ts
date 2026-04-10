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

const ymKey = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;

/**
 * Último valor IPC por mes civil en [fromYear,fromMonth] … [toYear,toMonth] (inclusive).
 * Si falta algún mes en la BD, la clave no estará en el map (el llamador valida).
 */
export async function fetchIpcMonthlyValueMap(
  fromYear: number,
  fromMonth: number,
  toYear: number,
  toMonth: number,
): Promise<Map<string, string>> {
  const start = monthStart(fromYear, fromMonth);
  const end = monthEnd(toYear, toMonth);
  const rows = await prisma.economicIndex.findMany({
    where: { type: "IPC", date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
  });
  const map = new Map<string, string>();
  for (const r of rows) {
    const d = r.date;
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    map.set(ymKey(y, m), r.value.toString());
  }
  return map;
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
