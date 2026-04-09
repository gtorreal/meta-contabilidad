import { Hono } from "hono";
import { assetCreateSchema, assetUpdateSchema } from "@meta-contabilidad/shared";
import { prisma } from "../db.js";
import { decToString } from "../serialize.js";
import { resolveHistoricalValueClp } from "../services/fx.js";
import { assertAssetEditable } from "../services/period-guard.js";

export const assetsRoute = new Hono();

function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function serializeAsset(a: Record<string, unknown>) {
  return {
    ...a,
    acquisitionAmountOriginal: decToString(a.acquisitionAmountOriginal as never),
    historicalValueClp: decToString(a.historicalValueClp as never),
    creditAfPercent: decToString(a.creditAfPercent as never),
  };
}

assetsRoute.get("/", async (c) => {
  const rows = await prisma.asset.findMany({
    include: { category: true },
    orderBy: { acquisitionDate: "desc" },
  });
  return c.json(rows.map((r) => serializeAsset(r as unknown as Record<string, unknown>)));
});

assetsRoute.get("/:id", async (c) => {
  const row = await prisma.asset.findUnique({
    where: { id: c.req.param("id") },
    include: { category: true, snapshots: { include: { period: true } } },
  });
  if (!row) return c.json({ error: "No encontrado" }, 404);
  const { snapshots: snapRows, ...rest } = row;
  const base = serializeAsset(rest as unknown as Record<string, unknown>);
  const snapshots = snapRows.map((s) => ({
    ...s,
    cmFactor: decToString(s.cmFactor),
    updatedGrossValue: decToString(s.updatedGrossValue),
    depHistorical: decToString(s.depHistorical),
    depCmAdjustment: decToString(s.depCmAdjustment),
    depUpdated: decToString(s.depUpdated),
    netToDepreciate: decToString(s.netToDepreciate),
    depreciationForPeriod: decToString(s.depreciationForPeriod),
    accumulatedDepreciation: decToString(s.accumulatedDepreciation),
    netBookValue: decToString(s.netBookValue),
  }));
  return c.json({ ...base, snapshots });
});

assetsRoute.post("/", async (c) => {
  const body = assetCreateSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }
  let historicalValueClp: string;
  try {
    historicalValueClp = await resolveHistoricalValueClp({
      acquisitionDate: body.data.acquisitionDate,
      currency: body.data.acquisitionCurrency,
      acquisitionAmountOriginal: body.data.acquisitionAmountOriginal,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error de conversión";
    return c.json({ error: msg }, 400);
  }

  try {
    const row = await prisma.asset.create({
      data: {
        acquisitionDate: parseYmd(body.data.acquisitionDate),
        invoiceNumber: body.data.invoiceNumber ?? undefined,
        description: body.data.description,
        categoryId: body.data.categoryId,
        acquisitionCurrency: body.data.acquisitionCurrency,
        acquisitionAmountOriginal: body.data.acquisitionAmountOriginal,
        historicalValueClp,
        creditAfPercent: body.data.creditAfPercent ?? undefined,
        usefulLifeMonths: body.data.usefulLifeMonths ?? undefined,
        acceleratedDepreciation: body.data.acceleratedDepreciation ?? false,
        status: body.data.status ?? "ACTIVE",
        odooAssetRef: body.data.odooAssetRef ?? undefined,
        odooMoveRef: body.data.odooMoveRef ?? undefined,
      },
      include: { category: true },
    });
    return c.json(serializeAsset(row as unknown as Record<string, unknown>), 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al crear";
    return c.json({ error: msg }, 400);
  }
});

assetsRoute.patch("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    await assertAssetEditable(id);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "No editable" }, 409);
  }

  const body = assetUpdateSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }
  const data = body.data;

  const existing = await prisma.asset.findUnique({ where: { id } });
  if (!existing) return c.json({ error: "No encontrado" }, 404);

  const acq = existing.acquisitionDate;
  const acqDefault = `${acq.getUTCFullYear()}-${String(acq.getUTCMonth() + 1).padStart(2, "0")}-${String(acq.getUTCDate()).padStart(2, "0")}`;
  const merged = {
    acquisitionDate: data.acquisitionDate ?? acqDefault,
    acquisitionCurrency: data.acquisitionCurrency ?? existing.acquisitionCurrency,
    acquisitionAmountOriginal:
      data.acquisitionAmountOriginal ?? existing.acquisitionAmountOriginal.toString(),
  };

  let historicalValueClp = existing.historicalValueClp.toString();
  if (
    data.acquisitionDate ||
    data.acquisitionCurrency ||
    data.acquisitionAmountOriginal
  ) {
    try {
      historicalValueClp = await resolveHistoricalValueClp({
        acquisitionDate: merged.acquisitionDate,
        currency: merged.acquisitionCurrency,
        acquisitionAmountOriginal: merged.acquisitionAmountOriginal,
      });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Error de conversión" }, 400);
    }
  }

  try {
    const row = await prisma.asset.update({
      where: { id },
      data: {
        ...(data.acquisitionDate ? { acquisitionDate: parseYmd(data.acquisitionDate) } : {}),
        ...(data.invoiceNumber !== undefined ? { invoiceNumber: data.invoiceNumber ?? undefined } : {}),
        ...(data.description ? { description: data.description } : {}),
        ...(data.categoryId ? { categoryId: data.categoryId } : {}),
        ...(data.acquisitionCurrency ? { acquisitionCurrency: data.acquisitionCurrency } : {}),
        ...(data.acquisitionAmountOriginal
          ? { acquisitionAmountOriginal: data.acquisitionAmountOriginal }
          : {}),
        historicalValueClp,
        ...(data.creditAfPercent !== undefined ? { creditAfPercent: data.creditAfPercent ?? undefined } : {}),
        ...(data.usefulLifeMonths !== undefined
          ? { usefulLifeMonths: data.usefulLifeMonths ?? null }
          : {}),
        ...(data.acceleratedDepreciation !== undefined
          ? { acceleratedDepreciation: data.acceleratedDepreciation }
          : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.odooAssetRef !== undefined ? { odooAssetRef: data.odooAssetRef ?? undefined } : {}),
        ...(data.odooMoveRef !== undefined ? { odooMoveRef: data.odooMoveRef ?? undefined } : {}),
      },
      include: { category: true },
    });
    return c.json(serializeAsset(row as unknown as Record<string, unknown>));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al actualizar";
    return c.json({ error: msg }, 400);
  }
});

assetsRoute.delete("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    await assertAssetEditable(id);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "No editable" }, 409);
  }
  try {
    await prisma.asset.delete({ where: { id } });
    return c.body(null, 204);
  } catch {
    return c.json({ error: "No encontrado" }, 404);
  }
});
