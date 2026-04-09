/**
 * Importa activos (hoja Apertura) y snapshots mensuales (hojas YYYY_MM) desde el Excel Budacom.
 *
 * Uso: pnpm exec tsx scripts/import-budacom-xlsx.ts [ruta-al-xlsx]
 */
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

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

function resolveCmFactor(row: unknown[], M: HeaderMap): string {
  const fFact = toNum(getCell(row, M["FACTOR"]));
  const fCm = toNum(getCell(row, M["CM"]));
  const pick =
    fFact !== null && fFact > 0 ? fFact : fCm !== null && fCm > 0 ? fCm : 1;
  return String(pick);
}

function readDataRow(sheet: XLSX.WorkSheet, R: number, maxC: number): unknown[] {
  const row: unknown[] = [];
  for (let C = 0; C <= maxC; C++) {
    row[C] = sheet[XLSX.utils.encode_cell({ r: R, c: C })]?.v;
  }
  return row;
}

type MasterRow = {
  fechaRaw: unknown;
  desc: string;
  invoice: string | null;
  hist: number;
  original: number;
  credit: number | null;
};

function extractMaster(row: unknown[], map: HeaderMap): MasterRow | null {
  const desc = normStr(getCell(row, map.DESCRIPCION));
  const fecha = getCell(row, map.FECHA);
  if (!desc && !cellToDate(fecha)) return null;
  const key = assetKey(fecha, desc, getCell(row, map["Nº FACTURA"]));
  if (!key) return null;

  const hist = toNum(getCell(row, map["VALOR HISTORICO"])) ?? 0;
  const adq = toNum(getCell(row, map["VALOR ADQUISICION"]));
  const original = adq !== null && adq > 0 ? adq : hist;
  const credit = toNum(getCell(row, map["4% CREDITO A.F."]));

  const invoiceRaw = getCell(row, map["Nº FACTURA"]);
  const invoice =
    invoiceRaw === null || invoiceRaw === undefined || invoiceRaw === ""
      ? null
      : String(invoiceRaw).trim().slice(0, 128);

  return { fechaRaw: fecha, desc, invoice, hist, original, credit };
}

function iterSheetData(
  sheet: XLSX.WorkSheet,
  onRow: (row: unknown[], map: HeaderMap) => void,
): HeaderMap | null {
  const fh = findHeaderRow(sheet);
  if (!fh) return null;
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1");
  const maxCol = range.e.c;
  for (let R = fh.row + 1; R <= range.e.r; R++) {
    const row = readDataRow(sheet, R, maxCol);
    onRow(row, fh.map);
  }
  return fh.map;
}

async function main() {
  const xlsxPath = process.argv[2] ?? DEFAULT_XLSX;
  const wb = XLSX.readFile(xlsxPath, { cellDates: true, raw: false });

  const cat = await prisma.usefulLifeCategory.findUnique({ where: { code: "EQ_COMP" } });
  if (!cat) {
    throw new Error("Falta categoría EQ_COMP; ejecuta: pnpm --filter @meta-contabilidad/api prisma:seed");
  }

  await prisma.usefulLifeCategory.update({
    where: { id: cat.id },
    data: {
      normalLifeMonths: 72,
      acceleratedLifeMonths: 24,
      name: "Equipos computacionales (SII ítem 23 — import Excel)",
    },
  });

  await prisma.auditLog.deleteMany();
  await prisma.assetPeriodSnapshot.deleteMany();
  await prisma.accountingPeriod.deleteMany();
  await prisma.asset.deleteMany();

  const masterByKey = new Map<string, MasterRow>();

  const apertura = wb.Sheets.Apertura;
  if (!apertura) throw new Error('Falta la hoja "Apertura"');
  iterSheetData(apertura, (row, map) => {
    const m = extractMaster(row, map);
    if (m) masterByKey.set(assetKey(m.fechaRaw, m.desc, m.invoice), m);
  });

  const monthRe = /^(\d{4})_(\d{2})$/;
  const monthSheets = wb.SheetNames.map((n) => n.trim()).filter((n) => monthRe.test(n)).sort();

  for (const sheetName of monthSheets) {
    const sh = wb.Sheets[sheetName];
    if (!sh) continue;
    iterSheetData(sh, (row, map) => {
      const m = extractMaster(row, map);
      if (!m) return;
      const k = assetKey(m.fechaRaw, m.desc, m.invoice);
      if (!k) return;
      if (!masterByKey.has(k)) masterByKey.set(k, m);
    });
  }

  const assetIdByKey = new Map<string, string>();

  for (const [key, m] of masterByKey) {
    const d = cellToDate(m.fechaRaw);
    if (!d) continue;

    const asset = await prisma.asset.create({
      data: {
        acquisitionDate: d,
        invoiceNumber: m.invoice,
        description: m.desc.slice(0, 2000),
        categoryId: cat.id,
        acquisitionCurrency: "CLP",
        acquisitionAmountOriginal: m.original.toFixed(2),
        historicalValueClp: m.hist.toFixed(2),
        creditAfPercent: m.credit !== null ? String(m.credit) : undefined,
        acceleratedDepreciation: false,
        status: "ACTIVE",
      },
    });
    assetIdByKey.set(key, asset.id);
  }

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
    const period = await prisma.accountingPeriod.create({
      data: { year, month, status: "OPEN" },
    });

    const range = XLSX.utils.decode_range(sh["!ref"] ?? "A1");
    const maxCol = range.e.c;
    let snaps = 0;
    for (let R = fh.row + 1; R <= range.e.r; R++) {
      const row = readDataRow(sh, R, maxCol);
      const desc = getCell(row, M.DESCRIPCION);
      const fecha = getCell(row, M.FECHA);
      if (!normStr(desc) && !cellToDate(fecha)) break;

      const key = assetKey(fecha, desc, getCell(row, M["Nº FACTURA"]));
      if (!key) continue;
      const assetId = assetIdByKey.get(key);
      if (!assetId) {
        console.warn(`Sin match en ${sheetName}: ${key}`);
        continue;
      }

      const vidaUtil = toNum(getCell(row, M["VIDA UTIL"]));
      const monthsRem = vidaUtil !== null ? Math.max(0, Math.round(vidaUtil)) : 0;

      await prisma.assetPeriodSnapshot.create({
        data: {
          assetId,
          periodId: period.id,
          cmFactor: resolveCmFactor(row, M),
          updatedGrossValue: decStr(getCell(row, M["VALOR ACTUALIZADO"])),
          depHistorical: decStr(getCell(row, M["DEP HISTORICA"])),
          depCmAdjustment: decStr(getCell(row, M["CM DEP"])),
          depUpdated: decStr(getCell(row, M["DEP ACTUALIZADA"])),
          netToDepreciate: decStr(getCell(row, M["VALOR NETO A DEPRECIAR"])),
          monthsRemainingInYear: monthsRem,
          depreciationForPeriod: decStr(getCell(row, M["DEPRECIACION PERIODO"])),
          accumulatedDepreciation: decStr(getCell(row, M["DEP ACUMULADA"])),
          netBookValue: decStr(getCell(row, M["VALOR NETO"])),
        },
      });
      snaps += 1;
    }
    console.log(`${sheetName}: ${snaps} snapshots`);
  }

  console.log(`Activos importados: ${assetIdByKey.size}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  void prisma.$disconnect();
  process.exit(1);
});
