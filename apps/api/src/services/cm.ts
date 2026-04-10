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
    const ym = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
    const parts: string[] = [];
    if (!ipcAcq) parts.push(`mes de adquisición ${ym(acquisitionYear, acquisitionMonth)}`);
    if (!ipcPer) parts.push(`período de cierre ${ym(periodYear, periodMonth)}`);
    throw new Error(
      `No hay fila IPC en la base para: ${parts.join(" ni para ")}. ` +
        `En la planilla Índices económicos use «Cargar IPC desde archivo (repo)», o en la API ejecute \`pnpm import:ipc\` o \`prisma db seed\` (carga \`apps/api/data/ipc-monthly.json\`).`,
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
