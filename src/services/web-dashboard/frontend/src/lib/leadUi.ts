import type { LeadCaptureListItem, LeadCaptureOrigin, LeadCaptureStatus, LeadStats } from '@radarchat-types/lead-form'
import { LEAD_CAPTURE_STATUS_LABEL, LEAD_TEMPERATURE_LABEL } from '@radarchat-types/lead-form'

/** Rótulos amigáveis para atendentes (não técnicos). */
export const SITE_FORM_ORIGINS: LeadCaptureOrigin[] = ['site', 'widget', 'wordpress', 'webchat', 'api']

export const LEAD_ORIGIN_DISPLAY: Record<LeadCaptureOrigin, string> = {
  site: 'Site',
  widget: 'Formulário embed',
  wordpress: 'WordPress',
  api: 'API',
  whatsapp: 'WhatsApp',
  webchat: 'Chat do site',
  manual: 'Manual',
  import: 'Importação',
  campaign: 'Campanha',
}

export const LEAD_STATUS_DISPLAY: Record<LeadCaptureStatus, string> = {
  new: 'Novo',
  in_review: 'Aguardando',
  in_progress: 'Em atendimento',
  qualified: 'Qualificado',
  converted: 'Convertido',
  lost: 'Perdido',
  spam: 'Spam',
}

export type KanbanColumnDef = {
  key: string
  label: string
  emptyLabel: string
  statuses: LeadCaptureStatus[]
}

export const LEAD_KANBAN_COLUMNS: KanbanColumnDef[] = [
  { key: 'new', label: 'Novo lead', emptyLabel: 'Nenhum lead novo', statuses: ['new'] },
  { key: 'waiting', label: 'Tentando contato', emptyLabel: 'Ninguém aguardando', statuses: ['in_review'] },
  { key: 'in_progress', label: 'Em atendimento', emptyLabel: 'Nenhum em atendimento', statuses: ['in_progress'] },
  { key: 'qualified', label: 'Qualificado', emptyLabel: 'Nenhum qualificado', statuses: ['qualified'] },
  { key: 'converted', label: 'Fechado / Ganho', emptyLabel: 'Nenhum convertido', statuses: ['converted'] },
  { key: 'lost', label: 'Perdido', emptyLabel: 'Nenhum perdido', statuses: ['lost', 'spam'] },
]

export function leadOriginBadgeVariant(origin: LeadCaptureOrigin): 'green' | 'blue' | 'purple' | 'yellow' | 'gray' {
  if (origin === 'whatsapp') return 'green'
  if (origin === 'webchat') return 'blue'
  if (origin === 'site' || origin === 'widget' || origin === 'wordpress') return 'purple'
  return 'gray'
}

export function formatRelativeEntry(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  return `há ${d}d`
}

export function formatPhoneDisplay(phone: string): string {
  if (phone.startsWith('email:')) return '—'
  const digits = phone.replace(/\D/g, '')
  if (digits.length >= 12 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4)
    const rest = digits.slice(4)
    const p1 = rest.length > 4 ? rest.slice(0, rest.length - 4) : rest
    const p2 = rest.length > 4 ? rest.slice(-4) : ''
    return `+55 ${ddd} ${p1}${p2 ? `-${p2}` : ''}`.trim()
  }
  return phone
}

export type RecommendedAction = {
  title: string
  description: string
  primaryLabel: string
  kind: 'open-inbox' | 'inbox' | 'convert' | 'view-contact' | 'link' | 'follow-up'
}

export function hasLiveInboxConversation(item: LeadCaptureListItem): boolean {
  if (item.webchatConversationId) return true
  if (!item.inboxConversationId) return false
  return item.inboxConversationActive !== false
}

export function getRecommendedAction(item: LeadCaptureListItem): RecommendedAction {
  if (item.possibleDuplicate && !item.destinationId) {
    return {
      kind: 'link',
      title: 'Contato parecido encontrado',
      description: 'Vincule ao contato existente para não duplicar a base.',
      primaryLabel: 'Vincular contato',
    }
  }
  if (item.status === 'converted' && item.destinationId) {
    return {
      kind: 'view-contact',
      title: 'Lead já convertido',
      description: 'Este lead já virou contato na base.',
      primaryLabel: 'Ver contato',
    }
  }
  if (hasLiveInboxConversation(item)) {
    return {
      kind: 'inbox',
      title: 'Atendimento em andamento',
      description: item.assignedUserName
        ? `Responsável: ${item.assignedUserName}`
        : item.webchatConversationId
          ? 'Conversa aberta no Chat do site.'
          : 'Existe conversa aberta no Inbox.',
      primaryLabel: 'Abrir atendimento',
    }
  }
  if (item.inboxConversationId && item.inboxConversationActive === false) {
    return {
      kind: 'open-inbox',
      title: 'Conversa encerrada',
      description: 'A conversa anterior foi finalizada. Abra um novo atendimento para retomar o contato.',
      primaryLabel: 'Retomar atendimento',
    }
  }
  if (item.status === 'qualified') {
    return {
      kind: 'convert',
      title: 'Lead qualificado',
      description: 'Salve como contato para acompanhar depois.',
      primaryLabel: 'Salvar como contato',
    }
  }
  if (item.status === 'in_progress') {
    return {
      kind: 'follow-up',
      title: 'Em triagem',
      description: 'Retome o contato ou abra a conversa no Inbox.',
      primaryLabel: 'Abrir atendimento',
    }
  }
  if (!item.destinationId) {
    return {
      kind: 'open-inbox',
      title: 'Entrada nova',
      description: `${LEAD_ORIGIN_DISPLAY[item.origin]} · cria a conversa no Inbox ao abrir.`,
      primaryLabel: 'Abrir atendimento',
    }
  }
  return {
    kind: 'open-inbox',
    title: 'Pronto para atendimento',
    description: 'Contato vinculado — cria ou abre a conversa no Inbox.',
    primaryLabel: 'Abrir atendimento',
  }
}

export function getInboxStateLabel(item: LeadCaptureListItem): string {
  if (item.inboxConversationId && item.inboxConversationActive === false) {
    return 'Conversa encerrada — retome o atendimento para enviar mensagens'
  }
  if (hasLiveInboxConversation(item)) {
    return item.assignedUserName
      ? `Em atendimento com ${item.assignedUserName}`
      : item.webchatConversationId
        ? 'Chat do site aberto'
        : 'Atendimento aberto'
  }
  if (item.status === 'in_progress') return 'Aguardando atendente'
  return 'Sem atendimento aberto'
}

export function getContactStateLabel(item: LeadCaptureListItem): string {
  if (item.linkedContactName) return `Contato vinculado: ${item.linkedContactName}`
  if (item.possibleDuplicate) return 'Possível contato existente'
  if (item.destinationId) return 'Contato vinculado'
  return 'Sem contato vinculado'
}

export type OperationalStatKey =
  | 'newOpen'
  | 'whatsappWaiting'
  | 'siteWaiting'
  | 'inProgress'
  | 'convertedToday'
  | 'unassigned'

export function canQuickOpenLeadAtendimento(item: LeadCaptureListItem): boolean {
  if (item.status === 'converted' || item.status === 'lost' || item.status === 'spam') return false
  if (item.inboxConversationId || item.webchatConversationId) return false
  return ['new', 'in_review', 'qualified', 'in_progress'].includes(item.status)
}

/** @deprecated use canQuickOpenLeadAtendimento */
export function canQuickAssumeLead(item: LeadCaptureListItem): boolean {
  return canQuickOpenLeadAtendimento(item)
}

export function canQuickWhatsAppLead(item: LeadCaptureListItem): boolean {
  return !item.phone.startsWith('email:')
}

export function canQuickConvertLead(item: LeadCaptureListItem): boolean {
  if (item.status === 'converted' || item.status === 'lost' || item.status === 'spam') return false
  return !item.destinationId
}

/** Deep link Inbox unificado (WhatsApp ou WebChat). */
export function leadInboxHref(item: LeadCaptureListItem): string | null {
  if (!hasLiveInboxConversation(item)) return null
  if (item.inboxConversationId) {
    return `/platform/inbox?conv=${encodeURIComponent(item.inboxConversationId)}`
  }
  if (item.webchatConversationId) {
    return `/platform/inbox?conv=${encodeURIComponent(`wc:${item.webchatConversationId}`)}`
  }
  return null
}

export function canQuickOpenLeadInbox(item: LeadCaptureListItem): boolean {
  if (!leadInboxHref(item)) return false
  if (item.status === 'converted' || item.status === 'lost' || item.status === 'spam') return false
  return !canQuickOpenLeadAtendimento(item)
}

export function operationalStatCards(stats: LeadStats | undefined) {
  if (!stats) return []
  const op = stats.operational
  return [
    { key: 'newOpen' as const, label: 'Novos', value: op?.newOpen ?? stats.byStatus.new + stats.byStatus.in_review },
    { key: 'whatsappWaiting' as const, label: 'WhatsApp aguardando', value: op?.whatsappWaiting ?? 0 },
    { key: 'siteWaiting' as const, label: 'Site / Formulários', value: op?.siteWaiting ?? 0 },
    { key: 'inProgress' as const, label: 'Em atendimento', value: stats.inProgress },
    { key: 'convertedToday' as const, label: 'Convertidos hoje', value: op?.convertedToday ?? 0 },
    { key: 'unassigned' as const, label: 'Sem responsável', value: op?.unassigned ?? 0 },
  ]
}

export function priorityLabel(temp?: LeadCaptureListItem['temperature']) {
  if (!temp) return 'Sem prioridade'
  return LEAD_TEMPERATURE_LABEL[temp]
}

export function statusDisplay(status: LeadCaptureStatus) {
  return LEAD_STATUS_DISPLAY[status] ?? LEAD_CAPTURE_STATUS_LABEL[status]
}
