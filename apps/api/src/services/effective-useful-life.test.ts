import { describe, expect, it } from "vitest";
import { computeVuRestanteMeses, effectiveUsefulLifeMonths } from "./effective-useful-life.js";
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
    acquisitionDate: new Date(Date.UTC(2025, 10, 17)),
    usefulLifeMonths: null,
    acceleratedDepreciation: true,
    ...overrides,
    category,
  } as Parameters<typeof computeVuRestanteMeses>[0];
  return asset;
}

describe("effectiveUsefulLifeMonths", () => {
  it("uses override when set", () => {
    const a = mockAsset({ usefulLifeMonths: 12, category: {} });
    expect(effectiveUsefulLifeMonths(a)).toBe(12);
  });

  it("uses accelerated catalog when accelerated", () => {
    const a = mockAsset({ usefulLifeMonths: null, acceleratedDepreciation: true, category: {} });
    expect(effectiveUsefulLifeMonths(a)).toBe(24);
  });
});

describe("computeVuRestanteMeses", () => {
  it("returns full life in acquisition month", () => {
    const a = mockAsset({ category: {} });
    expect(computeVuRestanteMeses(a, 2025, 11)).toBe(24);
  });

  it("subtracts elapsed calendar months", () => {
    const a = mockAsset({ category: {} });
    expect(computeVuRestanteMeses(a, 2025, 12)).toBe(23);
  });
});
