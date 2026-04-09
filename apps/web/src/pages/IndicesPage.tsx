import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { adminHeaders, api } from "../api";
import { formatClpInteger, formatIpcInteger } from "../formatCurrency";

type IndexRow = { id: string; type: string; date: string; value: string };

const PAGE_SIZE = 50;

type IndicesPageResponse = {
  items: IndexRow[];
  total: number;
  page: number;
  pageSize: number;
};

type SiiSyncResult = {
  maxDate: string;
  years: number[];
  totals: { USD_OBSERVED: number; UF: number };
  byYear: Array<{ year: number; USD_OBSERVED: number; UF: number }>;
};

export function IndicesPage() {
  const qc = useQueryClient();
  const [type, setType] = useState<"USD_OBSERVED" | "UF" | "IPC">("USD_OBSERVED");
  const [page, setPage] = useState(1);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [value, setValue] = useState("");
  const [syncInfo, setSyncInfo] = useState<string | null>(null);

  const siiYear = new Date().getFullYear();

  const { data, error } = useQuery({
    queryKey: ["indices", type, page],
    queryFn: () =>
      api<IndicesPageResponse>(
        `/api/indices?type=${type}&page=${page}&pageSize=${PAGE_SIZE}`,
      ),
  });

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const fromIdx = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const toIdx = Math.min(page * PAGE_SIZE, total);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const create = useMutation({
    mutationFn: () =>
      api<IndexRow>("/api/indices", {
        method: "POST",
        body: JSON.stringify({ type, date, value }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["indices", type] });
      setValue("");
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/indices/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["indices", type] }),
  });

  const syncSii = useMutation({
    mutationFn: () =>
      api<SiiSyncResult>("/api/indices/sync-sii", {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({}),
      }),
    onSuccess: (r) => {
      setSyncInfo(
        `Actualizado hasta ${r.maxDate}: ${r.totals.USD_OBSERVED} upserts dólar observado, ${r.totals.UF} upserts UF en esta ejecución.`,
      );
      void qc.invalidateQueries({ queryKey: ["indices", "USD_OBSERVED"] });
      void qc.invalidateQueries({ queryKey: ["indices", "UF"] });
      void qc.invalidateQueries({ queryKey: ["indices", type] });
    },
    onError: () => setSyncInfo(null),
  });

  const isSiiSeries = type === "USD_OBSERVED" || type === "UF";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Índices económicos</h1>
        <p className="mt-1 text-sm text-slate-600">
          Dólar observado y UF se sincronizan desde el SII. IPC es mensual e ingreso manual. USD→CLP y CM
          leen solo de esta fuente.
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">UF y dólar observado (SII)</h2>
        <p className="mt-1 text-xs text-slate-600">
          Descarga las tablas oficiales y completa o actualiza registros hasta hoy. Requiere la misma clave
          que reapertura de períodos: <code className="rounded bg-slate-100 px-1">VITE_ADMIN_API_KEY</code>{" "}
          → header <code className="rounded bg-slate-100 px-1">X-Admin-Key</code>.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={syncSii.isPending}
            onClick={() => {
              setSyncInfo(null);
              syncSii.mutate();
            }}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {syncSii.isPending ? "Sincronizando…" : "Actualizar desde SII"}
          </button>
          <span className="text-xs text-slate-500">|</span>
          <a
            href={`https://www.sii.cl/valores_y_fechas/dolar/dolar${siiYear}.htm`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-sky-700 underline hover:text-sky-900"
          >
            Dólar observado ({siiYear}) en sii.cl
          </a>
          <a
            href={`https://www.sii.cl/valores_y_fechas/uf/uf${siiYear}.htm`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-sky-700 underline hover:text-sky-900"
          >
            UF ({siiYear}) en sii.cl
          </a>
        </div>
        {syncSii.isError && (
          <p className="mt-2 text-sm text-red-600">{(syncSii.error as Error).message}</p>
        )}
        {syncInfo && <p className="mt-2 text-sm text-emerald-800">{syncInfo}</p>}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-slate-600">
            Serie
            <select
              className="mt-1 block w-48 rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={type}
              onChange={(e) => {
                setType(e.target.value as typeof type);
                setPage(1);
                setSyncInfo(null);
              }}
            >
              <option value="USD_OBSERVED">Dólar observado</option>
              <option value="UF">UF</option>
              <option value="IPC">IPC (mensual)</option>
            </select>
          </label>
          {type === "IPC" && (
            <>
              <label className="text-xs font-medium text-slate-600">
                Fecha
                <input
                  type="date"
                  className="mt-1 block rounded border border-slate-300 px-2 py-1.5 text-sm"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <label className="text-xs font-medium text-slate-600">
                Valor
                <input
                  type="text"
                  className="mt-1 block w-40 rounded border border-slate-300 px-2 py-1.5 text-sm font-mono"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="928.45"
                />
              </label>
              <button
                type="button"
                disabled={create.isPending || !value}
                onClick={() => create.mutate()}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Agregar IPC
              </button>
            </>
          )}
        </div>
        {type === "IPC" && create.error && (
          <p className="mt-2 text-sm text-red-600">{(create.error as Error).message}</p>
        )}
        {isSiiSeries && (
          <p className="mt-3 text-sm text-slate-600">
            Esta serie se actualiza solo con &quot;Actualizar desde SII&quot; arriba (no se edita ni borra
            aquí).
          </p>
        )}
      </section>

      <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs font-semibold uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2 text-right">Valor</th>
              {type === "IPC" && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-mono text-xs">{String(r.date).slice(0, 10)}</td>
                <td className="px-3 py-2 text-right text-xs tabular-nums">
                  {type === "IPC" ? formatIpcInteger(r.value) : formatClpInteger(r.value)}
                </td>
                {type === "IPC" && (
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => remove.mutate(r.id)}
                    >
                      Borrar
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {error && <p className="p-3 text-sm text-red-600">{(error as Error).message}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-3 py-2 text-sm text-slate-600">
          <span>
            {total === 0
              ? "Sin registros"
              : `Mostrando ${fromIdx}–${toIdx} de ${total} (${PAGE_SIZE} por página)`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="text-xs text-slate-500">
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
