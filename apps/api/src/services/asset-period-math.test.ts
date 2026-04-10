import { describe, expect, it } from "vitest";
import { monthsElapsedSinceAcquisitionMonth } from "./asset-period-math.js";

describe("monthsElapsedSinceAcquisitionMonth", () => {
  it("returns 0 when acquisition month equals period month", () => {
    const acq = new Date(Date.UTC(2025, 10, 17));
    expect(monthsElapsedSinceAcquisitionMonth(acq, 2025, 11)).toBe(0);
  });

  it("returns 1 one calendar month after acquisition month", () => {
    const acq = new Date(Date.UTC(2025, 8, 12));
    expect(monthsElapsedSinceAcquisitionMonth(acq, 2025, 10)).toBe(1);
  });

  it("returns 2 two calendar months after acquisition month", () => {
    const acq = new Date(Date.UTC(2025, 8, 12));
    expect(monthsElapsedSinceAcquisitionMonth(acq, 2025, 11)).toBe(2);
  });

  it("counts across year boundary", () => {
    const acq = new Date(Date.UTC(2024, 11, 1));
    expect(monthsElapsedSinceAcquisitionMonth(acq, 2025, 1)).toBe(1);
    expect(monthsElapsedSinceAcquisitionMonth(acq, 2026, 1)).toBe(13);
  });

  it("never returns negative", () => {
    const acq = new Date(Date.UTC(2025, 5, 3));
    expect(monthsElapsedSinceAcquisitionMonth(acq, 2025, 3)).toBe(0);
  });
});
