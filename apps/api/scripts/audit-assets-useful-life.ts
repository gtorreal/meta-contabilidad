/**
 * Lista activos ACTIVE (énfasis en adquisición 2022 o anterior) con vida útil y bandera acelerada.
 * Ayuda a detectar EQ_COMP importados sin «VIDA UTIL» en Apertura (24m acelerada) cuando se esperaba 72m normal.
 *
 * Tras corregir activos en la app o con SQL, alinear snapshots al modelo lineal:
 *   pnpm --filter @meta-contabilidad/api run recalculate:snapshots
 *   (períodos OPEN hasta hoy; reabrir CLOSED con Admin si aplica)
 *
 * Uso:
 *   pnpm --filter @meta-contabilidad/api run audit:assets-life
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { prisma } from "../src/db.js";
import { declaredInitialUsefulLifeMonths, type AssetWithCategory } from "../src/services/effective-useful-life.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, "..");
const repoRoot = path.resolve(here, "..", "..", "..");
config({ path: path.join(repoRoot, ".env"), quiet: true });
config({ path: path.join(apiRoot, ".env"), override: true, quiet: true });

async function main() {
  const rows = await prisma.asset.findMany({
    where: { status: "ACTIVE" },
    include: { category: true },
    orderBy: { acquisitionDate: "asc" },
  });

  const cutoffYear = 2023;
  const interesting = rows.filter((r) => {
    const y = new Date(r.acquisitionDate).getUTCFullYear();
    return y < cutoffYear;
  });

  console.log(
    JSON.stringify(
      {
        totalActive: rows.length,
        acquiredBefore2023: interesting.length,
        rows: interesting.map((r) => {
          const a = r as unknown as AssetWithCategory;
          const declared = declaredInitialUsefulLifeMonths(a);
          return {
            id: r.id,
            acquisitionDate: r.acquisitionDate.toISOString().slice(0, 10),
            description: r.description.slice(0, 60),
            categoryCode: r.category.code,
            usefulLifeMonthsStored: r.usefulLifeMonths,
            acceleratedDepreciation: r.acceleratedDepreciation,
            declaredInitialUsefulLifeMonths: declared,
            possibleAcceleratedImport:
              r.acceleratedDepreciation === true && declared === r.category.acceleratedLifeMonths,
          };
        }),
        nextSteps: [
          "Si possibleAcceleratedImport es true y el bien debe depreciarse en 72m: edite el activo (desmarque acelerada y/o fije vida 72).",
          "Luego ejecute: pnpm --filter @meta-contabilidad/api run recalculate:snapshots",
        ],
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  void prisma.$disconnect();
  process.exit(1);
});
