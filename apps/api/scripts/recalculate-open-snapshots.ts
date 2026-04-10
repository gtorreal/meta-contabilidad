/**
 * Recalcula `AssetPeriodSnapshot` con la lógica actual (histórico CLP, topes) en todos los períodos **OPEN**,
 * en orden desde el mes de la primera adquisición ACTIVE hasta el mes tope.
 *
 * Los períodos **CLOSED** se omiten (snapshots inmutables hasta reapertura con Admin).
 *
 * Uso (desde la raíz del repo, con `.env`):
 *   pnpm exec dotenv -e .env -- pnpm --filter @meta-contabilidad/api run recalculate:snapshots
 *   pnpm exec dotenv -e .env -- pnpm --filter @meta-contabilidad/api run recalculate:snapshots -- 2025 12
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { prisma } from "../src/db.js";
import { backfillSnapshotsChronologically } from "../src/services/period-backfill.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, "..");
const repoRoot = path.resolve(here, "..", "..", "..");
config({ path: path.join(repoRoot, ".env"), quiet: true });
config({ path: path.join(apiRoot, ".env"), override: true, quiet: true });

function monthOrdinal(y: number, m: number): number {
  return y * 12 + m;
}

async function main() {
  const argv = process.argv.slice(2).filter((a) => a !== "--");
  const now = new Date();
  let untilYear = now.getUTCFullYear();
  let untilMonth = now.getUTCMonth() + 1;

  if (argv.length >= 2) {
    untilYear = Number(argv[0]);
    untilMonth = Number(argv[1]);
    if (!Number.isInteger(untilYear) || !Number.isInteger(untilMonth) || untilMonth < 1 || untilMonth > 12) {
      throw new Error("Uso: recalculate-open-snapshots [año] [mes]");
    }
  }

  const lastPeriod = await prisma.accountingPeriod.findFirst({
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
  if (lastPeriod) {
    const lastOrd = monthOrdinal(lastPeriod.year, lastPeriod.month);
    const curOrd = monthOrdinal(untilYear, untilMonth);
    if (lastOrd > curOrd) {
      untilYear = lastPeriod.year;
      untilMonth = lastPeriod.month;
    }
  }

  const label = `${untilYear}-${String(untilMonth).padStart(2, "0")}`;
  console.log(`Recalculando snapshots en períodos OPEN hasta ${label}…`);
  const r = await backfillSnapshotsChronologically(untilYear, untilMonth);
  console.log(
    JSON.stringify(
      {
        ...r,
        note:
          r.skippedClosed.length > 0
            ? "Períodos CLOSED omitidos; reabra con Admin si debe recalcularlos."
            : undefined,
      },
      null,
      2,
    ),
  );
  if (r.failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
