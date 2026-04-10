import { Decimal } from "decimal.js";
import { monthsElapsedSinceAcquisitionMonth, usefulLifeMonthsRemaining } from "./asset-period-math.js";

/** Igual que `computeCmFactorFromIpc` pero con valores ya resueltos (tests / golden). */
export function computeCmFactorFromIpcValues(
  ipcAcquisition: string,
  ipcPeriod: string,
): { factor: string; ipcAcquisition: string; ipcPeriod: string } {
  const a = new Decimal(ipcAcquisition);
  const p = new Decimal(ipcPeriod);
  if (a.isZero()) {
    throw new Error("IPC de adquisición no puede ser cero.");
  }
  const factor = p.div(a).toDecimalPlaces(10, Decimal.ROUND_HALF_UP);
  return {
    factor: factor.toFixed(10),
    ipcAcquisition: a.toFixed(),
    ipcPeriod: p.toFixed(),
  };
}

export type BudacomSnapshotInputs = {
  historicalValueClp: string;
  acquisitionDate: Date;
  lifeMonths: number;
  periodYear: number;
  periodMonth: number;
  ipcAcquisition: string;
  ipcPeriod: string;
  /** Acumulado depreciación “actualizada” del mes anterior (campo `accumulatedDepreciation` del snapshot previo). */
  prevAccumulatedDepUpdated: string | null;
};

/**
 * Auxiliar mensual alineado con Budacom Financiero: bruto actualizado por IPC (cierre / adquisición),
 * depreciación lineal sobre bruto histórico y sobre bruto actualizado; delta del mes = depUpdated − prev acum.
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
  const { factor } = computeCmFactorFromIpcValues(input.ipcAcquisition, input.ipcPeriod);
  const fDec = new Decimal(factor);
  const updatedGross = historical.mul(fDec).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const acq = input.acquisitionDate;
  const monthsElapsedUncapped = monthsElapsedSinceAcquisitionMonth(acq, input.periodYear, input.periodMonth);
  let monthsHeld = monthsElapsedUncapped;
  if (monthsHeld > input.lifeMonths) monthsHeld = input.lifeMonths;

  const monthsRemainingInYear = usefulLifeMonthsRemaining(input.lifeMonths, monthsElapsedUncapped);

  const depHistoricalRaw = historical.div(input.lifeMonths).mul(monthsHeld);
  const depHistorical = Decimal.min(depHistoricalRaw, historical).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const depUpdatedRaw = updatedGross.div(input.lifeMonths).mul(monthsHeld);
  const depUpdated = Decimal.min(depUpdatedRaw, updatedGross).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const depCmAdjustment = depUpdated
    .sub(depHistorical)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toFixed(2);
  const prevAccum =
    input.prevAccumulatedDepUpdated !== null ? new Decimal(input.prevAccumulatedDepUpdated) : new Decimal(0);
  const depreciationForPeriod = depUpdated.sub(prevAccum).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const netToDepreciate = updatedGross.sub(depUpdated).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const netBookValue = netToDepreciate;

  return {
    cmFactor: factor,
    updatedGrossValue: updatedGross.toFixed(2),
    depHistorical: depHistorical.toFixed(2),
    depCmAdjustment,
    depUpdated: depUpdated.toFixed(2),
    netToDepreciate: netToDepreciate.toFixed(2),
    depreciationForPeriod: depreciationForPeriod.toFixed(2),
    accumulatedDepreciation: depUpdated.toFixed(2),
    netBookValue: netBookValue.toFixed(2),
    monthsRemainingInYear,
  };
}
