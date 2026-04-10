import { fixedAssetMovementReportSchema, type FixedAssetMovementReportDto } from "@meta-contabilidad/shared";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";

function formatMillionsClp(decimalString: string): string {
  const n = Number.parseFloat(decimalString);
  if (Number.isNaN(n)) return "—";
  const millions = n / 1_000_000;
  return new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(millions);
}

function displayCell(officeEquipment: string, isDepreciationRow: boolean): string {
  const m = formatMillionsClp(officeEquipment);
  if (!isDepreciationRow || officeEquipment === "0.00" || m === "0") {
    return m;
  }
  return `(${m})`;
}

export function ReportsFixedAssetMovementPage() {
  const defaultYear = new Date().getUTCFullYear();
  const [year, setYear] = useState(defaultYear);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<FixedAssetMovementReportDto | null>(null);

  const load = useCallback(async (y: number) => {
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const raw = await api<unknown>(`/api/reports/fixed-asset-movement?year=${y}`);
      const parsed = fixedAssetMovementReportSchema.safeParse(raw);
      if (!parsed.success) {
        setError("Respuesta del servidor inválida.");
        return;
      }
      setReport(parsed.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(year);
  }, [year, load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Movimiento de activos fijos</h1>
          <p className="mt-1 text-sm text-slate-600">
            Valores en millones de pesos (M$), al 31 de diciembre del año seleccionado.
          </p>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Año del informe</span>
          <select
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {Array.from({ length: 11 }, (_, i) => defaultYear - 5 + i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading && <p className="text-sm text-slate-600">Cargando…</p>}
      {error && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</div>
      )}

      {report && (
        <>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-3 py-2 font-semibold text-slate-800">Descripción</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-800">
                    Activos por derecho de uso (*) M$
                  </th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-800">Equipos de oficina M$</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-800">Total M$</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => {
                  if (row.kind === "section") {
                    return (
                      <tr key={row.key} className="border-t border-slate-200">
                        <td colSpan={4} className="px-3 py-2 font-medium text-slate-800">
                          {row.label}
                        </td>
                      </tr>
                    );
                  }
                  const isDep = row.key.startsWith("depreciation_");
                  return (
                    <tr key={row.key} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-800">{row.label}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                        {formatMillionsClp(row.columns.rightOfUse)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-800">
                        {displayCell(row.columns.officeEquipment, isDep)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-800">
                        {displayCell(row.columns.total, isDep)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <p className="font-medium text-slate-700">Reconciliación bruto</p>
            <p>
              Cierre snapshots: {formatMillionsClp(report.reconciliation.grossClosingFromSnapshots)} M$ · Movimiento
              (apertura + adiciones): {formatMillionsClp(report.reconciliation.grossMovementSubtotal)} M$ · Diferencia
              (redondeos, bajas, datos faltantes): {formatMillionsClp(report.reconciliation.grossDifference)} M$
            </p>
            <p className="mt-1">Categorías: {report.categoryCodes.join(", ")}</p>
          </div>

          {report.warnings.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              <p className="font-medium">Advertencias</p>
              <ul className="mt-1 list-inside list-disc space-y-1">
                {report.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
