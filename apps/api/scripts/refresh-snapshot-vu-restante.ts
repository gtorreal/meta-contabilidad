/**
 * Recalcula y persiste `monthsRemainingInYear` en todos los snapshots según
 * mes civil de adquisición → mes del período (mismo mes = 0) y vida útil efectiva.
 *
 * PELIGRO: no recalcula dep. mes / dep. acum. / neto. Tras un import Budacom donde la
 * depreciación en planilla no sigue el mismo calendario que `computeVuRestanteMeses`,
 * ejecutar este script deja la fila incoherente en BD (VU distinta de los montos).
 * Prefiera regenerar la cadena con cierre mensual (`runCloseMonthForPeriod` / backfill)
 * o corregir el import; use este script solo si entiende que alineará solo la columna VU.
 *
 * La API del auxiliar mensual expone la VU persistida en el snapshot junto con los montos
 * del mismo registro (`auxiliarSnapshotMonthsRemainingInYear`); no reemplaza solo la VU al vuelo.
 *
 * Uso (con DATABASE_URL en .env):
 *   pnpm --filter @meta-contabilidad/api exec tsx scripts/refresh-snapshot-vu-restante.ts
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { prisma } from "../src/db.js";
import { computeVuRestanteMeses } from "../src/services/effective-useful-life.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, "..");
const repoRoot = path.resolve(here, "..", "..", "..");
config({ path: path.join(repoRoot, ".env"), quiet: true });
config({ path: path.join(apiRoot, ".env"), override: true, quiet: true });

async function main() {
  const rows = await prisma.assetPeriodSnapshot.findMany({
    include: {
      period: true,
      asset: { include: { category: true } },
    },
  });

  let changed = 0;
  for (const r of rows) {
    const vu = computeVuRestanteMeses(r.asset, r.period.year, r.period.month);
    if (vu !== r.monthsRemainingInYear) {
      await prisma.assetPeriodSnapshot.update({
        where: { id: r.id },
        data: { monthsRemainingInYear: vu },
      });
      changed += 1;
    }
  }

  console.log(JSON.stringify({ totalSnapshots: rows.length, updated: changed }, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  void prisma.$disconnect();
  process.exit(1);
});
