export type WebChatPrechatFieldType = 'text' | 'phone' | 'email' | 'select' | 'textarea'

export type WebChatPrechatMode = 'steps' | 'form'

export interface WebChatPrechatField {
  id: string
  label: string
  type: WebChatPrechatFieldType
  enabled: boolean
  required: boolean
  placeholder?: string
  maxLength?: number
  options?: string[]
  preset?: 'name' | 'phone' | 'email' | 'contact_reason'
}

export const DEFAULT_CONTACT_REASON_OPTIONS = [
  'Quero saber preços',
  'Quero contratar',
  'Preciso de suporte',
  'Dúvida sobre planos',
  'Outro',
]

export function defaultPrechatFields(): WebChatPrechatField[] {
  return [
    {
      id: 'name',
      label: 'Nome',
      type: 'text',
      enabled: true,
      required: true,
      placeholder: 'Seu nome',
      preset: 'name',
    },
    {
      id: 'phone',
      label: 'WhatsApp',
      type: 'phone',
      enabled: true,
      required: true,
      placeholder: '(11) 99999-9999',
      preset: 'phone',
    },
    {
      id: 'contact_reason',
      label: 'Motivo do contato',
      type: 'select',
      enabled: true,
      required: true,
      options: [...DEFAULT_CONTACT_REASON_OPTIONS],
      preset: 'contact_reason',
    },
    {
      id: 'email',
      label: 'E-mail',
      type: 'email',
      enabled: false,
      required: false,
      placeholder: 'seu@email.com',
      preset: 'email',
    },
  ]
}

export function prechatFieldsFromLegacy(appearance: {
  askName?: boolean
  askPhone?: boolean
  askContactReason?: boolean
  askEmail?: boolean
  contactReasonOptions?: string[]
}): WebChatPrechatField[] {
  const defaults = defaultPrechatFields()
  return defaults.map(field => {
    if (field.preset === 'name') return { ...field, enabled: appearance.askName !== false }
    if (field.preset === 'phone') return { ...field, enabled: appearance.askPhone !== false }
    if (field.preset === 'contact_reason') {
      return {
        ...field,
        enabled: appearance.askContactReason !== false,
        options: appearance.contactReasonOptions?.length
          ? appearance.contactReasonOptions
          : field.options,
      }
    }
    if (field.preset === 'email') {
      return { ...field, enabled: Boolean(appearance.askEmail), required: false }
    }
    return field
  })
}

export function resolvePrechatFields(appearance: {
  prechatFields?: WebChatPrechatField[]
  askName?: boolean
  askPhone?: boolean
  askContactReason?: boolean
  askEmail?: boolean
  contactReasonOptions?: string[]
}): WebChatPrechatField[] {
  if (appearance.prechatFields?.length) {
    return appearance.prechatFields.map(normalizePrechatField)
  }
  return prechatFieldsFromLegacy(appearance)
}

export function resolvePrechatMode(appearance?: { prechatMode?: WebChatPrechatMode } | null): WebChatPrechatMode {
  return appearance?.prechatMode === 'form' ? 'form' : 'steps'
}

export function normalizePrechatField(field: WebChatPrechatField): WebChatPrechatField {
  const id = slugifyPrechatFieldId(field.id || field.label)
  const maxLength =
    field.maxLength && field.maxLength > 0 ? Math.min(500, Math.round(field.maxLength)) : undefined
  return {
    id,
    label: (field.label || id).trim().slice(0, 80),
    type: field.type || 'text',
    enabled: field.enabled !== false,
    required: Boolean(field.required),
    placeholder: field.placeholder?.trim().slice(0, 120),
    maxLength: field.type === 'text' || field.type === 'textarea' ? maxLength : undefined,
    options:
      field.type === 'select'
        ? (field.options ?? []).map(o => o.trim()).filter(Boolean).slice(0, 20)
        : undefined,
    preset: field.preset,
  }
}

export function classicPrechatFormAppearance<T extends {
  prechatFields?: WebChatPrechatField[]
  askName: boolean
  askPhone: boolean
  askContactReason: boolean
  askEmail: boolean
  contactReasonOptions: string[]
  prechatMode?: WebChatPrechatMode
}>(appearance: T): T & { prechatMode: 'form'; prechatFields: WebChatPrechatField[] } {
  return syncLegacyAppearanceFlags({
    ...appearance,
    prechatMode: 'form',
    prechatFields: [
      normalizePrechatField({
        id: 'name',
        label: 'Nome',
        type: 'text',
        enabled: true,
        required: true,
        placeholder: 'Seu nome completo',
        preset: 'name',
      }),
      normalizePrechatField({
        id: 'phone',
        label: 'Telefone',
        type: 'phone',
        enabled: true,
        required: true,
        placeholder: '(11) 99999-9999',
        preset: 'phone',
      }),
      normalizePrechatField({
        id: 'contact_reason',
        label: 'Motivo do contato',
        type: 'textarea',
        enabled: true,
        required: true,
        placeholder: 'Descreva brevemente o que você precisa',
        maxLength: 150,
        preset: 'contact_reason',
      }),
    ],
  }) as T & { prechatMode: 'form'; prechatFields: WebChatPrechatField[] }
}

export function slugifyPrechatFieldId(raw: string): string {
  const base = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)
  return base || `campo_${Date.now().toString(36)}`
}

export function syncLegacyAppearanceFlags<T extends {
  primaryColor?: string
  position?: 'left' | 'right'
  title?: string
  subtitle?: string
  greeting?: string
  theme?: 'light' | 'dark'
  previewTemplateId?: string
  prechatFields?: WebChatPrechatField[]
  askName: boolean
  askPhone: boolean
  askContactReason: boolean
  askEmail: boolean
  contactReasonOptions: string[]
  prechatMode?: WebChatPrechatMode
}>(appearance: T): T {
  const fields = resolvePrechatFields(appearance)
  const byPreset = (preset: WebChatPrechatField['preset']) =>
    fields.find(f => f.preset === preset)
  const name = byPreset('name')
  const phone = byPreset('phone')
  const reason = byPreset('contact_reason')
  const email = byPreset('email')
  return {
    ...appearance,
    prechatFields: fields,
    prechatMode: resolvePrechatMode(appearance),
    askName: name?.enabled !== false,
    askPhone: phone?.enabled !== false,
    askContactReason: reason?.enabled !== false,
    askEmail: Boolean(email?.enabled),
    contactReasonOptions: reason?.options?.length
      ? reason.options
      : [...DEFAULT_CONTACT_REASON_OPTIONS],
    theme: appearance.theme ?? 'light',
    previewTemplateId: appearance.previewTemplateId,
  }
}

export const FIELD_TEMPLATES: Array<{
  label: string
  type: WebChatPrechatFieldType
  placeholder?: string
  maxLength?: number
  options?: string[]
}> = [
  { label: 'Número do pedido', type: 'text', placeholder: 'Ex.: 12345' },
  { label: 'Nota fiscal', type: 'text', placeholder: 'Ex.: 000123456' },
  { label: 'CPF / CNPJ', type: 'text', placeholder: 'Somente números' },
  { label: 'Empresa', type: 'text', placeholder: 'Nome da empresa' },
  { label: 'Cidade', type: 'text', placeholder: 'Sua cidade' },
  {
    label: 'Motivo do contato',
    type: 'textarea',
    placeholder: 'Descreva o que você precisa',
    maxLength: 150,
  },
  {
    label: 'Tipo de atendimento',
    type: 'select',
    options: ['Vendas', 'Suporte', 'Financeiro', 'Outro'],
  },
]
