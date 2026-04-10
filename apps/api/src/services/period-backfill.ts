import { prisma } from "../db.js";
import {
  endOfUtcMonth,
  isActiveAssetEligibleForPeriodEnd,
  runCloseMonthForPeriod,
} from "./close-month.js";

function monthOrdinal(y: number, m: number): number {
  return y * 12 + m;
}

function nextMonth(y: number, m: number): { year: number; month: number } {
  if (m === 12) return { year: y + 1, month: 1 };
  return { year: y, month: m + 1 };
}

/** Mes civil UTC del primer activo ACTIVE (o null si no hay). */
export async function getEarliestActiveAcquisitionMonth(): Promise<{ year: number; month: number } | null> {
  const row = await prisma.asset.aggregate({
    where: { status: "ACTIVE" },
    _min: { acquisitionDate: true },
  });
  const d = row._min.acquisitionDate;
  if (!d) return null;
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

/**
 * Riesgo de cadena rota: hay snapshot en un período posterior a (year, month) pero ninguno en períodos anteriores.
 * En ese caso run-close pondría todo el acumulado como "dep. mes".
 */
export async function hasRunCloseChainGapRisk(year: number, month: number): Promise<boolean> {
  const periodEnd = endOfUtcMonth(year, month);
  const assets = await prisma.asset.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, acquisitionDate: true, disposedAt: true },
  });
  const eligibleIds = assets
    .filter((a) => isActiveAssetEligibleForPeriodEnd(a, periodEnd))
    .map((a) => a.id);
  if (eligibleIds.length === 0) return false;

  const targetOrd = monthOrdinal(year, month);
  const snaps = await prisma.assetPeriodSnapshot.findMany({
    where: { assetId: { in: eligibleIds } },
    include: { period: true },
  });
  const byAsset = new Map<string, typeof snaps>();
  for (const s of snaps) {
    const list = byAsset.get(s.assetId) ?? [];
    list.push(s);
    byAsset.set(s.assetId, list);
  }

  for (const id of eligibleIds) {
    const list = byAsset.get(id) ?? [];
    let hasLater = false;
    let hasEarlier = false;
    for (const s of list) {
      const o = monthOrdinal(s.period.year, s.period.month);
      if (o > targetOrd) hasLater = true;
      if (o < targetOrd) hasEarlier = true;
    }
    if (hasLater && !hasEarlier) return true;
  }
  return false;
}

export type BackfillSnapshotsResult = {
  startYear: number;
  startMonth: number;
  untilYear: number;
  untilMonth: number;
  processed: Array<{ year: number; month: number; processedAssets: number }>;
  skippedClosed: Array<{ year: number; month: number }>;
  failures: Array<{ year: number; month: number; error: string }>;
};

/**
 * Ejecuta runCloseMonthForPeriod en orden cronológico desde el mes de la primera adquisición ACTIVE hasta until.
 * Omite meses cuyo AccountingPeriod ya está CLOSED.
 */
export async function backfillSnapshotsChronologically(
  untilYear: number,
  untilMonth: number,
): Promise<BackfillSnapshotsResult> {
  const start = await getEarliestActiveAcquisitionMonth();
  if (!start) {
    throw new Error("No hay activos ACTIVE para determinar el mes inicial.");
  }

  const untilOrd = monthOrdinal(untilYear, untilMonth);
  const startOrd = monthOrdinal(start.year, start.month);
  if (startOrd > untilOrd) {
    throw new Error(
      `El mes tope ${untilYear}-${String(untilMonth).padStart(2, "0")} es anterior al primer alta (${start.year}-${String(start.month).padStart(2, "0")}).`,
    );
  }

  const processed: BackfillSnapshotsResult["processed"] = [];
  const skippedClosed: BackfillSnapshotsResult["skippedClosed"] = [];
  const failures: BackfillSnapshotsResult["failures"] = [];

  let y = start.year;
  let m = start.month;

  while (monthOrdinal(y, m) <= untilOrd) {
    const existing = await prisma.accountingPeriod.findUnique({
      where: { year_month: { year: y, month: m } },
    });
    if (existing?.status === "CLOSED") {
      skippedClosed.push({ year: y, month: m });
    } else {
      try {
        const r = await runCloseMonthForPeriod(y, m);
        processed.push({ year: y, month: m, processedAssets: r.processed });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error";
        failures.push({ year: y, month: m, error: msg });
      }
    }
    ({ year: y, month: m } = nextMonth(y, m));
  }

  return {
    startYear: start.year,
    startMonth: start.month,
    untilYear,
    untilMonth,
    processed,
    skippedClosed,
    failures,
  };
}
