import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api";

type Row = {
  id: string;
  code: string;
  name: string;
  normalLifeMonths: number;
  acceleratedLifeMonths: number;
};

export function CategoriesPage() {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api<Row[]>("/api/categories"),
  });

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [normalLifeMonths, setNormalLifeMonths] = useState(36);
  const [acceleratedLifeMonths, setAcceleratedLifeMonths] = useState(18);

  const create = useMutation({
    mutationFn: () =>
      api<Row>("/api/categories", {
        method: "POST",
        body: JSON.stringify({ code, name, normalLifeMonths, acceleratedLifeMonths }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      setCode("");
      setName("");
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Vida útil (catálogo)</h1>
        <p className="mt-1 text-sm text-slate-600">
          Tabla normativa por tipo de bien; la depreciación del MVP usa meses normales o acelerados según el activo.
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Nueva categoría</h2>
        <form
          className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <label className="text-xs font-medium text-slate-600">
            Código
            <input
              required
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <label className="text-xs font-medium text-slate-600 md:col-span-2">
            Nombre
            <input
              required
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Meses vida normal
            <input
              type="number"
              min={1}
              required
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={normalLifeMonths}
              onChange={(e) => setNormalLifeMonths(Number(e.target.value))}
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Meses vida acelerada
            <input
              type="number"
              min={1}
              required
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={acceleratedLifeMonths}
              onChange={(e) => setAcceleratedLifeMonths(Number(e.target.value))}
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={create.isPending}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Crear
            </button>
          </div>
        </form>
        {create.error && (
          <p className="mt-2 text-sm text-red-600">{(create.error as Error).message}</p>
        )}
      </section>

      <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs font-semibold uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2 text-right">Normal (meses)</th>
              <th className="px-3 py-2 text-right">Acelerada (meses)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2 text-right">{r.normalLifeMonths}</td>
                <td className="px-3 py-2 text-right">{r.acceleratedLifeMonths}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
