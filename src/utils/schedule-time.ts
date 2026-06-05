/**
 * Validação de agendamentos em todo o sistema (campanhas, automações, fila).
 */

/** Margem mínima para considerar “futuro” (1 minuto). */
export const SCHEDULE_MIN_FUTURE_MS = 60_000;

export type ScheduleValidationResult =
  | { ok: true; date: Date }
  | { ok: false; error: string };

export function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Próximo minuto arredondado — mínimo para inputs datetime-local. */
export function minFutureDate(refDate: Date = new Date()): Date {
  const d = new Date(refDate);
  d.setSeconds(0, 0);
  d.setMilliseconds(0);
  d.setMinutes(d.getMinutes() + 1);
  return d;
}

export function minDatetimeLocalFromNow(refDate: Date = new Date()): string {
  return toDatetimeLocal(minFutureDate(refDate));
}

export function currentTimeHHmm(refDate: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(refDate.getHours())}:${pad(refDate.getMinutes())}`;
}

function parseDateInput(value: Date | string): Date | null {
  const d = typeof value === 'string' ? new Date(value) : new Date(value.getTime());
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Data/hora de agendamento deve ser estritamente no futuro (≥ agora + 1 min). */
export function validateFutureSchedule(
  value: Date | string | null | undefined,
  refDate: Date = new Date(),
): ScheduleValidationResult {
  if (value == null || (typeof value === 'string' && !value.trim())) {
    return { ok: false, error: 'Informe data e hora no futuro' };
  }
  const d = parseDateInput(value);
  if (!d) {
    return { ok: false, error: 'Data e hora inválidas' };
  }
  if (d.getTime() < minFutureDate(refDate).getTime()) {
    return { ok: false, error: 'Data e hora devem ser no futuro' };
  }
  return { ok: true, date: d };
}

function parseHm(sendTime: string): { h: number; min: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(sendTime.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, min };
}

/** Horário HH:mm no dia de refDate deve ser futuro. */
export function validateFutureTimeToday(
  sendTime: string,
  refDate: Date = new Date(),
): string | null {
  const parsed = parseHm(sendTime);
  if (!parsed) return 'Horário inválido';
  const sendAt = new Date(refDate);
  sendAt.setHours(parsed.h, parsed.min, 0, 0);
  if (sendAt.getTime() < minFutureDate(refDate).getTime()) {
    return 'Horário já passou — escolha um horário futuro';
  }
  return null;
}

/** Envio imediato (sem sendAt) é permitido; com sendAt exige futuro. */
export function validateOptionalCampaignSendAt(
  sendAt: Date | string | null | undefined,
  refDate: Date = new Date(),
): ScheduleValidationResult | { ok: true; date: undefined } {
  if (sendAt == null || (typeof sendAt === 'string' && !sendAt.trim())) {
    return { ok: true, date: undefined };
  }
  return validateFutureSchedule(sendAt, refDate);
}
