import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { adminHeaders, api } from "../api";

type Period = {
  id: string;
  year: number;
  month: number;
  status: string;
  _count: { snapshots: number };
};

type SnapshotRow = {
  id: string;
  asset: { description: string; category: { code: string } };
  cmFactor: string;
  updatedGrossValue: string;
  depreciationForPeriod: string;
  accumulatedDepreciation: string;
  netBookValue: string;
  monthsRemainingInYear: number;
};

export function PeriodsPage() {
  const qc = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [reopenReason, setReopenReason] = useState("");
  const [reopenPeriodId, setReopenPeriodId] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: periods = [] } = useQuery({
    queryKey: ["periods"],
    queryFn: () => api<Period[]>("/api/periods"),
  });

  const { data: snapshots = [] } = useQuery({
    queryKey: ["snapshots", selectedId],
    queryFn: () => api<SnapshotRow[]>(`/api/periods/${selectedId}/snapshots`),
    enabled: Boolean(selectedId),
  });

  const runClose = useMutation({
    mutationFn: () =>
      api("/api/periods/run-close", {
        method: "POST",
        body: JSON.stringify({ year, month }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["periods"] }),
  });

  const closePeriod = useMutation({
    mutationFn: (id: string) =>
      api(`/api/periods/${id}/close`, { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["periods"] }),
  });

  const reopen = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api(`/api/periods/${id}/reopen`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["periods"] });
      setReopenReason("");
      setReopenPeriodId("");
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Períodos y cierre</h1>
        <p className="mt-1 text-sm text-slate-600">
          Ejecutar cierre calcula snapshots (CM por IPC, depreciación lineal). Cerrar período lo deja inmutable;
          reapertura solo con <code className="rounded bg-slate-100 px-1">X-Admin-Key</code> (ver{" "}
          <code className="rounded bg-slate-100 px-1">VITE_ADMIN_API_KEY</code>).
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Correr cierre / auxiliar</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-slate-600">
            Año
            <input
              type="number"
              className="mt-1 block w-28 rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Mes
            <input
              type="number"
              min={1}
              max={12}
              className="mt-1 block w-24 rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            />
          </label>
          <button
            type="button"
            disabled={runClose.isPending}
            onClick={() => runClose.mutate()}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Calcular snapshots
          </button>
        </div>
        {runClose.error && (
          <p className="mt-2 text-sm text-red-600">{(runClose.error as Error).message}</p>
        )}
        {runClose.isSuccess && (
          <p className="mt-2 text-sm text-green-700">Cierre calculado (activos elegibles procesados).</p>
        )}
      </section>

      <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs font-semibold uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2">Período</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Snapshots</th>
              <th className="px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-mono">
                  {p.year}-{String(p.month).padStart(2, "0")}
                </td>
                <td className="px-3 py-2">{p.status}</td>
                <td className="px-3 py-2">{p._count.snapshots}</td>
                <td className="space-x-2 px-3 py-2">
                  <button
                    type="button"
                    className="text-xs text-slate-700 underline"
                    onClick={() => setSelectedId(p.id)}
                  >
                    Ver auxiliar
                  </button>
                  {p.status === "OPEN" && (
                    <button
                      type="button"
                      className="text-xs text-amber-700 underline"
                      onClick={() => closePeriod.mutate(p.id)}
                    >
                      Cerrar período
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Reabrir período (Admin)</h2>
        <p className="mt-1 text-xs text-slate-500">
          Motivo obligatorio; queda en AuditLog. Configura VITE_ADMIN_API_KEY igual a ADMIN_API_KEY del API.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-xs font-medium text-slate-600">
            Período
            <select
              className="mt-1 block min-w-[200px] rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={reopenPeriodId}
              onChange={(e) => setReopenPeriodId(e.target.value)}
            >
              <option value="">Elegir período cerrado…</option>
              {periods
                .filter((p) => p.status === "CLOSED")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.year}-{String(p.month).padStart(2, "0")}
                  </option>
                ))}
            </select>
          </label>
          <input
            className="min-w-[220px] flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
            placeholder="Motivo de reapertura"
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
          />
          <button
            type="button"
            disabled={!reopenPeriodId || reopenReason.trim().length < 3 || reopen.isPending}
            onClick={() => reopen.mutate({ id: reopenPeriodId, reason: reopenReason.trim() })}
            className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Reabrir
          </button>
        </div>
        {reopen.error && (
          <p className="mt-2 text-sm text-red-600">{(reopen.error as Error).message}</p>
        )}
      </section>

      {selectedId && (
        <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <h2 className="text-sm font-semibold text-slate-800">Auxiliar del período</h2>
            <button type="button" className="text-xs text-slate-600 underline" onClick={() => setSelectedId(null)}>
              Cerrar
            </button>
          </div>
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-100 font-semibold uppercase text-slate-600">
              <tr>
                <th className="px-2 py-2">Activo</th>
                <th className="px-2 py-2 text-right">CM</th>
                <th className="px-2 py-2 text-right">Bruto act.</th>
                <th className="px-2 py-2 text-right">Dep. mes</th>
                <th className="px-2 py-2 text-right">Dep. acum.</th>
                <th className="px-2 py-2 text-right">Neto</th>
                <th className="px-2 py-2">Meses rest. año</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="max-w-xs truncate px-2 py-2">{s.asset.description}</td>
                  <td className="px-2 py-2 text-right font-mono">{s.cmFactor}</td>
                  <td className="px-2 py-2 text-right font-mono">{s.updatedGrossValue}</td>
                  <td className="px-2 py-2 text-right font-mono">{s.depreciationForPeriod}</td>
                  <td className="px-2 py-2 text-right font-mono">{s.accumulatedDepreciation}</td>
                  <td className="px-2 py-2 text-right font-mono">{s.netBookValue}</td>
                  <td className="px-2 py-2">{s.monthsRemainingInYear}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
