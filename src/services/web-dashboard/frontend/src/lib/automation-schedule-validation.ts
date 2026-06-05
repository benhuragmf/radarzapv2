import type { TriggerType } from './automation-triggers'
import {
  currentTimeHHmm,
  minDatetimeLocalFromNow,
  toDatetimeLocal,
  validateFutureSchedule,
} from './schedule-time'

export { toDatetimeLocal, minDatetimeLocalFromNow, currentTimeHHmm }

const WEEKDAY_ISO = (d: Date) => (d.getDay() === 0 ? 7 : d.getDay())

function parseHm(sendTime: string): { h: number; min: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(sendTime.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return { h, min }
}

function isCalendarDay(refDate: Date, dayOfMonth: number): boolean {
  return dayOfMonth >= 1 && dayOfMonth <= 31 && refDate.getDate() === dayOfMonth
}

function isNthBusinessDay(refDate: Date, nth: number): boolean {
  if (nth < 1 || nth > 23) return false
  const year = refDate.getFullYear()
  const month = refDate.getMonth()
  let business = 0
  for (let d = 1; d <= 31; d++) {
    const dt = new Date(year, month, d)
    if (dt.getMonth() !== month) break
    const dow = dt.getDay()
    if (dow >= 1 && dow <= 5) {
      business++
      if (business === nth) return dt.getDate() === refDate.getDate()
    }
  }
  return false
}

export function triggerMatchesCalendarToday(
  form: {
    triggerType: TriggerType
    dayOfMonth?: number
    nthBusinessDay?: number
    weekday?: number
    weekdays?: number[]
  },
  refDate: Date = new Date(),
): boolean {
  switch (form.triggerType) {
    case 'once_at':
      return false
    case 'calendar_day_of_month':
    case 'day_of_month':
      return isCalendarDay(refDate, form.dayOfMonth ?? 0)
    case 'nth_business_day_of_month':
      return isNthBusinessDay(refDate, form.nthBusinessDay ?? 0)
    case 'weekly': {
      const days = form.weekdays?.length
        ? form.weekdays
        : form.weekday
          ? [form.weekday]
          : []
      const iso = WEEKDAY_ISO(refDate)
      return days.some(w => w === iso)
    }
    case 'on_contact_birthday':
    case 'interval_months':
      return true
    default:
      return true
  }
}

export function validateAutomationScheduleTimes(
  form: {
    triggerType: TriggerType
    scheduledAt?: string
    sendTime?: string
    dayOfMonth?: number
    nthBusinessDay?: number
    weekday?: number
    weekdays?: number[]
  },
  refDate: Date = new Date(),
): string | null {
  if (form.triggerType === 'once_at') {
    return validateFutureSchedule(form.scheduledAt, refDate)
  }

  if (form.sendTime && triggerMatchesCalendarToday(form, refDate)) {
    const parsed = parseHm(form.sendTime)
    if (!parsed) return 'Horário inválido'
    const sendAt = new Date(refDate)
    sendAt.setHours(parsed.h, parsed.min, 0, 0)
    return validateFutureSchedule(sendAt, refDate)
  }
  return null
}
