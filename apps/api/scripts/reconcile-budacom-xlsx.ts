/**
 * Compara suma DEPRECIACION PERIODO (Excel) vs suma snapshots en BD por hoja YYYY_MM.
 *
 * Uso: pnpm exec tsx scripts/reconcile-budacom-xlsx.ts [ruta.xlsx]
 * Exit 1 si algún período no calza: delta por encima de la tolerancia (por defecto 0,02 CLP)
 * o distinto número de filas Excel vs snapshots en BD.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { prisma } from "../src/db.js";
import { reconcileBudacomWorkbookDepreciation } from "../src/services/budacom-reconcile.js";

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

async function main() {
  const xlsxPath = process.argv[2] ?? DEFAULT_XLSX;
  const rows = await reconcileBudacomWorkbookDepreciation(xlsxPath);
  console.log(JSON.stringify(rows, null, 2));
  const bad = rows.filter((r) => !r.ok);
  if (bad.length > 0) {
    console.error(`\nFallo: ${bad.length} período(s) sin calce (suma o conteo de filas).`);
    process.exit(1);
  }
  console.error(`\nOK: ${rows.length} período(s) comparados.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
