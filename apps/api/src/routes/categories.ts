import { Hono } from "hono";
import { usefulLifeCategoryCreateSchema, usefulLifeCategoryUpdateSchema } from "@meta-contabilidad/shared";
import { prisma } from "../db.js";

export const categoriesRoute = new Hono();

categoriesRoute.get("/", async (c) => {
  const rows = await prisma.usefulLifeCategory.findMany({ orderBy: { code: "asc" } });
  return c.json(rows);
});

categoriesRoute.post("/", async (c) => {
  const body = usefulLifeCategoryCreateSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }
  const row = await prisma.usefulLifeCategory.create({ data: body.data });
  return c.json(row, 201);
});

categoriesRoute.patch("/:id", async (c) => {
  const body = usefulLifeCategoryUpdateSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: body.error.flatten() }, 400);
  }
  try {
    const row = await prisma.usefulLifeCategory.update({
      where: { id: c.req.param("id") },
      data: body.data,
    });
    return c.json(row);
  } catch {
    return c.json({ error: "Categoría no encontrada" }, 404);
  }
});
