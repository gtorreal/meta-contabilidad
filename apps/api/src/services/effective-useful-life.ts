import type { Asset, UsefulLifeCategory } from "@prisma/client";
import { monthsElapsedSinceAcquisitionMonth, usefulLifeMonthsRemaining } from "./asset-period-math.js";

export type AssetWithCategory = Asset & { category: UsefulLifeCategory };

/** Meses de vida útil aplicados al cálculo: override del activo o catálogo según régimen. */
export function effectiveUsefulLifeMonths(asset: AssetWithCategory): number {
  if (asset.usefulLifeMonths != null) return asset.usefulLifeMonths;
  return asset.acceleratedDepreciation
    ? asset.category.acceleratedLifeMonths
    : asset.category.normalLifeMonths;
}

/**
 * VU restante (meses) para un período, según mes civil de adquisición → período (mismo mes = 0).
 * Útil al exponer el auxiliar aunque el valor persistido en snapshot venga mal de import Excel.
 */
export function computeVuRestanteMeses(
  asset: AssetWithCategory,
  periodYear: number,
  periodMonth: number,
): number {
  const life = effectiveUsefulLifeMonths(asset);
  const elapsed = monthsElapsedSinceAcquisitionMonth(
    new Date(asset.acquisitionDate),
    periodYear,
    periodMonth,
  );
  return usefulLifeMonthsRemaining(life, elapsed);
}
