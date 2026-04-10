/**
 * Utilidades IPC monotónico para referencia y tests (`cm-monotonic.test.ts`).
 * El cierre de activos fijos (`close-month`) no usa este módulo: la depreciación va sobre histórico CLP sin CM.
 */
import { Decimal } from "decimal.js";
import { iterateCalendarMonthsInclusive } from "./asset-period-math.js";
import { fetchIpcMonthlyValueMap } from "./indices.js";

const ymKey = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;

/**
 * IPC “efectivo” al cierre: máximo del índice oficial desde el mes de adquisición hasta el mes del período (inclusive).
 * Evita que un IPC mensual que baja (p. ej. nov > dic) reduzca el bruto actualizado y genere depreciaciones del mes negativas,
 * alineado con la lógica típica de planillas que no revierten CM por oscilaciones del índice mes a mes.
 */
export function computeMonotonicIpcFactorFromMap(
  ipcByYm: Map<string, string>,
  acquisitionYear: number,
  acquisitionMonth: number,
  periodYear: number,
  periodMonth: number,
): { factor: string; ipcAcquisition: string; ipcPeriodEffective: string } {
  const acqK = ymKey(acquisitionYear, acquisitionMonth);
  const ipcAcqStr = ipcByYm.get(acqK);
  if (!ipcAcqStr) {
    throw new Error(`No hay IPC en la base para el mes de adquisición ${acqK}.`);
  }
  const a = new Decimal(ipcAcqStr);
  if (a.isZero()) {
    throw new Error("IPC de adquisición no puede ser cero.");
  }

  let runningMax = new Decimal(0);
  for (const { year: y, month: m } of iterateCalendarMonthsInclusive(
    acquisitionYear,
    acquisitionMonth,
    periodYear,
    periodMonth,
  )) {
    const v = ipcByYm.get(ymKey(y, m));
    if (!v) {
      throw new Error(
        `No hay IPC en la base para ${ymKey(y, m)} (rango adquisición → período). ` +
          `Cargue la serie IPC (índices o import:ipc).`,
      );
    }
    const d = new Decimal(v);
    if (d.gt(runningMax)) runningMax = d;
  }

  const factor = runningMax.div(a).toDecimalPlaces(10, Decimal.ROUND_HALF_UP);
  return {
    factor: factor.toFixed(10),
    ipcAcquisition: a.toFixed(),
    ipcPeriodEffective: runningMax.toFixed(),
  };
}

/**
 * Factor CM = IPC_efectivo(período) / IPC(adquisición), con IPC_efectivo = max mensual desde adquisición hasta período.
 * La fuente de datos es siempre `EconomicIndex` (ver ADR).
 */
export async function computeCmFactorFromIpc(
  acquisitionYear: number,
  acquisitionMonth: number,
  periodYear: number,
  periodMonth: number,
): Promise<{ factor: string; ipcAcquisition: string; ipcPeriod: string }> {
  const map = await fetchIpcMonthlyValueMap(acquisitionYear, acquisitionMonth, periodYear, periodMonth);
  const r = computeMonotonicIpcFactorFromMap(map, acquisitionYear, acquisitionMonth, periodYear, periodMonth);
  return {
    factor: r.factor,
    ipcAcquisition: r.ipcAcquisition,
    ipcPeriod: r.ipcPeriodEffective,
  };
}

/** Carga IPC por rango de meses (p. ej. scripts o tests); el cierre de períodos no usa esta función. */
export async function fetchIpcMapForCloseRange(
  minAcquisitionYear: number,
  minAcquisitionMonth: number,
  periodYear: number,
  periodMonth: number,
): Promise<Map<string, string>> {
  return fetchIpcMonthlyValueMap(minAcquisitionYear, minAcquisitionMonth, periodYear, periodMonth);
}
