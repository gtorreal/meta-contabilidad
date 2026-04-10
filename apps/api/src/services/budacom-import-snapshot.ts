import { computeBudacomSnapshotFields } from "./budacom-snapshot.js";
import {
  computeVuRestanteMeses,
  declaredInitialUsefulLifeMonths,
  type AssetWithCategory,
} from "./effective-useful-life.js";

/**
 * VU restante persistida en import mensual Budacom: si la planilla trae «VIDA UTIL», se respeta;
 * si no, se usa el calendario civil + vida útil declarada del activo (misma base que el cierre).
 */
export function monthsRemainingForBudacomImportRow(
  vidaUtilCell: number | null,
  asset: AssetWithCategory,
  periodYear: number,
  periodMonth: number,
): number {
  if (vidaUtilCell !== null) return Math.max(0, Math.round(vidaUtilCell));
  return computeVuRestanteMeses(asset, periodYear, periodMonth);
}

/** Snapshots alineados al motor lineal CLP (mismo criterio que `runCloseMonthForPeriod`). */
export function linearSnapshotFieldsForBudacomImport(
  asset: AssetWithCategory,
  periodYear: number,
  periodMonth: number,
  prevAccumulatedDepreciation: string | null,
) {
  const lifeMonths = declaredInitialUsefulLifeMonths(asset);
  return computeBudacomSnapshotFields({
    historicalValueClp: asset.historicalValueClp.toString(),
    acquisitionDate: new Date(asset.acquisitionDate),
    lifeMonths,
    periodYear,
    periodMonth,
    prevAccumulatedDepreciation,
  });
}
