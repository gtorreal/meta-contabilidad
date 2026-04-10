import { Hono } from "hono";
import {
  backfillSnapshotsSchema,
  periodReopenSchema,
  runCloseMonthSchema,
} from "@meta-contabilidad/shared";
import { prisma } from "../db.js";
import { decToString, serializeAssetDecimals } from "../serialize.js";
import { requireAdmin } from "../middleware/admin.js";
import {
  countEligibleAssetsForPeriod,
  countEligibleFromAssetRows,
  runCloseMonthForPeriod,
} from "../services/close-month.js";
import {
  backfillSnapshotsChronologically,
  hasRunCloseChainGapRisk,
} from "../services/period-backfill.js";
import { isLikelyZeroDepDueToInflatedPrevChain } from "../services/auxiliar-dep-anomaly.js";
import { auxiliarSnapshotMonthsRemainingInYear } from "../services/auxiliar-snapshot-policy.js";
import {
  computeVuRestanteMeses,
  declaredInitialUsefulLifeMonths,
  type AssetWithCategory,
} from "../services/effective-useful-life.js";

export const periodsRoute = new Hono();

periodsRoute.get("/", async (c) => {
  const [rows, activeAssets] = await Promise.all([
    prisma.accountingPeriod.findMany({
      orderBy: [{ year: "desc" }, { month: "desc" }],
      include: { _count: { select: { snapshots: true } } },
    }),
    prisma.asset.findMany({
      where: { status: "ACTIVE" },
      select: { acquisitionDate: true, disposedAt: true },
    }),
  ]);
  return c.json(
    rows.map((p) => ({
      ...p,
      eligibleAssetCount: countEligibleFromAssetRows(activeAssets, p.year, p.month),
    })),
  );
});

periodsRoute.post("/run-close", async (c) => {
  const body = runCloseMonthSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }
  try {
    if (await hasRunCloseChainGapRisk(body.data.year, body.data.month)) {
      return c.json(
        {
          error:
            "Hay activos con snapshot en un mes posterior pero sin ningún mes anterior: calcular este mes dejaría mal el «dep. mes». Use «Generar cadena desde primera compra» o genere los meses previos en orden, luego vuelva a calcular los posteriores.",
        },
        409,
      );
    }
    const result = await runCloseMonthForPeriod(body.data.year, body.data.month);
    return c.json(result);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Error" }, 400);
  }
});

periodsRoute.post("/backfill-snapshots", async (c) => {
  const body = backfillSnapshotsSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }
  try {
    const result = await backfillSnapshotsChronologically(body.data.untilYear, body.data.untilMonth);
    return c.json(result);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Error" }, 400);
  }
});

periodsRoute.post("/:id/close", async (c) => {
  const id = c.req.param("id");
  const period = await prisma.accountingPeriod.findUnique({ where: { id } });
  if (!period) return c.json({ error: "No encontrado" }, 404);
  if (period.status === "CLOSED") {
    return c.json({ error: "Ya está cerrado" }, 409);
  }
  const [snapshotCount, eligibleCount] = await Promise.all([
    prisma.assetPeriodSnapshot.count({ where: { periodId: id } }),
    countEligibleAssetsForPeriod(period.year, period.month),
  ]);
  if (eligibleCount > 0 && snapshotCount === 0) {
    return c.json(
      {
        error:
          "Hay activos elegibles pero aún no hay snapshots. Ejecute primero «Calcular snapshots» (POST /api/periods/run-close) para este año y mes.",
      },
      409,
    );
  }
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  const updated = await prisma.accountingPeriod.update({
    where: { id },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      closedById: admin?.id,
    },
  });
  return c.json(updated);
});

periodsRoute.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const period = await prisma.accountingPeriod.findUnique({
    where: { id },
    include: { _count: { select: { snapshots: true } } },
  });
  if (!period) return c.json({ error: "No encontrado" }, 404);
  if (period.status === "CLOSED" && period._count.snapshots > 0) {
    return c.json(
      {
        error:
          "No se puede eliminar un período cerrado con snapshots. Reábralo con Admin (X-Admin-Key) y elimínelo mientras esté abierto.",
      },
      409,
    );
  }
  await prisma.accountingPeriod.delete({ where: { id } });
  return c.body(null, 204);
});

periodsRoute.post("/:id/reopen", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const body = periodReopenSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }
  const period = await prisma.accountingPeriod.findUnique({ where: { id } });
  if (!period) return c.json({ error: "No encontrado" }, 404);
  if (period.status === "OPEN") {
    return c.json({ error: "Ya está abierto" }, 409);
  }

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });

  await prisma.$transaction([
    prisma.auditLog.create({
      data: {
        actorId: admin?.id,
        action: "PERIOD_REOPENED",
        entityType: "AccountingPeriod",
        entityId: id,
        reason: body.data.reason,
        metadata: { year: period.year, month: period.month },
      },
    }),
    prisma.accountingPeriod.update({
      where: { id },
      data: {
        status: "OPEN",
        closedAt: null,
        closedById: null,
      },
    }),
  ]);

  const updated = await prisma.accountingPeriod.findUnique({ where: { id } });
  return c.json(updated);
});

periodsRoute.get("/:id/snapshots", async (c) => {
  const id = c.req.param("id");
  const period = await prisma.accountingPeriod.findUnique({ where: { id } });
  if (!period) return c.json({ error: "No encontrado" }, 404);

  const rows = await prisma.assetPeriodSnapshot.findMany({
    where: { periodId: id },
    include: { asset: { include: { category: true } } },
    orderBy: { asset: { description: "asc" } },
  });
  return c.json(
    rows.map((r) => {
      const { asset, ...rest } = r;
      const assetForVu = asset as unknown as AssetWithCategory;
      const initialUsefulLifeMonths = declaredInitialUsefulLifeMonths(assetForVu);
      const monthsRemainingInYear = auxiliarSnapshotMonthsRemainingInYear(r.monthsRemainingInYear);
      const linearModelMonthsRemaining = computeVuRestanteMeses(assetForVu, period.year, period.month);
      const acqDate = new Date(asset.acquisitionDate);
      const likelyZeroDepFromChainMismatch = isLikelyZeroDepDueToInflatedPrevChain({
        acquisitionDate: acqDate,
        periodYear: period.year,
        periodMonth: period.month,
        depreciationForPeriod: r.depreciationForPeriod.toString(),
        monthsRemainingInYear,
        initialUsefulLifeMonths,
        historicalValueClp: asset.historicalValueClp.toString(),
      });
      return {
        ...rest,
        initialUsefulLifeMonths,
        monthsRemainingInYear,
        linearModelMonthsRemaining,
        likelyZeroDepFromChainMismatch,
        cmFactor: decToString(r.cmFactor),
        updatedGrossValue: decToString(r.updatedGrossValue),
        depHistorical: decToString(r.depHistorical),
        depCmAdjustment: decToString(r.depCmAdjustment),
        depUpdated: decToString(r.depUpdated),
        netToDepreciate: decToString(r.netToDepreciate),
        depreciationForPeriod: decToString(r.depreciationForPeriod),
        accumulatedDepreciation: decToString(r.accumulatedDepreciation),
        netBookValue: decToString(r.netBookValue),
        asset: serializeAssetDecimals(asset as unknown as Record<string, unknown>),
      };
    }),
  );
});
