import { describe, expect, it } from "vitest";
import { computeVuRestanteMeses } from "./effective-useful-life.js";
import { auxiliarSnapshotMonthsRemainingInYear } from "./auxiliar-snapshot-policy.js";
import type { Asset, UsefulLifeCategory } from "@prisma/client";

function mockAsset(overrides: Partial<Asset> & { category: Partial<UsefulLifeCategory> }): Parameters<
  typeof computeVuRestanteMeses
>[0] {
  const category = {
    id: "c1",
    code: "EQ",
    name: "Eq",
    normalLifeMonths: 72,
    acceleratedLifeMonths: 24,
    ...overrides.category,
  } as UsefulLifeCategory;
  const asset = {
    id: "a1",
    acquisitionDate: new Date(Date.UTC(2022, 10, 28)),
    usefulLifeMonths: 72,
    acceleratedDepreciation: false,
    ...overrides,
    category,
  } as Parameters<typeof computeVuRestanteMeses>[0];
  return asset;
}

describe("auxiliarSnapshotMonthsRemainingInYear", () => {
  it("uses persisted snapshot value, not catalog timeline recomputation", () => {
    const asset = mockAsset({ category: {} });
    const recomputedWouldBe = computeVuRestanteMeses(asset, 2026, 4);
    expect(recomputedWouldBe).toBeGreaterThan(0);

    const persistedFromImportOrClose = 0;
    expect(auxiliarSnapshotMonthsRemainingInYear(persistedFromImportOrClose)).toBe(0);
    expect(auxiliarSnapshotMonthsRemainingInYear(persistedFromImportOrClose)).not.toBe(recomputedWouldBe);
  });

  it("passes through close-month snapshot VU (aligned with computeBudacomSnapshotFields)", () => {
    expect(auxiliarSnapshotMonthsRemainingInYear(19)).toBe(19);
  });
});
