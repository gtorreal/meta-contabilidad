import { Decimal } from "decimal.js";
import type { Asset, UsefulLifeCategory } from "@prisma/client";
import { prisma } from "../db.js";
import { computeCmFactorFromIpc } from "./cm.js";

function endOfUtcMonth(year: number, month: number): Date {
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

function monthsInclusiveFromAcquisition(acquisition: Date, periodYear: number, periodMonth: number): number {
  const acqY = acquisition.getUTCFullYear();
  const acqM = acquisition.getUTCMonth() + 1;
  const endY = periodYear;
  const endM = periodMonth;
  const diff = (endY - acqY) * 12 + (endM - acqM) + 1;
  return Math.max(diff, 0);
}

function monthsRemainingInCalendarYear(periodMonth: number): number {
  return 13 - periodMonth;
}

type AssetWithCategory = Asset & { category: UsefulLifeCategory };

/** Meses de vida útil aplicados al cálculo: override del activo o catálogo según régimen. */
export function effectiveUsefulLifeMonths(asset: AssetWithCategory): number {
  if (asset.usefulLifeMonths != null) return asset.usefulLifeMonths;
  return asset.acceleratedDepreciation
    ? asset.category.acceleratedLifeMonths
    : asset.category.normalLifeMonths;
}

function monthsRemainingInYearForSnapshot(
  periodMonth: number,
  lifeMonths: number,
  monthsHeldUncapped: number,
): number {
  const calendarRemaining = monthsRemainingInCalendarYear(periodMonth);
  const elapsed = Math.min(monthsHeldUncapped, lifeMonths);
  const remainingLife = Math.max(0, lifeMonths - elapsed);
  return Math.min(calendarRemaining, remainingLife);
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

  for (const asset of eligible as AssetWithCategory[]) {
    const acq = new Date(asset.acquisitionDate);
    const acqY = acq.getUTCFullYear();
    const acqM = acq.getUTCMonth() + 1;

    const historical = new Decimal(asset.historicalValueClp.toString());
    const { factor, ipcAcquisition, ipcPeriod } = await computeCmFactorFromIpc(acqY, acqM, year, month);
    const f = new Decimal(factor);
    const updatedGross = historical.mul(f).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const lifeMonths = effectiveUsefulLifeMonths(asset);
    const monthsHeldUncapped = monthsInclusiveFromAcquisition(acq, year, month);
    let monthsHeld = monthsHeldUncapped;
    if (monthsHeld > lifeMonths) monthsHeld = lifeMonths;

    const monthsRemainingInYear = monthsRemainingInYearForSnapshot(
      month,
      lifeMonths,
      monthsHeldUncapped,
    );

    const depHistoricalRaw = historical.div(lifeMonths).mul(monthsHeld);
    const depHistorical = Decimal.min(depHistoricalRaw, historical).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const depUpdatedRaw = updatedGross.div(lifeMonths).mul(monthsHeld);
    const depUpdated = Decimal.min(depUpdatedRaw, updatedGross).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const depCmAdjustment = depUpdated.sub(depHistorical).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const netToDepreciate = updatedGross.sub(depUpdated).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const netBookValue = updatedGross.sub(depUpdated).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const prev = await findPreviousSnapshot(asset.id, year, month);
    const prevAccum = prev ? new Decimal(prev.accumulatedDepreciation.toString()) : new Decimal(0);
    const depreciationForPeriod = depUpdated.sub(prevAccum).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const snap = await prisma.assetPeriodSnapshot.upsert({
      where: {
        assetId_periodId: { assetId: asset.id, periodId: period.id },
      },
      create: {
        assetId: asset.id,
        periodId: period.id,
        cmFactor: f.toFixed(),
        updatedGrossValue: updatedGross.toFixed(),
        depHistorical: depHistorical.toFixed(),
        depCmAdjustment: depCmAdjustment.toFixed(),
        depUpdated: depUpdated.toFixed(),
        netToDepreciate: netToDepreciate.toFixed(),
        monthsRemainingInYear,
        depreciationForPeriod: depreciationForPeriod.toFixed(),
        accumulatedDepreciation: depUpdated.toFixed(),
        netBookValue: netBookValue.toFixed(),
      },
      update: {
        cmFactor: f.toFixed(),
        updatedGrossValue: updatedGross.toFixed(),
        depHistorical: depHistorical.toFixed(),
        depCmAdjustment: depCmAdjustment.toFixed(),
        depUpdated: depUpdated.toFixed(),
        netToDepreciate: netToDepreciate.toFixed(),
        monthsRemainingInYear,
        depreciationForPeriod: depreciationForPeriod.toFixed(),
        accumulatedDepreciation: depUpdated.toFixed(),
        netBookValue: netBookValue.toFixed(),
      },
    });

    results.push({
      assetId: asset.id,
      snapshotId: snap.id,
      cmFactor: factor,
      ipcAcquisition,
      ipcPeriod,
    });
  }

  return { periodId: period.id, processed: results.length, results };
}
