import { describe, expect, it } from "vitest";
import type { Asset, UsefulLifeCategory } from "@prisma/client";
import { monthsRemainingForBudacomImportRow } from "./budacom-import-snapshot.js";

function mockAsset(overrides: Partial<Asset> & { category: Partial<UsefulLifeCategory> }) {
  const category = {
    id: "c1",
    code: "EQ_COMP",
    name: "Eq",
    normalLifeMonths: 72,
    acceleratedLifeMonths: 24,
    ...overrides.category,
  } as UsefulLifeCategory;
  return {
    id: "a1",
    acquisitionDate: new Date(Date.UTC(2022, 10, 28)),
    usefulLifeMonths: 72,
    acceleratedDepreciation: false,
    ...overrides,
    category,
  } as Asset & { category: UsefulLifeCategory };
}

describe("monthsRemainingForBudacomImportRow", () => {
  it("uses Excel VIDA UTIL when present", () => {
    const a = mockAsset({ category: {} });
    expect(monthsRemainingForBudacomImportRow(15, a, 2026, 4)).toBe(15);
  });

  it("uses computeVuRestanteMeses when VIDA UTIL cell is missing (not 0)", () => {
    const a = mockAsset({ category: {} });
    expect(monthsRemainingForBudacomImportRow(null, a, 2026, 4)).toBe(31);
  });
});
