import { describe, expect, it } from "vitest";
import { isLikelyZeroDepDueToInflatedPrevChain } from "./auxiliar-dep-anomaly.js";

describe("isLikelyZeroDepDueToInflatedPrevChain", () => {
  const acq = new Date(Date.UTC(2022, 10, 28));

  it("is false in mes de adquisición (sin dep aún)", () => {
    expect(
      isLikelyZeroDepDueToInflatedPrevChain({
        acquisitionDate: acq,
        periodYear: 2022,
        periodMonth: 11,
        depreciationForPeriod: "0.00",
        monthsRemainingInYear: 72,
        initialUsefulLifeMonths: 72,
        historicalValueClp: "4705866",
      }),
    ).toBe(false);
  });

  it("is false cuando hay dep del período", () => {
    expect(
      isLikelyZeroDepDueToInflatedPrevChain({
        acquisitionDate: acq,
        periodYear: 2026,
        periodMonth: 4,
        depreciationForPeriod: "65359.25",
        monthsRemainingInYear: 31,
        initialUsefulLifeMonths: 72,
        historicalValueClp: "4705866",
      }),
    ).toBe(false);
  });

  it("is true cuando dep 0, VU > 0 y ya transcurrió al menos un mes", () => {
    expect(
      isLikelyZeroDepDueToInflatedPrevChain({
        acquisitionDate: acq,
        periodYear: 2026,
        periodMonth: 4,
        depreciationForPeriod: "0.00",
        monthsRemainingInYear: 35,
        initialUsefulLifeMonths: 72,
        historicalValueClp: "4705866",
      }),
    ).toBe(true);
  });
});
