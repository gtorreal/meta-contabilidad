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
