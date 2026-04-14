import { Hono } from "hono";
import type { Decimal } from "@prisma/client/runtime/library";
import { leaseScheduleCreateSchema } from "@meta-contabilidad/shared";
import { prisma } from "../db.js";
import {
  computeScheduleRows,
  computeScheduleSummary,
} from "../services/lease-schedule-math.js";

export const leaseSchedulesRoute = new Hono();

const MONTH_NAMES_ES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatIsoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function buildTitle(recognitionDate: string): string {
  const [y, m] = recognitionDate.split("-").map(Number);
  return `Arriendo ${MONTH_NAMES_ES[m - 1]} ${y}`;
}

function serializeSchedule(row: {
  id: string;
  title: string;
  recognitionDate: Date;
  firstPaymentDay: number;
  numberOfPeriods: number;
  monthlyInstallmentUF: Decimal;
  annualInterestRate: Decimal;
  ufAtRecognition: Decimal;
  usefulLifeMonths: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    title: row.title,
    recognitionDate: formatIsoDate(row.recognitionDate),
    firstPaymentDay: row.firstPaymentDay,
    numberOfPeriods: row.numberOfPeriods,
    monthlyInstallmentUF: row.monthlyInstallmentUF.toFixed(),
    annualInterestRate: row.annualInterestRate.toFixed(),
    ufAtRecognition: row.ufAtRecognition.toFixed(),
    usefulLifeMonths: row.usefulLifeMonths,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

leaseSchedulesRoute.get("/", async (c) => {
  const rows = await prisma.leaseSchedule.findMany({
    orderBy: { recognitionDate: "asc" },
  });
  return c.json(rows.map(serializeSchedule));
});

leaseSchedulesRoute.post("/", async (c) => {
  const body = leaseScheduleCreateSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }
  const d = body.data;
  const title = buildTitle(d.recognitionDate);
  try {
    const row = await prisma.leaseSchedule.create({
      data: {
        title,
        recognitionDate: parseYmd(d.recognitionDate),
        firstPaymentDay: d.firstPaymentDay,
        numberOfPeriods: d.numberOfPeriods,
        monthlyInstallmentUF: d.monthlyInstallmentUF,
        annualInterestRate: d.annualInterestRate,
        ufAtRecognition: d.ufAtRecognition,
        usefulLifeMonths: d.usefulLifeMonths,
      },
    });
    return c.json(serializeSchedule(row), 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al crear";
    return c.json({ error: msg }, 400);
  }
});

leaseSchedulesRoute.get("/:id/rows", async (c) => {
  const id = c.req.param("id");
  const schedule = await prisma.leaseSchedule.findUnique({ where: { id } });
  if (!schedule) return c.json({ error: "No encontrado" }, 404);

  const params = {
    recognitionDate: formatIsoDate(schedule.recognitionDate),
    firstPaymentDay: schedule.firstPaymentDay,
    numberOfPeriods: schedule.numberOfPeriods,
    monthlyInstallmentUF: Number(schedule.monthlyInstallmentUF),
    annualInterestRate: Number(schedule.annualInterestRate),
    ufAtRecognition: Number(schedule.ufAtRecognition),
    usefulLifeMonths: schedule.usefulLifeMonths,
  };

  const rows = computeScheduleRows(params);
  const summary = computeScheduleSummary(params);

  return c.json({
    schedule: serializeSchedule(schedule),
    summary: {
      initialPV: summary.initialPV,
      initialAssetCLP: summary.initialAssetCLP,
      deferredInterestCLP: summary.deferredInterestCLP,
      totalLiabilityCLP: summary.totalLiabilityCLP,
      monthlyDeprecCLP: summary.monthlyDeprecCLP,
    },
    rows: rows.map((r) => ({
      ...r,
      openingBalanceUF: r.openingBalanceUF,
      interestUF: r.interestUF,
      amortizationUF: r.amortizationUF,
      closingBalanceUF: r.closingBalanceUF,
    })),
  });
});

leaseSchedulesRoute.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await prisma.leaseSchedule.findUnique({ where: { id } });
  if (!existing) return c.json({ error: "No encontrado" }, 404);
  await prisma.leaseSchedule.delete({ where: { id } });
  return c.body(null, 204);
});
