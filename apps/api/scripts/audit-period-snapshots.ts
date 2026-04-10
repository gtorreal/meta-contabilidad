/**
 * Lista períodos contables: elegibles vs snapshots y suma depreciationForPeriod.
 *
 * Uso: pnpm exec tsx scripts/audit-period-snapshots.ts
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { Decimal } from "decimal.js";
import { prisma } from "../src/db.js";
import { countEligibleAssetsForPeriod } from "../src/services/close-month.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, "..");
const repoRoot = path.resolve(here, "..", "..", "..");
config({ path: path.join(repoRoot, ".env"), quiet: true });
config({ path: path.join(apiRoot, ".env"), override: true, quiet: true });

async function main() {
  const periods = await prisma.accountingPeriod.findMany({
    orderBy: [{ year: "asc" }, { month: "asc" }],
    include: { _count: { select: { snapshots: true } } },
  });

  const lines: string[] = [];
  lines.push("year-month\tsnapshots\teligible\tdepSum");
  for (const p of periods) {
    const eligible = await countEligibleAssetsForPeriod(p.year, p.month);
    const snaps = await prisma.assetPeriodSnapshot.findMany({
      where: { periodId: p.id },
      select: { depreciationForPeriod: true },
    });
    let sum = new Decimal(0);
    for (const s of snaps) {
      sum = sum.add(s.depreciationForPeriod.toString());
    }
    lines.push(
      `${p.year}-${String(p.month).padStart(2, "0")}\t${p._count.snapshots}\t${eligible}\t${sum.toFixed(2)}`,
    );
  }
  console.log(lines.join("\n"));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
