import type { Context, Next } from "hono";

export function requireAdmin(c: Context, next: Next) {
  const key = c.req.header("x-admin-key");
  const expected = process.env.ADMIN_API_KEY;
  if (!expected || key !== expected) {
    return c.json({ error: "Se requiere clave de administrador (header X-Admin-Key)." }, 403);
  }
  return next();
}
