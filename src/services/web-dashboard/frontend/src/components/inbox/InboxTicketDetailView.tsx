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
import type { ContactStats, PreviousConversation } from './InboxContactSidebar'
import type { InboxTicketDetail, InboxTicketTeamMember } from '../../lib/inboxTicket'

export interface TicketConversation {
  _id: string
  contactName: string
  contactIdentifier: string
  ticketRef?: string
  status: string
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
  onAddComment,
  addingComment,
  onAddInternalNote,
  addingInternalNote,
}: Props) {
  const ticketOpen = ticketIsOpen(ticket.status)
  const ref = ticket.ticketRef ?? conv.ticketRef ?? '—'
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
    <div className="flex flex-col xl:flex-row gap-0 min-h-[520px] rounded-xl border border-gray-800 bg-gray-900/30 overflow-hidden shadow-xl shadow-black/20">
      <div className="flex-1 min-w-0 flex flex-col min-h-[360px]">
        <header className="shrink-0 px-5 py-4 border-b border-gray-800/80 bg-gradient-to-r from-amber-500/[0.06] via-gray-900/80 to-gray-900/80">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center shrink-0">
                <Ticket size={22} className="text-amber-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold font-mono text-amber-400 tracking-wide">{ref}</h2>
                  <TicketStatusBadge status={ticket.status} />
                  {ticket.unreadClientReply && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                      Nova resposta
                    </span>
                  )}
                  <ConversationStatusBadge status={conv.status} />
                </div>
                <p className="text-sm text-gray-200 mt-0.5 font-medium truncate">{conv.contactName}</p>
                <p className="text-xs text-gray-500 truncate">
                  {formatContactIdentifier(conv.contactIdentifier, conv.contactName)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Link to={`/platform/inbox?conv=${conv._id}`}>
                <Button size="sm" variant="secondary">
                  <MessageSquare size={14} /> Abrir no Inbox
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

          <div className="mt-4">
            <InboxTicketActionsBar
              ticket={ticket}
              teamMembers={teamMembers}
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
            ].map(item => (
              <div
                key={item.label}
                className="rounded-lg bg-gray-950/50 border border-gray-800/60 px-2.5 py-2"
              >
                <p className="text-[10px] text-gray-600 uppercase tracking-wider flex items-center gap-1">
                  <item.icon size={10} />
                  {item.label}
                </p>
                <p className="text-xs text-gray-300 mt-0.5 truncate tabular-nums">{item.value}</p>
              </div>
            ))}
          </div>

          {ticket.status === 'closed' && ticket.closedAt && (
            <p className="text-[11px] text-gray-500 mt-3">
              Ticket fechado em {formatInboxMsgTime(ticket.closedAt, true)}
              {ticket.closedByUserName ? ` por ${ticket.closedByUserName}` : ''}
            </p>
          )}
          {conv.resolvedAt && conv.status === 'resolved' && (
            <p className="text-[11px] text-gray-600 mt-1">
              Chat WhatsApp finalizado em {formatInboxMsgTime(conv.resolvedAt, true)} — o ticket
              permanece {ticketOpen ? 'aberto para a equipe' : 'registrado no histórico'}.
            </p>
          )}
        </header>

        <section className="shrink-0 border-b border-gray-800/80 bg-gray-950/30 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Users size={12} /> Acompanhamento do ticket
            </h3>
            <span className="text-[10px] text-gray-600">
              {ticket.clientCanReply
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
          <p className="text-[11px] text-gray-600 mb-3">
            Registre o acompanhamento aqui — fica só no ticket até você clicar em{' '}
            <strong className="text-gray-500">Enviar atualização ao cliente</strong> para mandar o
            resumo no WhatsApp. Notas internas ficam só para a equipe.
          </p>

          <div className="space-y-3 max-h-[280px] overflow-y-auto mb-3">
            {ticket.comments.length === 0 && (ticket.clientReplies?.length ?? 0) === 0 ? (
              <p className="text-xs text-gray-600">Nenhuma interação ainda.</p>
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
                        : 'bg-gray-900/60 border-gray-800/80'
                    }`}
                  >
                    <div className="flex justify-between gap-2 text-[10px] mb-1">
                      <span
                        className={`font-medium ${
                          entry.kind === 'client' ? 'text-brand-400' : 'text-gray-400'
                        }`}
                      >
                        {entry.kind === 'client' ? `${entry.author} (cliente)` : entry.author}
                      </span>
                      <span className="text-gray-600 tabular-nums">
                        {formatInboxMsgTime(entry.at, true)}
                      </span>
                    </div>
                    <p className="text-gray-300 whitespace-pre-wrap break-words">{entry.body}</p>
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
                placeholder="Adicionar informação ao acompanhamento…"
                rows={2}
                className="flex-1 text-sm bg-gray-900/80 border border-gray-800 rounded-lg px-3 py-2 text-gray-200 resize-none"
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

          <div className="mt-4 pt-3 border-t border-gray-800/60">
            <p className="text-[10px] uppercase tracking-wider text-gray-600 flex items-center gap-1 mb-2">
              <StickyNote size={10} /> Notas internas
            </p>
            <p className="text-[11px] text-gray-600 mb-3">
              Cada membro da equipe adiciona sua nota — visível só internamente, com nome e horário.
            </p>

            <div className="space-y-2 max-h-[200px] overflow-y-auto mb-3">
              {(ticket.internalNotesList?.length ?? 0) === 0 ? (
                <p className="text-xs text-gray-600">Nenhuma nota ainda.</p>
              ) : (
                ticket.internalNotesList.map(note => (
                  <div
                    key={note._id}
                    className="rounded-lg border border-gray-800/80 bg-gray-950/50 px-3 py-2 text-sm"
                  >
                    <div className="flex justify-between gap-2 text-[10px] mb-1">
                      <span className="font-medium text-gray-400">{note.authorUserName}</span>
                      <span className="text-gray-600 tabular-nums">
                        {formatInboxMsgTime(note.createdAt, true)}
                      </span>
                    </div>
                    <p className="text-gray-300 whitespace-pre-wrap break-words">{note.body}</p>
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
                  className="flex-1 text-sm bg-gray-900/80 border border-gray-800 rounded-lg px-3 py-2 text-gray-200 resize-none"
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
          <p className="text-[10px] uppercase tracking-wider text-gray-600 px-1">
            Histórico WhatsApp · {messages.length} mensagem(ns)
          </p>
          {messages.length === 0 ? (
            <p className="text-center text-sm text-gray-600 py-8">Nenhuma mensagem registrada.</p>
          ) : (
            messages.map(m => <InboxMessageBubble key={m._id} message={m} />)
          )}
        </div>

        {ticketOpen && (
          <footer className="shrink-0 border-t border-gray-800/80 bg-gray-900/40 px-4 py-3 text-xs text-gray-500">
            Respostas do cliente recebem confirmação automática com prazo de 30 min para complementos.
            Depois disso, o chamado pausa até nova atualização da equipe.
          </footer>
        )}
      </div>

      <aside className="w-full xl:w-[280px] shrink-0 border-t xl:border-t-0 xl:border-l border-gray-800/80 bg-gray-950/40 flex flex-col">
        <div className="p-4 border-b border-gray-800/80">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Cliente</h3>
          {contact ? (
            <div className="mt-3 space-y-2 text-sm">
              <p className="font-medium text-gray-100">{contact.name}</p>
              {contact.organization && <p className="text-xs text-gray-500">{contact.organization}</p>}
              <p className="flex items-center gap-1.5 text-xs text-gray-500">
                <Phone size={12} />
                {formatContactIdentifier(contact.identifier, contact.name)}
              </p>
              {contact.email && (
                <p className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Mail size={12} />
                  {contact.email}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-600 mt-2">{conv.contactName}</p>
          )}

          {contactStats && (
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="rounded-lg bg-gray-900/60 border border-gray-800 px-2 py-1.5 text-center">
                <p className="text-[10px] text-gray-600">Atendimentos</p>
                <p className="text-base font-semibold text-brand-400 tabular-nums">
                  {contactStats.totalConversations}
                </p>
              </div>
              <div className="rounded-lg bg-gray-900/60 border border-gray-800 px-2 py-1.5 text-center">
                <p className="text-[10px] text-gray-600">Mensagens</p>
                <p className="text-base font-semibold text-gray-200 tabular-nums">
                  {contactStats.totalMessages}
                </p>
              </div>
            </div>
          )}
        </div>

        {previousConversations.length > 0 && (
          <div className="flex-1 min-h-0 overflow-y-auto p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-2">Outros atendimentos</p>
            <div className="space-y-1">
              {previousConversations.slice(0, 8).map(c => (
                <Link
                  key={c._id}
                  to={
                    c.ticketRef
                      ? `/platform/inbox/tickets/${c.ticketRef}`
                      : `/platform/inbox?conv=${c._id}`
                  }
                  className="block px-2.5 py-2 rounded-lg hover:bg-gray-800/50 border border-transparent hover:border-gray-800 text-xs"
                >
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-400 tabular-nums">
                      {formatInboxMsgTime(c.createdAt, false)}
                    </span>
                    <ConversationStatusBadge status={c.status} size="sm" />
                  </div>
                  <p className="text-gray-600 mt-0.5 truncate">
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
