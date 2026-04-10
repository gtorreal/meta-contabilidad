/**
 * One-off: persiste `usefulLifeMonths` = vida acelerada del rubro donde hoy es NULL pero
 * `acceleratedDepreciation` es true (alineado con UI/import y `declaredInitialUsefulLifeMonths`).
 *
 * Tras ejecutar, conviene recalcular snapshots de períodos abiertos:
 *   pnpm --filter @meta-contabilidad/api run recalculate:snapshots
 *
 * Uso (desde apps/api, con DATABASE_URL en .env):
 *   pnpm exec tsx scripts/backfill-useful-life-from-accelerated-flag.ts
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, "..");
const repoRoot = path.resolve(here, "..", "..", "..");
config({ path: path.join(repoRoot, ".env"), quiet: true });
config({ path: path.join(apiRoot, ".env"), override: true, quiet: true });

const prisma = new PrismaClient();

async function main() {
  const updated = await prisma.$executeRaw`
    UPDATE "Asset" AS a
    SET "usefulLifeMonths" = c."acceleratedLifeMonths"
    FROM "UsefulLifeCategory" AS c
    WHERE a."categoryId" = c.id
      AND a."usefulLifeMonths" IS NULL
      AND a."acceleratedDepreciation" = true
  `;
  console.log(`UPDATE usefulLifeMonths (acelerada del rubro): filas afectadas: ${updated}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
