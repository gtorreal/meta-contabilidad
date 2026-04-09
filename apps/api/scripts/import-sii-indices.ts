/**
 * Ingesta valores diarios UF y dólar observado desde el SII (páginas anuales HTML).
 *
 * Uso: pnpm exec tsx scripts/import-sii-indices.ts
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { load } from "cheerio";
import { PrismaClient, type EconomicIndexType } from "@prisma/client";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, "..");
const repoRoot = path.resolve(here, "..", "..", "..");
config({ path: path.join(repoRoot, ".env"), quiet: true });
config({ path: path.join(apiRoot, ".env"), override: true, quiet: true });

const prisma = new PrismaClient();

const MIN_DATE_UTC = new Date(Date.UTC(2025, 0, 1));

const MONTH_BY_DIV_ID: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

const UA =
  "Mozilla/5.0 (compatible; meta-contabilidad/1.0; +https://github.com/) AppleWebKit/537.36";

function todayUtcDateOnly(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

function utcDateOnly(year: number, month1to12: number, day: number): Date | null {
  const d = new Date(Date.UTC(year, month1to12 - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month1to12 - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return d;
}

/** UF: 39.731,79 — dólar: 927.46 */
function parseSiiCell(text: string, kind: "uf" | "dolar"): string | null {
  const t = text.replace(/\s+/g, "").trim();
  if (!t) return null;

  if (kind === "uf") {
    const normalized = t.replace(/\./g, "").replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) && n > 0 ? normalized : null;
  }

  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? String(n) : null;
}

function monthFromMesDivId(id: string): number | null {
  const match = id.match(/^mes_(.+)$/);
  if (!match) return null;
  const key = match[1];
  return MONTH_BY_DIV_ID[key] ?? null;
}

type ParsedRow = { date: Date; valueStr: string };

function parseYearHtml(html: string, year: number, kind: "uf" | "dolar"): ParsedRow[] {
  const $ = load(html);
  const out: ParsedRow[] = [];

  $("div.meses[id^='mes_']").each((_, el) => {
    const id = $(el).attr("id") ?? "";
    if (id === "mes_all") return;
    const month = monthFromMesDivId(id);
    if (!month) {
      console.warn(`[sii] Ignorando bloque con id desconocido: ${id}`);
      return;
    }

    const mainTable = $(el).find("table.table").not("#table_export").first();
    mainTable.find("tbody tr").each((__, tr) => {
        const cells = $(tr).children().toArray();
        for (let i = 0; i + 1 < cells.length; i += 2) {
          const th = cells[i];
          const td = cells[i + 1];
          if ($(th).prop("tagName")?.toLowerCase() !== "th") continue;
          if ($(td).prop("tagName")?.toLowerCase() !== "td") continue;

          const dayRaw = $(th).text().trim();
          const day = Number.parseInt(dayRaw, 10);
          if (!Number.isFinite(day) || day < 1 || day > 31) continue;

          const valueStr = parseSiiCell($(td).text(), kind);
          if (!valueStr) continue;

          const date = utcDateOnly(year, month, day);
          if (!date) continue;

          out.push({ date, valueStr });
        }
      });
  });

  return out;
}

async function fetchSiiYear(pathSegment: "dolar" | "uf", year: number): Promise<string> {
  const url = `https://www.sii.cl/valores_y_fechas/${pathSegment}/${pathSegment}${year}.htm`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    throw new Error(`SII ${url} → HTTP ${res.status}`);
  }
  return res.text();
}

async function upsertRows(
  type: EconomicIndexType,
  rows: ParsedRow[],
  maxDate: Date,
): Promise<{ upserted: number; skippedRange: number }> {
  let upserted = 0;
  let skippedRange = 0;

  for (const { date, valueStr } of rows) {
    if (date < MIN_DATE_UTC || date > maxDate) {
      skippedRange++;
      continue;
    }

    await prisma.economicIndex.upsert({
      where: { type_date: { type, date } },
      create: { type, date, value: valueStr },
      update: { value: valueStr },
    });
    upserted++;
  }

  return { upserted, skippedRange };
}

async function main() {
  const maxDate = todayUtcDateOnly();
  const yEnd = maxDate.getUTCFullYear();
  const years: number[] = [];
  for (let y = 2025; y <= yEnd; y++) years.push(y);

  console.log(`[sii] Rango fechas: ${MIN_DATE_UTC.toISOString().slice(0, 10)} … ${maxDate.toISOString().slice(0, 10)} (UTC)`);
  console.log(`[sii] Años: ${years.join(", ")}`);

  let totalUsd = 0;
  let totalUf = 0;

  for (const year of years) {
    const dolarHtml = await fetchSiiYear("dolar", year);
    const ufHtml = await fetchSiiYear("uf", year);

    const dolarRows = parseYearHtml(dolarHtml, year, "dolar");
    const ufRows = parseYearHtml(ufHtml, year, "uf");

    const rUsd = await upsertRows("USD_OBSERVED", dolarRows, maxDate);
    const rUf = await upsertRows("UF", ufRows, maxDate);

    console.log(
      `[sii] ${year} USD_OBSERVED: upsert ${rUsd.upserted}, fuera de rango ${rUsd.skippedRange} (filas parseadas ${dolarRows.length})`,
    );
    console.log(
      `[sii] ${year} UF: upsert ${rUf.upserted}, fuera de rango ${rUf.skippedRange} (filas parseadas ${ufRows.length})`,
    );

    totalUsd += rUsd.upserted;
    totalUf += rUf.upserted;
  }

  console.log(`[sii] Listo. Total upserts USD_OBSERVED: ${totalUsd}, UF: ${totalUf}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
