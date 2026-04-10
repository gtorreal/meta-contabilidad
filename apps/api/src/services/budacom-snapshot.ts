import { Decimal } from "decimal.js";
import { monthsElapsedSinceAcquisitionMonth, usefulLifeMonthsRemaining } from "./asset-period-math.js";

const CM_FACTOR_ONE = "1.0000000000";

export type BudacomSnapshotInputs = {
  historicalValueClp: string;
  acquisitionDate: Date;
  lifeMonths: number;
  periodYear: number;
  periodMonth: number;
  /** Acumulado depreciación del mes anterior (campo `accumulatedDepreciation` del snapshot previo). */
  prevAccumulatedDepreciation: string | null;
};

/**
 * Auxiliar mensual sobre valor histórico CLP (sin corrección monetaria por IPC).
 * - Acumulado nunca supera el histórico.
 * - Con vida útil restante 0: dep. del período = 0 y acumulado = histórico (cierre del bien).
 * - Si el mes anterior trae acumulado inflado (p. ej. import Excel al 100 %), el tope lineal de este mes puede ser
 *   **menor** que ese acumulado: la dep. del período queda en 0 (no hay depreciación negativa) y el acumulado pasa al
 *   tope lineal. Con vida útil restante &gt; 0 puede verse «dep. mes = 0» hasta regenerar la cadena mes a mes.
 */
export function computeBudacomSnapshotFields(input: BudacomSnapshotInputs): {
  cmFactor: string;
  updatedGrossValue: string;
  depHistorical: string;
  depCmAdjustment: string;
  depUpdated: string;
  netToDepreciate: string;
  depreciationForPeriod: string;
  accumulatedDepreciation: string;
  netBookValue: string;
  monthsRemainingInYear: number;
} {
  const historical = new Decimal(input.historicalValueClp);
  const historicalCap = historical.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const updatedGross = historicalCap;

  const acq = input.acquisitionDate;
  const monthsElapsedUncapped = monthsElapsedSinceAcquisitionMonth(acq, input.periodYear, input.periodMonth);
  let monthsHeld = monthsElapsedUncapped;
  if (monthsHeld > input.lifeMonths) monthsHeld = input.lifeMonths;

  const monthsRemainingInYear = usefulLifeMonthsRemaining(input.lifeMonths, monthsElapsedUncapped);

  const depHistoricalRaw = historical.div(input.lifeMonths).mul(monthsHeld);
  const depHistorical = Decimal.min(depHistoricalRaw, historical).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const targetAccum = Decimal.min(depHistorical, historicalCap).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const prevRaw =
    input.prevAccumulatedDepreciation !== null ? new Decimal(input.prevAccumulatedDepreciation) : new Decimal(0);
  const prevCapped = Decimal.min(prevRaw, historicalCap).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  let depreciationForPeriod = targetAccum.sub(prevCapped).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  if (depreciationForPeriod.isNeg()) {
    depreciationForPeriod = new Decimal(0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  let accumulatedDepreciation = targetAccum;
  if (monthsRemainingInYear === 0) {
    depreciationForPeriod = new Decimal(0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    accumulatedDepreciation = targetAccum;
  }

  const depUpdated = accumulatedDepreciation;
  const depCmAdjustment = "0.00";
  const netToDepreciate = updatedGross.sub(accumulatedDepreciation).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const netBookValue = netToDepreciate;

  return {
    cmFactor: CM_FACTOR_ONE,
    updatedGrossValue: updatedGross.toFixed(2),
    depHistorical: depHistorical.toFixed(2),
    depCmAdjustment,
    depUpdated: depUpdated.toFixed(2),
    netToDepreciate: netToDepreciate.toFixed(2),
    depreciationForPeriod: depreciationForPeriod.toFixed(2),
    accumulatedDepreciation: accumulatedDepreciation.toFixed(2),
    netBookValue: netBookValue.toFixed(2),
    monthsRemainingInYear,
  };
}
