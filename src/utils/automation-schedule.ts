/**
 * Calendário para gatilhos de automação (não baseados em birthday do contato).
 */

/** 1 = segunda … 7 = domingo (ISO weekday) */
export function weekdayMatches(refDate: Date, weekdayIso: number): boolean {
  if (weekdayIso < 1 || weekdayIso > 7) return false;
  const js = refDate.getDay();
  const iso = js === 0 ? 7 : js;
  return iso === weekdayIso;
}

/** Um ou mais dias da semana (ISO 1–7). */
export function weekdaysMatch(refDate: Date, weekdays: number[]): boolean {
  if (!weekdays?.length) return false;
  return weekdays.some(w => weekdayMatches(refDate, w));
}

/** Dia N do calendário no mês atual (1–31). */
export function isCalendarDayOfMonth(refDate: Date, dayOfMonth: number): boolean {
  if (dayOfMonth < 1 || dayOfMonth > 31) return false;
  return refDate.getDate() === dayOfMonth;
}

/**
 * N-ésimo dia útil do mês (segunda a sexta).
 * Ex.: nth=5 → 5º dia útil.
 */
export function isNthBusinessDayOfMonth(refDate: Date, nth: number): boolean {
  if (nth < 1 || nth > 23) return false;
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  let business = 0;
  for (let d = 1; d <= 31; d++) {
    const dt = new Date(year, month, d);
    if (dt.getMonth() !== month) break;
    const dow = dt.getDay();
    if (dow >= 1 && dow <= 5) {
      business++;
      if (business === nth) {
        return dt.getDate() === refDate.getDate();
      }
    }
  }
  return false;
}
