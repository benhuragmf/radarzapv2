import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Ticket,
  User,
  Building2,
  Clock,
  MessageSquare,
  Mail,
  Phone,
  ExternalLink,
  Users,
  StickyNote,
} from 'lucide-react'
import { Button } from '../ui/Button'
import { formatContactIdentifier } from '../../lib/destinationFormat'
import { InboxMessageBubble, formatInboxMsgTime, type InboxMessageView } from './InboxMessageBubble'
import { TicketStatusBadge, ConversationStatusBadge, ticketIsOpen } from './TicketStatusBadge'
import { InboxTicketActionsBar } from './InboxTicketActionsBar'
import { textareaCls } from '@/design-system'
import { cn } from '@/lib/utils'
import type { ContactStats, PreviousConversation } from './InboxContactSidebar'
import type { InboxTicketDetail, InboxTicketTeamMember } from '../../lib/inboxTicket'

export interface TicketConversation {
  _id: string
  contactName: string
  contactIdentifier: string
  ticketRef?: string
  status: string
  channel?: 'whatsapp' | 'webchat_site'
  departmentName?: string
  assignedUserName?: string
  createdAt?: string
  resolvedAt?: string
  acceptedAt?: string
  lastMessageAt?: string
}

export interface TicketContact {
  _id: string
  name: string
  email: string
  notes: string
  organization: string
  identifier: string
}

interface Props {
  conversation: TicketConversation
  ticket: InboxTicketDetail
  teamMembers: InboxTicketTeamMember[]
  messages: InboxMessageView[]
  contact?: TicketContact | null
  contactStats?: ContactStats
  previousConversations?: PreviousConversation[]
  onCloseTicket?: () => void
  closingTicket?: boolean
  onReopenTicket?: () => void
  reopeningTicket?: boolean
  onSendClientUpdate?: () => void
  sendingClientUpdate?: boolean
  onDeleteTicket?: () => void
  deletingTicket?: boolean
  onForward?: (payload: { targetUserId?: string; phone?: string; note?: string }) => Promise<unknown>
  forwarding?: boolean
  onAssign?: (userId: string) => Promise<unknown>
  assigning?: boolean
  onSetStatus?: (status: 'open' | 'in_progress' | 'client_replied') => Promise<unknown>
  settingStatus?: boolean
  onAddComment?: (body: string, mentionedUserIds: string[]) => Promise<unknown>
  addingComment?: boolean
  onAddInternalNote?: (body: string) => Promise<unknown>
  addingInternalNote?: boolean
}

export function InboxTicketDetailView({
  conversation: conv,
  ticket,
  teamMembers,
  messages,
  contact,
  contactStats,
  previousConversations = [],
  onCloseTicket,
  closingTicket,
  onReopenTicket,
  reopeningTicket,
  onSendClientUpdate,
  sendingClientUpdate,
  onDeleteTicket,
  deletingTicket,
  onForward,
  forwarding,
  onAssign,
  assigning,
  onSetStatus,
  settingStatus,
  onAddComment,
  addingComment,
  onAddInternalNote,
  addingInternalNote,
}: Props) {
  const ticketOpen = ticketIsOpen(ticket.status)
  const ref = ticket.ticketRef ?? conv.ticketRef ?? '—'
  const isWebChat = conv.channel === 'webchat_site' || ticket.channel === 'webchat_site'
  const [commentDraft, setCommentDraft] = useState('')
  const [noteDraft, setNoteDraft] = useState('')
  const [mentionSelection, setMentionSelection] = useState<string[]>([])

  const toggleMention = (userId: string) => {
    setMentionSelection(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId],
    )
  }

  const handleAddComment = async () => {
    const text = commentDraft.trim()
    if (!text || !onAddComment) return
    await onAddComment(text, mentionSelection)
    setCommentDraft('')
    setMentionSelection([])
  }

  const handleAddInternalNote = async () => {
    const text = noteDraft.trim()
    if (!text || !onAddInternalNote) return
    await onAddInternalNote(text)
    setNoteDraft('')
  }

  return (
    <div className="flex flex-col xl:flex-row gap-0 min-h-[520px] rounded-xl border border-[var(--rz-border)] bg-[var(--rz-surface)]/30 overflow-hidden shadow-xl shadow-black/20">
      <div className="flex-1 min-w-0 flex flex-col min-h-[360px]">
        <header className="shrink-0 px-5 py-4 border-b border-[var(--rz-border)]/80 bg-gradient-to-r from-amber-500/[0.06] via-[var(--rz-surface)]/80 to-[var(--rz-surface)]/80">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center shrink-0">
                <Ticket size={22} className="text-amber-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold font-mono text-amber-400 tracking-wide">{ref}</h2>
                  <TicketStatusBadge
                    status={ticket.status}
                    displayStatus={ticket.displayStatus}
                    teamSlaOverdue={ticket.teamSlaOverdue}
                  />
                  {ticket.unreadClientReply && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                      Nova resposta
                    </span>
                  )}
                  <ConversationStatusBadge status={conv.status} />
                </div>
                <p className="text-sm text-[var(--rz-text-primary)] mt-0.5 font-medium truncate">{conv.contactName}</p>
                <p className="text-xs text-[var(--rz-text-muted)] truncate">
                  {formatContactIdentifier(conv.contactIdentifier, conv.contactName)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Link to={`/platform/inbox?conv=${conv._id}`}>
                <Button size="sm" variant="secondary">
                  <MessageSquare size={14} /> Abrir na caixa de entrada
                </Button>
              </Link>
              {contact && (
                <Link to="/contact">
                  <Button size="sm" variant="secondary">
                    <ExternalLink size={14} /> Contatos
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {(ticket.teamSlaOverdue || ticket.teamSlaBreachedAt) && (
            <div className="mt-3 px-3 py-2 rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 text-xs flex items-center gap-2">
              <Clock size={14} className="shrink-0" />
              {ticket.teamSlaBreachedAt
                ? 'SLA interno estourado — cliente aguardando resposta da equipe.'
                : `SLA interno vence em ${formatInboxMsgTime(ticket.teamSlaDueAt!, true)} — priorize este chamado.`}
            </div>
          )}

          <div className="mt-4">
            <InboxTicketActionsBar
              ticket={ticket}
              teamMembers={teamMembers}
              clientChannel={isWebChat ? 'webchat_site' : 'whatsapp'}
              onCloseTicket={onCloseTicket}
              closingTicket={closingTicket}
              onReopenTicket={onReopenTicket}
              reopeningTicket={reopeningTicket}
              onSendClientUpdate={onSendClientUpdate}
              sendingClientUpdate={sendingClientUpdate}
              onDeleteTicket={onDeleteTicket}
              deletingTicket={deletingTicket}
              onForward={onForward}
              forwarding={forwarding}
              onAssign={onAssign}
              assigning={assigning}
              onSetStatus={onSetStatus}
              settingStatus={settingStatus}
              mentionSelection={mentionSelection}
              onMentionToggle={toggleMention}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
            {[
              { label: 'Setor', value: ticket.departmentName ?? conv.departmentName ?? '—', icon: Building2 },
              {
                label: 'Responsável',
                value: ticket.assignedUserName ?? conv.assignedUserName ?? '—',
                icon: User,
              },
              {
                label: 'Aberto em',
                value: ticket.createdAt ? formatInboxMsgTime(ticket.createdAt, false) : '—',
                icon: Clock,
              },
              { label: 'Aberto por', value: ticket.openedByUserName ?? '—', icon: Users },
              {
                label: 'SLA equipe',
                value: ticket.teamSlaBreachedAt
                  ? 'Estourado'
                  : ticket.teamSlaDueAt
                    ? formatInboxMsgTime(ticket.teamSlaDueAt, true)
                    : '—',
                icon: Clock,
              },
            ].map(item => (
              <div
                key={item.label}
                className="rounded-lg bg-[var(--rz-surface-muted)]/50 border border-[var(--rz-border)]/60 px-2.5 py-2"
              >
                <p className="text-[10px] text-[var(--rz-text-muted)] uppercase tracking-wider flex items-center gap-1">
                  <item.icon size={10} />
                  {item.label}
                </p>
                <p className="text-xs text-[var(--rz-text-secondary)] mt-0.5 truncate tabular-nums">{item.value}</p>
              </div>
            ))}
          </div>

          {ticket.status === 'closed' && ticket.closedAt && (
            <p className="text-[11px] text-[var(--rz-text-muted)] mt-3">
              Ticket fechado em {formatInboxMsgTime(ticket.closedAt, true)}
              {ticket.closedByUserName ? ` por ${ticket.closedByUserName}` : ''}
            </p>
          )}
          {conv.resolvedAt && conv.status === 'resolved' && (
            <p className="text-[11px] text-[var(--rz-text-muted)] mt-1">
              Chat WhatsApp finalizado em {formatInboxMsgTime(conv.resolvedAt, true)} — o ticket
              permanece {ticketOpen ? 'aberto para a equipe' : 'registrado no histórico'}.
            </p>
          )}
        </header>

        <section className="shrink-0 border-b border-[var(--rz-border)]/80 bg-[var(--rz-surface-muted)]/30 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="text-xs font-semibold text-[var(--rz-text-muted)] uppercase tracking-wider flex items-center gap-1.5">
              <Users size={12} /> {isWebChat ? 'Mensagens ao cliente' : 'Acompanhamento do ticket'}
            </h3>
            <span className="text-[10px] text-[var(--rz-text-muted)]">
              {isWebChat
                ? 'Visível no chamado, consulta TK+token e chat (chamado aberto)'
                : ticket.clientCanReply
                  ? 'Cliente pode responder no WhatsApp'
                  : ticket.clientReplyPaused
                    ? 'Cliente pausou respostas (enviou sair)'
                    : !ticket.teamHasMessagedClient
                      ? 'Envie a 1ª mensagem para abrir resposta do cliente'
                      : ticket.status === 'closed' && ticket.clientReplyExpiresAt
                        ? 'Prazo de resposta encerrado'
                        : 'Resposta do cliente pausada'}
            </span>
          </div>
          <p className="text-[11px] text-[var(--rz-text-muted)] mb-3">
            {isWebChat ? (
              <>
                Texto aqui vai para o cliente no chamado, no chat do site e na consulta TK+token.
                Pelo celular, use <strong className="text-[var(--rz-text-muted)]">TK-XXXX sua mensagem</strong>{' '}
                (ex.: <strong className="text-[var(--rz-text-muted)]">TK-O7WB2F Encaminhado @suporte2</strong>).
                Notas só da equipe: campo abaixo ou <strong className="text-[var(--rz-text-muted)]">!nota TK-…</strong>{' '}
                no WhatsApp. Chamado finalizado não aceita novas mensagens.
              </>
            ) : (
              <>
                Registre o acompanhamento aqui — fica só no ticket até você clicar em{' '}
                <strong className="text-[var(--rz-text-muted)]">Enviar atualização ao cliente</strong> para
                mandar o resumo no WhatsApp. Notas internas ficam só para a equipe.
              </>
            )}
          </p>

          <div className="space-y-3 max-h-[280px] overflow-y-auto mb-3">
            {ticket.comments.length === 0 && (ticket.clientReplies?.length ?? 0) === 0 ? (
              <p className="text-xs text-[var(--rz-text-muted)]">Nenhuma interação ainda.</p>
            ) : (
              [
                ...ticket.comments.map(c => ({
                  id: c._id,
                  kind: 'team' as const,
                  at: c.createdAt,
                  author: c.authorUserName,
                  body: c.body,
                  mentions: c.mentionedUserNames,
                })),
                ...(ticket.clientReplies ?? []).map(r => ({
                  id: r._id,
                  kind: 'client' as const,
                  at: r.createdAt,
                  author: conv.contactName,
                  body: r.body,
                  mentions: undefined as string[] | undefined,
                })),
              ]
                .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
                .map(entry => (
                  <div
                    key={entry.id}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      entry.kind === 'client'
                        ? 'bg-brand-500/[0.06] border-brand-500/20'
                        : 'bg-[var(--rz-surface-muted)]/60 border-[var(--rz-border)]/80'
                    }`}
                  >
                    <div className="flex justify-between gap-2 text-[10px] mb-1">
                      <span
                        className={`font-medium ${
                          entry.kind === 'client' ? 'text-brand-400' : 'text-[var(--rz-text-muted)]'
                        }`}
                      >
                        {entry.kind === 'client' ? `${entry.author} (cliente)` : entry.author}
                      </span>
                      <span className="text-[var(--rz-text-muted)] tabular-nums">
                        {formatInboxMsgTime(entry.at, true)}
                      </span>
                    </div>
                    <p className="text-[var(--rz-text-secondary)] whitespace-pre-wrap break-words">{entry.body}</p>
                    {entry.mentions && entry.mentions.length > 0 && (
                      <p className="text-[10px] text-brand-400/80 mt-1">
                        Mencionou: {entry.mentions.map(n => `@${n}`).join(', ')}
                      </p>
                    )}
                  </div>
                ))
            )}
          </div>

          {ticketOpen && onAddComment && (
            <div className="flex gap-2">
              <textarea
                value={commentDraft}
                onChange={e => setCommentDraft(e.currentTarget.value)}
                placeholder="Mensagem ao cliente (visível no chamado)…"
                rows={2}
                className={cn(textareaCls, 'flex-1 text-sm resize-none')}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault()
                    void handleAddComment()
                  }
                }}
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void handleAddComment()}
                disabled={addingComment || !commentDraft.trim()}
                className="self-end"
              >
                {addingComment ? 'Salvando…' : 'Adicionar'}
              </Button>
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-[var(--rz-border)]/60">
            <p className="text-[10px] uppercase tracking-wider text-[var(--rz-text-muted)] flex items-center gap-1 mb-2">
              <StickyNote size={10} /> Notas internas
            </p>
            <p className="text-[11px] text-[var(--rz-text-muted)] mb-3">
              Só a equipe vê — no painel ou via <strong className="text-[var(--rz-text-muted)]">!nota TK-…</strong>{' '}
              no WhatsApp (ex.: <strong className="text-[var(--rz-text-muted)]">!nota TK-ABC Cliente VIP @suporte2</strong>).
            </p>

            <div className="space-y-2 max-h-[200px] overflow-y-auto mb-3">
              {(ticket.internalNotesList?.length ?? 0) === 0 ? (
                <p className="text-xs text-[var(--rz-text-muted)]">Nenhuma nota ainda.</p>
              ) : (
                ticket.internalNotesList.map(note => (
                  <div
                    key={note._id}
                    className="rounded-lg border border-[var(--rz-border)]/80 bg-[var(--rz-surface-muted)]/50 px-3 py-2 text-sm"
                  >
                    <div className="flex justify-between gap-2 text-[10px] mb-1">
                      <span className="font-medium text-[var(--rz-text-muted)]">{note.authorUserName}</span>
                      <span className="text-[var(--rz-text-muted)] tabular-nums">
                        {formatInboxMsgTime(note.createdAt, true)}
                      </span>
                    </div>
                    <p className="text-[var(--rz-text-secondary)] whitespace-pre-wrap break-words">{note.body}</p>
                  </div>
                ))
              )}
            </div>

            {ticketOpen && onAddInternalNote ? (
              <div className="flex gap-2">
                <textarea
                  value={noteDraft}
                  onChange={e => setNoteDraft(e.currentTarget.value)}
                  placeholder="Sua nota interna…"
                  rows={2}
                  className={cn(textareaCls, 'flex-1 text-sm resize-none')}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault()
                      void handleAddInternalNote()
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void handleAddInternalNote()}
                  disabled={addingInternalNote || !noteDraft.trim()}
                  className="self-end"
                >
                  {addingInternalNote ? 'Salvando…' : 'Adicionar nota'}
                </Button>
              </div>
            ) : null}
          </div>
        </section>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3">
          <p className="text-[10px] uppercase tracking-wider text-[var(--rz-text-muted)] px-1">
            {isWebChat ? 'Histórico do chat do site' : 'Histórico WhatsApp'} · {messages.length}{' '}
            mensagem(ns)
          </p>
          {messages.length === 0 ? (
            <p className="text-center text-sm text-[var(--rz-text-muted)] py-8">Nenhuma mensagem registrada.</p>
          ) : (
            messages.map(m => <InboxMessageBubble key={m._id} message={m} />)
          )}
        </div>

        {ticketOpen && (
          <footer className="shrink-0 border-t border-[var(--rz-border)]/80 bg-[var(--rz-surface-muted)]/40 px-4 py-3 text-xs text-[var(--rz-text-muted)]">
            Respostas do cliente recebem confirmação automática com prazo de 30 min para complementos.
            Depois disso, o chamado pausa até nova atualização da equipe.
          </footer>
        )}
      </div>

      <aside className="w-full xl:w-[280px] shrink-0 border-t xl:border-t-0 xl:border-l border-[var(--rz-border)]/80 bg-[var(--rz-surface-muted)]/40 flex flex-col">
        <div className="p-4 border-b border-[var(--rz-border)]/80">
          <h3 className="text-xs font-semibold text-[var(--rz-text-secondary)] uppercase tracking-wider">Cliente</h3>
          {contact ? (
            <div className="mt-3 space-y-2 text-sm">
              <p className="font-medium text-[var(--rz-text-primary)]">{contact.name}</p>
              {contact.organization && <p className="text-xs text-[var(--rz-text-muted)]">{contact.organization}</p>}
              <p className="flex items-center gap-1.5 text-xs text-[var(--rz-text-muted)]">
                <Phone size={12} />
                {formatContactIdentifier(contact.identifier, contact.name)}
              </p>
              {contact.email && (
                <p className="flex items-center gap-1.5 text-xs text-[var(--rz-text-muted)]">
                  <Mail size={12} />
                  {contact.email}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-[var(--rz-text-muted)] mt-2">{conv.contactName}</p>
          )}

          {contactStats && (
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="rounded-lg bg-[var(--rz-surface-muted)]/60 border border-[var(--rz-border)] px-2 py-1.5 text-center">
                <p className="text-[10px] text-[var(--rz-text-muted)]">Atendimentos</p>
                <p className="text-base font-semibold text-brand-400 tabular-nums">
                  {contactStats.totalConversations}
                </p>
              </div>
              <div className="rounded-lg bg-[var(--rz-surface-muted)]/60 border border-[var(--rz-border)] px-2 py-1.5 text-center">
                <p className="text-[10px] text-[var(--rz-text-muted)]">Mensagens</p>
                <p className="text-base font-semibold text-[var(--rz-text-primary)] tabular-nums">
                  {contactStats.totalMessages}
                </p>
              </div>
            </div>
          )}
        </div>

        {previousConversations.length > 0 && (
          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            <p className="text-[10px] uppercase tracking-wider text-[var(--rz-text-muted)] mb-2">Outros atendimentos</p>
            <div className="space-y-1">
              {previousConversations.slice(0, 8).map(c => (
                <Link
                  key={c._id}
                  to={
                    c.ticketRef
                      ? `/platform/inbox/tickets/${c.ticketRef}`
                      : `/platform/inbox?conv=${c._id}`
                  }
                  className="block px-2.5 py-2 rounded-lg hover:bg-[var(--rz-surface-muted)] border border-transparent hover:border-[var(--rz-border)] text-xs"
                >
                  <div className="flex justify-between gap-2">
                    <span className="text-[var(--rz-text-muted)] tabular-nums">
                      {formatInboxMsgTime(c.createdAt, false)}
                    </span>
                    <ConversationStatusBadge status={c.status} size="sm" />
                  </div>
                  <p className="text-[var(--rz-text-muted)] mt-0.5 truncate">
                    {c.ticketRef ? (
                      <span className="font-mono text-amber-500/80">{c.ticketRef}</span>
                    ) : (
                      `${c.messageCount} msg`
                    )}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}
