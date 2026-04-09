const base = import.meta.env.VITE_API_URL ?? "";

function parseResponseBody(text: string): { json: true; value: unknown } | { json: false; text: string } {
  const t = text.trim();
  if (!t) return { json: true, value: null };
  try {
    return { json: true, value: JSON.parse(text) };
  } catch {
    return { json: false, text: t };
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 204) return undefined as T;
  const raw = await res.text();
  const parsed = parseResponseBody(raw);

  if (!res.ok) {
    if (parsed.json && parsed.value && typeof parsed.value === "object" && parsed.value !== null) {
      const err = (parsed.value as { error?: unknown }).error;
      const msg =
        typeof err === "string"
          ? err
          : err !== undefined
            ? JSON.stringify(err)
            : res.statusText;
      throw new Error(msg);
    }
    const fallback =
      !parsed.json && parsed.text
        ? parsed.text.length > 400
          ? `${parsed.text.slice(0, 400)}…`
          : parsed.text
        : res.statusText;
    throw new Error(fallback || `HTTP ${res.status}`);
  }

  if (!parsed.json) {
    throw new Error(
      `El servidor no devolvió JSON (${res.status}). Primeros caracteres: ${parsed.text.slice(0, 80)}`,
    );
  }
  return parsed.value as T;
}

export function adminHeaders(): HeadersInit {
  const key = import.meta.env.VITE_ADMIN_API_KEY;
  return key ? { "X-Admin-Key": key } : {};
}
