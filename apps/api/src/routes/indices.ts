import { Hono } from "hono";
import type { EconomicIndexType } from "@prisma/client";
import { economicIndexCreateSchema, economicIndexUpdateSchema } from "@meta-contabilidad/shared";
import { prisma } from "../db.js";
import { requireAdmin } from "../middleware/admin.js";
import { decToString } from "../serialize.js";
import { syncSiiUsdAndUf } from "../services/sii-sync.js";

export const indicesRoute = new Hono();

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function parsePageParam(raw: string | undefined, fallback: number): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
}

function parsePageSizeParam(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n < 1) return 50;
  return Math.min(n, 100);
}

indicesRoute.get("/", async (c) => {
  const type = c.req.query("type") as EconomicIndexType | undefined;
  if (!type || !["USD_OBSERVED", "UF", "IPC"].includes(type)) {
    return c.json({ error: "Query type requerido: USD_OBSERVED | UF | IPC" }, 400);
  }
  const from = c.req.query("from");
  const to = c.req.query("to");
  const page = parsePageParam(c.req.query("page"), 1);
  const pageSize = parsePageSizeParam(c.req.query("pageSize"));

  const where = {
    type,
    ...(from || to
      ? {
          date: {
            ...(from ? { gte: parseDate(from) } : {}),
            ...(to ? { lte: parseDate(to) } : {}),
          },
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.economicIndex.count({ where }),
    prisma.economicIndex.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return c.json({
    items: rows.map((r) => ({
      ...r,
      value: decToString(r.value),
    })),
    total,
    page,
    pageSize,
  });
});

indicesRoute.post("/sync-sii", requireAdmin, async (c) => {
  try {
    const result = await syncSiiUsdAndUf();
    return c.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al sincronizar con el SII";
    return c.json({ error: msg }, 502);
  }
});

indicesRoute.post("/", async (c) => {
  const body = economicIndexCreateSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }
  if (body.data.type !== "IPC") {
    return c.json(
      { error: "Solo se puede crear manualmente IPC. UF y dólar observado vienen del SII (sync)." },
      400,
    );
  }
  const date = parseDate(body.data.date);
  try {
    const row = await prisma.economicIndex.create({
      data: {
        type: body.data.type,
        date,
        value: body.data.value,
      },
    });
    return c.json({ ...row, value: decToString(row.value) }, 201);
  } catch {
    return c.json({ error: "Ya existe un índice para ese tipo y fecha." }, 409);
  }
});

indicesRoute.patch("/:id", async (c) => {
  const body = economicIndexUpdateSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }
  const id = c.req.param("id");
  const existing = await prisma.economicIndex.findUnique({ where: { id } });
  if (!existing) return c.json({ error: "No encontrado" }, 404);
  if (existing.type !== "IPC") {
    return c.json({ error: "Solo IPC admite edición manual." }, 403);
  }
  try {
    const row = await prisma.economicIndex.update({
      where: { id },
      data: { value: body.data.value },
    });
    return c.json({ ...row, value: decToString(row.value) });
  } catch {
    return c.json({ error: "No encontrado" }, 404);
  }
});

indicesRoute.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await prisma.economicIndex.findUnique({ where: { id } });
  if (!existing) return c.json({ error: "No encontrado" }, 404);
  if (existing.type !== "IPC") {
    return c.json({ error: "Solo IPC admite borrado manual." }, 403);
  }
  try {
    await prisma.economicIndex.delete({ where: { id } });
    return c.body(null, 204);
  } catch {
    return c.json({ error: "No encontrado" }, 404);
  }
});
