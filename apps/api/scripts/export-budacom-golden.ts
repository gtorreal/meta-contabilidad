/**
 * Emite en stdout un JSON con filas de hojas YYYY_MM del Excel Budacom (columnas numéricas del auxiliar)
 * para construir o contrastar `src/services/__fixtures__/budacom-golden.json`.
 *
 * Uso:
 *   pnpm exec tsx scripts/export-budacom-golden.ts [ruta.xlsx]
 *
 * No incluye IPC por mes (debe mapearse aparte a `ipcAcquisitionValue` / `ipcPeriodValue` del golden).
 */
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx") as typeof import("xlsx");

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, "..");
const repoRoot = path.resolve(here, "..", "..", "..");
config({ path: path.join(repoRoot, ".env"), quiet: true });
config({ path: path.join(apiRoot, ".env"), override: true, quiet: true });

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

function readDataRow(sheet: XLSX.WorkSheet, R: number, maxC: number): unknown[] {
  const row: unknown[] = [];
  for (let C = 0; C <= maxC; C++) {
    row[C] = sheet[XLSX.utils.encode_cell({ r: R, c: C })]?.v;
  }
  return row;
}

type ExportedRow = {
  sheet: string;
  year: number;
  month: number;
  assetKey: string;
  excelColumns: Record<string, unknown>;
};

async function main() {
  const xlsxPath = process.argv[2] ?? DEFAULT_XLSX;
  const wb = XLSX.readFile(xlsxPath, { cellDates: true, raw: false });
  const monthRe = /^(\d{4})_(\d{2})$/;
  const monthSheets = wb.SheetNames.map((n) => n.trim()).filter((n) => monthRe.test(n)).sort();

  const numericHeaders = [
    "CM",
    "VALOR ACTUALIZADO",
    "DEP HISTORICA",
    "DEP ACTUALIZADA",
    "CM DEP",
    "VALOR NETO A DEPRECIAR",
    "DEPRECIACION PERIODO",
    "DEP ACUMULADA",
    "VALOR NETO",
    "VIDA UTIL",
  ];

  const out: ExportedRow[] = [];

  for (const sheetName of monthSheets) {
    const m = sheetName.match(monthRe)!;
    const year = Number(m[1]);
    const month = Number(m[2]);
    const sh = wb.Sheets[sheetName];
    if (!sh) continue;
    const fh = findHeaderRow(sh);
    if (!fh) continue;
    const M = fh.map;
    const range = XLSX.utils.decode_range(sh["!ref"] ?? "A1");
    const maxCol = range.e.c;
    for (let R = fh.row + 1; R <= range.e.r; R++) {
      const row = readDataRow(sh, R, maxCol);
      const desc = getCell(row, M.DESCRIPCION);
      const fecha = getCell(row, M.FECHA);
      if (!normStr(desc) && !cellToDate(fecha)) break;
      const key = assetKey(fecha, desc, getCell(row, M["Nº FACTURA"]));
      if (!key) continue;
      const excelColumns: Record<string, unknown> = {};
      for (const h of numericHeaders) {
        const col = M[h];
        if (col !== undefined) excelColumns[h] = getCell(row, col);
      }
      out.push({ sheet: sheetName, year, month, assetKey: key, excelColumns });
    }
  }

  console.log(
    JSON.stringify(
      {
        source: xlsxPath,
        rowCount: out.length,
        rows: out,
        note: "Completar ipcAcquisitionValue/ipcPeriodValue en casos de test según EconomicIndex IPC del mes civil.",
      },
      null,
      2,
    ),
  );

}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
