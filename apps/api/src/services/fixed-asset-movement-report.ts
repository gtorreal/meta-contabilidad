import { Decimal } from "decimal.js";
import type { Asset, AssetPeriodSnapshot, UsefulLifeCategory } from "@prisma/client";
import { prisma } from "../db.js";

export const DEFAULT_OFFICE_EQUIPMENT_CATEGORY_CODES = ["EQ_COMP"] as const;

function endOfUtcMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
}

function jan1Utc(year: number): Date {
  return new Date(Date.UTC(year, 0, 1));
}

type AssetWithCategory = Asset & { category: UsefulLifeCategory };

function eligibleAtPeriodEnd(asset: AssetWithCategory, periodEnd: Date): boolean {
  if (asset.status !== "ACTIVE") return false;
  const acq = new Date(asset.acquisitionDate);
  if (acq > periodEnd) return false;
  if (asset.disposedAt) {
    const d = new Date(asset.disposedAt);
    if (d <= periodEnd) return false;
  }
  return true;
}

function d2(s: Decimal | string): Decimal {
  return new Decimal(s.toString()).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

function moneyStr(d: Decimal): string {
  return d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

function zeroColumn(): FixedAssetMovementColumn {
  const z = "0.00";
  return { rightOfUse: z, officeEquipment: z, total: z };
}

function officeOnly(office: Decimal): FixedAssetMovementColumn {
  const o = moneyStr(office);
  return { rightOfUse: "0.00", officeEquipment: o, total: o };
}

export type FixedAssetMovementColumn = {
  rightOfUse: string;
  officeEquipment: string;
  total: string;
};

export type FixedAssetMovementReportRow = {
  key: string;
  label: string;
  kind: "data" | "section";
  columns: FixedAssetMovementColumn;
};

export type FixedAssetMovementReport = {
  year: number;
  currency: "CLP";
  categoryCodes: string[];
  rows: FixedAssetMovementReportRow[];
  reconciliation: {
    grossClosingFromSnapshots: string;
    grossMovementSubtotal: string;
    grossDifference: string;
  };
  warnings: string[];
};

export class FixedAssetMovementReportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FixedAssetMovementReportError";
  }
}

export type BuildFixedAssetMovementReportInput = {
  year: number;
  categoryCodes?: string[];
};

export type MovementTotals = {
  grossOpening: Decimal;
  grossAdditions: Decimal;
  grossClosing: Decimal;
  depOpening: Decimal;
  depPeriod: Decimal;
  depClosing: Decimal;
  netClosing: Decimal;
  grossMovementSubtotal: Decimal;
  grossDifference: Decimal;
  warnings: string[];
};

/** Expuesto para tests unitarios sin Prisma. */
export function computeMovementTotals(
  year: number,
  eligibleN: AssetWithCategory[],
  byIdSnapN: Map<string, AssetPeriodSnapshot>,
  byIdSnapN1: Map<string, AssetPeriodSnapshot>,
): MovementTotals {
  const endDecN = endOfUtcMonth(year, 12);
  const jan1 = jan1Utc(year);
  const warnings: string[] = [];

  let grossOpening = new Decimal(0);
  let grossAdditions = new Decimal(0);
  let grossClosing = new Decimal(0);
  let depOpening = new Decimal(0);
  let depPeriod = new Decimal(0);
  let depClosing = new Decimal(0);
  let netClosing = new Decimal(0);

  for (const asset of eligibleN) {
    const snapN = byIdSnapN.get(asset.id);
    if (!snapN) continue;

    const acq = new Date(asset.acquisitionDate);
    const gN = d2(snapN.updatedGrossValue);
    const aN = d2(snapN.accumulatedDepreciation);
    const nN = d2(snapN.netBookValue);

    grossClosing = grossClosing.add(gN);
    depClosing = depClosing.add(aN);
    netClosing = netClosing.add(nN);

    const snapN1 = byIdSnapN1.get(asset.id);
    const isAdditionYear = acq >= jan1 && acq <= endDecN;

    if (acq < jan1) {
      if (snapN1) {
        grossOpening = grossOpening.add(d2(snapN1.updatedGrossValue));
        depOpening = depOpening.add(d2(snapN1.accumulatedDepreciation));
      } else {
        warnings.push(
          `Activo ${asset.id} (${asset.description.slice(0, 40)}): sin snapshot diciembre ${year - 1}; el bruto y la depreciación inicial omiten este activo.`,
        );
      }
    }

    if (isAdditionYear) {
      grossAdditions = grossAdditions.add(gN);
    }

    const prevAccum = snapN1 ? d2(snapN1.accumulatedDepreciation) : new Decimal(0);
    depPeriod = depPeriod.add(aN.sub(prevAccum));
  }

  const grossMovementSubtotal = grossOpening.add(grossAdditions);
  const grossDifference = grossClosing.sub(grossMovementSubtotal);

  return {
    grossOpening,
    grossAdditions,
    grossClosing,
    depOpening,
    depPeriod,
    depClosing,
    netClosing,
    grossMovementSubtotal,
    grossDifference,
    warnings,
  };
}

/**
 * Cuadro de movimiento de activos fijos (equipos de oficina + ROU en cero + total).
 * Usa snapshots de diciembre año N y N−1; misma elegibilidad que el cierre de mes.
 */
export async function buildFixedAssetMovementReport(
  input: BuildFixedAssetMovementReportInput,
): Promise<FixedAssetMovementReport> {
  const year = input.year;
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new FixedAssetMovementReportError("Año inválido (use 2000–2100).");
  }

  const categoryCodes =
    input.categoryCodes && input.categoryCodes.length > 0
      ? input.categoryCodes
      : [...DEFAULT_OFFICE_EQUIPMENT_CATEGORY_CODES];

  const periodDecN = await prisma.accountingPeriod.findUnique({
    where: { year_month: { year, month: 12 } },
  });
  const periodDecN1 = await prisma.accountingPeriod.findUnique({
    where: { year_month: { year: year - 1, month: 12 } },
  });

  if (!periodDecN) {
    throw new FixedAssetMovementReportError(
      `No existe el período contable diciembre ${year}. Cree el período y ejecute el cierre de mes hasta diciembre.`,
    );
  }
  if (!periodDecN1) {
    throw new FixedAssetMovementReportError(
      `No existe el período contable diciembre ${year - 1}. Es necesario para saldos iniciales del ejercicio ${year}.`,
    );
  }

  const endDecN = endOfUtcMonth(year, 12);
  const endDecN1 = endOfUtcMonth(year - 1, 12);

  const assets = await prisma.asset.findMany({
    where: {
      status: "ACTIVE",
      category: { code: { in: categoryCodes } },
    },
    include: { category: true },
  });

  const eligibleN = (assets as AssetWithCategory[]).filter((a) => eligibleAtPeriodEnd(a, endDecN));

  const byIdSnapN = new Map<string, AssetPeriodSnapshot>();
  const snapsN = await prisma.assetPeriodSnapshot.findMany({
    where: {
      periodId: periodDecN.id,
      assetId: { in: eligibleN.map((a) => a.id) },
    },
  });
  for (const s of snapsN) byIdSnapN.set(s.assetId, s);

  const missingN = eligibleN.filter((a) => !byIdSnapN.has(a.id));
  if (missingN.length > 0) {
    const ids = missingN.slice(0, 5).map((a) => a.id);
    throw new FixedAssetMovementReportError(
      `Faltan snapshots de diciembre ${year} para ${missingN.length} activo(s). Ejecute el cierre de mes hasta diciembre ${year}. Ejemplos de id: ${ids.join(", ")}`,
    );
  }

  const byIdSnapN1 = new Map<string, AssetPeriodSnapshot>();
  const eligibleN1Ids = (assets as AssetWithCategory[])
    .filter((a) => eligibleAtPeriodEnd(a, endDecN1))
    .map((a) => a.id);
  if (eligibleN1Ids.length > 0) {
    const snapsN1 = await prisma.assetPeriodSnapshot.findMany({
      where: {
        periodId: periodDecN1.id,
        assetId: { in: eligibleN1Ids },
      },
    });
    for (const s of snapsN1) byIdSnapN1.set(s.assetId, s);
  }

  const {
    grossOpening,
    grossAdditions,
    grossClosing,
    depOpening,
    depPeriod,
    depClosing,
    netClosing,
    grossMovementSubtotal,
    grossDifference,
    warnings,
  } = computeMovementTotals(year, eligibleN, byIdSnapN, byIdSnapN1);

  const rows: FixedAssetMovementReportRow[] = [
    {
      key: "gross_opening_jan1",
      kind: "data",
      label: `Importe bruto 01 de enero de ${year}`,
      columns: officeOnly(grossOpening),
    },
    {
      key: "additions",
      kind: "data",
      label: "Adiciones",
      columns: officeOnly(grossAdditions),
    },
    {
      key: "gross_subtotal_dec31",
      kind: "data",
      label: `Subtotal al 31 de diciembre de ${year}`,
      columns: officeOnly(grossClosing),
    },
    { key: "less_header", kind: "section", label: "Menos:", columns: zeroColumn() },
    {
      key: "depreciation_opening",
      kind: "data",
      label: "Depreciación inicial (−)",
      columns: officeOnly(depOpening),
    },
    {
      key: "depreciation_period",
      kind: "data",
      label: "Depreciación del período (−)",
      columns: officeOnly(depPeriod),
    },
    {
      key: "depreciation_accumulated",
      kind: "data",
      label: "Depreciación acumulada (−)",
      columns: officeOnly(depClosing),
    },
    {
      key: "net_dec31",
      kind: "data",
      label: `Importe neto al 31 de diciembre de ${year}`,
      columns: officeOnly(netClosing),
    },
  ];

  return {
    year,
    currency: "CLP",
    categoryCodes,
    rows,
    reconciliation: {
      grossClosingFromSnapshots: moneyStr(grossClosing),
      grossMovementSubtotal: moneyStr(grossMovementSubtotal),
      grossDifference: moneyStr(grossDifference),
    },
    warnings,
  };
}
