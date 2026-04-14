import { describe, expect, it } from "vitest";
import {
  computeVuRestanteMeses,
  declaredInitialUsefulLifeMonths,
} from "./effective-useful-life.js";
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

describe("declaredInitialUsefulLifeMonths", () => {
  it("uses stored usefulLifeMonths directly when set, regardless of category catalog", () => {
    expect(declaredInitialUsefulLifeMonths(mockAsset({ usefulLifeMonths: 72, category: {} }))).toBe(72);
    expect(declaredInitialUsefulLifeMonths(mockAsset({ usefulLifeMonths: 24, category: {} }))).toBe(24);
    expect(declaredInitialUsefulLifeMonths(mockAsset({ usefulLifeMonths: 48, category: {} }))).toBe(48);
    expect(declaredInitialUsefulLifeMonths(mockAsset({ usefulLifeMonths: 6, category: {} }))).toBe(6);
  });

  it("uses accelerated catalog when usefulLifeMonths null and accelerated flag", () => {
    const a = mockAsset({ usefulLifeMonths: null, acceleratedDepreciation: true, category: {} });
    expect(declaredInitialUsefulLifeMonths(a)).toBe(24);
  });

  it("uses normal catalog when usefulLifeMonths null and not accelerated", () => {
    const a = mockAsset({ usefulLifeMonths: null, acceleratedDepreciation: false, category: {} });
    expect(declaredInitialUsefulLifeMonths(a)).toBe(72);
  });
});

describe("computeVuRestanteMeses", () => {
  it("returns full declared life in acquisition month when accelerated flag without override", () => {
    const a = mockAsset({ category: {} });
    expect(computeVuRestanteMeses(a, 2025, 11)).toBe(24);
  });

  it("subtracts elapsed calendar months", () => {
    const a = mockAsset({ category: {} });
    expect(computeVuRestanteMeses(a, 2025, 12)).toBe(23);
  });
});
