import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api";
import { formatClpInteger, formatIpcInteger } from "../formatCurrency";

type IndexRow = { id: string; type: string; date: string; value: string };

/** Una sola petición trae toda la serie (API permite hasta 50k filas por tipo). */
const LIST_PAGE_SIZE = 50_000;

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

type IpcBundleSyncResult = {
  upserted: number;
  firstDate: string;
  lastDate: string;
  asOf?: string;
};

export function IndicesPage() {
  const qc = useQueryClient();
  /** IPC suele venir del seed; mostrarlo primero evita la sensación de “todo vacío”. */
  const [type, setType] = useState<"USD_OBSERVED" | "UF" | "IPC">("IPC");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [value, setValue] = useState("");
  const [syncInfo, setSyncInfo] = useState<string | null>(null);
  const [ipcBundleInfo, setIpcBundleInfo] = useState<string | null>(null);

  const siiYear = new Date().getFullYear();

  const { data, error } = useQuery({
    queryKey: ["indices", type],
    queryFn: () =>
      api<IndicesPageResponse>(
        `/api/indices?type=${type}&page=1&pageSize=${LIST_PAGE_SIZE}`,
      ),
  });

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const shown = rows.length;
  const truncated = total > shown;

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

  const syncIpcBundle = useMutation({
    mutationFn: () =>
      api<IpcBundleSyncResult>("/api/indices/sync-ipc-bundle", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: (r) => {
      const meta = r.asOf ? ` (archivo al ${r.asOf})` : "";
      setIpcBundleInfo(
        `${r.upserted} meses IPC: ${r.firstDate} → ${r.lastDate}${meta}. La tabla se actualiza abajo.`,
      );
      void qc.invalidateQueries({ queryKey: ["indices", "IPC"] });
    },
    onError: () => setIpcBundleInfo(null),
  });

  const isSiiSeries = type === "USD_OBSERVED" || type === "UF";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Índices económicos</h1>
        <p className="mt-1 text-sm text-slate-600">
          <span className="font-medium">IPC</span> mensual: serie en repo desde{" "}
          <span className="font-medium">enero 2017</span> (
          <code className="text-xs">apps/api/data/ipc-monthly.json</code>); cárguela con el botón de abajo,{" "}
          <code className="text-xs">pnpm import:ipc</code> o el seed.{" "}
          <span className="font-medium">Dólar</span> y <span className="font-medium">UF</span> son diarios y vienen del
          SII (botón o <code className="text-xs">AUTO_SYNC_SII_ON_STARTUP</code>). USD→CLP en alta de activo usa el dólar
          observado de aquí. La serie <span className="font-medium">IPC</span> se guarda como referencia; por ahora no se
          usa en cálculos de depreciación.
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">UF y dólar observado (SII)</h2>
        <p className="mt-1 text-xs text-slate-600">
          Incluye años 2024 en adelante. Con <code className="rounded bg-slate-100 px-1">AUTO_SYNC_SII_ON_STARTUP=true</code> en{" "}
          <code className="rounded bg-slate-100 px-1">.env</code> la API también sincroniza al arrancar (requiere red).
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
        <h2 className="text-sm font-semibold text-slate-800">IPC mensual (enero 2017 en adelante)</h2>
        <p className="mt-1 text-xs text-slate-600">
          Vuelca en la base la serie versionada del repositorio (misma fuente que el seed). Útil si la planilla IPC no
          muestra meses desde 2017-01.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={syncIpcBundle.isPending}
            onClick={() => {
              setIpcBundleInfo(null);
              syncIpcBundle.mutate();
            }}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {syncIpcBundle.isPending ? "Cargando IPC…" : "Cargar IPC desde archivo (repo)"}
          </button>
        </div>
        {syncIpcBundle.isError && (
          <p className="mt-2 text-sm text-red-600">{(syncIpcBundle.error as Error).message}</p>
        )}
        {ipcBundleInfo && <p className="mt-2 text-sm text-emerald-800">{ipcBundleInfo}</p>}
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
                setSyncInfo(null);
                setIpcBundleInfo(null);
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

      <section className="max-h-[min(70vh,56rem)] overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-100 text-xs font-semibold uppercase text-slate-600 shadow-sm">
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
        <div className="border-t border-slate-100 px-3 py-2 text-sm text-slate-600">
            {total === 0 ? (
            isSiiSeries ? (
              <>
                Sin registros — pulse «Actualizar desde SII», reinicie la API con{" "}
                <code className="text-xs">AUTO_SYNC_SII_ON_STARTUP=true</code>, o{" "}
                <code className="text-xs">pnpm import:sii</code> (requiere red).
              </>
            ) : type === "IPC" ? (
              <>
                Sin registros — pulse «Cargar IPC desde archivo (repo)» arriba, ejecute{" "}
                <code className="text-xs">pnpm import:ipc</code> en la API, o <code className="text-xs">prisma:seed</code>
                .
              </>
            ) : (
              "Sin registros"
            )
          ) : truncated ? (
            <>
              Mostrando {shown} de {total} (límite {LIST_PAGE_SIZE.toLocaleString("es-CL")}; hay más filas en base).
            </>
          ) : (
            <>
              {total.toLocaleString("es-CL")} registro{total === 1 ? "" : "s"} (fecha más reciente arriba).
            </>
          )}
        </div>
      </section>
    </div>
  );
}
