import { describe, expect, it } from "vitest";
import { usefulLifeErrorForCategory } from "./useful-life-for-category.js";

describe("usefulLifeErrorForCategory", () => {
  const cat = { normalLifeMonths: 72, acceleratedLifeMonths: 24 };

  it("permite null o undefined", () => {
    expect(usefulLifeErrorForCategory(cat, null)).toBeNull();
    expect(usefulLifeErrorForCategory(cat, undefined)).toBeNull();
  });

  it("permite meses normal y acelerado", () => {
    expect(usefulLifeErrorForCategory(cat, 72)).toBeNull();
    expect(usefulLifeErrorForCategory(cat, 24)).toBeNull();
  });

  it("rechaza otros valores", () => {
    expect(usefulLifeErrorForCategory(cat, 36)).toBe(
      "La vida útil debe ser la normal o la acelerada de la categoría elegida.",
    );
  });
});
