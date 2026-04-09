/**
 * Ingesta valores diarios UF y dólar observado desde el SII (páginas anuales HTML).
 *
 * Uso: pnpm exec tsx scripts/import-sii-indices.ts
 */
import "../src/env.js";
import { prisma } from "../src/db.js";
import { syncSiiUsdAndUf } from "../src/services/sii-sync.js";

async function main() {
  const r = await syncSiiUsdAndUf();
  console.log(`[sii] Hasta ${r.maxDate} (UTC). Años: ${r.years.join(", ")}`);
  for (const y of r.byYear) {
    console.log(
      `[sii] ${y.year} USD_OBSERVED: upsert ${y.USD_OBSERVED}, UF: upsert ${y.UF}`,
    );
  }
  console.log(
    `[sii] Listo. Total upserts USD_OBSERVED: ${r.totals.USD_OBSERVED}, UF: ${r.totals.UF}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
