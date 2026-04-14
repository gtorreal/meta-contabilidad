import "./env.js";
import { serve } from "@hono/node-server";

import { Prisma } from "@prisma/client";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { assetsRoute } from "./routes/assets.js";
import { categoriesRoute } from "./routes/categories.js";
import { indicesRoute } from "./routes/indices.js";
import { leaseSchedulesRoute } from "./routes/leaseSchedules.js";
import { periodsRoute } from "./routes/periods.js";
import { reportsRoute } from "./routes/reports.js";
import { prisma } from "./db.js";
import { syncSiiUsdAndUf } from "./services/sii-sync.js";

const app = new Hono();

const DB_UNAVAILABLE =
  "No hay conexión a PostgreSQL. 1) Docker Desktop encendido. 2) En la raíz: `pnpm db:up` y espere ~5–10 s (o `pnpm db:wait`). 3) Primera vez: `pnpm db:migrate` y `dotenv -e .env -- pnpm --filter @meta-contabilidad/api prisma:seed`. 4) Use `127.0.0.1` en DATABASE_URL si `localhost` falla (macOS). Compruebe: GET http://localhost:8787/health/db";

app.onError((err, c) => {
  console.error(err);
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P1001") {
    return c.json({ error: DB_UNAVAILABLE }, 503);
  }
  if (err instanceof Prisma.PrismaClientInitializationError) {
    return c.json({ error: DB_UNAVAILABLE }, 503);
  }
  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "Error interno del servidor";
  if (msg.includes("Can't reach database server")) {
    return c.json({ error: DB_UNAVAILABLE }, 503);
  }
  return c.json({ error: msg }, 500);
});

app.notFound((c) => c.json({ error: `No encontrado: ${c.req.path}` }, 404));

app.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "X-Admin-Key"],
  }),
);

app.get("/health", (c) => c.json({ ok: true }));

/** Comprueba conexión real a Postgres (útil si la API arranca pero Prisma falla al consultar). */
app.get("/health/db", async (c) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return c.json({ ok: true, database: "up" });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return c.json({ ok: false, database: "down", detail }, 503);
  }
});

app.route("/api/categories", categoriesRoute);
app.route("/api/assets", assetsRoute);
app.route("/api/indices", indicesRoute);
app.route("/api/lease-schedules", leaseSchedulesRoute);
app.route("/api/periods", periodsRoute);
app.route("/api/reports", reportsRoute);

const port = Number(process.env.PORT ?? 8787);
function envFlagTrue(name: string): boolean {
  const v = process.env[name]?.toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

serve({ fetch: app.fetch, port }, () => {
  console.log(`API escuchando en http://localhost:${port}`);
  if (envFlagTrue("AUTO_SYNC_SII_ON_STARTUP")) {
    void syncSiiUsdAndUf()
      .then((r) =>
        console.log(
          `[sii] AUTO_SYNC_SII_ON_STARTUP: dólar +UF upserts en esta corrida → USD ${r.totals.USD_OBSERVED}, UF ${r.totals.UF}`,
        ),
      )
      .catch((e) => console.warn("[sii] AUTO_SYNC_SII_ON_STARTUP falló (¿red o SII?):", e instanceof Error ? e.message : e));
  }
});
