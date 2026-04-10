/**
 * Sincroniza snapshots mensuales desde el Excel Budacom (mismas columnas que import).
 * Por cada hoja YYYY_MM: borra snapshots del período en BD y los recrea desde la planilla.
 * Períodos CERRADOS se omiten (reabrir con Admin antes si hace falta).
 *
 * Uso:
 *   pnpm exec tsx scripts/sync-budacom-snapshots-from-xlsx.ts [ruta.xlsx]
 */
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { Decimal } from "decimal.js";
import { type Prisma, PrismaClient } from "@prisma/client";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx") as typeof import("xlsx");

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, "..");
const repoRoot = path.resolve(here, "..", "..", "..");
config({ path: path.join(repoRoot, ".env"), quiet: true });
config({ path: path.join(apiRoot, ".env"), override: true, quiet: true });

const prisma = new PrismaClient();

const DEFAULT_XLSX = path.join(
  process.env.HOME ?? process.env.USERPROFILE ?? "",
  "Downloads",
  "Activo fijo Financiero Budacom 2025.xlsx",
);

function normStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function cellToDate(v: unknown): Date | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  }
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  if (typeof v === "number") {
    const epoch = (v - 25569) * 86400 * 1000;
    const d = new Date(epoch);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  return null;
}

function fmtYmd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function assetKey(fechaRaw: unknown, desc: unknown, factura: unknown): string {
  const d = cellToDate(fechaRaw);
  if (!d) return "";
  const inv =
    factura === null || factura === undefined || factura === "" ? "" : String(factura).trim();
  return `${fmtYmd(d)}|${normStr(desc)}|${inv}`;
}

type HeaderMap = Record<string, number>;

function findHeaderRow(sheet: XLSX.WorkSheet): { row: number; map: HeaderMap } | null {
  const ref = sheet["!ref"];
  if (!ref) return null;
  const range = XLSX.utils.decode_range(ref);
  for (let R = range.s.r; R <= Math.min(range.e.r, range.s.r + 35); R++) {
    const first = sheet[XLSX.utils.encode_cell({ r: R, c: 0 })]?.v;
    if (first === "FECHA") {
      const map: HeaderMap = {};
      for (let C = range.s.c; C <= range.e.c; C++) {
        const cell = sheet[XLSX.utils.encode_cell({ r: R, c: C })];
        const h = normStr(cell?.v);
        if (h) map[h] = C;
      }
      return { row: R, map };
    }
  }
  return null;
}

function getCell(row: unknown[], col: number | undefined): unknown {
  if (col === undefined) return undefined;
  return row[col];
}

function decStr(v: unknown, fallback = "0"): string {
  const n = toNum(v);
  if (n === null) return fallback;
  return n.toFixed(2);
}

function cmFactorFromRow(M: HeaderMap, row: unknown[]): string {
  const col = M["CM"];
  if (col === undefined) return "1.0000000000";
  const n = toNum(getCell(row, col));
  if (n === null) return "1.0000000000";
  return new Decimal(n).toDecimalPlaces(10, Decimal.ROUND_HALF_UP).toFixed(10);
}

function depCmAdjustmentFromRow(M: HeaderMap, row: unknown[]): string {
  const depHistoricalStr = decStr(getCell(row, M["DEP HISTORICA"]));
  const depUpdatedStr = decStr(getCell(row, M["DEP ACTUALIZADA"]));
  const cmDepCol = M["CM DEP"];
  if (cmDepCol !== undefined && toNum(getCell(row, cmDepCol)) !== null) {
    return decStr(getCell(row, cmDepCol));
  }
  return new Decimal(depUpdatedStr)
    .sub(new Decimal(depHistoricalStr))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toFixed(2);
}

function readDataRow(sheet: XLSX.WorkSheet, R: number, maxC: number): unknown[] {
  const row: unknown[] = [];
  for (let C = 0; C <= maxC; C++) {
    row[C] = sheet[XLSX.utils.encode_cell({ r: R, c: C })]?.v;
  }
  return row;
}

async function buildAssetIdByKey(): Promise<Map<string, string>> {
  const assets = await prisma.asset.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, acquisitionDate: true, description: true, invoiceNumber: true },
  });
  const map = new Map<string, string>();
  for (const a of assets) {
    const d = new Date(a.acquisitionDate);
    const inv = a.invoiceNumber === null || a.invoiceNumber === "" ? "" : String(a.invoiceNumber).trim();
    const k = `${fmtYmd(d)}|${normStr(a.description)}|${inv}`;
    if (map.has(k)) {
      console.warn(`Clave duplicada en BD (último gana): ${k}`);
    }
    map.set(k, a.id);
  }
  return map;
}

async function main() {
  const xlsxPath = process.argv[2] ?? DEFAULT_XLSX;
  const wb = XLSX.readFile(xlsxPath, { cellDates: true, raw: false });
  const monthRe = /^(\d{4})_(\d{2})$/;
  const monthSheets = wb.SheetNames.map((n) => n.trim()).filter((n) => monthRe.test(n)).sort();

  const assetIdByKey = await buildAssetIdByKey();
  console.error(`Activos ACTIVE en BD: ${assetIdByKey.size} (claves fecha|desc|factura)`);

  let sheetsOk = 0;
  let sheetsSkippedClosed = 0;
  let rowsWritten = 0;
  let rowsNoAsset = 0;

  for (const sheetName of monthSheets) {
    const m = sheetName.match(monthRe)!;
    const year = Number(m[1]);
    const month = Number(m[2]);
    const sh = wb.Sheets[sheetName];
    if (!sh) continue;

    const fh = findHeaderRow(sh);
    if (!fh) {
      console.warn(`Sin cabecera FECHA en ${sheetName}, se omite.`);
      continue;
    }
    const M = fh.map;

    const period = await prisma.accountingPeriod.upsert({
      where: { year_month: { year, month } },
      create: { year, month, status: "OPEN" },
      update: {},
    });

    if (period.status === "CLOSED") {
      console.warn(`Omitido ${sheetName}: período cerrado. Reabra con Admin para sincronizar.`);
      sheetsSkippedClosed += 1;
      continue;
    }

    const range = XLSX.utils.decode_range(sh["!ref"] ?? "A1");
    const maxCol = range.e.c;
    const toCreate: Prisma.AssetPeriodSnapshotCreateManyInput[] = [];

    for (let R = fh.row + 1; R <= range.e.r; R++) {
      const row = readDataRow(sh, R, maxCol);
      const desc = getCell(row, M.DESCRIPCION);
      const fecha = getCell(row, M.FECHA);
      if (!normStr(desc) && !cellToDate(fecha)) break;

      const key = assetKey(fecha, desc, getCell(row, M["Nº FACTURA"]));
      if (!key) continue;
      const assetId = assetIdByKey.get(key);
      if (!assetId) {
        console.warn(`Sin activo en BD para ${sheetName}: ${key}`);
        rowsNoAsset += 1;
        continue;
      }

      const vidaUtil = toNum(getCell(row, M["VIDA UTIL"]));
      /** Vida útil remanente (meses totales en planilla). El cierre recalcula con meses transcurridos mes civil adq. → período (mismo mes = 0). */
      const monthsRem = vidaUtil !== null ? Math.max(0, Math.round(vidaUtil)) : 0;

      toCreate.push({
        assetId,
        periodId: period.id,
        cmFactor: cmFactorFromRow(M, row),
        updatedGrossValue: decStr(getCell(row, M["VALOR ACTUALIZADO"])),
        depHistorical: decStr(getCell(row, M["DEP HISTORICA"])),
        depCmAdjustment: depCmAdjustmentFromRow(M, row),
        depUpdated: decStr(getCell(row, M["DEP ACTUALIZADA"])),
        netToDepreciate: decStr(getCell(row, M["VALOR NETO A DEPRECIAR"])),
        monthsRemainingInYear: monthsRem,
        depreciationForPeriod: decStr(getCell(row, M["DEPRECIACION PERIODO"])),
        accumulatedDepreciation: decStr(getCell(row, M["DEP ACUMULADA"])),
        netBookValue: decStr(getCell(row, M["VALOR NETO"])),
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.assetPeriodSnapshot.deleteMany({ where: { periodId: period.id } });
      if (toCreate.length > 0) {
        await tx.assetPeriodSnapshot.createMany({ data: toCreate });
      }
    });

    const sheetRows = toCreate.length;
    rowsWritten += sheetRows;

    console.error(`${sheetName}: ${sheetRows} snapshots desde Excel`);
    sheetsOk += 1;
  }

  console.error(
    JSON.stringify(
      { xlsxPath, sheetsProcessed: sheetsOk, sheetsSkippedClosed, rowsWritten, rowsNoAsset },
      null,
      2,
    ),
  );

  if (rowsNoAsset > 0) {
    console.warn(`\nAtención: ${rowsNoAsset} fila(s) sin match de activo; revise claves vs BD.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
