import { Hono } from "hono";
import { periodReopenSchema, runCloseMonthSchema } from "@meta-contabilidad/shared";
import { prisma } from "../db.js";
import { decToString } from "../serialize.js";
import { requireAdmin } from "../middleware/admin.js";
import {
  countEligibleAssetsForPeriod,
  countEligibleFromAssetRows,
  runCloseMonthForPeriod,
} from "../services/close-month.js";

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
    const result = await runCloseMonthForPeriod(body.data.year, body.data.month);
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
  const period = await prisma.accountingPeriod.findUnique({ where: { id } });
  if (!period) return c.json({ error: "No encontrado" }, 404);
  if (period.status === "CLOSED") {
    return c.json(
      {
        error:
          "No se puede eliminar un período cerrado. Reábralo con Admin (X-Admin-Key) y luego elimínelo mientras esté abierto.",
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
  const rows = await prisma.assetPeriodSnapshot.findMany({
    where: { periodId: id },
    include: { asset: { include: { category: true } } },
    orderBy: { asset: { description: "asc" } },
  });
  return c.json(
    rows.map((r) => ({
      ...r,
      cmFactor: decToString(r.cmFactor),
      updatedGrossValue: decToString(r.updatedGrossValue),
      depHistorical: decToString(r.depHistorical),
      depCmAdjustment: decToString(r.depCmAdjustment),
      depUpdated: decToString(r.depUpdated),
      netToDepreciate: decToString(r.netToDepreciate),
      depreciationForPeriod: decToString(r.depreciationForPeriod),
      accumulatedDepreciation: decToString(r.accumulatedDepreciation),
      netBookValue: decToString(r.netBookValue),
    })),
  );
});
