/**
 * Correspondência de aniversário (Destination.birthday = YYYY-MM-DD ou MM-DD).
 */

export interface BirthdayParts {
  year?: number;
  month: number;
  day: number;
}

/** Parseia YYYY-MM-DD, YYYY/MM/DD ou MM-DD. */
export function parseBirthday(birthday: string): BirthdayParts | null {
  const raw = birthday.trim();
  if (!raw) return null;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw);
  if (iso) {
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (!isValidMonthDay(month, day)) return null;
    return { year: Number(iso[1]), month, day };
  }

  const slash = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(raw);
  if (slash) {
    const month = Number(slash[2]);
    const day = Number(slash[3]);
    if (!isValidMonthDay(month, day)) return null;
    return { year: Number(slash[1]), month, day };
  }

  const md = /^(\d{1,2})-(\d{1,2})$/.exec(raw);
  if (md) {
    const month = Number(md[1]);
    const day = Number(md[2]);
    if (!isValidMonthDay(month, day)) return null;
    return { month, day };
  }

  return null;
}

function isValidMonthDay(month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  return true;
}

/** Contato faz aniversário hoje (mesmo mês e dia, ignora ano). */
export function contactBirthdayMatchesToday(birthday: string, refDate: Date = new Date()): boolean {
  const parts = parseBirthday(birthday);
  if (!parts) return false;
  return parts.month === refDate.getMonth() + 1 && parts.day === refDate.getDate();
}

/** Dia do mês do aniversário do contato (ex.: todo dia 10 → contatos nascidos no dia 10). */
export function contactBirthdayDayOfMonth(birthday: string, dayOfMonth: number): boolean {
  const parts = parseBirthday(birthday);
  if (!parts) return false;
  return parts.day === dayOfMonth;
}

export function formatBirthdayPtBr(birthday: string): string {
  const parts = parseBirthday(birthday);
  if (!parts) return birthday;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(parts.day)}/${pad(parts.month)}`;
}

export function computeAgeYears(birthday: string, refDate: Date = new Date()): number | null {
  const parts = parseBirthday(birthday);
  if (!parts?.year) return null;
  let age = refDate.getFullYear() - parts.year;
  const refMonth = refDate.getMonth() + 1;
  const refDay = refDate.getDate();
  if (refMonth < parts.month || (refMonth === parts.month && refDay < parts.day)) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

/** Já enviou parabéns automático neste ano civil? */
export function wasBirthdaySentThisYear(lastSentAt: Date | undefined, refDate: Date = new Date()): boolean {
  if (!lastSentAt) return false;
  return lastSentAt.getFullYear() === refDate.getFullYear();
}

/** Intervalo em meses desde o último envio (para regras "a cada N meses"). */
export function monthsSinceLastSend(lastSentAt: Date | undefined, refDate: Date = new Date()): number {
  if (!lastSentAt) return Number.POSITIVE_INFINITY;
  const months =
    (refDate.getFullYear() - lastSentAt.getFullYear()) * 12 +
    (refDate.getMonth() - lastSentAt.getMonth());
  if (refDate.getDate() < lastSentAt.getDate()) return Math.max(0, months - 1);
  return Math.max(0, months);
}

export function intervalMonthsElapsed(
  lastSentAt: Date | undefined,
  intervalMonths: number,
  refDate: Date = new Date(),
): boolean {
  if (!intervalMonths || intervalMonths < 1) return true;
  if (!lastSentAt) return true;
  return monthsSinceLastSend(lastSentAt, refDate) >= intervalMonths;
}

function parseSendTimeHm(sendTime: string): { h: number; min: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(sendTime.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, min };
}

/** HH:mm no fuso local — verdadeiro apenas no minuto exato do horário (job a cada 1 min). */
export function isSendTimeDue(sendTime: string, refDate: Date = new Date()): boolean {
  const parsed = parseSendTimeHm(sendTime);
  if (!parsed) return false;
  return refDate.getHours() === parsed.h && refDate.getMinutes() === parsed.min;
}

/** Envio único — dispara no minuto exato de scheduledAt (data + hora). */
export function isScheduledAtDue(scheduledAt: Date, refDate: Date = new Date()): boolean {
  return (
    refDate.getFullYear() === scheduledAt.getFullYear() &&
    refDate.getMonth() === scheduledAt.getMonth() &&
    refDate.getDate() === scheduledAt.getDate() &&
    refDate.getHours() === scheduledAt.getHours() &&
    refDate.getMinutes() === scheduledAt.getMinutes()
  );
}

/** @deprecated Use isSendTimeDue — mantido para compatibilidade em testes legados. */
export function isSendTimeReached(sendTime: string, refDate: Date = new Date()): boolean {
  return isSendTimeDue(sendTime, refDate);
}
