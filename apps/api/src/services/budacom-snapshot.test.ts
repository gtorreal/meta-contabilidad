import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { computeBudacomSnapshotFields } from "./budacom-snapshot.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const goldenPath = path.join(__dirname, "__fixtures__", "budacom-golden.json");

type GoldenCase = {
  label: string;
  historicalValueClp: string;
  acquisitionDate: string;
  lifeMonths: number;
  periodYear: number;
  periodMonth: number;
  ipcAcquisitionValue: string;
  ipcPeriodValue: string;
  prevAccumulatedDepUpdated: string | null;
  expected: Record<string, string | number>;
};

describe("computeBudacomSnapshotFields (golden Budacom)", () => {
  const golden = JSON.parse(readFileSync(goldenPath, "utf-8")) as { cases: GoldenCase[] };

  for (const c of golden.cases) {
    it(c.label, () => {
      const acq = new Date(`${c.acquisitionDate}T12:00:00.000Z`);
      const out = computeBudacomSnapshotFields({
        historicalValueClp: c.historicalValueClp,
        acquisitionDate: acq,
        lifeMonths: c.lifeMonths,
        periodYear: c.periodYear,
        periodMonth: c.periodMonth,
        ipcAcquisition: c.ipcAcquisitionValue,
        ipcPeriod: c.ipcPeriodValue,
        prevAccumulatedDepUpdated: c.prevAccumulatedDepUpdated,
      });
      expect(out.cmFactor).toBe(c.expected.cmFactor);
      expect(out.updatedGrossValue).toBe(c.expected.updatedGrossValue);
      expect(out.depHistorical).toBe(c.expected.depHistorical);
      expect(out.depUpdated).toBe(c.expected.depUpdated);
      expect(out.depCmAdjustment).toBe(c.expected.depCmAdjustment);
      expect(out.depreciationForPeriod).toBe(c.expected.depreciationForPeriod);
      expect(out.accumulatedDepreciation).toBe(c.expected.accumulatedDepreciation);
      expect(out.netBookValue).toBe(c.expected.netBookValue);
      expect(out.netToDepreciate).toBe(c.expected.netToDepreciate);
      expect(out.monthsRemainingInYear).toBe(c.expected.monthsRemainingInYear);
    });
  }
});
