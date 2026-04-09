import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { assetsRoute } from "./routes/assets.js";
import { categoriesRoute } from "./routes/categories.js";
import { indicesRoute } from "./routes/indices.js";
import { periodsRoute } from "./routes/periods.js";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "X-Admin-Key"],
  }),
);

app.get("/health", (c) => c.json({ ok: true }));

app.route("/api/categories", categoriesRoute);
app.route("/api/assets", assetsRoute);
app.route("/api/indices", indicesRoute);
app.route("/api/periods", periodsRoute);

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, () => {
  console.log(`API escuchando en http://localhost:${port}`);
});
