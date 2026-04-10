/**
 * Auxiliar mensual (GET período / snapshots): «VU restante» debe ser la persistida en
 * `AssetPeriodSnapshot`, igual que dep. mes / acum. / neto. Recalcular solo esta columna
 * con `computeVuRestanteMeses` al responder rompe la coherencia con import Budacom o con
 * criterios distintos al calendario del catálogo.
 *
 * Para la vida útil «teórica» al día de hoy sin fila de snapshot, use `computeVuRestanteMeses`
 * en listados de activos (p. ej. GET /assets).
 */
export function auxiliarSnapshotMonthsRemainingInYear(persistedMonthsRemainingInYear: number): number {
  return persistedMonthsRemainingInYear;
}
