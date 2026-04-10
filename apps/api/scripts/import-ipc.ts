/**
 * Carga IPC mensual desde apps/api/data/ipc-monthly.json (upsert en EconomicIndex).
 *
 * Uso: pnpm --filter @meta-contabilidad/api exec tsx scripts/import-ipc.ts
 */
import "../src/env.js";
import { prisma } from "../src/db.js";
import { loadIpcMonthlyPayload, upsertIpcMonthlyFromBundledData } from "../src/services/ipc-import.js";

async function main() {
  const meta = loadIpcMonthlyPayload();
  console.log(`[ipc] ${meta.series.length} meses (asOf: ${meta.asOf ?? "n/d"})`);
  const { upserted } = await upsertIpcMonthlyFromBundledData(meta);
  console.log(`[ipc] Listo. ${upserted} upserts IPC.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
