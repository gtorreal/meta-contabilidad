import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { formatClpInteger } from "../formatCurrency";

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
  acceleratedDepreciation?: boolean;
  initialUsefulLifeMonths?: number;
  remainingUsefulLifeMonths?: number;
  status: string;
  uniqueIdentifier: string | null;
  odooAssetRef: string | null;
  odooMoveRef: string | null;
};

type AssetEditForm = {
  acquisitionDate: string;
  invoiceNumber: string;
  description: string;
  categoryId: string;
  acquisitionCurrency: string;
  acquisitionAmountOriginal: string;
  odooAssetRef: string;
  odooMoveRef: string;
  usefulLifeMonths: string;
  status: string;
  uniqueIdentifier: string;
};

function assetToEditForm(asset: Asset): AssetEditForm {
  const d =
    typeof asset.acquisitionDate === "string" ? asset.acquisitionDate.slice(0, 10) : "";
  const lifeMonths =
    asset.usefulLifeMonths != null
      ? String(asset.usefulLifeMonths)
      : asset.acceleratedDepreciation === true
        ? String(asset.category.acceleratedLifeMonths)
        : String(asset.category.normalLifeMonths);
  return {
    acquisitionDate: d,
    invoiceNumber: asset.invoiceNumber ?? "",
    description: asset.description,
    categoryId: asset.categoryId,
    acquisitionCurrency: asset.acquisitionCurrency,
    acquisitionAmountOriginal: asset.acquisitionAmountOriginal,
    odooAssetRef: asset.odooAssetRef ?? "",
    odooMoveRef: asset.odooMoveRef ?? "",
    usefulLifeMonths: lifeMonths,
    status: asset.status,
    uniqueIdentifier: asset.uniqueIdentifier ?? "",
  };
}

type AssetCreateForm = {
  acquisitionDate: string;
  invoiceNumber: string;
  description: string;
  categoryId: string;
  acquisitionCurrency: string;
  acquisitionAmountOriginal: string;
  odooAssetRef: string;
  odooMoveRef: string;
  usefulLifeMonths: string;
  uniqueIdentifier: string;
};

function emptyCreateForm(): AssetCreateForm {
  return {
    acquisitionDate: new Date().toISOString().slice(0, 10),
    invoiceNumber: "",
    description: "",
    categoryId: "",
    acquisitionCurrency: "CLP",
    acquisitionAmountOriginal: "",
    odooAssetRef: "",
    odooMoveRef: "",
    usefulLifeMonths: "",
    uniqueIdentifier: "",
  };
}

const VALID_CURRENCIES = ["CLP", "PEN", "USD", "COP", "ARS"] as const;

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activo",
  DISPOSED: "Dado de baja",
  SOLD: "Vendido",
};

function validateCreateForm(form: AssetCreateForm, categories: Category[]): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.acquisitionDate.trim())) {
    return "La fecha de adquisición es obligatoria y debe ser válida.";
  }
  if (!form.categoryId.trim()) return "Seleccione una categoría.";
  if (!categories.find((c) => c.id === form.categoryId)) return "Categoría no válida.";
  if (!(VALID_CURRENCIES as readonly string[]).includes(form.acquisitionCurrency)) {
    return "Seleccione una moneda válida.";
  }
  const amt = form.acquisitionAmountOriginal.trim();
  if (!/^\d+(\.\d{1,4})?$/.test(amt)) {
    return "Monto original inválido (números y hasta 4 decimales).";
  }
  if (!form.description.trim()) return "La descripción es obligatoria.";
  const v = parseInt(form.usefulLifeMonths, 10);
  if (!Number.isFinite(v) || v <= 0 || v > 600) return "Ingrese una vida útil válida (1–600 meses).";
  if (form.uniqueIdentifier.trim() && !/^[A-Za-z0-9]+$/.test(form.uniqueIdentifier.trim())) {
    return "El identificador único solo puede contener letras y números.";
  }
  return null;
}

function buildCreateBody(form: AssetCreateForm, categories: Category[]): Record<string, unknown> | null {
  if (!categories.find((c) => c.id === form.categoryId)) return null;
  const v = parseInt(form.usefulLifeMonths, 10);
  if (!Number.isFinite(v) || v <= 0) return null;
  const amt = form.acquisitionAmountOriginal.trim();
  if (!/^\d+(\.\d{1,4})?$/.test(amt)) return null;
  return {
    acquisitionDate: form.acquisitionDate,
    description: form.description.trim(),
    categoryId: form.categoryId,
    acquisitionCurrency: form.acquisitionCurrency,
    acquisitionAmountOriginal: amt,
    invoiceNumber: form.invoiceNumber.trim() === "" ? null : form.invoiceNumber.trim(),
    odooAssetRef: form.odooAssetRef.trim() === "" ? null : form.odooAssetRef.trim(),
    odooMoveRef: form.odooMoveRef.trim() === "" ? null : form.odooMoveRef.trim(),
    usefulLifeMonths: v,
    acceleratedDepreciation: false,
    uniqueIdentifier: form.uniqueIdentifier.trim() === "" ? null : form.uniqueIdentifier.trim(),
  };
}

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
  const [assetToEdit, setAssetToEdit] = useState<Asset | null>(null);
  const [editForm, setEditForm] = useState<AssetEditForm | null>(null);
  const [editStep, setEditStep] = useState<"form" | "confirm">("form");
  const [editClientError, setEditClientError] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createConfirmOpen, setCreateConfirmOpen] = useState(false);
  const [createClientError, setCreateClientError] = useState<string | null>(null);

  const [form, setForm] = useState<AssetCreateForm>(() => emptyCreateForm());


  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<Asset>("/api/assets", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      setCreateConfirmOpen(false);
      setShowCreateForm(false);
      setForm(emptyCreateForm());
      setCreateClientError(null);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/assets/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      setAssetToDelete(null);
    },
  });


  const updateAsset = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api<Asset>(`/api/assets/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      void qc.invalidateQueries({ queryKey: ["snapshots"] });
      setAssetToEdit(null);
      setEditForm(null);
      setEditStep("form");
    },
  });

  const closeEditModal = useCallback(() => {
    setAssetToEdit(null);
    setEditForm(null);
    setEditStep("form");
    setEditClientError(null);
    updateAsset.reset();
  }, [updateAsset]);

  function validateEditForm(form: AssetEditForm): string | null {
    if (!form.description.trim()) return "La descripción es obligatoria.";
    const amt = form.acquisitionAmountOriginal.trim();
    if (!/^\d+(\.\d{1,4})?$/.test(amt)) {
      return "Monto original inválido (números y hasta 4 decimales).";
    }
    const v = parseInt(form.usefulLifeMonths, 10);
    if (!Number.isFinite(v) || v <= 0 || v > 600) return "Ingrese una vida útil válida (1–600 meses).";
    if (form.uniqueIdentifier.trim() && !/^[A-Za-z0-9]+$/.test(form.uniqueIdentifier.trim())) {
      return "El identificador único solo puede contener letras y números.";
    }
    return null;
  }

  function buildPatchBody(form: AssetEditForm): Record<string, unknown> | null {
    if (!categories.find((c) => c.id === form.categoryId)) return null;
    const v = parseInt(form.usefulLifeMonths, 10);
    if (!Number.isFinite(v) || v <= 0) return null;
    return {
      acquisitionDate: form.acquisitionDate,
      description: form.description.trim(),
      categoryId: form.categoryId,
      acquisitionCurrency: form.acquisitionCurrency,
      acquisitionAmountOriginal: form.acquisitionAmountOriginal.trim(),
      invoiceNumber: form.invoiceNumber.trim() === "" ? null : form.invoiceNumber.trim(),
      odooAssetRef: form.odooAssetRef.trim() === "" ? null : form.odooAssetRef.trim(),
      odooMoveRef: form.odooMoveRef.trim() === "" ? null : form.odooMoveRef.trim(),
      usefulLifeMonths: v,
      acceleratedDepreciation: false,
      status: form.status,
      uniqueIdentifier: form.uniqueIdentifier.trim() === "" ? null : form.uniqueIdentifier.trim(),
    };
  }

  useEffect(() => {
    if (!assetToDelete) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAssetToDelete(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [assetToDelete]);

  useEffect(() => {
    if (!assetToEdit) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeEditModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [assetToEdit, closeEditModal]);

  const closeCreateConfirm = useCallback(() => {
    setCreateConfirmOpen(false);
    create.reset();
  }, [create]);

  useEffect(() => {
    if (!createConfirmOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCreateConfirm();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [createConfirmOpen, closeCreateConfirm]);

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
        {!showCreateForm ? (
          <button
            type="button"
            disabled={categoriesPending || !categories.length}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={() => {
              create.reset();
              setCreateClientError(null);
              setForm(emptyCreateForm());
              setShowCreateForm(true);
            }}
          >
            Agregar Activo Fijo
          </button>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-800">Nuevo activo</h2>
              <button
                type="button"
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  create.reset();
                  setCreateClientError(null);
                  setForm(emptyCreateForm());
                  setShowCreateForm(false);
                }}
              >
                Cancelar
              </button>
            </div>
            <form
              className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault();
                setCreateClientError(null);
                create.reset();
                const err = validateCreateForm(form, categories);
                if (err) {
                  setCreateClientError(err);
                  return;
                }
                setCreateConfirmOpen(true);
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
                  required
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  value={form.categoryId}
                  onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                >
                  <option value="" disabled>
                    Seleccione categoría
                  </option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-slate-600">
                Vida útil inicial (meses)
                <input
                  type="number"
                  required
                  min={1}
                  max={600}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  value={form.usefulLifeMonths}
                  onChange={(e) => setForm((f) => ({ ...f, usefulLifeMonths: e.target.value }))}
                  placeholder="Ej: 36"
                />
              </label>
              <label className="text-xs font-medium text-slate-600">
                Moneda
                <select
                  required
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  value={form.acquisitionCurrency}
                  onChange={(e) => setForm((f) => ({ ...f, acquisitionCurrency: e.target.value }))}
                >
                  <option value="CLP">CLP</option>
                  <option value="PEN">PEN</option>
                  <option value="USD">USD</option>
                  <option value="COP">COP</option>
                  <option value="ARS">ARS</option>
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
                Identificador único
                <input
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  value={form.uniqueIdentifier}
                  onChange={(e) => setForm((f) => ({ ...f, uniqueIdentifier: e.target.value }))}
                  placeholder="Alfanumérico, ej: ACT001"
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
                  disabled={categoriesPending || !categories.length}
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Crear
                </button>
              </div>
            </form>
            {createClientError && <p className="mt-2 text-sm text-red-600">{createClientError}</p>}
            {create.error && !createConfirmOpen && (
              <p className="mt-2 text-sm text-red-600">{(create.error as Error).message}</p>
            )}
          </>
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
              <th className="px-3 py-2">Identificador</th>
              <th className="px-3 py-2">Descripción</th>
              <th className="px-3 py-2">Categoría</th>
              <th className="px-3 py-2">Mon.</th>
              <th className="px-3 py-2 text-right">Valor histórico CLP</th>
              <th className="px-3 py-2 text-right">Vida útil inicial (m)</th>
              <th className="px-3 py-2 text-right">Vida útil restante (m)</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Editar</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {assetsPending && (
              <tr className="border-t border-slate-100">
                <td colSpan={10} className="px-3 py-6 text-center text-sm text-slate-500">
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
                <td className="whitespace-nowrap px-3 py-2 text-slate-600 font-mono text-xs">
                  {a.uniqueIdentifier ?? "—"}
                </td>
                <td className="max-w-xs truncate px-3 py-2">{a.description}</td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">{a.category?.name}</td>
                <td className="px-3 py-2">{a.acquisitionCurrency}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-xs tabular-nums">
                  {formatClpInteger(a.historicalValueClp)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-slate-600 tabular-nums">
                  {a.initialUsefulLifeMonths ?? "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-slate-600">
                  {a.status === "ACTIVE"
                    ? (a.remainingUsefulLifeMonths ?? "—")
                    : "—"}
                </td>
                <td className="px-3 py-2">{STATUS_LABELS[a.status] ?? a.status}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="text-xs text-slate-700 underline decoration-slate-400 hover:text-slate-900"
                    onClick={() => {
                      updateAsset.reset();
                      setEditClientError(null);
                      setEditStep("form");
                      setAssetToEdit(a);
                      setEditForm(assetToEditForm(a));
                    }}
                  >
                    Editar
                  </button>
                </td>
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
            No hay activos dados de alta. Pulse <span className="font-medium">Agregar Activo Fijo</span>, complete el
            formulario y confirme la creación, o compruebe que la API y la base de datos están en marcha si esperaba ver
            datos.
          </p>
        )}
      </section>

      {createConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => closeCreateConfirm()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-asset-title"
            className="relative w-full max-w-md rounded-lg border border-slate-200 bg-white p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="create-asset-title" className="text-sm font-semibold text-slate-900">
              Confirmar alta
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              ¿Crear el activo fijo «{form.description.trim() || "(sin descripción)"}»?
            </p>
            <ul className="mt-2 list-inside list-disc text-sm text-slate-600">
              <li>
                Fecha {form.acquisitionDate} · {form.acquisitionCurrency}{" "}
                {form.acquisitionAmountOriginal.trim() || "—"}
              </li>
              <li>Factura {form.invoiceNumber.trim() || "—"}</li>
            </ul>
            {create.isError && (
              <p className="mt-2 text-sm text-red-600">{(create.error as Error).message}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                disabled={create.isPending}
                onClick={() => closeCreateConfirm()}
              >
                Volver
              </button>
              <button
                type="button"
                disabled={create.isPending}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                onClick={() => {
                  const body = buildCreateBody(form, categories);
                  if (!body) {
                    setCreateClientError("No se pudo armar la solicitud. Revise categoría y vida útil.");
                    setCreateConfirmOpen(false);
                    return;
                  }
                  create.mutate(body);
                }}
              >
                {create.isPending ? "Guardando…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {assetToEdit && editForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => closeEditModal()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-asset-title"
            className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="edit-asset-title" className="text-sm font-semibold text-slate-900">
              {editStep === "form" ? "Editar activo" : "Confirmar cambios"}
            </h2>
            {editStep === "confirm" ? (
              <>
                <p className="mt-2 text-sm text-slate-600">
                  ¿Guardar los cambios en «{editForm.description.trim() || assetToEdit.description}»? El activo se
                  actualizará en el servidor.
                </p>
                {updateAsset.isError && (
                  <p className="mt-2 text-sm text-red-600">{(updateAsset.error as Error).message}</p>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    disabled={updateAsset.isPending}
                    onClick={() => {
                      setEditStep("form");
                      updateAsset.reset();
                    }}
                  >
                    Volver
                  </button>
                  <button
                    type="button"
                    disabled={updateAsset.isPending}
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                    onClick={() => {
                      const body = buildPatchBody(editForm);
                      if (!body) {
                        setEditStep("form");
                        setEditClientError("No se pudo armar la solicitud. Revise categoría y vida útil.");
                        return;
                      }
                      updateAsset.mutate({ id: assetToEdit.id, body });
                    }}
                  >
                    {updateAsset.isPending ? "Guardando…" : "Confirmar y guardar"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="text-xs font-medium text-slate-600">
                    Fecha adquisición
                    <input
                      type="date"
                      required
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      value={editForm.acquisitionDate}
                      onChange={(e) => setEditForm((f) => (f ? { ...f, acquisitionDate: e.target.value } : f))}
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-600">
                    Categoría
                    <select
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      value={editForm.categoryId}
                      onChange={(e) =>
                        setEditForm((f) => (f ? { ...f, categoryId: e.target.value } : f))
                      }
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-slate-600">
                    Vida útil inicial (meses)
                    <input
                      type="number"
                      required
                      min={1}
                      max={600}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      value={editForm.usefulLifeMonths}
                      onChange={(e) =>
                        setEditForm((f) => (f ? { ...f, usefulLifeMonths: e.target.value } : f))
                      }
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-600">
                    Estado
                    <select
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      value={editForm.status}
                      onChange={(e) => setEditForm((f) => (f ? { ...f, status: e.target.value } : f))}
                    >
                      <option value="ACTIVE">Activo</option>
                      <option value="DISPOSED">Dado de baja</option>
                      <option value="SOLD">Vendido</option>
                    </select>
                  </label>
                  <label className="text-xs font-medium text-slate-600">
                    Moneda
                    <select
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      value={editForm.acquisitionCurrency}
                      onChange={(e) =>
                        setEditForm((f) => (f ? { ...f, acquisitionCurrency: e.target.value } : f))
                      }
                    >
                      <option value="CLP">CLP</option>
                      <option value="PEN">PEN</option>
                      <option value="USD">USD</option>
                      <option value="COP">COP</option>
                      <option value="ARS">ARS</option>
                    </select>
                  </label>
                  <label className="text-xs font-medium text-slate-600">
                    Monto original
                    <input
                      required
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      value={editForm.acquisitionAmountOriginal}
                      onChange={(e) =>
                        setEditForm((f) => (f ? { ...f, acquisitionAmountOriginal: e.target.value } : f))
                      }
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-600 md:col-span-2">
                    Descripción
                    <input
                      required
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      value={editForm.description}
                      onChange={(e) => setEditForm((f) => (f ? { ...f, description: e.target.value } : f))}
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-600">
                    Nº factura
                    <input
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      value={editForm.invoiceNumber}
                      onChange={(e) => setEditForm((f) => (f ? { ...f, invoiceNumber: e.target.value } : f))}
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-600">
                    Identificador único
                    <input
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      value={editForm.uniqueIdentifier}
                      onChange={(e) => setEditForm((f) => (f ? { ...f, uniqueIdentifier: e.target.value } : f))}
                      placeholder="Alfanumérico, ej: ACT001"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-600">
                    Odoo asset ref
                    <input
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      value={editForm.odooAssetRef}
                      onChange={(e) => setEditForm((f) => (f ? { ...f, odooAssetRef: e.target.value } : f))}
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-600">
                    Odoo move ref
                    <input
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                      value={editForm.odooMoveRef}
                      onChange={(e) => setEditForm((f) => (f ? { ...f, odooMoveRef: e.target.value } : f))}
                    />
                  </label>
                </div>
                {(editClientError || updateAsset.isError) && (
                  <p className="mt-2 text-sm text-red-600">
                    {editClientError ?? (updateAsset.error as Error).message}
                  </p>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    onClick={() => closeEditModal()}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                    onClick={() => {
                      setEditClientError(null);
                      updateAsset.reset();
                      const err = validateEditForm(editForm);
                      if (err) {
                        setEditClientError(err);
                        return;
                      }
                      if (!buildPatchBody(editForm)) {
                        setEditClientError("Categoría no válida.");
                        return;
                      }
                      setEditStep("confirm");
                    }}
                  >
                    Guardar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
