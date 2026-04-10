import { Decimal } from "decimal.js";
import XLSX from "xlsx";
import { prisma } from "../db.js";

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

function readDataRow(sheet: XLSX.WorkSheet, R: number, maxC: number): unknown[] {
  const row: unknown[] = [];
  for (let C = 0; C <= maxC; C++) {
    row[C] = sheet[XLSX.utils.encode_cell({ r: R, c: C })]?.v;
  }
  return row;
}

function getCell(row: unknown[], col: number | undefined): unknown {
  if (col === undefined) return undefined;
  return row[col];
}

/** Suma DEPRECIACION PERIODO de una hoja YYYY_MM del Excel Budacom. */
export function sumDepreciationFromMonthSheet(sheet: XLSX.WorkSheet, sheetName: string): {
  sum: Decimal;
  rowCount: number;
} {
  const fh = findHeaderRow(sheet);
  if (!fh) {
    throw new Error(`Sin cabecera FECHA en hoja ${sheetName}`);
  }
  const M = fh.map;
  const depCol = M["DEPRECIACION PERIODO"];
  if (depCol === undefined) {
    throw new Error(`Sin columna DEPRECIACION PERIODO en ${sheetName}`);
  }
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1");
  const maxCol = range.e.c;
  let sum = new Decimal(0);
  let rowCount = 0;
  for (let R = fh.row + 1; R <= range.e.r; R++) {
    const row = readDataRow(sheet, R, maxCol);
    const desc = getCell(row, M.DESCRIPCION);
    const fecha = getCell(row, M.FECHA);
    if (!normStr(desc) && !cellToDate(fecha)) break;
    const key = assetKey(fecha, desc, getCell(row, M["Nº FACTURA"]));
    if (!key) continue;
    rowCount += 1;
    const n = toNum(getCell(row, depCol));
    sum = sum.add(n !== null ? n : 0);
  }
  return { sum, rowCount };
}

export async function sumDepreciationInDb(year: number, month: number): Promise<{
  sum: Decimal;
  count: number;
}> {
  const rows = await prisma.assetPeriodSnapshot.findMany({
    where: { period: { year, month } },
    select: { depreciationForPeriod: true },
  });
  let sum = new Decimal(0);
  for (const r of rows) {
    sum = sum.add(new Decimal(r.depreciationForPeriod.toString()));
  }
  return { sum, count: rows.length };
}

export type PeriodReconcileRow = {
  sheet: string;
  year: number;
  month: number;
  excelSum: string;
  excelRows: number;
  dbSum: string;
  dbSnapshots: number;
  delta: string;
  ok: boolean;
};

/**
 * Compara suma de DEPRECIACION PERIODO del Excel vs BD por cada hoja YYYY_MM.
 * Períodos sin fila en BD se omiten (solo hojas con período existente).
 */
/** Tolerancia por defecto (CLP): redondeo Excel vs `Decimal` en BD (2 decimales). */
const DEFAULT_TOLERANCE_CLP = 0.02;

export async function reconcileBudacomWorkbookDepreciation(
  xlsxPath: string,
  options?: { toleranceClp?: number },
): Promise<PeriodReconcileRow[]> {
  const tol = new Decimal(options?.toleranceClp ?? DEFAULT_TOLERANCE_CLP);
  const wb = XLSX.readFile(xlsxPath, { cellDates: true, raw: false });
  const monthRe = /^(\d{4})_(\d{2})$/;
  const out: PeriodReconcileRow[] = [];

  for (const sheetName of wb.SheetNames.map((n) => n.trim())) {
    const m = sheetName.match(monthRe);
    if (!m) continue;
    const year = Number(m[1]);
    const month = Number(m[2]);
    const sh = wb.Sheets[sheetName];
    if (!sh) continue;

    const period = await prisma.accountingPeriod.findUnique({
      where: { year_month: { year, month } },
    });
    if (!period) continue;

    const { sum: excelSum, rowCount: excelRows } = sumDepreciationFromMonthSheet(sh, sheetName);
    const { sum: dbSum, count: dbSnapshots } = await sumDepreciationInDb(year, month);
    const delta = excelSum.sub(dbSum).abs();
    const ok = delta.lte(tol) && excelRows === dbSnapshots;

    out.push({
      sheet: sheetName,
      year,
      month,
      excelSum: excelSum.toFixed(2),
      excelRows,
      dbSum: dbSum.toFixed(2),
      dbSnapshots,
      delta: delta.toFixed(2),
      ok,
    });
  }

  out.sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));
  return out;
}
