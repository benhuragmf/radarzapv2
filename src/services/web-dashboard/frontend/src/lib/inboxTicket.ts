export type InboxTicketStatus = 'open' | 'in_progress' | 'client_replied' | 'closed'

export type InboxTicketDisplayStatus =
  | InboxTicketStatus
  | 'waiting_team'
  | 'waiting_client'
  | 'paused'
  | 'expired'

export const INBOX_TICKET_STATUS_LABEL: Record<InboxTicketStatus, string> = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  client_replied: 'Cliente respondeu',
  closed: 'Fechado',
}

export const INBOX_TICKET_DISPLAY_LABEL: Record<InboxTicketDisplayStatus, string> = {
  ...INBOX_TICKET_STATUS_LABEL,
  waiting_team: 'Aguardando equipe',
  waiting_client: 'Aguardando cliente',
  paused: 'Pausado',
  expired: 'Janela encerrada',
}

export interface InboxTicketComment {
  _id: string
  body: string
  createdAt: string
  authorUserName: string
  mentionedUserIds?: string[]
  mentionedUserNames?: string[]
}

export interface InboxTicketClientReply {
  _id: string
  body: string
  createdAt: string
  mediaType?: string
  mediaUrl?: string
}

export interface InboxTicketTeamMember {
  memberId: string
  userId: string | null
  displayName: string
  linked: boolean
  whatsappPhone?: string
}

export interface InboxTicketInternalNote {
  _id: string
  body: string
  createdAt: string
  authorUserName: string
}

export interface InboxTicketDetail {
  _id: string
  ticketRef: string
  status: InboxTicketStatus
  displayStatus?: InboxTicketDisplayStatus
  displayStatusLabel?: string
  subject?: string
  internalNotesList: InboxTicketInternalNote[]
  departmentName?: string
  assignedUserId?: string
  assignedUserName?: string
  openedByUserName?: string
  closedByUserName?: string
  createdAt: string
  updatedAt: string
  closedAt?: string
  comments: InboxTicketComment[]
  clientReplies: InboxTicketClientReply[]
  teamHasMessagedClient: boolean
  clientReplyPaused: boolean
  clientReplyExpiresAt?: string
  clientCanReply: boolean
  unreadClientReply: boolean
  lastClientReplyAt?: string
  lastTeamMessageAt?: string
  teamSlaDueAt?: string
  teamSlaBreachedAt?: string
  teamSlaOverdue?: boolean
  lastStatusChangeAt?: string
}

export interface InboxTicketListRow {
  _id: string
  ticketRef: string
  ticketStatus: InboxTicketStatus
  displayStatus?: InboxTicketDisplayStatus
  displayStatusLabel?: string
  teamSlaOverdue?: boolean
  teamSlaBreachedAt?: string
  unreadClientReply?: boolean
  conversationId: string
  conversationStatus?: string
  contactName: string
  contactIdentifier: string
  departmentName?: string
  assignedUserName?: string
  lastMessageAt: string
  createdAt?: string
  closedAt?: string
}

export interface InboxTicketStats {
  total: number
  open: number
  inProgress: number
  clientReplied: number
  closed: number
  slaBreached?: number
  waitingTeam?: number
}

export function ticketIsOpen(status: string): boolean {
  return status === 'open' || status === 'in_progress' || status === 'client_replied'
}

export function ticketDisplayLabel(
  displayStatus?: InboxTicketDisplayStatus,
  fallbackStatus?: string,
): string {
  if (displayStatus && INBOX_TICKET_DISPLAY_LABEL[displayStatus]) {
    return INBOX_TICKET_DISPLAY_LABEL[displayStatus]
  }
  const key = fallbackStatus as InboxTicketStatus
  return INBOX_TICKET_STATUS_LABEL[key] ?? fallbackStatus ?? '—'
}
