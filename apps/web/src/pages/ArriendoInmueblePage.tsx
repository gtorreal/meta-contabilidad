import { formatClpInteger } from "../formatCurrency";

type AmortRow = {
  date: string;
  period: number;
  openingBalanceUF: number;
  interestUF: number;
  amortizationUF: number;
  closingBalanceUF: number;
  installmentCLP: number;
  interestCLP: number;
  monthlyDeprecCLP: number;
  accumDeprecCLP: number;
  netValueCLP: number;
};

const INSTALLMENT_UF = 95;
const ASSET_VALUE_CLP = 100_305_357.1;

const ROWS: AmortRow[] = [
  { date: "2023-01-05", period: 1,  openingBalanceUF: 2880.882504, interestUF: 27.60845733, amortizationUF: 67.39154267, closingBalanceUF: 2813.490962, installmentCLP: 2_346_410.428, interestCLP: 961_259.6719, monthlyDeprecCLP: 2_786_259.919, accumDeprecCLP: 2_786_259.919,  netValueCLP: 97_519_097.15 },
  { date: "2023-02-05", period: 2,  openingBalanceUF: 2813.490962, interestUF: 26.96262172, amortizationUF: 68.03737828, closingBalanceUF: 2745.453584, installmentCLP: 2_368_896.861, interestCLP: 938_773.2387, monthlyDeprecCLP: 2_786_259.919, accumDeprecCLP: 5_572_519.837,  netValueCLP: 94_732_837.23 },
  { date: "2023-03-05", period: 3,  openingBalanceUF: 2745.453584, interestUF: 26.31059684, amortizationUF: 68.68940316, closingBalanceUF: 2676.76418,  installmentCLP: 2_391_598.79,  interestCLP: 916_071.3104, monthlyDeprecCLP: 2_786_259.919, accumDeprecCLP: 8_358_779.756,  netValueCLP: 91_946_577.31 },
  { date: "2023-04-05", period: 4,  openingBalanceUF: 2676.76418,  interestUF: 25.6523234,  amortizationUF: 69.3476766,  closingBalanceUF: 2607.416504, installmentCLP: 2_414_518.278, interestCLP: 893_151.822,  monthlyDeprecCLP: 2_786_259.919, accumDeprecCLP: 11_145_039.67, netValueCLP: 89_160_317.4  },
  { date: "2023-05-05", period: 5,  openingBalanceUF: 2607.416504, interestUF: 24.98774149, amortizationUF: 70.01225851, closingBalanceUF: 2537.404245, installmentCLP: 2_437_657.411, interestCLP: 870_012.6885, monthlyDeprecCLP: 2_786_259.919, accumDeprecCLP: 13_931_299.59, netValueCLP: 86_374_057.48 },
  { date: "2023-06-05", period: 6,  openingBalanceUF: 2537.404245, interestUF: 24.31679068, amortizationUF: 70.68320932, closingBalanceUF: 2466.721036, installmentCLP: 2_461_018.295, interestCLP: 846_651.805,  monthlyDeprecCLP: 2_786_259.919, accumDeprecCLP: 16_717_559.51, netValueCLP: 83_587_797.56 },
  { date: "2023-07-05", period: 7,  openingBalanceUF: 2466.721036, interestUF: 23.63940993, amortizationUF: 71.36059007, closingBalanceUF: 2395.360446, installmentCLP: 2_484_603.054, interestCLP: 823_067.0463, monthlyDeprecCLP: 2_786_259.919, accumDeprecCLP: 19_503_819.43, netValueCLP: 80_801_537.64 },
  { date: "2023-08-05", period: 8,  openingBalanceUF: 2395.360446, interestUF: 22.95553761, amortizationUF: 72.04446239, closingBalanceUF: 2323.315983, installmentCLP: 2_508_413.833, interestCLP: 799_256.2671, monthlyDeprecCLP: 2_786_259.919, accumDeprecCLP: 22_290_079.35, netValueCLP: 78_015_277.72 },
  { date: "2023-09-05", period: 9,  openingBalanceUF: 2323.315983, interestUF: 22.26511151, amortizationUF: 72.73488849, closingBalanceUF: 2250.581095, installmentCLP: 2_532_452.799, interestCLP: 775_217.3012, monthlyDeprecCLP: 2_786_259.919, accumDeprecCLP: 25_076_339.27, netValueCLP: 75_229_017.8  },
  { date: "2023-10-05", period: 10, openingBalanceUF: 2250.581095, interestUF: 21.56806883, amortizationUF: 73.43193117, closingBalanceUF: 2177.149164, installmentCLP: 2_556_722.138, interestCLP: 750_947.9618, monthlyDeprecCLP: 2_786_259.919, accumDeprecCLP: 27_862_599.19, netValueCLP: 72_442_757.88 },
  { date: "2023-11-05", period: 11, openingBalanceUF: 2177.149164, interestUF: 20.86434615, amortizationUF: 74.13565385, closingBalanceUF: 2103.01351,  installmentCLP: 2_581_224.059, interestCLP: 726_446.0413, monthlyDeprecCLP: 2_786_259.919, accumDeprecCLP: 30_648_859.1,  netValueCLP: 69_656_497.97 },
  { date: "2023-12-05", period: 12, openingBalanceUF: 2103.01351,  interestUF: 20.15387947, amortizationUF: 74.84612053, closingBalanceUF: 2028.167389, installmentCLP: 2_605_960.789, interestCLP: 701_709.3108, monthlyDeprecCLP: 2_786_259.919, accumDeprecCLP: 33_435_119.02, netValueCLP: 66_870_238.05 },
  { date: "2024-01-05", period: 13, openingBalanceUF: 2028.167389, interestUF: 19.43660415, amortizationUF: 75.56339585, closingBalanceUF: 1952.603994, installmentCLP: 2_630_934.58,  interestCLP: 676_735.5199, monthlyDeprecCLP: 2_786_259.919, accumDeprecCLP: 36_221_378.94, netValueCLP: 64_083_978.13 },
  { date: "2024-02-05", period: 14, openingBalanceUF: 1952.603994, interestUF: 18.71245494, amortizationUF: 76.28754506, closingBalanceUF: 1876.316449, installmentCLP: 2_656_147.703, interestCLP: 651_522.3968, monthlyDeprecCLP: 2_786_259.919, accumDeprecCLP: 39_007_638.86, netValueCLP: 61_297_718.21 },
  { date: "2024-03-05", period: 15, openingBalanceUF: 1876.316449, interestUF: 17.98136597, amortizationUF: 77.01863403, closingBalanceUF: 1799.297814, installmentCLP: 2_681_602.452, interestCLP: 626_067.648,  monthlyDeprecCLP: 2_786_259.919, accumDeprecCLP: 41_793_898.78, netValueCLP: 58_511_458.29 },
  { date: "2024-04-05", period: 16, openingBalanceUF: 1799.297814, interestUF: 17.24327072, amortizationUF: 77.75672928, closingBalanceUF: 1721.541085, installmentCLP: 2_707_301.142, interestCLP: 600_368.9578, monthlyDeprecCLP: 2_786_259.919, accumDeprecCLP: 44_580_158.7,  netValueCLP: 55_725_198.37 },
  { date: "2024-05-05", period: 17, openingBalanceUF: 1721.541085, interestUF: 16.49810207, amortizationUF: 78.50189793, closingBalanceUF: 1643.039187, installmentCLP: 2_733_246.111, interestCLP: 574_423.9886, monthlyDeprecCLP: 2_786_259.919, accumDeprecCLP: 47_366_418.62, netValueCLP: 52_938_938.45 },
  { date: "2024-06-05", period: 18, openingBalanceUF: 1643.039187, interestUF: 15.74579221, amortizationUF: 79.25420779, closingBalanceUF: 1563.784979, installmentCLP: 2_759_439.72,  interestCLP: 548_230.38,   monthlyDeprecCLP: 2_786_259.919, accumDeprecCLP: 50_152_678.54, netValueCLP: 50_152_678.54 },
  { date: "2024-07-05", period: 19, openingBalanceUF: 1563.784979, interestUF: 14.98627272, amortizationUF: 80.01372728, closingBalanceUF: 1483.771252, installmentCLP: 2_785_884.351, interestCLP: 521_785.7493, monthlyDeprecCLP: 2_786_259.919, accumDeprecCLP: 52_938_938.45, netValueCLP: 47_366_418.62 },
  { date: "2024-08-05", period: 20, openingBalanceUF: 1483.771252, interestUF: 14.2194745,  amortizationUF: 80.7805255,  closingBalanceUF: 1402.990727, installmentCLP: 2_812_582.409, interestCLP: 495_087.691,  monthlyDeprecCLP: 2_786_259.919, accumDeprecCLP: 55_725_198.37, netValueCLP: 44_580_158.7  },
  { date: "2024-09-05", period: 21, openingBalanceUF: 1402.990727, interestUF: 13.4453278,  amortizationUF: 81.5546722,  closingBalanceUF: 1321.436055, installmentCLP: 2_839_536.324, interestCLP: 468_133.7762, monthlyDeprecCLP: 2_786_259.919, accumDeprecCLP: 58_511_458.29, netValueCLP: 41_793_898.78 },
  { date: "2024-10-05", period: 22, openingBalanceUF: 1321.436055, interestUF: 12.66376219, amortizationUF: 82.33623781, closingBalanceUF: 1239.099817, installmentCLP: 2_866_748.547, interestCLP: 440_921.5531, monthlyDeprecCLP: 2_786_259.919, accumDeprecCLP: 61_297_718.21, netValueCLP: 39_007_638.86 },
  { date: "2024-11-05", period: 23, openingBalanceUF: 1239.099817, interestUF: 11.87470658, amortizationUF: 83.12529342, closingBalanceUF: 1155.974523, installmentCLP: 2_894_221.554, interestCLP: 413_448.5462, monthlyDeprecCLP: 2_786_259.919, accumDeprecCLP: 64_083_978.13, netValueCLP: 36_221_378.94 },
  { date: "2024-12-05", period: 24, openingBalanceUF: 1155.974523, interestUF: 11.07808918, amortizationUF: 83.92191082, closingBalanceUF: 1072.052612, installmentCLP: 2_921_957.844, interestCLP: 385_712.2563, monthlyDeprecCLP: 2_786_259.919, accumDeprecCLP: 66_870_238.05, netValueCLP: 33_435_119.02 },
  { date: "2025-01-05", period: 25, openingBalanceUF: 1072.052612, interestUF: 10.27383754, amortizationUF: 84.72616246, closingBalanceUF: 987.32645,   installmentCLP: 2_949_959.94,  interestCLP: 357_710.1603, monthlyDeprecCLP: 2_786_259.919, accumDeprecCLP: 69_656_497.97, netValueCLP: 30_648_859.1  },
  { date: "2025-02-05", period: 26, openingBalanceUF: 987.32645,   interestUF: 9.461878479, amortizationUF: 85.53812152, closingBalanceUF: 901.7883285, installmentCLP: 2_978_230.389, interestCLP: 329_439.7109, monthlyDeprecCLP: 2_786_259.919, accumDeprecCLP: 72_442_757.88, netValueCLP: 27_862_599.19 },
  { date: "2025-03-05", period: 27, openingBalanceUF: 901.7883285, interestUF: 8.642138148, amortizationUF: 86.35786185, closingBalanceUF: 815.4304666, installmentCLP: 3_006_771.764, interestCLP: 300_898.3363, monthlyDeprecCLP: 2_786_259.919, accumDeprecCLP: 75_229_017.8,  netValueCLP: 25_076_339.27 },
  { date: "2025-04-05", period: 28, openingBalanceUF: 815.4304666, interestUF: 7.814541972, amortizationUF: 87.18545803, closingBalanceUF: 728.2450086, installmentCLP: 3_035_586.66,  interestCLP: 272_083.4403, monthlyDeprecCLP: 2_786_259.919, accumDeprecCLP: 78_015_277.72, netValueCLP: 22_290_079.35 },
  { date: "2025-05-05", period: 29, openingBalanceUF: 728.2450086, interestUF: 6.979014666, amortizationUF: 88.02098533, closingBalanceUF: 640.2240233, installmentCLP: 3_064_677.699, interestCLP: 242_992.4014, monthlyDeprecCLP: 2_786_259.919, accumDeprecCLP: 80_801_537.64, netValueCLP: 19_503_819.43 },
  { date: "2025-06-05", period: 30, openingBalanceUF: 640.2240233, interestUF: 6.135480223, amortizationUF: 88.86451978, closingBalanceUF: 551.3595035, installmentCLP: 3_094_047.526, interestCLP: 213_622.5735, monthlyDeprecCLP: 2_786_259.919, accumDeprecCLP: 83_587_797.56, netValueCLP: 16_717_559.51 },
  { date: "2025-07-05", period: 31, openingBalanceUF: 551.3595035, interestUF: 5.283861908, amortizationUF: 89.71613809, closingBalanceUF: 461.6433654, installmentCLP: 3_123_698.815, interestCLP: 183_971.2847, monthlyDeprecCLP: 2_786_259.919, accumDeprecCLP: 86_374_057.48, netValueCLP: 13_931_299.59 },
  { date: "2025-08-05", period: 32, openingBalanceUF: 461.6433654, interestUF: 4.424082252, amortizationUF: 90.57591775, closingBalanceUF: 371.0674476, installmentCLP: 3_153_634.262, interestCLP: 154_035.8377, monthlyDeprecCLP: 2_786_259.919, accumDeprecCLP: 89_160_317.4,  netValueCLP: 11_145_039.67 },
  { date: "2025-09-05", period: 33, openingBalanceUF: 371.0674476, interestUF: 3.55606304,  amortizationUF: 91.44393696, closingBalanceUF: 279.6235107, installmentCLP: 3_183_856.591, interestCLP: 123_813.5094, monthlyDeprecCLP: 2_786_259.919, accumDeprecCLP: 91_946_577.31, netValueCLP: 8_358_779.756 },
  { date: "2025-10-05", period: 34, openingBalanceUF: 279.6235107, interestUF: 2.679725311, amortizationUF: 92.32027469, closingBalanceUF: 187.303236,  installmentCLP: 3_214_368.55,  interestCLP: 93_301.55038, monthlyDeprecCLP: 2_786_259.919, accumDeprecCLP: 94_732_837.23, netValueCLP: 5_572_519.837 },
  { date: "2025-11-05", period: 35, openingBalanceUF: 187.303236,  interestUF: 1.794989345, amortizationUF: 93.20501066, closingBalanceUF: 94.09822534, installmentCLP: 3_245_172.915, interestCLP: 62_497.18512, monthlyDeprecCLP: 2_786_259.919, accumDeprecCLP: 97_519_097.15, netValueCLP: 2_786_259.919 },
  { date: "2025-12-05", period: 36, openingBalanceUF: 94.09822534, interestUF: 0.901774660, amortizationUF: 94.09822534, closingBalanceUF: 0,           installmentCLP: 3_276_272.489, interestCLP: 31_397.61135, monthlyDeprecCLP: 2_786_259.919, accumDeprecCLP: 100_305_357.1, netValueCLP: 0 },
];

const UF_FORMAT = new Intl.NumberFormat("es-CL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function fmtUF(n: number): string {
  return UF_FORMAT.format(n);
}

function fmtCLP(n: number): string {
  return formatClpInteger(String(Math.round(n)));
}


const MONTH_LABELS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function periodLabel(iso: string): string {
  const [y, m] = iso.split("-");
  return `${MONTH_LABELS[parseInt(m, 10) - 1]} ${y}`;
}

function isCurrentOrFuture(isoDate: string): boolean {
  const today = new Date();
  const d = new Date(isoDate + "T12:00:00");
  return d >= new Date(today.getFullYear(), today.getMonth(), 1);
}

function currentPeriodIndex(): number {
  const today = new Date();
  return ROWS.findIndex((r) => {
    const d = new Date(r.date + "T12:00:00");
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
  });
}

export function ArriendoInmueblePage() {
  const totalInstallCLP = ROWS.reduce((s, r) => s + r.installmentCLP, 0);
  const totalInterestCLP = ROWS.reduce((s, r) => s + r.interestCLP, 0);

  const totalInstallUF = ROWS.reduce((s) => s + INSTALLMENT_UF, 0);
  const totalInterestUF = ROWS.reduce((s, r) => s + r.interestUF, 0);
  const totalAmortUF = ROWS.reduce((s, r) => s + r.amortizationUF, 0);

  const currIdx = currentPeriodIndex();

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Amortización arriendo oficina</h1>
        <p className="mt-1 text-sm text-slate-600">
          Tabla de amortización NIIF 16 — Buda.com SpA · contrato enero 2023 – diciembre 2025 (36 cuotas de 95 UF)
        </p>
      </div>

      {/* Contract summary */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Inicio / Término</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">01/01/2023 – 05/12/2025</p>
          <p className="text-xs text-slate-500">36 períodos mensuales</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Cuota mensual</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">95,00 UF</p>
          <p className="text-xs text-slate-500">Tasa anual: 11,5% · UF dic-2022: 34.817,58</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Activo derecho de uso</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{fmtCLP(ASSET_VALUE_CLP)}</p>
          <p className="text-xs text-slate-500">Valor inicial en CLP · cta. 117003</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Depreciación mensual</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{fmtCLP(2_786_259.919)}</p>
          <p className="text-xs text-slate-500">Lineal · vida útil 36 meses</p>
        </div>
      </section>

      {/* Initial recognition entry */}
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Asiento de reconocimiento inicial — 01/12/2022</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          GL: Reconocimiento de arrendamiento bajo NIIF 16
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-600">
              <tr>
                <th className="px-3 py-2">Cuenta</th>
                <th className="px-3 py-2">Descripción</th>
                <th className="px-3 py-2 text-right">Débito</th>
                <th className="px-3 py-2 text-right">Crédito</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-100">
                <td className="px-3 py-2 font-mono text-xs text-slate-600">117003</td>
                <td className="px-3 py-2">Activo por derecho de uso</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtCLP(100_305_357.1)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-400">—</td>
              </tr>
              <tr className="border-t border-slate-100">
                <td className="px-3 py-2 font-mono text-xs text-slate-600">117004</td>
                <td className="px-3 py-2">Activo por intereses diferidos</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtCLP(18_770_766.53)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-400">—</td>
              </tr>
              <tr className="border-t border-slate-100">
                <td className="px-3 py-2 font-mono text-xs text-slate-600">210181</td>
                <td className="px-3 py-2">Pasivo por derecho de uso</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-400">—</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtCLP(119_076_123.63)}</td>
              </tr>
            </tbody>
            <tfoot className="border-t-2 border-slate-300 bg-slate-50">
              <tr>
                <td colSpan={2} className="px-3 py-2 text-xs font-semibold text-slate-600">Total</td>
                <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums">{fmtCLP(119_076_123.63)}</td>
                <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums">{fmtCLP(119_076_123.63)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
          <span><span className="font-medium">Corto plazo (pasivo):</span> {fmtCLP(29_689_476.74)}</span>
          <span><span className="font-medium">Largo plazo (pasivo):</span> {fmtCLP(70_615_880.34)}</span>
        </div>
      </section>

      {/* Amortization table */}
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Tabla de amortización</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Pasivo en UF · activo y pagos en CLP · cuota pagadera el día 5 de cada mes
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                {/* Date / period */}
                <th className="sticky left-0 z-10 bg-slate-100 px-3 py-2 whitespace-nowrap">Mes</th>
                <th className="px-3 py-2 text-center">Per.</th>

                {/* Liability UF */}
                <th className="border-l border-slate-200 px-3 py-2 text-right whitespace-nowrap">Saldo SI (UF)</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">Cuota (UF)</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">Interés (UF)</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">Amort. (UF)</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">Saldo SF (UF)</th>

                {/* CLP payments */}
                <th className="border-l border-slate-200 px-3 py-2 text-right whitespace-nowrap">Cuota CLP</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">Interés CLP</th>

                {/* Asset CLP */}
                <th className="border-l border-slate-200 px-3 py-2 text-right whitespace-nowrap">Deprec. mensual</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">Deprec. acum.</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">Valor neto</th>
              </tr>
            </thead>

            <tbody>
              {ROWS.map((r, i) => {
                const isCurrent = i === currIdx;
                const isPast = !isCurrentOrFuture(r.date) && !isCurrent;
                const rowBg = isCurrent
                  ? "bg-amber-50"
                  : isPast
                  ? i % 2 === 0
                    ? "bg-white"
                    : "bg-slate-50/60"
                  : i % 2 === 0
                  ? "bg-white"
                  : "bg-slate-50/60";

                return (
                  <tr key={r.date} className={`border-t border-slate-100 ${rowBg}`}>
                    <td className={`sticky left-0 z-10 px-3 py-1.5 font-medium whitespace-nowrap ${rowBg}`}>
                      <span className={isCurrent ? "text-amber-700" : isPast ? "text-slate-500" : "text-slate-800"}>
                        {periodLabel(r.date)}
                      </span>
                      {isCurrent && (
                        <span className="ml-1.5 rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                          actual
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-center tabular-nums text-slate-500">{r.period}</td>

                    {/* Liability UF */}
                    <td className="border-l border-slate-100 px-3 py-1.5 text-right tabular-nums text-slate-700">
                      {fmtUF(r.openingBalanceUF)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">{fmtUF(INSTALLMENT_UF)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{fmtUF(r.interestUF)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-medium text-slate-800">
                      {fmtUF(r.amortizationUF)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">
                      {fmtUF(r.closingBalanceUF)}
                    </td>

                    {/* CLP payments */}
                    <td className="border-l border-slate-100 px-3 py-1.5 text-right tabular-nums text-slate-700">
                      {fmtCLP(r.installmentCLP)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">
                      {fmtCLP(r.interestCLP)}
                    </td>

                    {/* Asset CLP */}
                    <td className="border-l border-slate-100 px-3 py-1.5 text-right tabular-nums text-slate-700">
                      {fmtCLP(r.monthlyDeprecCLP)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">
                      {fmtCLP(r.accumDeprecCLP)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-medium text-slate-800">
                      {fmtCLP(r.netValueCLP)}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            <tfoot className="border-t-2 border-slate-300 bg-slate-100 text-xs font-semibold text-slate-700">
              <tr>
                <td className="sticky left-0 z-10 bg-slate-100 px-3 py-2">Total</td>
                <td className="px-3 py-2 text-center text-slate-500">36</td>

                <td className="border-l border-slate-200 px-3 py-2" />
                <td className="px-3 py-2 text-right tabular-nums">{fmtUF(totalInstallUF)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtUF(totalInterestUF)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtUF(totalAmortUF)}</td>
                <td className="px-3 py-2" />

                <td className="border-l border-slate-200 px-3 py-2 text-right tabular-nums">
                  {fmtCLP(totalInstallCLP)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtCLP(totalInterestCLP)}</td>

                <td className="border-l border-slate-200 px-3 py-2 text-right tabular-nums">
                  {fmtCLP(ROWS.reduce((s, r) => s + r.monthlyDeprecCLP, 0))}
                </td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </main>
  );
}
