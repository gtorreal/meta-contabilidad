import { Decimal } from "decimal.js";
import type { AssetCurrency } from "@prisma/client";
import { requireUsdObservedOnDate } from "./indices.js";

function parseDateYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Valor histórico contable en CLP: CLP directo o USD × observado del día de adquisición.
 */
export async function resolveHistoricalValueClp(params: {
  acquisitionDate: string;
  currency: AssetCurrency;
  acquisitionAmountOriginal: string;
}): Promise<string> {
  const amount = new Decimal(params.acquisitionAmountOriginal);
  const date = parseDateYmd(params.acquisitionDate);

  if (params.currency === "CLP") {
    return amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed();
  }

  if (params.currency === "USD") {
    const row = await requireUsdObservedOnDate(date);
    const rate = new Decimal(row.value.toString());
    return amount.mul(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed();
  }

  throw new Error(
    "Solo CLP y USD tienen conversión automática en el MVP. Use categoría OTHER con política manual (no implementada).",
  );
}
