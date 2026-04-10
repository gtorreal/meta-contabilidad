import { existsSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../db.js";
import { reconcileBudacomWorkbookDepreciation } from "./budacom-reconcile.js";

const xlsxPath = process.env.BUDACOM_XLSX_PATH ?? "";
const runParity = Boolean(xlsxPath && existsSync(xlsxPath));

describe.skipIf(!runParity)("Budacom Excel parity (set BUDACOM_XLSX_PATH to workbook)", () => {
  it("every period present in DB matches sum DEPRECIACION PERIODO in Excel (delta 0)", async () => {
    const rows = await reconcileBudacomWorkbookDepreciation(xlsxPath, { toleranceClp: 0 });
    const bad = rows.filter((r) => !r.ok);
    expect(bad, JSON.stringify(bad, null, 2)).toEqual([]);
  }, 180_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
