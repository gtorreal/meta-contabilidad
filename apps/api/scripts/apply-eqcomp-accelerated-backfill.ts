/**
 * Uno-off / mantenimiento: marca EQ_COMP sin vida útil explícita como depreciación acelerada
 * y regenera snapshots en orden cronológico hasta un mes tope (p. ej. 2025-12).
 *
 * Uso (desde apps/api, con DATABASE_URL en .env):
 *   pnpm exec tsx scripts/apply-eqcomp-accelerated-backfill.ts [hastaAño] [hastaMes]
 *
 * Por defecto: 2025 12
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { backfillSnapshotsChronologically } from "../src/services/period-backfill.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, "..");
const repoRoot = path.resolve(here, "..", "..", "..");
config({ path: path.join(repoRoot, ".env"), quiet: true });
config({ path: path.join(apiRoot, ".env"), override: true, quiet: true });

const prisma = new PrismaClient();

async function main() {
  const untilYear = Number(process.argv[2]) || 2025;
  const untilMonth = Number(process.argv[3]) || 12;
  if (!Number.isFinite(untilYear) || !Number.isFinite(untilMonth) || untilMonth < 1 || untilMonth > 12) {
    throw new Error("Argumentos inválidos. Uso: apply-eqcomp-accelerated-backfill.ts [año] [mes]");
  }

  const updated = await prisma.$executeRaw`
    UPDATE "Asset" AS a
    SET "acceleratedDepreciation" = true
    FROM "UsefulLifeCategory" AS c
    WHERE a."categoryId" = c.id
      AND c.code = 'EQ_COMP'
      AND a."usefulLifeMonths" IS NULL
      AND a."acceleratedDepreciation" = false
  `;
  console.log(`UPDATE acceleratedDepreciation: filas afectadas (aprox.): ${updated}`);

  const result = await backfillSnapshotsChronologically(untilYear, untilMonth);
  console.log(
    JSON.stringify(
      {
        start: `${result.startYear}-${String(result.startMonth).padStart(2, "0")}`,
        until: `${result.untilYear}-${String(result.untilMonth).padStart(2, "0")}`,
        processedMonths: result.processed.length,
        skippedClosed: result.skippedClosed.length,
        failures: result.failures,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
