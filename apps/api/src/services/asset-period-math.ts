const ymKey = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;

/** Itera meses civiles de (fromY,fromM) a (toY,toM) inclusive, en orden. */
export function* iterateCalendarMonthsInclusive(
  fromY: number,
  fromM: number,
  toY: number,
  toM: number,
): Generator<{ year: number; month: number }> {
  const fromOrd = fromY * 12 + fromM;
  const toOrd = toY * 12 + toM;
  if (fromOrd > toOrd) {
    throw new Error(`iterateCalendarMonthsInclusive: origen ${ymKey(fromY, fromM)} posterior a ${ymKey(toY, toM)}`);
  }
  let y = fromY;
  let m = fromM;
  for (;;) {
    yield { year: y, month: m };
    if (y === toY && m === toM) break;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
}

/** Meses civiles desde el mes de adquisición hasta el período (inclusive), mínimo 0. */
export function monthsInclusiveFromAcquisition(
  acquisition: Date,
  periodYear: number,
  periodMonth: number,
): number {
  const acqY = acquisition.getUTCFullYear();
  const acqM = acquisition.getUTCMonth() + 1;
  const diff = (periodYear - acqY) * 12 + (periodMonth - acqM) + 1;
  return Math.max(diff, 0);
}

function monthsRemainingInCalendarYear(periodMonth: number): number {
  return 13 - periodMonth;
}

/**
 * Meses restantes en el año calendario del período, acotados por vida útil restante (misma regla que import Budacom / UI).
 */
export function monthsRemainingInYearForSnapshot(
  periodMonth: number,
  lifeMonths: number,
  monthsHeldUncapped: number,
): number {
  const calendarRemaining = monthsRemainingInCalendarYear(periodMonth);
  const elapsed = Math.min(monthsHeldUncapped, lifeMonths);
  const remainingLife = Math.max(0, lifeMonths - elapsed);
  return Math.min(calendarRemaining, remainingLife);
}
