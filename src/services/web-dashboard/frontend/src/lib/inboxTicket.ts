export type InboxTicketStatus = 'open' | 'in_progress' | 'client_replied' | 'closed'

export const INBOX_TICKET_STATUS_LABEL: Record<InboxTicketStatus, string> = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  client_replied: 'Cliente respondeu',
  closed: 'Fechado',
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
}

export interface InboxTicketListRow {
  _id: string
  ticketRef: string
  ticketStatus: InboxTicketStatus
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
}

/** Ticket aberto para ações da equipe (não finalizado) */
export function ticketIsOpen(status: string) {
  return status === 'open' || status === 'in_progress' || status === 'client_replied'
}
