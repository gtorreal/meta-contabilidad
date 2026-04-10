import type { Asset, UsefulLifeCategory } from "@prisma/client";
import { monthsElapsedSinceAcquisitionMonth, usefulLifeMonthsRemaining } from "./asset-period-math.js";
import { usefulLifeErrorForCategory } from "./useful-life-for-category.js";

export type AssetWithCategory = Asset & { category: UsefulLifeCategory };

/**
 * Vida útil total del cronograma (depreciación, VU inicial en UI, VU restante):
 * meses persistidos si son válidos para el rubro; si no hay override y el activo está marcado
 * acelerado, la vida acelerada del catálogo; en caso contrario la vida normal del rubro.
 */
export function declaredInitialUsefulLifeMonths(asset: AssetWithCategory): number {
  const u = asset.usefulLifeMonths;
  if (u != null && usefulLifeErrorForCategory(asset.category, u) === null) {
    return u;
  }
  if (u == null && asset.acceleratedDepreciation === true) {
    return asset.category.acceleratedLifeMonths;
  }
  return asset.category.normalLifeMonths;
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
  const life = declaredInitialUsefulLifeMonths(asset);
  const elapsed = monthsElapsedSinceAcquisitionMonth(
    new Date(asset.acquisitionDate),
    periodYear,
    periodMonth,
  );
  return usefulLifeMonthsRemaining(life, elapsed);
}
