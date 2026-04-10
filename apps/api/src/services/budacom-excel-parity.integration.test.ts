/**
 * Deshabilitado: el auxiliar ya no replica Budacom con CM por IPC. Para reactivar, reintroducir CM en snapshots o
 * comparar contra una planilla alineada a histórico sin CM.
 */
import { existsSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../db.js";
import { reconcileBudacomWorkbookDepreciation } from "./budacom-reconcile.js";

describe.skip("Budacom Excel parity (incompatible sin CM en snapshots; set BUDACOM_XLSX_PATH para inspección futura)", () => {
  it("every period present in DB matches sum DEPRECIACION PERIODO in Excel (delta 0)", async () => {
    const xlsxPath = process.env.BUDACOM_XLSX_PATH ?? "";
    if (!xlsxPath || !existsSync(xlsxPath)) {
      throw new Error("BUDACOM_XLSX_PATH requerido si se reactiva este test");
    }
    const rows = await reconcileBudacomWorkbookDepreciation(xlsxPath, { toleranceClp: 0 });
    const bad = rows.filter((r) => !r.ok);
    expect(bad, JSON.stringify(bad, null, 2)).toEqual([]);
  }, 180_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
