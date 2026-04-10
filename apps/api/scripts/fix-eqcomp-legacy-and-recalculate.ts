/**
 * Normaliza activos EQ_COMP con adquisición anterior a 2024 a vida **normal** del rubro (p. ej. 72 m)
 * y sin depreciación acelerada, luego recalcula snapshots en todos los períodos OPEN hasta un mes tope.
 *
 * Pensado para imports Budacom que marcaron ítem 23 en 24 m acelerada cuando los equipos antiguos
 * debían seguir 72 m. Ajuste el corte en el SQL si su política es distinta.
 *
 * Uso (desde la raíz del repo, con `.env` y DATABASE_URL):
 *   pnpm exec dotenv -e .env -- pnpm --filter @meta-contabilidad/api run fix:eqcomp-legacy-recalc
 *   pnpm exec dotenv -e .env -- pnpm --filter @meta-contabilidad/api run fix:eqcomp-legacy-recalc -- 2026 12
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

const LEGACY_CUTOFF = "2024-01-01";

async function main() {
  const argv = process.argv.slice(2).filter((a) => a !== "--");
  const now = new Date();
  let untilYear = now.getUTCFullYear();
  let untilMonth = now.getUTCMonth() + 1;
  if (argv.length >= 2) {
    untilYear = Number(argv[0]);
    untilMonth = Number(argv[1]);
    if (!Number.isInteger(untilYear) || !Number.isInteger(untilMonth) || untilMonth < 1 || untilMonth > 12) {
      throw new Error("Uso: fix-eqcomp-legacy-and-recalculate.ts [hastaAño] [hastaMes]");
    }
  }

  const lastPeriod = await prisma.accountingPeriod.findFirst({
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
  if (lastPeriod) {
    const lastOrd = lastPeriod.year * 12 + lastPeriod.month;
    const curOrd = untilYear * 12 + untilMonth;
    if (lastOrd < curOrd) {
      untilYear = lastPeriod.year;
      untilMonth = lastPeriod.month;
    }
  }

  const updated = await prisma.$executeRaw`
    UPDATE "Asset" AS a
    SET
      "usefulLifeMonths" = c."normalLifeMonths",
      "acceleratedDepreciation" = false
    FROM "UsefulLifeCategory" AS c
    WHERE a."categoryId" = c.id
      AND c.code = 'EQ_COMP'
      AND a."status" = 'ACTIVE'
      AND a."acquisitionDate" < ${new Date(LEGACY_CUTOFF)}::date
  `;

  console.log(
    JSON.stringify(
      {
        step: "normalize_eqcomp_legacy",
        cutoffAcquisitionBefore: LEGACY_CUTOFF,
        assetsUpdatedRows: Number(updated),
      },
      null,
      2,
    ),
  );

  const result = await backfillSnapshotsChronologically(untilYear, untilMonth);
  console.log(
    JSON.stringify(
      {
        step: "backfill_open_periods",
        start: `${result.startYear}-${String(result.startMonth).padStart(2, "0")}`,
        until: `${result.untilYear}-${String(result.untilMonth).padStart(2, "0")}`,
        processedMonths: result.processed.length,
        skippedClosed: result.skippedClosed,
        failures: result.failures,
      },
      null,
      2,
    ),
  );

  if (result.failures.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
