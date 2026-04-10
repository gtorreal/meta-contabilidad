import { describe, expect, it } from "vitest";
import { computeMonotonicIpcFactorFromMap } from "./cm.js";

describe("computeMonotonicIpcFactorFromMap", () => {
  it("when December IPC is below November, effective period IPC stays at the running maximum", () => {
    const map = new Map<string, string>([
      ["2025-10", "109"],
      ["2025-11", "109.4757"],
      ["2025-12", "109.2567"],
    ]);
    const r = computeMonotonicIpcFactorFromMap(map, 2025, 10, 2025, 12);
    expect(r.ipcPeriodEffective).toBe("109.4757");
    expect(r.factor).toBe("1.0043642202");
  });

  it("when IPC only rises, matches ratio of last month to acquisition", () => {
    const map = new Map<string, string>([
      ["2024-06", "100"],
      ["2024-07", "101"],
      ["2024-08", "102"],
    ]);
    const r = computeMonotonicIpcFactorFromMap(map, 2024, 6, 2024, 8);
    expect(r.ipcPeriodEffective).toBe("102");
    expect(r.factor).toBe("1.0200000000");
  });
});
