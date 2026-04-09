import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api";

type IndexRow = { id: string; type: string; date: string; value: string };

export function IndicesPage() {
  const qc = useQueryClient();
  const [type, setType] = useState<"USD_OBSERVED" | "UF" | "IPC">("USD_OBSERVED");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [value, setValue] = useState("");

  const { data: rows = [], error } = useQuery({
    queryKey: ["indices", type],
    queryFn: () => api<IndexRow[]>(`/api/indices?type=${type}`),
  });

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Índices económicos</h1>
        <p className="mt-1 text-sm text-slate-600">
          Fuente única para conversión USD→CLP y CM (IPC). Sin valores hardcodeados en código.
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-slate-600">
            Serie
            <select
              className="mt-1 block w-48 rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
            >
              <option value="USD_OBSERVED">Dólar observado</option>
              <option value="UF">UF</option>
              <option value="IPC">IPC (mensual)</option>
            </select>
          </label>
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
            Agregar
          </button>
        </div>
        {create.error && (
          <p className="mt-2 text-sm text-red-600">{(create.error as Error).message}</p>
        )}
      </section>

      <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs font-semibold uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2 text-right">Valor</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-mono text-xs">{String(r.date).slice(0, 10)}</td>
                <td className="px-3 py-2 text-right font-mono text-xs">{r.value}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:underline"
                    onClick={() => remove.mutate(r.id)}
                  >
                    Borrar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {error && <p className="p-3 text-sm text-red-600">{(error as Error).message}</p>}
      </section>
    </div>
  );
}
