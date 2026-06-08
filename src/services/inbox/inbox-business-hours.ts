import {
  INBOX_WEEKDAYS,
  InboxWeekday,
  InboxWeeklySchedule,
} from '@/types/inbox-settings';

const WEEKDAY_FROM_SHORT: Record<string, InboxWeekday> = {
  Mon: 'monday',
  Tue: 'tuesday',
  Wed: 'wednesday',
  Thu: 'thursday',
  Fri: 'friday',
  Sat: 'saturday',
  Sun: 'sunday',
};

function parseTimeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(v => parseInt(v, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function getZonedParts(timezone: string): { weekday: InboxWeekday; minutes: number } {
  const now = new Date();
  const weekdayShort = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  }).format(now);
  const weekday = WEEKDAY_FROM_SHORT[weekdayShort] ?? 'monday';

  const timeParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const hour = parseInt(timeParts.find(p => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(timeParts.find(p => p.type === 'minute')?.value ?? '0', 10);

  return { weekday, minutes: hour * 60 + minute };
}

export function isWithinBusinessHours(
  enabled: boolean,
  timezone: string,
  schedule: InboxWeeklySchedule,
): boolean {
  if (!enabled) return true;

  const tz = timezone?.trim() || 'America/Sao_Paulo';
  const { weekday, minutes } = getZonedParts(tz);
  const day = schedule[weekday];
  if (!day?.enabled) return false;

  const start = parseTimeToMinutes(day.start);
  const end = parseTimeToMinutes(day.end);
  if (end <= start) return minutes >= start || minutes < end;
  return minutes >= start && minutes < end;
}

export function formatScheduleSummary(schedule: InboxWeeklySchedule): string {
  const enabledDays = INBOX_WEEKDAYS.filter(d => schedule[d]?.enabled);
  if (!enabledDays.length) return 'Fechado todos os dias';
  const first = schedule[enabledDays[0]];
  const sameHours = enabledDays.every(
    d => schedule[d].start === first.start && schedule[d].end === first.end,
  );
  if (sameHours && enabledDays.length === 5 && !schedule.saturday.enabled && !schedule.sunday.enabled) {
    return `Seg–Sex ${first.start}–${first.end}`;
  }
  return `${enabledDays.length} dia(s) configurado(s)`;
}
