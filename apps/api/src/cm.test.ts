import { describe, expect, it } from "vitest";
import { Decimal } from "decimal.js";

describe("Decimal CM sanity", () => {
  it("divides IPC period by acquisition", () => {
    const a = new Decimal("100");
    const p = new Decimal("105");
    expect(p.div(a).toDecimalPlaces(10).toFixed()).toBe("1.05");
  });
});
