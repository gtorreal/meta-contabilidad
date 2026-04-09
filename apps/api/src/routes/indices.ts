import { Hono } from "hono";
import type { EconomicIndexType } from "@prisma/client";
import { economicIndexCreateSchema, economicIndexUpdateSchema } from "@meta-contabilidad/shared";
import { prisma } from "../db.js";
import { decToString } from "../serialize.js";

export const indicesRoute = new Hono();

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

indicesRoute.get("/", async (c) => {
  const type = c.req.query("type") as EconomicIndexType | undefined;
  if (!type || !["USD_OBSERVED", "UF", "IPC"].includes(type)) {
    return c.json({ error: "Query type requerido: USD_OBSERVED | UF | IPC" }, 400);
  }
  const from = c.req.query("from");
  const to = c.req.query("to");
  const rows = await prisma.economicIndex.findMany({
    where: {
      type,
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: parseDate(from) } : {}),
              ...(to ? { lte: parseDate(to) } : {}),
            },
          }
        : {}),
    },
    orderBy: { date: "asc" },
  });
  return c.json(
    rows.map((r) => ({
      ...r,
      value: decToString(r.value),
    })),
  );
});

indicesRoute.post("/", async (c) => {
  const body = economicIndexCreateSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
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
  try {
    await prisma.economicIndex.delete({ where: { id } });
    return c.body(null, 204);
  } catch {
    return c.json({ error: "No encontrado" }, 404);
  }
});
