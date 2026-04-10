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

/**
 * Meses civiles transcurridos entre el mes de adquisición y el mes del período (excluye el +1 inclusivo):
 * mismo mes y año → 0; un mes después → 1; nunca negativo.
 * Misma base que la depreciación lineal y VU restante en el auxiliar.
 */
export function monthsElapsedSinceAcquisitionMonth(
  acquisition: Date,
  periodYear: number,
  periodMonth: number,
): number {
  const acqY = acquisition.getUTCFullYear();
  const acqM = acquisition.getUTCMonth() + 1;
  const diff = (periodYear - acqY) * 12 + (periodMonth - acqM);
  return Math.max(diff, 0);
}

/**
 * Vida útil restante en meses (total). `monthsElapsedUncapped` debe ser el resultado de
 * `monthsElapsedSinceAcquisitionMonth` (no el conteo inclusivo antiguo).
 */
export function usefulLifeMonthsRemaining(lifeMonths: number, monthsElapsedUncapped: number): number {
  const elapsed = Math.min(monthsElapsedUncapped, lifeMonths);
  return Math.max(0, lifeMonths - elapsed);
}
