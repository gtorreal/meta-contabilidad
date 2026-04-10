import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { adminHeaders, api } from "../api";
import { formatClpInteger, parseDecimalStringToRoundedBigInt } from "../formatCurrency";

type Period = {
  id: string;
  year: number;
  month: number;
  status: string;
  _count: { snapshots: number };
  eligibleAssetCount: number;
};

type AuxSortKey = "acquisitionDate" | "initialUsefulLife" | "historicalValue";

type SnapshotRow = {
  id: string;
  initialUsefulLifeMonths: number;
  /** VU restante según calendario + vida útil declarada (diagnóstico; puede diferir del snapshot importado). */
  linearModelMonthsRemaining: number;
  /** Dep. mes = 0 con VU > 0: posible acumulado del mes anterior inflado vs modelo lineal. */
  likelyZeroDepFromChainMismatch: boolean;
  asset: {
    description: string;
    acquisitionDate: string;
    historicalValueClp: string | null;
    category: { code: string; acceleratedLifeMonths: number };
  };
  updatedGrossValue: string;
  depreciationForPeriod: string;
  accumulatedDepreciation: string;
  netBookValue: string;
  monthsRemainingInYear: number;
};

function cmpSnapshotsForSort(a: SnapshotRow, b: SnapshotRow, key: AuxSortKey): number {
  const tieBreak = a.asset.description.localeCompare(b.asset.description, "es") || a.id.localeCompare(b.id);
  if (key === "acquisitionDate") {
    const da = typeof a.asset.acquisitionDate === "string" ? a.asset.acquisitionDate.slice(0, 10) : "";
    const db = typeof b.asset.acquisitionDate === "string" ? b.asset.acquisitionDate.slice(0, 10) : "";
    const c = da.localeCompare(db);
    return c !== 0 ? c : tieBreak;
  }
  if (key === "initialUsefulLife") {
    const va = a.initialUsefulLifeMonths;
    const vb = b.initialUsefulLifeMonths;
    if (va !== vb) return va - vb;
    return tieBreak;
  }
  const na = parseDecimalStringToRoundedBigInt(a.asset.historicalValueClp ?? "") ?? 0n;
  const nb = parseDecimalStringToRoundedBigInt(b.asset.historicalValueClp ?? "") ?? 0n;
  if (na < nb) return -1;
  if (na > nb) return 1;
  return tieBreak;
}

type BackfillSnapshotsResult = {
  startYear: number;
  startMonth: number;
  untilYear: number;
  untilMonth: number;
  processed: Array<{ year: number; month: number; processedAssets: number }>;
  skippedClosed: Array<{ year: number; month: number }>;
  failures: Array<{ year: number; month: number; error: string }>;
};

const PERIODS_PAGE_SIZE = 10;

export function PeriodsPage() {
  const qc = useQueryClient();
  const nowUtc = new Date();
  const [year, setYear] = useState(nowUtc.getUTCFullYear());
  const [month, setMonth] = useState(nowUtc.getUTCMonth() + 1);
  const [backfillUntilYear, setBackfillUntilYear] = useState(nowUtc.getUTCFullYear());
  const [backfillUntilMonth, setBackfillUntilMonth] = useState(nowUtc.getUTCMonth() + 1);
  const [backfillSummary, setBackfillSummary] = useState<BackfillSnapshotsResult | null>(null);
  const [reopenReason, setReopenReason] = useState("");
  const [reopenPeriodId, setReopenPeriodId] = useState("");
  const [periodsPage, setPeriodsPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [auxSort, setAuxSort] = useState<{ key: AuxSortKey; dir: "asc" | "desc" }>({
    key: "acquisitionDate",
    dir: "desc",
  });

  const { data: periods = [] } = useQuery({
    queryKey: ["periods"],
    queryFn: () => api<Period[]>("/api/periods"),
  });

  const periodsTotal = periods.length;
  const totalPages = Math.max(1, Math.ceil(periodsTotal / PERIODS_PAGE_SIZE));

  useEffect(() => {
    setPeriodsPage((p) => {
      const tp = Math.max(1, Math.ceil(periods.length / PERIODS_PAGE_SIZE));
      return Math.min(p, tp);
    });
  }, [periods.length]);

  const paginatedPeriods = useMemo(() => {
    const start = (periodsPage - 1) * PERIODS_PAGE_SIZE;
    return periods.slice(start, start + PERIODS_PAGE_SIZE);
  }, [periods, periodsPage]);

  const { data: snapshots = [], isPending: snapshotsPending } = useQuery({
    queryKey: ["snapshots", selectedId],
    queryFn: () => api<SnapshotRow[]>(`/api/periods/${selectedId}/snapshots`),
    enabled: Boolean(selectedId),
  });

  useEffect(() => {
    setAuxSort({ key: "acquisitionDate", dir: "desc" });
  }, [selectedId]);

  const sortedSnapshots = useMemo(() => {
    const { key, dir } = auxSort;
    return [...snapshots].sort((a, b) => {
      const c = cmpSnapshotsForSort(a, b, key);
      return dir === "asc" ? c : -c;
    });
  }, [snapshots, auxSort]);

  const depreciationEntryTotal = useMemo(() => {
    let sum = 0n;
    for (const s of snapshots) {
      const n = parseDecimalStringToRoundedBigInt(s.depreciationForPeriod);
      if (n !== null) sum += n;
    }
    return sum;
  }, [snapshots]);

  const auxiliarHasImportedDepMismatch = useMemo(() => {
    if (snapshotsPending) return false;
    return snapshots.some((s) => {
      const net = parseDecimalStringToRoundedBigInt(s.netBookValue) ?? 0n;
      return net === 0n && s.linearModelMonthsRemaining > 0;
    });
  }, [snapshots, snapshotsPending]);

  const auxiliarHasZeroDepChainMismatch = useMemo(() => {
    if (snapshotsPending) return false;
    return snapshots.some((s) => s.likelyZeroDepFromChainMismatch);
  }, [snapshots, snapshotsPending]);

  const entryAmountLabel = snapshotsPending ? "…" : formatClpInteger(String(depreciationEntryTotal));

  const auxiliarPeriodTitle = useMemo(() => {
    const p = periods.find((x) => x.id === selectedId);
    if (!p) return "Auxiliar del período";
    return `Auxiliar del período ${p.year}-${String(p.month).padStart(2, "0")}`;
  }, [periods, selectedId]);

  const selectedPeriod = useMemo(() => periods.find((x) => x.id === selectedId) ?? null, [periods, selectedId]);

  const [runCloseFeedback, setRunCloseFeedback] = useState<string | null>(null);

  const runClose = useMutation({
    mutationFn: ({ year: y, month: m }: { year: number; month: number }) =>
      api<{ processed: number }>("/api/periods/run-close", {
        method: "POST",
        body: JSON.stringify({ year: y, month: m }),
      }),
    onMutate: () => setRunCloseFeedback(null),
    onSuccess: (data, { year: y, month: m }) => {
      qc.invalidateQueries({ queryKey: ["periods"] });
      const label = `${y}-${String(m).padStart(2, "0")}`;
      setRunCloseFeedback(
        `Período ${label}: ${data.processed} activo(s) elegible(s) con snapshot (depreciación lineal sobre valor histórico CLP).`,
      );
    },
    onError: () => setRunCloseFeedback(null),
  });

  const recalcAuxiliarPeriod = useMutation({
    mutationFn: async () => {
      if (!selectedPeriod) throw new Error("No hay período seleccionado.");
      return api<{ processed: number }>("/api/periods/run-close", {
        method: "POST",
        body: JSON.stringify({ year: selectedPeriod.year, month: selectedPeriod.month }),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["snapshots", selectedId] });
      void qc.invalidateQueries({ queryKey: ["periods"] });
    },
  });

  useEffect(() => {
    recalcAuxiliarPeriod.reset();
  }, [selectedId]);

  const backfillSnapshots = useMutation({
    mutationFn: () =>
      api<BackfillSnapshotsResult>("/api/periods/backfill-snapshots", {
        method: "POST",
        body: JSON.stringify({
          untilYear: backfillUntilYear,
          untilMonth: backfillUntilMonth,
        }),
      }),
    onMutate: () => setBackfillSummary(null),
    onSuccess: (r) => {
      setBackfillSummary(r);
      void qc.invalidateQueries({ queryKey: ["periods"] });
      void qc.invalidateQueries({ queryKey: ["snapshots", selectedId] });
    },
    onError: () => setBackfillSummary(null),
  });

  const closePeriod = useMutation({
    mutationFn: (id: string) =>
      api(`/api/periods/${id}/close`, { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["periods"] }),
  });

  const deletePeriod = useMutation({
    mutationFn: (id: string) => api(`/api/periods/${id}`, { method: "DELETE" }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["periods"] });
      setSelectedId((cur) => (cur === id ? null : cur));
    },
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
          La <span className="font-medium">depreciación del mes</span> depende del mes anterior en base: si calculaste un
          mes tarde sin la cadena, usá <span className="font-medium">Generar cadena desde primera compra</span>. Para un
          solo mes, el formulario o <span className="font-medium">«Generar auxiliar»</span> en la fila.{" "}
          <span className="font-medium">Cerrar período</span> lo deja inmutable. Reapertura solo con{" "}
          <code className="rounded bg-slate-100 px-1">X-Admin-Key</code> (ver{" "}
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
            onClick={() => runClose.mutate({ year, month })}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Calcular snapshots
          </button>
        </div>
        {runClose.error && (
          <p className="mt-2 text-sm text-red-600">{(runClose.error as Error).message}</p>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Cadena completa (desde primera compra)</h2>
        <p className="mt-1 text-xs text-slate-600">
          Recorre en orden cada mes civil desde el mes de la <span className="font-medium">adquisición más antigua</span>{" "}
          de un activo ACTIVE hasta el mes tope (inclusive). Omite períodos ya <span className="font-medium">CLOSED</span>
          . Puede tardar varios minutos (muchos meses × activos).
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-slate-600">
            Hasta año
            <input
              type="number"
              className="mt-1 block w-28 rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={backfillUntilYear}
              onChange={(e) => setBackfillUntilYear(Number(e.target.value))}
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Hasta mes
            <input
              type="number"
              min={1}
              max={12}
              className="mt-1 block w-24 rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={backfillUntilMonth}
              onChange={(e) => setBackfillUntilMonth(Number(e.target.value))}
            />
          </label>
          <button
            type="button"
            disabled={backfillSnapshots.isPending}
            onClick={() => {
              if (
                !window.confirm(
                  `¿Generar snapshots mes a mes desde la primera compra hasta ${backfillUntilYear}-${String(backfillUntilMonth).padStart(2, "0")}? Puede tardar bastante.`,
                )
              ) {
                return;
              }
              backfillSnapshots.mutate();
            }}
            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {backfillSnapshots.isPending ? "Generando cadena…" : "Generar cadena desde primera compra"}
          </button>
        </div>
        {backfillSnapshots.isError && (
          <p className="mt-2 text-sm text-red-600">{(backfillSnapshots.error as Error).message}</p>
        )}
        {backfillSummary && (
          <div className="mt-3 rounded border border-slate-100 bg-slate-50 p-3 text-xs text-slate-800">
            <p className="font-medium text-slate-900">Resumen</p>
            <p className="mt-1">
              Origen: {backfillSummary.startYear}-{String(backfillSummary.startMonth).padStart(2, "0")} → tope:{" "}
              {backfillSummary.untilYear}-{String(backfillSummary.untilMonth).padStart(2, "0")}. Meses calculados:{" "}
              {backfillSummary.processed.length}. Omitidos (cerrados): {backfillSummary.skippedClosed.length}.
            </p>
            {backfillSummary.failures.length > 0 && (
              <div className="mt-2">
                <p className="font-medium text-red-800">Fallos</p>
                <ul className="mt-1 list-inside list-disc text-red-900">
                  {backfillSummary.failures.map((f) => (
                    <li key={`${f.year}-${f.month}`}>
                      {f.year}-{String(f.month).padStart(2, "0")}: {f.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
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
            {paginatedPeriods.map((p) => (
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
                    <>
                      <button
                        type="button"
                        disabled={runClose.isPending || p.eligibleAssetCount === 0}
                        title={
                          p.eligibleAssetCount === 0
                            ? "No hay activos activos elegibles a la fecha de cierre de este mes."
                            : "Genera snapshots para este año-mes con los activos actuales (mismo criterio que el formulario)."
                        }
                        className="text-xs text-sky-800 underline disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => runClose.mutate({ year: p.year, month: p.month })}
                      >
                        Generar auxiliar
                      </button>
                      <button
                        type="button"
                        disabled={
                          closePeriod.isPending ||
                          (p.eligibleAssetCount > 0 && p._count.snapshots === 0)
                        }
                        title={
                          p.eligibleAssetCount > 0 && p._count.snapshots === 0
                            ? "Use primero «Generar auxiliar» o «Calcular snapshots» para esta fila."
                            : undefined
                        }
                        className="text-xs text-amber-700 underline disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => closePeriod.mutate(p.id)}
                      >
                        Cerrar período
                      </button>
                    </>
                  )}
                  {(p.status === "OPEN" || (p.status === "CLOSED" && p._count.snapshots === 0)) && (
                    <button
                      type="button"
                      disabled={deletePeriod.isPending}
                      className="text-xs text-red-700 underline disabled:opacity-50"
                      onClick={() => {
                        const label = `${p.year}-${String(p.month).padStart(2, "0")}`;
                        const extra =
                          p.status === "CLOSED"
                            ? " Está cerrado sin snapshots (cierre vacío); al eliminarlo desaparece del listado."
                            : " Se borrarán sus snapshots si los hubiera.";
                        if (!window.confirm(`¿Eliminar el período ${label}?${extra}`)) return;
                        deletePeriod.mutate(p.id);
                      }}
                    >
                      Eliminar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2 text-xs text-slate-600">
          <span>
            {periodsTotal === 0
              ? "Sin períodos"
              : `Mostrando ${(periodsPage - 1) * PERIODS_PAGE_SIZE + 1}–${Math.min(periodsPage * PERIODS_PAGE_SIZE, periodsTotal)} de ${periodsTotal}`}
          </span>
          {periodsTotal > 0 && totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={periodsPage <= 1}
                onClick={() => setPeriodsPage((p) => Math.max(1, p - 1))}
                className="rounded border border-slate-300 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="tabular-nums">
                Página {periodsPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={periodsPage >= totalPages}
                onClick={() => setPeriodsPage((p) => Math.min(totalPages, p + 1))}
                className="rounded border border-slate-300 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
        <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
          Puede eliminar períodos <span className="font-medium">abiertos</span> o un período{" "}
          <span className="font-medium">cerrado sin snapshots</span> (p. ej. cerrado por error sin auxiliar). Si
          el período cerrado tiene snapshots, reábralo con Admin y elimínalo mientras esté abierto.
        </p>
        {runClose.error && (
          <p className="border-t border-slate-100 px-3 py-2 text-sm text-red-600">
            {(runClose.error as Error).message}
          </p>
        )}
        {runCloseFeedback && !runClose.error && (
          <p className="border-t border-slate-100 px-3 py-2 text-sm text-green-700">{runCloseFeedback}</p>
        )}
        {closePeriod.error && (
          <p className="border-t border-slate-100 px-3 py-2 text-sm text-red-600">
            {(closePeriod.error as Error).message}
          </p>
        )}
        {deletePeriod.error && (
          <p className="border-t border-slate-100 px-3 py-2 text-sm text-red-600">
            {(deletePeriod.error as Error).message}
          </p>
        )}
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
            <h2 className="text-sm font-semibold text-slate-800">{auxiliarPeriodTitle}</h2>
            <button type="button" className="text-xs text-slate-600 underline" onClick={() => setSelectedId(null)}>
              Cerrar
            </button>
          </div>
          <div className="border-b border-slate-100 bg-slate-50 px-3 py-3">
            <p className="text-xs font-semibold text-slate-700">Resumen del asiento</p>
            <table className="mt-2 w-full max-w-2xl border-collapse text-xs text-slate-800">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-1.5 pr-2 text-left font-normal" aria-hidden="true" />
                  <th className="py-1.5 text-left font-normal" aria-hidden="true" />
                  <th className="w-[1%] whitespace-nowrap py-1.5 px-3 text-right font-semibold lowercase">debe</th>
                  <th className="w-[1%] whitespace-nowrap py-1.5 pl-3 text-right font-semibold lowercase">haber</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-1 pr-2">Gasto depreciación</td>
                  <td className="py-1" />
                  <td className="px-3 py-1 text-right tabular-nums">{entryAmountLabel}</td>
                  <td className="py-1 pl-3 text-right tabular-nums" />
                </tr>
                <tr>
                  <td className="py-1 pr-2">Depreciación acumulada</td>
                  <td className="py-1" />
                  <td className="px-3 py-1 text-right tabular-nums" />
                  <td className="py-1 pl-3 text-right tabular-nums">{entryAmountLabel}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-3 max-w-2xl text-xs text-slate-600">
              Total = suma de «Dep. mes». «VU restante» y los montos salen del mismo snapshot persistido (cierre o import).
              Revise en Activos que la vida útil coincida (p. ej. acelerada 24 meses ítem 23); import sin «VIDA UTIL» en
              Apertura asume acelerada para EQ_COMP. Si los montos no cuadran con el modelo lineal, regenere la cadena de
              snapshots hasta este período.
            </p>
            {!snapshotsPending && auxiliarHasImportedDepMismatch && selectedPeriod && (
              <div className="mt-2 max-w-2xl rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                <p className="font-medium text-amber-950">Inconsistencia import vs modelo lineal</p>
                <p className="mt-1">
                  Hay filas con neto en cero pero el modelo lineal (vida útil declarada y meses desde la compra) aún indica
                  meses de vida útil. La tabla sigue mostrando lo que quedó guardado en la base (p. ej. dep. acumulada del
                  Excel); no se corrige sola al abrir esta pantalla.
                </p>
                {selectedPeriod.status === "CLOSED" ? (
                  <p className="mt-2 font-medium">
                    Este período está <span className="uppercase">cerrado</span>: no se puede recalcular hasta reabrirlo
                    con Admin (X-Admin-Key). Mientras tanto los números del auxiliar no cambiarán.
                  </p>
                ) : (
                  <>
                    <p className="mt-2">
                      Revise vida útil en Activos (p. ej. Mac 2022 en 72m, no acelerada 24m) y ejecute{" "}
                      <code className="rounded bg-amber-100/80 px-1">pnpm --filter @meta-contabilidad/api run audit:assets-life</code>{" "}
                      si lo necesita. Luego sobrescriba snapshots con el motor interno:
                    </p>
                    <ul className="mt-1 list-inside list-disc">
                      <li>
                        Lo más fiable: arriba, «Generar cadena desde primera compra» hasta el mes actual (períodos OPEN).
                      </li>
                      <li>
                        O solo este mes (si la cadena previa ya es correcta):{" "}
                        <button
                          type="button"
                          disabled={recalcAuxiliarPeriod.isPending}
                          onClick={() => recalcAuxiliarPeriod.mutate()}
                          className="rounded bg-amber-800 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                        >
                          {recalcAuxiliarPeriod.isPending ? "Recalculando…" : "Recalcular este período"}
                        </button>
                      </li>
                    </ul>
                    {recalcAuxiliarPeriod.isError && (
                      <p className="mt-2 text-red-800">
                        {(recalcAuxiliarPeriod.error as Error).message}. Si habla de «cadena» o meses anteriores, use
                        «Generar cadena desde primera compra».
                      </p>
                    )}
                    {recalcAuxiliarPeriod.isSuccess && (
                      <p className="mt-2 text-green-900">
                        Listo: {recalcAuxiliarPeriod.data.processed} activo(s) procesado(s). La tabla debería actualizarse
                        al instante.
                      </p>
                    )}
                  </>
                )}
                <p className="mt-2 border-t border-amber-200/80 pt-2 text-[11px] text-amber-900/90">
                  En importes nuevos: flag <code className="rounded bg-amber-100/80 px-1">--linear-snapshots</code> en
                  import-budacom-xlsx.
                </p>
              </div>
            )}
            {!snapshotsPending && auxiliarHasZeroDepChainMismatch && (
              <div className="mt-2 max-w-2xl rounded border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950">
                <p className="font-medium">Dep. mes en cero con vida útil aún pendiente</p>
                <p className="mt-1">
                  Suele ocurrir si el <strong>mes anterior</strong> en la base sigue con depreciación acumulada del Excel
                  (muy alta) y solo se recalculó <strong>este</strong> período: el motor ajusta el acumulado al tope lineal
                  de este mes pero <strong>no registra depreciación negativa</strong>, así que la cuota del mes queda en
                  $0 aunque el neto y la VU restante ya reflejen el modelo lineal.
                </p>
                <p className="mt-1 font-medium">
                  Solución: use «Generar cadena desde primera compra» hasta este mes (períodos OPEN) para recalcular en
                  orden; así cada mes toma un acumulado previo ya coherente y las cuotas mensuales vuelven a ser
                  positivas.
                </p>
              </div>
            )}
            {!snapshotsPending && snapshots.length === 0 && (
              <p className="mt-2 text-xs text-slate-500">Sin depreciación en este período (auxiliar vacío).</p>
            )}
          </div>
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-100 font-semibold uppercase text-slate-600">
              <tr>
                <th className="px-2 py-2">Activo</th>
                <th
                  className="px-2 py-2 text-left"
                  aria-sort={
                    auxSort.key === "acquisitionDate"
                      ? auxSort.dir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-start gap-1 text-left font-semibold uppercase tracking-normal text-slate-600 hover:text-slate-900"
                    onClick={() =>
                      setAuxSort((prev) =>
                        prev.key === "acquisitionDate"
                          ? { key: "acquisitionDate", dir: prev.dir === "asc" ? "desc" : "asc" }
                          : { key: "acquisitionDate", dir: "asc" },
                      )
                    }
                  >
                    Fecha adq.
                    {auxSort.key === "acquisitionDate" ? (auxSort.dir === "asc" ? " ↑" : " ↓") : ""}
                  </button>
                </th>
                <th
                  className="px-2 py-2 text-right"
                  aria-sort={
                    auxSort.key === "historicalValue"
                      ? auxSort.dir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    type="button"
                    className="ml-auto flex items-center justify-end gap-1 font-semibold uppercase tracking-normal text-slate-600 hover:text-slate-900"
                    onClick={() =>
                      setAuxSort((prev) =>
                        prev.key === "historicalValue"
                          ? { key: "historicalValue", dir: prev.dir === "asc" ? "desc" : "asc" }
                          : { key: "historicalValue", dir: "asc" },
                      )
                    }
                  >
                    Precio/Valor Histórico
                    {auxSort.key === "historicalValue" ? (auxSort.dir === "asc" ? " ↑" : " ↓") : ""}
                  </button>
                </th>
                <th className="px-2 py-2 text-right">Dep. mes</th>
                <th className="px-2 py-2 text-right">Dep. acum.</th>
                <th className="px-2 py-2 text-right">Neto</th>
                <th
                  className="px-2 py-2 text-right"
                  aria-sort={
                    auxSort.key === "initialUsefulLife"
                      ? auxSort.dir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    type="button"
                    className="ml-auto flex items-center justify-end gap-1 font-semibold uppercase tracking-normal text-slate-600 hover:text-slate-900"
                    onClick={() =>
                      setAuxSort((prev) =>
                        prev.key === "initialUsefulLife"
                          ? { key: "initialUsefulLife", dir: prev.dir === "asc" ? "desc" : "asc" }
                          : { key: "initialUsefulLife", dir: "asc" },
                      )
                    }
                  >
                    Vida útil inicial (m)
                    {auxSort.key === "initialUsefulLife" ? (auxSort.dir === "asc" ? " ↑" : " ↓") : ""}
                  </button>
                </th>
                <th className="px-2 py-2 text-right">VU restante (m)</th>
              </tr>
            </thead>
            <tbody>
              {snapshotsPending && (
                <tr className="border-t border-slate-100">
                  <td colSpan={8} className="px-2 py-6 text-center text-slate-500">
                    Cargando auxiliar…
                  </td>
                </tr>
              )}
              {!snapshotsPending &&
                sortedSnapshots.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="max-w-xs truncate px-2 py-2">{s.asset.description}</td>
                    <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                      {typeof s.asset.acquisitionDate === "string"
                        ? s.asset.acquisitionDate.slice(0, 10)
                        : "—"}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {formatClpInteger(s.asset.historicalValueClp)}
                    </td>
                    <td
                      className="px-2 py-2 text-right tabular-nums"
                      title={
                        s.likelyZeroDepFromChainMismatch
                          ? "Cuota en cero: el acumulado del mes anterior puede estar por encima del tope lineal de este mes. Genere la cadena completa de snapshots."
                          : undefined
                      }
                    >
                      {formatClpInteger(s.depreciationForPeriod)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatClpInteger(s.accumulatedDepreciation)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatClpInteger(s.netBookValue)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{s.initialUsefulLifeMonths}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{s.monthsRemainingInYear}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
