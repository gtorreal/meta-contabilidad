import type { Decimal } from "@prisma/client/runtime/library";

export function decToString(d: Decimal | null | undefined): string | null {
  if (d === null || d === undefined) return null;
  return d.toFixed();
}

/** Normaliza montos Decimal del modelo Asset para JSON (incluye relaciones anidadas en el spread). */
export function serializeAssetDecimals(a: Record<string, unknown>) {
  return {
    ...a,
    acquisitionAmountOriginal: decToString(a.acquisitionAmountOriginal as never),
    historicalValueClp: decToString(a.historicalValueClp as never),
    creditAfPercent: decToString(a.creditAfPercent as never),
  };
}
