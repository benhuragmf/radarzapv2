import { resolvePrechatFields, syncLegacyAppearanceFlags } from './webchatPrechatFields'
import { parseChatBoxModelId } from './chatBoxModels'
import { WEBCHAT_PREVIEW_TEMPLATES } from './webchatPreviewTemplates'
import type { WebChatWidgetFormState, Weekday } from '../types/webchatWidgetEditor'
import type { WebChatWidgetEditorSectionId } from '../components/webchat/WebChatWidgetEditorSection'

export type SectionStatusKind = 'complete' | 'incomplete' | 'optional' | 'attention'

export interface SectionStatus {
  kind: SectionStatusKind
  hint: string
}

export type EditorMode = 'simple' | 'advanced'

export function clampProactiveDelay(delayDraft: string, fallback = 30): number {
  return Math.min(300, Math.max(5, parseInt(delayDraft, 10) || fallback))
}

export function buildWidgetSavePayload(
  form: WebChatWidgetFormState,
  delayDraft: string,
): Record<string, unknown> {
  const delaySeconds = clampProactiveDelay(delayDraft, form.proactiveGreetingDelaySeconds || 30)
  return {
    name: form.name.trim(),
    active: form.active,
    allowedDomains: form.allowedDomains,
    appearance: syncLegacyAppearanceFlags(form.appearance),
    autoReplyEnabled: form.autoReplyEnabled,
    autoReplyMessage: form.autoReplyMessage,
    autoReplySenderName: form.autoReplySenderName,
    autoReplyUseAi: form.autoReplyUseAi,
    aiEscalationPolicy: form.aiEscalationPolicy,
    proactiveGreetingEnabled: form.proactiveGreetingEnabled,
    proactiveGreetingMessage: form.proactiveGreetingMessage,
    proactiveGreetingDelaySeconds: delaySeconds,
    defaultDepartmentId: form.defaultDepartmentId || null,
    useInboxBusinessHours: form.useInboxBusinessHours,
    businessHoursEnabled: form.businessHoursEnabled,
    timezone: form.timezone,
    schedule: form.schedule,
    outsideHoursMessage: form.outsideHoursMessage,
  }
}

function serializeWidgetSnapshot(
  form: WebChatWidgetFormState,
  delayDraft: string,
): string {
  return JSON.stringify(buildWidgetSavePayload(form, delayDraft))
}

export function isWidgetFormDirty(
  baseline: WebChatWidgetFormState,
  form: WebChatWidgetFormState,
  delayDraft: string,
  baselineDelayDraft: string,
): boolean {
  return (
    serializeWidgetSnapshot(form, delayDraft) !==
    serializeWidgetSnapshot(baseline, baselineDelayDraft)
  )
}

export function validateDomainLine(line: string): boolean {
  const s = line.trim()
  if (!s) return false
  if (s.startsWith('*.')) return /^(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(s.slice(2))
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(s)
}

export function validateWidgetForm(
  form: WebChatWidgetFormState,
  delayDraft: string,
): string[] {
  const errors: string[] = []
  if (!form.name.trim()) errors.push('Informe o nome interno do widget.')
  if (!form.appearance.title.trim()) errors.push('O título do chat não pode ficar vazio.')

  for (const domain of form.allowedDomains) {
    if (!validateDomainLine(domain)) {
      errors.push(`Domínio inválido: "${domain}"`)
    }
  }

  const fields = resolvePrechatFields(form.appearance)
  for (const field of fields) {
    if (field.enabled && field.required && !field.label.trim()) {
      errors.push('Campos obrigatórios do formulário precisam de pergunta/título.')
      break
    }
  }

  if (form.proactiveGreetingEnabled) {
    const delay = parseInt(delayDraft, 10)
    if (!Number.isFinite(delay) || delay < 5) {
      errors.push('O tempo da saudação proativa deve ser de pelo menos 5 segundos.')
    }
  }

  if (!form.useInboxBusinessHours && form.businessHoursEnabled) {
    const days = Object.values(form.schedule ?? {})
    const anyEnabled = days.some(d => d.enabled)
    if (!anyEnabled) errors.push('Ative pelo menos um dia no horário personalizado.')
    for (const d of days) {
      if (d.enabled && d.start >= d.end) {
        errors.push('Horário inicial deve ser anterior ao horário final.')
        break
      }
    }
  }

  return errors
}

function hoursSummary(form: WebChatWidgetFormState): string {
  if (form.useInboxBusinessHours) return 'Mesmo do atendimento principal'
  if (!form.businessHoursEnabled) return 'Sempre disponível'
  const enabled = Object.entries(form.schedule ?? {}).filter(([, d]) => d.enabled)
  if (!enabled.length) return 'Incompleto'
  return 'Horário personalizado'
}

function modelLabel(form: WebChatWidgetFormState): string {
  const id = form.appearance.previewTemplateId
  if (!id) return 'Padrão'
  const chatBox = parseChatBoxModelId(id)
  if (chatBox) return `Chat Box: ${chatBox}`
  return WEBCHAT_PREVIEW_TEMPLATES.find(t => t.id === id)?.name ?? id
}

export function getWidgetSectionStatuses(
  form: WebChatWidgetFormState,
  delayDraft: string,
): Record<WebChatWidgetEditorSectionId, SectionStatus> {
  const fields = resolvePrechatFields(form.appearance)
  const activeFields = fields.filter(f => f.enabled)
  const requiredActive = activeFields.filter(f => f.required)
  const validationErrors = validateWidgetForm(form, delayDraft)

  return {
    overview: {
      kind: form.name.trim() && form.active !== undefined ? 'complete' : 'incomplete',
      hint: form.name.trim() ? (form.active ? 'Widget ativo' : 'Widget inativo') : 'Defina o nome',
    },
    visual: {
      kind: form.appearance.title.trim()
        ? form.appearance.previewTemplateId
          ? 'complete'
          : 'attention'
        : 'incomplete',
      hint: modelLabel(form),
    },
    prechat: {
      kind: activeFields.length ? 'complete' : 'optional',
      hint:
        activeFields.length === 0
          ? 'Nenhum campo ativo'
          : `${activeFields.length} ativo(s) · ${requiredActive.length} obrigatório(s)`,
    },
    automacao: {
      kind: form.autoReplyEnabled ? 'complete' : 'optional',
      hint: form.autoReplyEnabled
        ? form.autoReplyUseAi
          ? 'IA ativa'
          : 'Resposta automática'
        : 'Desativada',
    },
    horarios: {
      kind:
        !form.useInboxBusinessHours && form.businessHoursEnabled && validationErrors.some(e =>
          e.includes('horário'),
        )
          ? 'attention'
          : 'complete',
      hint: hoursSummary(form),
    },
    instalacao: {
      kind: 'optional',
      hint: 'Copie o script no site',
    },
    avancado: {
      kind: form.allowedDomains.length ? 'complete' : 'attention',
      hint: form.allowedDomains.length
        ? `${form.allowedDomains.length} domínio(s)`
        : 'Bloqueado em prod.',
    },
  }
}

export function patchScheduleDay(
  schedule: WebChatWidgetFormState['schedule'],
  day: Weekday,
  field: 'enabled' | 'start' | 'end',
  value: boolean | string,
  defaults: WebChatWidgetFormState['schedule'],
): WebChatWidgetFormState['schedule'] {
  return {
    ...schedule,
    [day]: {
      ...(schedule?.[day] ?? defaults[day]),
      [field]: value,
    },
  }
}

export function applyWeekdayBulk(
  schedule: WebChatWidgetFormState['schedule'],
  days: Weekday[],
  patch: Partial<{ enabled: boolean; start: string; end: string }>,
  defaults: WebChatWidgetFormState['schedule'],
): WebChatWidgetFormState['schedule'] {
  const next = { ...schedule }
  for (const day of days) {
    next[day] = { ...(next[day] ?? defaults[day]), ...patch }
  }
  return next
}
