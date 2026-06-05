/**
 * Espelho do backend src/utils/schedule-time.ts — validação de agendamentos no painel.
 */

export const SCHEDULE_MIN_FUTURE_MS = 60_000;

export function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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

export function validateFutureSchedule(
  value: Date | string | null | undefined,
  refDate: Date = new Date(),
): string | null {
  if (value == null || (typeof value === 'string' && !value.trim())) {
    return 'Informe data e hora no futuro';
  }
  const d = typeof value === 'string' ? new Date(value) : new Date(value.getTime());
  if (Number.isNaN(d.getTime())) return 'Data e hora inválidas';
  if (d.getTime() < minFutureDate(refDate).getTime()) {
    return 'Data e hora devem ser no futuro';
  }
  return null;
}

export function clampDatetimeLocal(value: string, min: string): string {
  return value && value < min ? min : value;
}
