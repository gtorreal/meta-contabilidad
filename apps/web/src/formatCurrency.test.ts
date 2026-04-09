import { describe, expect, it } from "vitest";
import {
  formatClpInteger,
  formatIpcInteger,
  formatUsdInteger,
  parseDecimalStringToRoundedBigInt,
} from "./formatCurrency";

describe("parseDecimalStringToRoundedBigInt", () => {
  it("rounds using the tenths digit (first decimal place)", () => {
    expect(parseDecimalStringToRoundedBigInt("1234.44")).toBe(1234n);
    expect(parseDecimalStringToRoundedBigInt("1234.45")).toBe(1234n);
    expect(parseDecimalStringToRoundedBigInt("1234.46")).toBe(1234n);
    expect(parseDecimalStringToRoundedBigInt("1234.54")).toBe(1235n);
    expect(parseDecimalStringToRoundedBigInt("1234.56")).toBe(1235n);
  });

  it("handles .5 and leading-zero integer parts", () => {
    expect(parseDecimalStringToRoundedBigInt(".5")).toBe(1n);
    expect(parseDecimalStringToRoundedBigInt("0.5")).toBe(1n);
    expect(parseDecimalStringToRoundedBigInt("00.4")).toBe(0n);
    expect(parseDecimalStringToRoundedBigInt("001234.4")).toBe(1234n);
  });

  it("handles negatives", () => {
    expect(parseDecimalStringToRoundedBigInt("-1234.56")).toBe(-1235n);
    expect(parseDecimalStringToRoundedBigInt("-0.4")).toBe(0n);
  });

  it("returns null for invalid or empty input", () => {
    expect(parseDecimalStringToRoundedBigInt("")).toBeNull();
    expect(parseDecimalStringToRoundedBigInt("  ")).toBeNull();
    expect(parseDecimalStringToRoundedBigInt("12a34")).toBeNull();
  });
});

describe("formatClpInteger", () => {
  it("returns dash for nullish or invalid", () => {
    expect(formatClpInteger(undefined)).toBe("—");
    expect(formatClpInteger(null)).toBe("—");
    expect(formatClpInteger("")).toBe("—");
    expect(formatClpInteger("nope")).toBe("—");
  });

  it("formats integers in es-CL CLP without decimals", () => {
    const out = formatClpInteger("1000000");
    expect(out).toMatch(/1/);
    expect(out).not.toMatch(/[,.]00\b/);
  });
});

describe("formatUsdInteger", () => {
  it("returns dash for invalid", () => {
    expect(formatUsdInteger("")).toBe("—");
  });
});

describe("formatIpcInteger", () => {
  it("formats without currency symbol", () => {
    const out = formatIpcInteger("928.45");
    expect(out).not.toContain("CLP");
    expect(out).toContain("928");
  });
});
