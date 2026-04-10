import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { prisma } from "../db.js";

const payloadSchema = z.object({
  source: z.string(),
  asOf: z.string().optional(),
  series: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      value: z.string().regex(/^\d+(\.\d+)?$/),
    }),
  ),
});

export type IpcMonthlyPayload = z.infer<typeof payloadSchema>;

function parseUtcDateOnly(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((s) => parseInt(s, 10));
  return new Date(Date.UTC(y, m - 1, d));
}

export function loadIpcMonthlyPayload(): IpcMonthlyPayload {
  const here = dirname(fileURLToPath(import.meta.url));
  const path = join(here, "../../data/ipc-monthly.json");
  const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
  return payloadSchema.parse(raw);
}

/**
 * Upsert mensual IPC desde apps/api/data/ipc-monthly.json (una fila por mes, fecha = último día civil UTC).
 */
export async function upsertIpcMonthlyFromBundledData(
  payload?: IpcMonthlyPayload,
): Promise<{ upserted: number; firstDate: string; lastDate: string; asOf?: string }> {
  const p = payload ?? loadIpcMonthlyPayload();
  const { series, asOf } = p;
  let upserted = 0;
  for (const row of series) {
    const date = parseUtcDateOnly(row.date);
    await prisma.economicIndex.upsert({
      where: { type_date: { type: "IPC", date } },
      create: { type: "IPC", date, value: row.value },
      update: { value: row.value },
    });
    upserted++;
  }
  const firstDate = series[0]?.date ?? "";
  const lastDate = series[series.length - 1]?.date ?? "";
  return { upserted, firstDate, lastDate, asOf };
}
