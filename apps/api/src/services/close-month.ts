import { prisma } from "../db.js";
import { computeBudacomSnapshotFields } from "./budacom-snapshot.js";
import { computeMonotonicIpcFactorFromMap, fetchIpcMapForCloseRange } from "./cm.js";
import {
  effectiveUsefulLifeMonths,
  type AssetWithCategory,
} from "./effective-useful-life.js";

export { monthsElapsedSinceAcquisitionMonth, usefulLifeMonthsRemaining } from "./asset-period-math.js";

export function endOfUtcMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
}

export type AssetEligibilityRow = { acquisitionDate: Date; disposedAt: Date | null };

export function isActiveAssetEligibleForPeriodEnd(a: AssetEligibilityRow, periodEnd: Date): boolean {
  if (a.disposedAt) {
    const d = new Date(a.disposedAt);
    if (d <= periodEnd) return false;
  }
  const acq = new Date(a.acquisitionDate);
  return acq <= periodEnd;
}

export function countEligibleFromAssetRows(assets: AssetEligibilityRow[], year: number, month: number): number {
  const periodEnd = endOfUtcMonth(year, month);
  return assets.filter((a) => isActiveAssetEligibleForPeriodEnd(a, periodEnd)).length;
}

async function findPreviousSnapshot(assetId: string, year: number, month: number) {
  const rows = await prisma.assetPeriodSnapshot.findMany({
    where: { assetId },
    include: { period: true },
  });
  const before = rows
    .filter((r) => r.period.year < year || (r.period.year === year && r.period.month < month))
    .sort((a, b) => {
      if (a.period.year !== b.period.year) return b.period.year - a.period.year;
      return b.period.month - a.period.month;
    });
  return before[0] ?? null;
}

export async function ensurePeriod(year: number, month: number) {
  return prisma.accountingPeriod.upsert({
    where: { year_month: { year, month } },
    create: { year, month, status: "OPEN" },
    update: {},
  });
}

/** Misma elegibilidad que `runCloseMonthForPeriod` (activos ACTIVE en el período). */
export async function countEligibleAssetsForPeriod(year: number, month: number): Promise<number> {
  const assets = await prisma.asset.findMany({
    where: { status: "ACTIVE" },
    select: { acquisitionDate: true, disposedAt: true },
  });
  return countEligibleFromAssetRows(assets, year, month);
}

export async function runCloseMonthForPeriod(year: number, month: number) {
  const period = await ensurePeriod(year, month);
  if (period.status === "CLOSED") {
    throw new Error(
      `El período ${year}-${String(month).padStart(2, "0")} está cerrado. Reabra con Admin para recalcular snapshots.`,
    );
  }

  const periodEnd = endOfUtcMonth(year, month);
  const assets = await prisma.asset.findMany({
    where: { status: "ACTIVE" },
    include: { category: true },
  });

  const eligible = assets.filter((a) => isActiveAssetEligibleForPeriodEnd(a, periodEnd));

  const results = [];

  if (eligible.length === 0) {
    return { periodId: period.id, processed: 0, results: [] };
  }

  const minAcq = eligible.reduce(
    (min, a) => (a.acquisitionDate < min ? a.acquisitionDate : min),
    eligible[0].acquisitionDate,
  );
  const minY = minAcq.getUTCFullYear();
  const minM = minAcq.getUTCMonth() + 1;
  const ipcMap = await fetchIpcMapForCloseRange(minY, minM, year, month);

  for (const asset of eligible as AssetWithCategory[]) {
    const acq = new Date(asset.acquisitionDate);
    const acqY = acq.getUTCFullYear();
    const acqM = acq.getUTCMonth() + 1;

    const { ipcAcquisition, ipcPeriodEffective } = computeMonotonicIpcFactorFromMap(
      ipcMap,
      acqY,
      acqM,
      year,
      month,
    );

    const prev = await findPreviousSnapshot(asset.id, year, month);
    const prevAccumStr = prev ? prev.accumulatedDepreciation.toString() : null;

    const lifeMonths = effectiveUsefulLifeMonths(asset);
    const snapFields = computeBudacomSnapshotFields({
      historicalValueClp: asset.historicalValueClp.toString(),
      acquisitionDate: acq,
      lifeMonths,
      periodYear: year,
      periodMonth: month,
      ipcAcquisition,
      ipcPeriod: ipcPeriodEffective,
      prevAccumulatedDepUpdated: prevAccumStr,
    });

    const snap = await prisma.assetPeriodSnapshot.upsert({
      where: {
        assetId_periodId: { assetId: asset.id, periodId: period.id },
      },
      create: {
        assetId: asset.id,
        periodId: period.id,
        cmFactor: snapFields.cmFactor,
        updatedGrossValue: snapFields.updatedGrossValue,
        depHistorical: snapFields.depHistorical,
        depCmAdjustment: snapFields.depCmAdjustment,
        depUpdated: snapFields.depUpdated,
        netToDepreciate: snapFields.netToDepreciate,
        monthsRemainingInYear: snapFields.monthsRemainingInYear,
        depreciationForPeriod: snapFields.depreciationForPeriod,
        accumulatedDepreciation: snapFields.accumulatedDepreciation,
        netBookValue: snapFields.netBookValue,
      },
      update: {
        cmFactor: snapFields.cmFactor,
        updatedGrossValue: snapFields.updatedGrossValue,
        depHistorical: snapFields.depHistorical,
        depCmAdjustment: snapFields.depCmAdjustment,
        depUpdated: snapFields.depUpdated,
        netToDepreciate: snapFields.netToDepreciate,
        monthsRemainingInYear: snapFields.monthsRemainingInYear,
        depreciationForPeriod: snapFields.depreciationForPeriod,
        accumulatedDepreciation: snapFields.accumulatedDepreciation,
        netBookValue: snapFields.netBookValue,
      },
    });

    results.push({
      assetId: asset.id,
      snapshotId: snap.id,
      cmFactor: snapFields.cmFactor,
    });
  }

  return { periodId: period.id, processed: results.length, results };
}
