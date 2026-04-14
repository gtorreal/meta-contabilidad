import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { formatClpInteger } from "../formatCurrency";

// ── Types ─────────────────────────────────────────────────────────────────────

type LeaseSchedule = {
  id: string;
  title: string;
  recognitionDate: string;
  firstPaymentDay: number;
  numberOfPeriods: number;
  monthlyInstallmentUF: string;
  annualInterestRate: string;
  ufAtRecognition: string;
  usefulLifeMonths: number;
  createdAt: string;
};

type ScheduleRow = {
  period: number;
  paymentDate: string;
  openingBalanceUF: number;
  installmentUF: number;
  interestUF: number;
  amortizationUF: number;
  closingBalanceUF: number;
  installmentCLP: number | null;
  interestCLP: number | null;
  monthlyDeprecCLP: number;
  accumDeprecCLP: number;
  netValueCLP: number;
};

type ScheduleSummary = {
  initialPV: number;
  initialAssetCLP: number;
  deferredInterestCLP: number;
  totalLiabilityCLP: number;
  monthlyDeprecCLP: number;
};

type ScheduleDetail = {
  schedule: LeaseSchedule;
  summary: ScheduleSummary;
  rows: ScheduleRow[];
};

type CreateForm = {
  recognitionDate: string;
  firstPaymentDay: string;
  numberOfPeriods: string;
  monthlyInstallmentUF: string;
  annualInterestRate: string;
  ufAtRecognition: string;
  usefulLifeMonths: string;
};

// ── Formatters ─────────────────────────────────────────────────────────────────

const UF_FORMAT = new Intl.NumberFormat("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const MONTH_LABELS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function fmtUF(n: number): string {
  return UF_FORMAT.format(n);
}
function fmtCLP(n: number): string {
  return formatClpInteger(String(Math.round(n)));
}
function fmtCLPOrNull(n: number | null): string {
  return n === null ? "S/D" : fmtCLP(n);
}
function periodLabel(iso: string): string {
  const [y, m] = iso.split("-");
  return `${MONTH_LABELS[parseInt(m, 10) - 1]} ${y}`;
}
function fmtDateShort(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ── Create form validation ────────────────────────────────────────────────────

function validateCreateForm(f: CreateForm): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.recognitionDate)) return "Fecha de reconocimiento inválida (YYYY-MM-DD).";
  const day = parseInt(f.firstPaymentDay, 10);
  if (!Number.isFinite(day) || day < 1 || day > 28) return "Día de pago debe ser entre 1 y 28.";
  const periods = parseInt(f.numberOfPeriods, 10);
  if (!Number.isFinite(periods) || periods < 1 || periods > 120) return "Número de períodos debe ser 1–120.";
  if (!/^\d+(\.\d{1,4})?$/.test(f.monthlyInstallmentUF)) return "Cuota mensual (UF) inválida.";
  if (!/^\d+(\.\d+)?$/.test(f.annualInterestRate)) return "Tasa anual inválida (ej: 0.115).";
  if (!/^\d+(\.\d{1,4})?$/.test(f.ufAtRecognition)) return "Valor UF inválido.";
  const life = parseInt(f.usefulLifeMonths, 10);
  if (!Number.isFinite(life) || life < 1 || life > 600) return "Vida útil debe ser 1–600 meses.";
  return null;
}

function buildCreateBody(f: CreateForm) {
  return {
    recognitionDate: f.recognitionDate,
    firstPaymentDay: parseInt(f.firstPaymentDay, 10),
    numberOfPeriods: parseInt(f.numberOfPeriods, 10),
    monthlyInstallmentUF: f.monthlyInstallmentUF,
    annualInterestRate: f.annualInterestRate,
    ufAtRecognition: f.ufAtRecognition,
    usefulLifeMonths: parseInt(f.usefulLifeMonths, 10),
  };
}

function emptyForm(): CreateForm {
  return {
    recognitionDate: "",
    firstPaymentDay: "5",
    numberOfPeriods: "36",
    monthlyInstallmentUF: "",
    annualInterestRate: "",
    ufAtRecognition: "",
    usefulLifeMonths: "36",
  };
}

// ── Schedule detail table ─────────────────────────────────────────────────────

function ScheduleTable({ scheduleId }: { scheduleId: string }) {
  const { data, isPending, error } = useQuery<ScheduleDetail>({
    queryKey: ["lease-schedule-rows", scheduleId],
    queryFn: () => api<ScheduleDetail>(`/api/lease-schedules/${scheduleId}/rows`),
  });

  if (isPending) {
    return <p className="px-4 py-6 text-sm text-slate-500">Calculando tabla…</p>;
  }
  if (error || !data) {
    return (
      <p className="px-4 py-6 text-sm text-red-600">
        {error ? (error as Error).message : "Error al cargar"}
      </p>
    );
  }

  const { summary, rows } = data;
  const today = new Date();

  const totalInstallUF = rows.reduce((s, r) => s + r.installmentUF, 0);
  const totalInterestUF = rows.reduce((s, r) => s + r.interestUF, 0);
  const totalAmortUF = rows.reduce((s, r) => s + r.amortizationUF, 0);
  const totalInstallCLP = rows.reduce((s, r) => s + (r.installmentCLP ?? 0), 0);
  const totalInterestCLP = rows.reduce((s, r) => s + (r.interestCLP ?? 0), 0);
  const anyMissingCLP = rows.some((r) => r.installmentCLP === null);

  return (
    <div className="space-y-4 px-4 pb-4 pt-3">
      {/* Recognition entry */}
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold text-slate-700">
          Asiento de reconocimiento inicial — {fmtDateShort(data.schedule.recognitionDate)}
        </p>
        <table className="mt-2 min-w-full text-left text-xs">
          <thead className="text-slate-500">
            <tr>
              <th className="pr-4 font-medium">Descripción</th>
              <th className="pr-4 text-right font-medium">Débito</th>
              <th className="text-right font-medium">Crédito</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="pr-4 py-0.5">117003 · Activo por derecho de uso</td>
              <td className="pr-4 text-right tabular-nums">{fmtCLP(summary.initialAssetCLP)}</td>
              <td className="text-right text-slate-400">—</td>
            </tr>
            <tr>
              <td className="pr-4 py-0.5">117004 · Activo por intereses diferidos</td>
              <td className="pr-4 text-right tabular-nums">{fmtCLP(summary.deferredInterestCLP)}</td>
              <td className="text-right text-slate-400">—</td>
            </tr>
            <tr>
              <td className="pr-4 py-0.5">210181 · Pasivo por derecho de uso</td>
              <td className="pr-4 text-right text-slate-400">—</td>
              <td className="text-right tabular-nums">{fmtCLP(summary.totalLiabilityCLP)}</td>
            </tr>
          </tbody>
        </table>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
          <span>Depreciación mensual: <strong>{fmtCLP(summary.monthlyDeprecCLP)}</strong></span>
          <span>PV inicial: <strong>{fmtUF(summary.initialPV)} UF</strong></span>
        </div>
      </div>

      {anyMissingCLP && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          "S/D" indica que el precio UF para esa fecha no está en la tabla de índices. Sincroniza los índices para verlo en CLP.
        </p>
      )}

      {/* Amortization table */}
      <div className="overflow-x-auto rounded-md border border-slate-200">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th className="sticky left-0 z-10 bg-slate-100 px-3 py-2 whitespace-nowrap">Mes</th>
              <th className="px-3 py-2 text-center">Per.</th>
              <th className="border-l border-slate-200 px-3 py-2 text-right whitespace-nowrap">Saldo SI (UF)</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">Cuota (UF)</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">Interés (UF)</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">Amort. (UF)</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">Saldo SF (UF)</th>
              <th className="border-l border-slate-200 px-3 py-2 text-right whitespace-nowrap">Cuota CLP</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">Interés CLP</th>
              <th className="border-l border-slate-200 px-3 py-2 text-right whitespace-nowrap">Deprec. mensual</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">Deprec. acum.</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">Valor neto</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const d = new Date(r.paymentDate + "T12:00:00");
              const isCurrent =
                d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
              const isPast = d < new Date(today.getFullYear(), today.getMonth(), 1);
              const bg = isCurrent
                ? "bg-amber-50"
                : i % 2 === 0
                ? "bg-white"
                : "bg-slate-50/60";
              return (
                <tr key={r.paymentDate} className={`border-t border-slate-100 ${bg}`}>
                  <td className={`sticky left-0 z-10 px-3 py-1.5 font-medium whitespace-nowrap ${bg}`}>
                    <span className={isCurrent ? "text-amber-700" : isPast ? "text-slate-400" : "text-slate-800"}>
                      {periodLabel(r.paymentDate)}
                    </span>
                    {isCurrent && (
                      <span className="ml-1.5 rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                        actual
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-center tabular-nums text-slate-500">{r.period}</td>
                  <td className="border-l border-slate-100 px-3 py-1.5 text-right tabular-nums">{fmtUF(r.openingBalanceUF)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{fmtUF(r.installmentUF)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">{fmtUF(r.interestUF)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-medium">{fmtUF(r.amortizationUF)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{fmtUF(r.closingBalanceUF)}</td>
                  <td className="border-l border-slate-100 px-3 py-1.5 text-right tabular-nums">{fmtCLPOrNull(r.installmentCLP)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">{fmtCLPOrNull(r.interestCLP)}</td>
                  <td className="border-l border-slate-100 px-3 py-1.5 text-right tabular-nums">{fmtCLP(r.monthlyDeprecCLP)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">{fmtCLP(r.accumDeprecCLP)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-medium">{fmtCLP(r.netValueCLP)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-slate-300 bg-slate-100 text-xs font-semibold text-slate-700">
            <tr>
              <td className="sticky left-0 z-10 bg-slate-100 px-3 py-2">Total</td>
              <td className="px-3 py-2 text-center text-slate-500">{rows.length}</td>
              <td className="border-l border-slate-200 px-3 py-2" />
              <td className="px-3 py-2 text-right tabular-nums">{fmtUF(totalInstallUF)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtUF(totalInterestUF)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtUF(totalAmortUF)}</td>
              <td className="px-3 py-2" />
              <td className="border-l border-slate-200 px-3 py-2 text-right tabular-nums">
                {anyMissingCLP ? "S/D" : fmtCLP(totalInstallCLP)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {anyMissingCLP ? "S/D" : fmtCLP(totalInterestCLP)}
              </td>
              <td className="border-l border-slate-200 px-3 py-2 text-right tabular-nums">
                {fmtCLP(rows.reduce((s, r) => s + r.monthlyDeprecCLP, 0))}
              </td>
              <td className="px-3 py-2" />
              <td className="px-3 py-2" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── Schedule card ─────────────────────────────────────────────────────────────

function ScheduleCard({
  schedule,
  onDelete,
}: {
  schedule: LeaseSchedule;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!confirmDelete) return;
    const handler = (e: MouseEvent) => {
      if (confirmRef.current && !confirmRef.current.contains(e.target as Node)) {
        setConfirmDelete(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [confirmDelete]);

  const rate = (parseFloat(schedule.annualInterestRate) * 100).toFixed(2);

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">{schedule.title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Reconocimiento {fmtDateShort(schedule.recognitionDate)} · pago día {schedule.firstPaymentDay} · {schedule.numberOfPeriods} períodos
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
            {parseFloat(schedule.monthlyInstallmentUF).toFixed(2)} UF/mes
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
            Tasa {rate}%
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
            VU {schedule.usefulLifeMonths} meses
          </span>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Ocultar tabla" : "Ver tabla"}
          </button>

          {!confirmDelete ? (
            <button
              type="button"
              className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
              onClick={() => setConfirmDelete(true)}
            >
              Eliminar
            </button>
          ) : (
            <div ref={confirmRef} className="flex items-center gap-1.5">
              <span className="text-xs text-red-700">¿Confirmar?</span>
              <button
                type="button"
                className="rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                onClick={() => onDelete(schedule.id)}
              >
                Sí, eliminar
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => setConfirmDelete(false)}
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>

      {expanded && <ScheduleTable scheduleId={schedule.id} />}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const FIELD_CLASS = "mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm";
const LABEL_CLASS = "text-xs font-medium text-slate-600";

export function ArriendoInmueblePage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateForm>(emptyForm);
  const [clientError, setClientError] = useState<string | null>(null);
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);

  const { data: schedules = [], isPending, error } = useQuery<LeaseSchedule[]>({
    queryKey: ["lease-schedules"],
    queryFn: () => api<LeaseSchedule[]>("/api/lease-schedules"),
  });

  const create = useMutation({
    mutationFn: (body: object) =>
      api<LeaseSchedule>("/api/lease-schedules", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lease-schedules"] });
      setShowForm(false);
      setForm(emptyForm());
      setClientError(null);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      api(`/api/lease-schedules/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lease-schedules"] });
      setScheduleToDelete(null);
    },
  });

  const handleDelete = useCallback(
    (id: string) => {
      setScheduleToDelete(id);
      remove.mutate(id);
    },
    [remove],
  );

  const set = (field: keyof CreateForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Arriendo inmueble</h1>
        <p className="mt-1 text-sm text-slate-600">
          Planillas de amortización NIIF 16. Cada planilla se calcula a partir de los parámetros del contrato y los precios UF de la tabla de índices.
        </p>
      </div>

      {/* Create form toggle */}
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        {!showForm ? (
          <button
            type="button"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            onClick={() => {
              create.reset();
              setClientError(null);
              setForm(emptyForm());
              setShowForm(true);
            }}
          >
            Nueva planilla
          </button>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-800">Nueva planilla de amortización</h2>
              <button
                type="button"
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => { setShowForm(false); setClientError(null); create.reset(); }}
              >
                Cancelar
              </button>
            </div>

            <form
              className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
              onSubmit={(e) => {
                e.preventDefault();
                setClientError(null);
                create.reset();
                const err = validateCreateForm(form);
                if (err) { setClientError(err); return; }
                create.mutate(buildCreateBody(form));
              }}
            >
              <label className={LABEL_CLASS}>
                Fecha de reconocimiento
                <input type="date" required className={FIELD_CLASS} value={form.recognitionDate} onChange={set("recognitionDate")} />
              </label>

              <label className={LABEL_CLASS}>
                Día de pago mensual
                <input type="number" min={1} max={28} required className={FIELD_CLASS} value={form.firstPaymentDay} onChange={set("firstPaymentDay")} placeholder="5" />
              </label>

              <label className={LABEL_CLASS}>
                Número de períodos
                <input type="number" min={1} max={120} required className={FIELD_CLASS} value={form.numberOfPeriods} onChange={set("numberOfPeriods")} placeholder="36" />
              </label>

              <label className={LABEL_CLASS}>
                Cuota mensual (UF)
                <input required className={FIELD_CLASS} value={form.monthlyInstallmentUF} onChange={set("monthlyInstallmentUF")} placeholder="95" />
              </label>

              <label className={LABEL_CLASS}>
                Tasa anual (decimal, ej: 0.115)
                <input required className={FIELD_CLASS} value={form.annualInterestRate} onChange={set("annualInterestRate")} placeholder="0.115" />
              </label>

              <label className={LABEL_CLASS}>
                Valor UF al reconocimiento
                <input required className={FIELD_CLASS} value={form.ufAtRecognition} onChange={set("ufAtRecognition")} placeholder="34817.58" />
              </label>

              <label className={LABEL_CLASS}>
                Vida útil activo (meses)
                <input type="number" min={1} max={600} required className={FIELD_CLASS} value={form.usefulLifeMonths} onChange={set("usefulLifeMonths")} placeholder="36" />
              </label>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={create.isPending}
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {create.isPending ? "Creando…" : "Crear planilla"}
                </button>
              </div>
            </form>

            {clientError && <p className="mt-2 text-sm text-red-600">{clientError}</p>}
            {create.isError && (
              <p className="mt-2 text-sm text-red-600">{(create.error as Error).message}</p>
            )}

            {/* Helper reference */}
            <div className="mt-4 rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600">
              <span className="font-semibold">Contrato Buda 2022–2025 (referencia): </span>
              Reconocimiento 2022-12-01 · Día pago 5 · 36 períodos · Cuota 95 UF · Tasa 0.115 · UF 34817.58 · VU 36 meses
            </div>
          </>
        )}
      </section>

      {/* List of schedules */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {(error as Error).message}
        </div>
      )}

      {isPending && (
        <p className="text-sm text-slate-500">Cargando planillas…</p>
      )}

      {!isPending && schedules.length === 0 && !error && (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-12 text-center shadow-sm">
          <p className="text-sm text-slate-500">No hay planillas creadas. Usa el botón de arriba para crear la primera.</p>
          <p className="mt-1 text-xs text-slate-400">
            Puedes ingresar los datos del contrato Buda 2022–2025 directamente desde el formulario.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {schedules.map((s) => (
          <ScheduleCard
            key={s.id}
            schedule={s}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {scheduleToDelete && remove.isError && (
        <p className="text-sm text-red-600">{(remove.error as Error).message}</p>
      )}
    </main>
  );
}
