import { Hono } from "hono";
import { fixedAssetMovementQuerySchema } from "@meta-contabilidad/shared";
import {
  buildFixedAssetMovementReport,
  FixedAssetMovementReportError,
} from "../services/fixed-asset-movement-report.js";

export const reportsRoute = new Hono();

reportsRoute.get("/fixed-asset-movement", async (c) => {
  const raw = {
    year: c.req.query("year") ?? "",
    categoryCodes: c.req.query("categoryCodes") ?? undefined,
  };
  const parsed = fixedAssetMovementQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const categoryCodes = parsed.data.categoryCodes
    ? parsed.data.categoryCodes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  try {
    const report = await buildFixedAssetMovementReport({
      year: parsed.data.year,
      categoryCodes,
    });
    return c.json(report);
  } catch (e) {
    if (e instanceof FixedAssetMovementReportError) {
      return c.json({ error: e.message }, 422);
    }
    throw e;
  }
});
