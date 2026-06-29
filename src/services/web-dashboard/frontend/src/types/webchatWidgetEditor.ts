import type { WebChatAiEscalationPolicy } from '../lib/webchatEscalationPolicy'
import type { WebChatPrechatField, WebChatPrechatMode } from '../lib/webchatPrechatFields'

export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

export interface DaySchedule {
  enabled: boolean
  start: string
  end: string
}

export type WeeklySchedule = Record<Weekday, DaySchedule>

export interface WebChatWidgetFormState {
  id: string
  name: string
  publicKey: string
  active: boolean
  allowedDomains: string[]
  includeCompanyWebsite?: boolean
  appearance: {
    primaryColor: string
    position: 'left' | 'right'
    title: string
    subtitle: string
    greeting: string
    askName: boolean
    askPhone: boolean
    askContactReason: boolean
    contactReasonOptions: string[]
    askEmail: boolean
    prechatFields?: WebChatPrechatField[]
    prechatMode?: WebChatPrechatMode
    theme: 'light' | 'dark'
    chatLayout?: 'classic' | 'copilot'
    previewTemplateId?: string
  }
  autoReplyEnabled: boolean
  autoReplyMessage: string
  autoReplySenderName: string
  autoReplyUseAi: boolean
  aiEscalationPolicy: WebChatAiEscalationPolicy
  proactiveGreetingEnabled: boolean
  proactiveGreetingMessage: string
  proactiveGreetingDelaySeconds: number
  defaultDepartmentId?: string | null
  useInboxBusinessHours: boolean
  businessHoursEnabled: boolean
  timezone: string
  schedule: WeeklySchedule
  outsideHoursMessage: string
}

export const WEEKDAYS: Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

export const DEFAULT_WEEKLY_SCHEDULE: WeeklySchedule = {
  monday: { enabled: true, start: '09:00', end: '18:00' },
  tuesday: { enabled: true, start: '09:00', end: '18:00' },
  wednesday: { enabled: true, start: '09:00', end: '18:00' },
  thursday: { enabled: true, start: '09:00', end: '18:00' },
  friday: { enabled: true, start: '09:00', end: '18:00' },
  saturday: { enabled: false, start: '09:00', end: '13:00' },
  sunday: { enabled: false, start: '09:00', end: '13:00' },
}

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  monday: 'Segunda',
  tuesday: 'Terça',
  wednesday: 'Quarta',
  thursday: 'Quinta',
  friday: 'Sexta',
  saturday: 'Sábado',
  sunday: 'Domingo',
}
