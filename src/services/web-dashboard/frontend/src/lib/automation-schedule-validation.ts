import type { TriggerType } from './automation-triggers'

const WEEKDAY_ISO = (d: Date) => (d.getDay() === 0 ? 7 : d.getDay())

function parseHm(sendTime: string): { h: number; min: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(sendTime.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return { h, min }
}

export function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function minDatetimeLocalFromNow(d: Date = new Date()): string {
  const next = new Date(d)
  next.setSeconds(0, 0)
  next.setMinutes(next.getMinutes() + 1)
  return toDatetimeLocal(next)
}

export function currentTimeHHmm(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
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
  const graceMs = 60_000
  const now = refDate.getTime()

  if (form.triggerType === 'once_at') {
    if (!form.scheduledAt) return 'Informe data e hora futuras'
    const sched = new Date(form.scheduledAt)
    if (Number.isNaN(sched.getTime()) || sched.getTime() < now - graceMs) {
      return 'Data e hora devem ser no futuro'
    }
    return null
  }

  if (form.sendTime && triggerMatchesCalendarToday(form, refDate)) {
    const parsed = parseHm(form.sendTime)
    if (parsed) {
      const sendAt = new Date(refDate)
      sendAt.setHours(parsed.h, parsed.min, 0, 0)
      if (sendAt.getTime() < now - graceMs) {
        return 'Horário já passou hoje — escolha um horário futuro'
      }
    }
  }
  return null
}
