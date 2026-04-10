import { describe, expect, it } from "vitest";
import { loadIpcMonthlyPayload } from "./ipc-import.js";

describe("loadIpcMonthlyPayload", () => {
  it("loads bundled IPC series from enero 2017 with last-day-of-month dates", () => {
    const p = loadIpcMonthlyPayload();
    expect(p.series.length).toBeGreaterThanOrEqual(100);
    expect(p.series[0]).toEqual({ date: "2017-01-31", value: "73.0716" });
    const last = p.series[p.series.length - 1];
    expect(last.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(p.source.length).toBeGreaterThan(20);
  });
});
