import { PrismaClient } from "@prisma/client";
import { resolveHistoricalValueClp } from "../src/services/fx.js";
import { upsertIpcMonthlyFromBundledData } from "../src/services/ipc-import.js";
import { syncSiiUsdAndUf } from "../src/services/sii-sync.js";

const prisma = new PrismaClient();

/** IDs fijos para que `prisma:seed` sea idempotente. */
const DEMO_ASSET_CLP_ID = "11111111-1111-4111-8111-111111111101";
const DEMO_ASSET_USD_ID = "11111111-1111-4111-8111-111111111102";

async function main() {
  await prisma.user.upsert({
    where: { email: "admin@local.dev" },
    create: { email: "admin@local.dev", role: "ADMIN" },
    update: { role: "ADMIN" },
  });

  await prisma.usefulLifeCategory.upsert({
    where: { code: "EQ_COMP" },
    create: {
      code: "EQ_COMP",
      name: "Equipos computacionales",
      normalLifeMonths: 36,
      acceleratedLifeMonths: 18,
    },
    update: {},
  });

  /** Diciembre por año: el informe de movimiento exige períodos dic N y dic N−1 (solo fila; snapshots vienen del cierre de mes). */
  const nowY = new Date().getUTCFullYear();
  const decFrom = nowY - 8;
  const decTo = nowY + 5;
  for (let y = decFrom; y <= decTo; y++) {
    await prisma.accountingPeriod.upsert({
      where: { year_month: { year: y, month: 12 } },
      create: { year: y, month: 12, status: "OPEN" },
      update: {},
    });
  }
  console.log(`Períodos contables (solo diciembre): ${decFrom}…${decTo} upsert`);

  const { upserted: ipcUpserts } = await upsertIpcMonthlyFromBundledData();
  console.log(`IPC mensual (data/ipc-monthly.json): ${ipcUpserts} upserts`);

  try {
    const sii = await syncSiiUsdAndUf();
    console.log(
      `SII (dólar observado + UF): ${sii.totals.USD_OBSERVED} y ${sii.totals.UF} upserts en esta corrida · años ${sii.years.join(", ")}`,
    );
  } catch (e) {
    console.warn(
      "[seed] SII no disponible (sin red o error temporal). Cargue dólar/UF con el botón «Actualizar desde SII» o `pnpm import:sii`:",
      e instanceof Error ? e.message : e,
    );
  }

  const category = await prisma.usefulLifeCategory.findUniqueOrThrow({ where: { code: "EQ_COMP" } });
  const adminUser = await prisma.user.findUnique({ where: { email: "admin@local.dev" } });

  const histClp = await resolveHistoricalValueClp({
    acquisitionDate: "2024-06-15",
    currency: "CLP",
    acquisitionAmountOriginal: "850000",
  });
  await prisma.asset.upsert({
    where: { id: DEMO_ASSET_CLP_ID },
    create: {
      id: DEMO_ASSET_CLP_ID,
      acquisitionDate: new Date(Date.UTC(2024, 5, 15)),
      description: "Notebook corporativo (demo — seed)",
      categoryId: category.id,
      acquisitionCurrency: "CLP",
      acquisitionAmountOriginal: "850000",
      historicalValueClp: histClp,
      usefulLifeMonths: 36,
      createdById: adminUser?.id ?? undefined,
    },
    update: {},
  });

  try {
    const histUsd = await resolveHistoricalValueClp({
      acquisitionDate: "2024-03-01",
      currency: "USD",
      acquisitionAmountOriginal: "1500",
    });
    await prisma.asset.upsert({
      where: { id: DEMO_ASSET_USD_ID },
      create: {
        id: DEMO_ASSET_USD_ID,
        acquisitionDate: new Date(Date.UTC(2024, 2, 1)),
        description: "Estación de trabajo USD (demo — seed)",
        categoryId: category.id,
        acquisitionCurrency: "USD",
        acquisitionAmountOriginal: "1500",
        historicalValueClp: histUsd,
        usefulLifeMonths: 36,
        createdById: adminUser?.id ?? undefined,
      },
      update: {},
    });
    console.log("Activos demo: CLP + USD (2 upserts)");
  } catch (e) {
    console.warn(
      "[seed] Activo demo USD omitido (¿falta dólar observado 2024-03-01?). Solo quedó el demo CLP.",
      e instanceof Error ? e.message : e,
    );
    console.log("Activos demo: solo CLP (1 upsert)");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
