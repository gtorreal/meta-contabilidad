import { Decimal } from "decimal.js";
import { monthsElapsedSinceAcquisitionMonth } from "./asset-period-math.js";

/**
 * Dep. del período = 0 pero aún hay VU restante y ya pasó al menos un mes civil desde la compra.
 * Suele indicar que el acumulado del mes anterior en BD supera el tope lineal de **este** mes
 * (`computeBudacomSnapshotFields` no genera depreciación negativa). Típico tras import con
 * dep. inflada y recálculo solo del último período. Solución: regenerar la cadena completa en orden.
 */
export function isLikelyZeroDepDueToInflatedPrevChain(args: {
  acquisitionDate: Date;
  periodYear: number;
  periodMonth: number;
  depreciationForPeriod: string;
  monthsRemainingInYear: number;
  initialUsefulLifeMonths: number;
  historicalValueClp: string;
}): boolean {
  const elapsed = monthsElapsedSinceAcquisitionMonth(
    args.acquisitionDate,
    args.periodYear,
    args.periodMonth,
  );
  if (elapsed <= 0) return false;
  if (args.monthsRemainingInYear <= 0) return false;
  if (args.initialUsefulLifeMonths <= 0) return false;
  const dep = new Decimal(args.depreciationForPeriod);
  if (!dep.isZero()) return false;
  const hist = new Decimal(args.historicalValueClp);
  const monthly = hist.div(args.initialUsefulLifeMonths).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return !monthly.isZero();
}
