import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { formatClpInteger, formatUsdInteger } from "../formatCurrency";

type Category = {
  id: string;
  code: string;
  name: string;
  normalLifeMonths: number;
  acceleratedLifeMonths: number;
};
type Asset = {
  id: string;
  acquisitionDate: string;
  invoiceNumber: string | null;
  description: string;
  categoryId: string;
  category: Category;
  acquisitionCurrency: string;
  acquisitionAmountOriginal: string;
  historicalValueClp: string;
  usefulLifeMonths: number | null;
  status: string;
  odooAssetRef: string | null;
  odooMoveRef: string | null;
};

export function AssetsPage() {
  const qc = useQueryClient();
  const {
    data: categories = [],
    error: categoriesError,
    isPending: categoriesPending,
  } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api<Category[]>("/api/categories"),
  });
  const {
    data: assetsRaw,
    error: assetsError,
    isPending: assetsPending,
  } = useQuery({
    queryKey: ["assets"],
    queryFn: () => api<Asset[]>("/api/assets"),
  });
  const assets = Array.isArray(assetsRaw) ? assetsRaw : [];

  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null);

  const [form, setForm] = useState({
    acquisitionDate: new Date().toISOString().slice(0, 10),
    invoiceNumber: "",
    description: "",
    categoryId: "",
    acquisitionCurrency: "CLP",
    acquisitionAmountOriginal: "",
    odooAssetRef: "",
    odooMoveRef: "",
    usefulLifeMonths: "",
  });

  const defaultCategoryId = useMemo(() => categories[0]?.id ?? "", [categories]);

  const selectedCategory = useMemo(() => {
    const cid = form.categoryId || defaultCategoryId;
    return categories.find((c) => c.id === cid) ?? null;
  }, [categories, form.categoryId, defaultCategoryId]);

  const usefulLifeOptions = useMemo(() => {
    if (!selectedCategory) return [];
    const { normalLifeMonths: n, acceleratedLifeMonths: a } = selectedCategory;
    if (n === a) {
      return [{ value: String(n), label: `Normal (${n} meses)` }];
    }
    return [
      { value: String(n), label: `Normal (${n} meses)` },
      { value: String(a), label: `Acelerada (${a} meses)` },
    ];
  }, [selectedCategory]);

  useEffect(() => {
    if (!categories.length) return;
    setForm((f) => {
      if (f.usefulLifeMonths !== "") return f;
      const cid = f.categoryId || categories[0].id;
      const cat = categories.find((c) => c.id === cid) ?? categories[0];
      return { ...f, usefulLifeMonths: String(cat.normalLifeMonths) };
    });
  }, [categories]);

  useEffect(() => {
    if (!selectedCategory || !usefulLifeOptions.length) return;
    const allowed = new Set(usefulLifeOptions.map((o) => o.value));
    setForm((f) => {
      if (allowed.has(f.usefulLifeMonths)) return f;
      return { ...f, usefulLifeMonths: String(selectedCategory.normalLifeMonths) };
    });
  }, [selectedCategory, usefulLifeOptions]);

  const create = useMutation({
    mutationFn: () => {
      const usefulLifeMonthsParsed = parseInt(form.usefulLifeMonths, 10);
      return api<Asset>("/api/assets", {
        method: "POST",
        body: JSON.stringify({
          acquisitionDate: form.acquisitionDate,
          description: form.description,
          categoryId: form.categoryId || defaultCategoryId,
          acquisitionCurrency: form.acquisitionCurrency,
          acquisitionAmountOriginal: form.acquisitionAmountOriginal,
          invoiceNumber: form.invoiceNumber.trim() === "" ? null : form.invoiceNumber,
          odooAssetRef: form.odooAssetRef.trim() === "" ? null : form.odooAssetRef,
          odooMoveRef: form.odooMoveRef.trim() === "" ? null : form.odooMoveRef,
          usefulLifeMonths:
            Number.isFinite(usefulLifeMonthsParsed) && usefulLifeMonthsParsed > 0
              ? usefulLifeMonthsParsed
              : null,
        }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assets"] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/assets/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      setAssetToDelete(null);
    },
  });

  useEffect(() => {
    if (!assetToDelete) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAssetToDelete(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [assetToDelete]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Activos fijos</h1>
        <p className="mt-1 text-sm text-slate-600">
          Histórico en CLP; USD se convierte con dólar observado del día de adquisición (serie en Índices). La tabla
          abajo solo muestra bienes ya creados; si está vacía, aún no hay altas.
        </p>
      </div>

      {categoriesError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          No se pudieron cargar categorías: {(categoriesError as Error).message}
        </div>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Nuevo activo</h2>
        <form
          className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <label className="text-xs font-medium text-slate-600">
            Fecha adquisición
            <input
              type="date"
              required
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={form.acquisitionDate}
              onChange={(e) => setForm((f) => ({ ...f, acquisitionDate: e.target.value }))}
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Categoría
            <select
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={form.categoryId || defaultCategoryId}
              onChange={(e) => {
                const id = e.target.value;
                const cat = categories.find((c) => c.id === id);
                setForm((f) => ({
                  ...f,
                  categoryId: id,
                  usefulLifeMonths: cat ? String(cat.normalLifeMonths) : f.usefulLifeMonths,
                }));
              }}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            Vida útil (meses)
            <select
              required
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={form.usefulLifeMonths}
              onChange={(e) => setForm((f) => ({ ...f, usefulLifeMonths: e.target.value }))}
            >
              {usefulLifeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            Moneda
            <select
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={form.acquisitionCurrency}
              onChange={(e) => setForm((f) => ({ ...f, acquisitionCurrency: e.target.value }))}
            >
              <option value="CLP">CLP</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            Monto original
            <input
              required
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={form.acquisitionAmountOriginal}
              onChange={(e) => setForm((f) => ({ ...f, acquisitionAmountOriginal: e.target.value }))}
              placeholder="1000000 o 1200.50"
            />
          </label>
          <label className="text-xs font-medium text-slate-600 md:col-span-2">
            Descripción
            <input
              required
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Nº factura
            <input
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={form.invoiceNumber}
              onChange={(e) => setForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Odoo asset ref
            <input
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={form.odooAssetRef}
              onChange={(e) => setForm((f) => ({ ...f, odooAssetRef: e.target.value }))}
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Odoo move ref
            <input
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={form.odooMoveRef}
              onChange={(e) => setForm((f) => ({ ...f, odooMoveRef: e.target.value }))}
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={create.isPending || categoriesPending || !categories.length}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {create.isPending ? "Guardando…" : "Crear"}
            </button>
          </div>
        </form>
        {create.error && (
          <p className="mt-2 text-sm text-red-600">{(create.error as Error).message}</p>
        )}
      </section>

      <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        {assetsError && (
          <p className="border-b border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
            {(assetsError as Error).message}
            <span className="mt-1 block text-xs text-red-600/90">
              Si actualizaste el repo, asegurate de correr la migración:{" "}
              <code className="rounded bg-red-100/80 px-1">pnpm db:migrate</code>
            </span>
          </p>
        )}
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs font-semibold uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Descripción</th>
              <th className="px-3 py-2">Cat.</th>
              <th className="px-3 py-2">Mon.</th>
              <th className="px-3 py-2 text-right">Original</th>
              <th className="px-3 py-2 text-right">Hist. CLP</th>
              <th className="px-3 py-2 text-right">Vida útil (m)</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {assetsPending && (
              <tr className="border-t border-slate-100">
                <td colSpan={9} className="px-3 py-6 text-center text-sm text-slate-500">
                  Cargando activos…
                </td>
              </tr>
            )}
            {!assetsPending &&
              assets.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                  {typeof a.acquisitionDate === "string"
                    ? a.acquisitionDate.slice(0, 10)
                    : ""}
                </td>
                <td className="max-w-xs truncate px-3 py-2">{a.description}</td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">{a.category?.code}</td>
                <td className="px-3 py-2">{a.acquisitionCurrency}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-xs tabular-nums">
                  {a.acquisitionCurrency === "USD"
                    ? formatUsdInteger(a.acquisitionAmountOriginal)
                    : a.acquisitionCurrency === "CLP"
                      ? formatClpInteger(a.acquisitionAmountOriginal)
                      : a.acquisitionAmountOriginal}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-xs tabular-nums">
                  {formatClpInteger(a.historicalValueClp)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-slate-600">
                  {a.usefulLifeMonths ?? "—"}
                </td>
                <td className="px-3 py-2">{a.status}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:underline"
                    onClick={() => {
                      remove.reset();
                      setAssetToDelete(a);
                    }}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!assetsPending && !assets.length && !assetsError && (
          <p className="p-4 text-sm text-slate-500">
            No hay activos dados de alta. Complete el formulario de arriba y pulse Crear, o compruebe que la API y la
            base de datos están en marcha si esperaba ver datos.
          </p>
        )}
      </section>

      {assetToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => setAssetToDelete(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-asset-title"
            className="relative w-full max-w-md rounded-lg border border-slate-200 bg-white p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-asset-title" className="text-sm font-semibold text-slate-900">
              Eliminar activo
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              ¿Eliminar el activo «{assetToDelete.description}»? Esta acción no se puede deshacer.
            </p>
            {remove.isError && (
              <p className="mt-2 text-sm text-red-600">{(remove.error as Error).message}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => setAssetToDelete(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={remove.isPending}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                onClick={() => remove.mutate(assetToDelete.id)}
              >
                {remove.isPending ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
