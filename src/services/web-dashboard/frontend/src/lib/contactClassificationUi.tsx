export type ContactKind = 'lead' | 'client' | 'prospect' | 'partner' | 'internal' | 'blocked'
export type ContactOrigin =
  | 'whatsapp'
  | 'webchat'
  | 'form'
  | 'manual'
  | 'csv'
  | 'wa_group'
  | 'api'
  | 'campaign'
export type SendPermission =
  | 'opt_in_accepted'
  | 'pending'
  | 'no_consent'
  | 'opt_out'
  | 'blocked'
export type CommercialStatus =
  | 'new'
  | 'in_service'
  | 'waiting_client'
  | 'waiting_agent'
  | 'qualified'
  | 'opportunity'
  | 'converted'
  | 'after_sale'
  | 'inactive'
  | 'lost'
export type ContactTemperature = 'cold' | 'warm' | 'hot' | 'vip' | 'risk'
export type PhoneQuality =
  | 'verified'
  | 'attention'
  | 'invalid'
  | 'no_whatsapp'
  | 'duplicate'
  | 'incomplete'
  | 'international'
  | 'suspicious'

export interface ContactClassificationView {
  kind: ContactKind
  origin: ContactOrigin
  permission: SendPermission
  commercialStatus: CommercialStatus
  temperature: ContactTemperature
  phoneQuality: PhoneQuality
  sendBlockReason?: string
  campaignSelectable: boolean
}

export const CONTACT_KIND_LABELS: Record<ContactKind, string> = {
  lead: 'Lead',
  client: 'Cliente',
  prospect: 'Prospect',
  partner: 'Parceiro',
  internal: 'Interno',
  blocked: 'Bloqueado',
}

export const CONTACT_ORIGIN_LABELS: Record<ContactOrigin, string> = {
  whatsapp: 'WhatsApp',
  webchat: 'WebChat',
  form: 'Formulário',
  manual: 'Manual',
  csv: 'CSV',
  wa_group: 'Grupo WA',
  api: 'API',
  campaign: 'Campanha',
}

export const SEND_PERMISSION_LABELS: Record<SendPermission, string> = {
  opt_in_accepted: 'Opt-in aceito',
  pending: 'Pendente',
  no_consent: 'Sem consentimento',
  opt_out: 'Opt-out',
  blocked: 'Bloqueado',
}

export const COMMERCIAL_STATUS_LABELS: Record<CommercialStatus, string> = {
  new: 'Novo',
  in_service: 'Em atendimento',
  waiting_client: 'Aguardando cliente',
  waiting_agent: 'Aguardando atendente',
  qualified: 'Qualificado',
  opportunity: 'Oportunidade',
  converted: 'Cliente',
  after_sale: 'Pós-venda',
  inactive: 'Inativo',
  lost: 'Perdido',
}

export const TEMPERATURE_LABELS: Record<ContactTemperature, string> = {
  cold: 'Frio',
  warm: 'Morno',
  hot: 'Quente',
  vip: 'VIP',
  risk: 'Risco',
}

export const PHONE_QUALITY_LABELS: Record<PhoneQuality, string> = {
  verified: 'Verificado',
  attention: 'Atenção',
  invalid: 'Inválido',
  no_whatsapp: 'Sem WhatsApp',
  duplicate: 'Duplicado',
  incomplete: 'Incompleto',
  international: 'Internacional',
  suspicious: 'Suspeito',
}

export const KIND_BADGE_CLASS: Record<ContactKind, string> = {
  lead: 'bg-blue-950/50 text-blue-300 border-blue-800/50',
  client: 'bg-emerald-950/50 text-emerald-300 border-emerald-800/50',
  prospect: 'bg-[var(--rz-surface-muted)] text-[var(--rz-text-secondary)] border-[var(--rz-border)]',
  partner: 'bg-purple-950/50 text-purple-300 border-purple-800/50',
  internal: 'bg-slate-800/50 text-slate-300 border-slate-600/50',
  blocked: 'bg-red-950/50 text-red-300 border-red-800/50',
}

export const PERMISSION_BADGE_CLASS: Record<SendPermission, string> = {
  opt_in_accepted: 'bg-emerald-950/40 text-emerald-300 border-emerald-700/40',
  pending: 'bg-amber-950/40 text-amber-300 border-amber-700/40',
  no_consent: 'bg-red-950/40 text-red-300 border-red-800/40',
  opt_out: 'bg-red-950/50 text-red-400 border-red-800/50',
  blocked: 'bg-red-950/60 text-red-400 border-red-700/50',
}

export const QUALITY_BADGE_CLASS: Record<PhoneQuality, string> = {
  verified: 'bg-emerald-950/40 text-emerald-300 border-emerald-700/40',
  attention: 'bg-amber-950/40 text-amber-300 border-amber-700/40',
  invalid: 'bg-red-950/40 text-red-300 border-red-800/40',
  no_whatsapp: 'bg-[var(--rz-surface-muted)] text-[var(--rz-text-muted)] border-[var(--rz-border)]',
  duplicate: 'bg-orange-950/40 text-orange-300 border-orange-800/40',
  incomplete: 'bg-red-950/40 text-red-300 border-red-800/40',
  international: 'bg-sky-950/40 text-sky-300 border-sky-800/40',
  suspicious: 'bg-red-950/50 text-red-400 border-red-800/50',
}

export const TEMPERATURE_BADGE_CLASS: Record<ContactTemperature, string> = {
  cold: 'text-sky-400/90',
  warm: 'text-amber-400/90',
  hot: 'text-orange-400/90',
  vip: 'text-brand-300',
  risk: 'text-red-400',
}

export function formatRelativeContactTime(iso?: string | Date | null): string {
  if (!iso) return '—'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const diffMs = Date.now() - t
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `há ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `há ${days} dia(s)`
  return new Date(iso).toLocaleDateString('pt-BR')
}

export function ClassificationBadge({
  label,
  className,
  title,
}: {
  label: string
  className: string
  title?: string
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium whitespace-nowrap ${className}`}
    >
      {label}
    </span>
  )
}

export const SMART_SEGMENT_PRESET_IDS = [
  'opt_in_leads',
  'active_clients',
  'hot_leads',
  'pending_consent',
  'blocked_send',
] as const

export type SmartSegmentPresetId = (typeof SMART_SEGMENT_PRESET_IDS)[number]

export function isSmartSegmentPresetId(id: string): id is SmartSegmentPresetId {
  return (SMART_SEGMENT_PRESET_IDS as readonly string[]).includes(id)
}

export function matchesSmartSegmentPreset(
  classification: ContactClassificationView | undefined,
  segmentId: string,
): boolean {
  if (!classification) return false
  switch (segmentId) {
    case 'opt_in_leads':
      return classification.kind === 'lead' && classification.permission === 'opt_in_accepted'
    case 'active_clients':
      return (
        classification.kind === 'client' &&
        classification.permission === 'opt_in_accepted' &&
        classification.commercialStatus !== 'inactive' &&
        classification.commercialStatus !== 'lost'
      )
    case 'hot_leads':
      return (
        classification.kind === 'lead' &&
        (classification.temperature === 'hot' || classification.temperature === 'warm')
      )
    case 'pending_consent':
      return classification.permission === 'pending'
    case 'blocked_send':
      return !classification.campaignSelectable
    default:
      return false
  }
}
