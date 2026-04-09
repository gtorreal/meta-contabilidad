import { Decimal } from "decimal.js";
import { getLatestIpcInMonth } from "./indices.js";

/**
 * Factor de corrección monetaria simplificado: IPC(cierre) / IPC(mes de adquisición).
 * La normativa detallada se documenta en docs/adr; la fuente de datos es siempre EconomicIndex.
 */
export async function computeCmFactorFromIpc(
  acquisitionYear: number,
  acquisitionMonth: number,
  periodYear: number,
  periodMonth: number,
): Promise<{ factor: string; ipcAcquisition: string; ipcPeriod: string }> {
  const [ipcAcq, ipcPer] = await Promise.all([
    getLatestIpcInMonth(acquisitionYear, acquisitionMonth),
    getLatestIpcInMonth(periodYear, periodMonth),
  ]);

  if (!ipcAcq || !ipcPer) {
    throw new Error(
      "Faltan valores IPC en EconomicIndex para el mes de adquisición o el período de cierre. Ingrese IPC mensual para ambos meses.",
    );
  }

  const a = new Decimal(ipcAcq.value.toString());
  const p = new Decimal(ipcPer.value.toString());
  if (a.isZero()) {
    throw new Error("IPC de adquisición no puede ser cero.");
  }

  const factor = p.div(a).toDecimalPlaces(10, Decimal.ROUND_HALF_UP);
  return {
    factor: factor.toFixed(),
    ipcAcquisition: a.toFixed(),
    ipcPeriod: p.toFixed(),
  };
}
