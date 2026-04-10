import { z } from "zod";

export const economicIndexTypeSchema = z.enum(["USD_OBSERVED", "UF", "IPC"]);
export type EconomicIndexType = z.infer<typeof economicIndexTypeSchema>;

export const assetCurrencySchema = z.enum(["CLP", "USD", "EUR", "OTHER"]);
export type AssetCurrency = z.infer<typeof assetCurrencySchema>;

export const assetStatusSchema = z.enum([
  "ACTIVE",
  "DISPOSED",
  "TRANSFERRED",
  "UNDER_REVIEW",
]);
export type AssetStatus = z.infer<typeof assetStatusSchema>;

export const periodStatusSchema = z.enum(["OPEN", "CLOSED"]);
export type PeriodStatus = z.infer<typeof periodStatusSchema>;

export const economicIndexCreateSchema = z.object({
  type: economicIndexTypeSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  value: z.string().regex(/^-?\d+(\.\d+)?$/),
});

export const economicIndexUpdateSchema = z.object({
  value: z.string().regex(/^-?\d+(\.\d+)?$/),
});

export const usefulLifeCategoryCreateSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(255),
  normalLifeMonths: z.number().int().positive(),
  acceleratedLifeMonths: z.number().int().positive(),
});

export const assetCreateSchema = z.object({
  acquisitionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  invoiceNumber: z.string().max(128).optional().nullable(),
  description: z.string().min(1).max(2000),
  categoryId: z.string().uuid(),
  acquisitionCurrency: assetCurrencySchema,
  acquisitionAmountOriginal: z.string().regex(/^\d+(\.\d{1,4})?$/),
  usefulLifeMonths: z.number().int().positive().max(600).optional().nullable(),
  creditAfPercent: z.string().regex(/^\d+(\.\d+)?$/).optional().nullable(),
  acceleratedDepreciation: z.boolean().optional(),
  status: assetStatusSchema.optional(),
  odooAssetRef: z.string().max(128).optional().nullable(),
  odooMoveRef: z.string().max(128).optional().nullable(),
});

export const assetUpdateSchema = assetCreateSchema.partial();

export const periodCloseSchema = z.object({});

export const periodReopenSchema = z.object({
  reason: z.string().min(3).max(2000),
});

export const runCloseMonthSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});

/** Cadena de snapshots desde MIN(acquisitionDate) de activos ACTIVE hasta el mes indicado (inclusive). */
export const backfillSnapshotsSchema = z.object({
  untilYear: z.number().int().min(2000).max(2100),
  untilMonth: z.number().int().min(1).max(12),
});

/** Query string: `year` requerido (cuatro dígitos); `categoryCodes` opcional (códigos separados por coma). */
export const fixedAssetMovementQuerySchema = z.object({
  year: z
    .string()
    .regex(/^\d{4}$/, "year debe ser un año de cuatro dígitos")
    .transform((s) => parseInt(s, 10))
    .pipe(z.number().int().min(2000).max(2100)),
  categoryCodes: z.string().optional(),
});

export const fixedAssetMovementColumnSchema = z.object({
  rightOfUse: z.string(),
  officeEquipment: z.string(),
  total: z.string(),
});

export const fixedAssetMovementReportRowSchema = z.object({
  key: z.string(),
  label: z.string(),
  kind: z.enum(["data", "section"]),
  columns: fixedAssetMovementColumnSchema,
});

export const fixedAssetMovementReportSchema = z.object({
  year: z.number(),
  currency: z.literal("CLP"),
  categoryCodes: z.array(z.string()),
  rows: z.array(fixedAssetMovementReportRowSchema),
  reconciliation: z.object({
    grossClosingFromSnapshots: z.string(),
    grossMovementSubtotal: z.string(),
    grossDifference: z.string(),
  }),
  warnings: z.array(z.string()),
});

export type FixedAssetMovementReportDto = z.infer<typeof fixedAssetMovementReportSchema>;
