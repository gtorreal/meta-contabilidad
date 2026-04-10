import type { Asset, AssetPeriodSnapshot, UsefulLifeCategory } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { computeMovementTotals } from "./fixed-asset-movement-report.js";

const cat = { id: "c1", code: "EQ_COMP", name: "x", normalLifeMonths: 36, acceleratedLifeMonths: 18 } as UsefulLifeCategory;

type AWC = Asset & { category: UsefulLifeCategory };

function asset(id: string, acquisitionDate: string, desc = "Activo"): AWC {
  return {
    id,
    acquisitionDate: new Date(acquisitionDate),
    description: desc,
    categoryId: cat.id,
    category: cat,
    status: "ACTIVE",
    disposedAt: null,
  } as AWC;
}

function snap(updatedGross: string, accumulated: string, net: string): AssetPeriodSnapshot {
  return {
    updatedGrossValue: updatedGross as unknown as AssetPeriodSnapshot["updatedGrossValue"],
    accumulatedDepreciation: accumulated as unknown as AssetPeriodSnapshot["accumulatedDepreciation"],
    netBookValue: net as unknown as AssetPeriodSnapshot["netBookValue"],
  } as AssetPeriodSnapshot;
}

describe("computeMovementTotals", () => {
  it("solo activos previos al año: apertura desde dic N−1 y depreciación del período = Δ acumulada", () => {
    const eligible = [asset("a1", "2024-06-15")];
    const n = new Map([["a1", snap("1000.00", "200.00", "800.00")]]);
    const n1 = new Map([["a1", snap("1000.00", "100.00", "900.00")]]);
    const t = computeMovementTotals(2025, eligible, n, n1);
    expect(t.grossOpening.toFixed(2)).toBe("1000.00");
    expect(t.grossAdditions.toFixed(2)).toBe("0.00");
    expect(t.grossClosing.toFixed(2)).toBe("1000.00");
    expect(t.depOpening.toFixed(2)).toBe("100.00");
    expect(t.depPeriod.toFixed(2)).toBe("100.00");
    expect(t.depClosing.toFixed(2)).toBe("200.00");
    expect(t.netClosing.toFixed(2)).toBe("800.00");
    expect(t.grossDifference.toFixed(2)).toBe("0.00");
    expect(t.warnings).toHaveLength(0);
  });

  it("solo altas del ejercicio: adiciones = bruto cierre y depreciación inicial 0", () => {
    const eligible = [asset("a2", "2025-03-01")];
    const n = new Map([["a2", snap("500.00", "50.00", "450.00")]]);
    const n1 = new Map<string, AssetPeriodSnapshot>();
    const t = computeMovementTotals(2025, eligible, n, n1);
    expect(t.grossOpening.toFixed(2)).toBe("0.00");
    expect(t.grossAdditions.toFixed(2)).toBe("500.00");
    expect(t.grossClosing.toFixed(2)).toBe("500.00");
    expect(t.depOpening.toFixed(2)).toBe("0.00");
    expect(t.depPeriod.toFixed(2)).toBe("50.00");
    expect(t.grossDifference.toFixed(2)).toBe("0.00");
    expect(t.warnings).toHaveLength(0);
  });

  it("activo antiguo sin snapshot dic N−1: advertencia y omite apertura", () => {
    const eligible = [asset("a3", "2024-01-01")];
    const n = new Map([["a3", snap("800.00", "300.00", "500.00")]]);
    const n1 = new Map<string, AssetPeriodSnapshot>();
    const t = computeMovementTotals(2025, eligible, n, n1);
    expect(t.grossOpening.toFixed(2)).toBe("0.00");
    expect(t.warnings.length).toBeGreaterThanOrEqual(1);
    expect(t.grossClosing.toFixed(2)).toBe("800.00");
    expect(t.depPeriod.toFixed(2)).toBe("300.00");
  });

  it("mezcla de activo antiguo y alta del año", () => {
    const eligible = [asset("old", "2023-05-01"), asset("new", "2025-07-01")];
    const n = new Map([
      ["old", snap("200.00", "80.00", "120.00")],
      ["new", snap("100.00", "10.00", "90.00")],
    ]);
    const n1 = new Map([["old", snap("200.00", "60.00", "140.00")]]);
    const t = computeMovementTotals(2025, eligible, n, n1);
    expect(t.grossOpening.toFixed(2)).toBe("200.00");
    expect(t.grossAdditions.toFixed(2)).toBe("100.00");
    expect(t.grossClosing.toFixed(2)).toBe("300.00");
    expect(t.depOpening.toFixed(2)).toBe("60.00");
    expect(t.depPeriod.toFixed(2)).toBe("30.00");
    expect(t.netClosing.toFixed(2)).toBe("210.00");
  });
});
