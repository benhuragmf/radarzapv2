import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Ticket,
  History,
  UserPen,
  UserCheck,
  CheckCircle2,
  StickyNote,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { api } from '../../lib/api'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { InboxChannelBadge } from './InboxChannelBadge'
import { InboxMessageBubble, formatInboxMsgTime, type InboxMessageView } from './InboxMessageBubble'
import { LoadingState } from '@/design-system'
import { formatContactIdentifier } from '../../lib/destinationFormat'
import { textareaCls } from '@/design-system'
import { cn } from '@/lib/utils'
import type { ContactStats, PreviousConversation } from './InboxContactSidebar'
import type { InboxTicketInternalNote } from '../../lib/inboxTicket'

export interface InboxContactDetailsContact {
  _id: string
  name: string
  email: string
  notes: string
  organization: string
  identifier: string
}

export interface InboxContactDetailsConversation {
  _id: string
  channel?: string
  contactName: string
  contactIdentifier: string
  status: string
  departmentName?: string
  assignedUserName?: string
  ticketRef?: string
  createdAt?: string
  resolvedAt?: string
  acceptedAt?: string
  lastMessageAt?: string
  pageUrl?: string
  widgetName?: string
  canAccept?: boolean
  priorityForMe?: boolean
}

const STATUS_LABEL: Record<string, string> = {
  bot_triage: 'Triagem',
  waiting_queue: 'Na fila',
  in_progress: 'Em atendimento',
  transferred: 'Transferido',
  resolved: 'Finalizado',
  closed: 'Encerrado',
}

const STATUS_VARIANT: Record<string, 'yellow' | 'blue' | 'green' | 'gray' | 'red'> = {
  bot_triage: 'yellow',
  waiting_queue: 'blue',
  in_progress: 'green',
  transferred: 'yellow',
  resolved: 'gray',
  closed: 'gray',
}

interface Props {
  conversation: InboxContactDetailsConversation
  contact?: InboxContactDetailsContact | null
  contactStats?: ContactStats
  previousConversations?: PreviousConversation[]
  isWebChat: boolean
  isTerminal: boolean
  historyConvId: string | null
  onSelectHistory: (id: string | null) => void
  onEditContact?: () => void
  onAssign?: () => void
  onResolve?: () => void
  onConvertTicket?: () => void
  assignPending?: boolean
  resolvePending?: boolean
  ticketPending?: boolean
  showAccept?: boolean
  showPull?: boolean
  showAssume?: boolean
  onSaveInternalNote?: (body: string) => Promise<unknown>
  savingNote?: boolean
  className?: string
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-[var(--rz-text-muted)] shrink-0">{label}</span>
      <span className="text-[var(--rz-text-secondary)] text-right truncate">{value}</span>
    </div>
  )
}

function ContactAvatar({ name }: { name: string }) {
  const initial = (name || '?').charAt(0).toUpperCase()
  return (
    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-500/20 to-violet-500/10 border border-[var(--rz-border)] flex items-center justify-center font-semibold text-lg text-[var(--rz-text-primary)] shrink-0">
      {initial}
    </div>
  )
}

export function InboxContactDetailsPanel({
  conversation: conv,
  contact,
  contactStats,
  previousConversations = [],
  isWebChat,
  isTerminal,
  historyConvId,
  onSelectHistory,
  onEditContact,
  onAssign,
  onResolve,
  onConvertTicket,
  assignPending,
  resolvePending,
  ticketPending,
  showAccept,
  showPull,
  showAssume,
  onSaveInternalNote,
  savingNote,
  className,
}: Props) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')

  const historyId =
    historyConvId && historyConvId !== conv._id ? historyConvId : null

  const { data: historyData, isLoading: loadingHistory } = useQuery({
    queryKey: ['inbox-history', historyId],
    queryFn: () =>
      api.get<{
        messages: InboxMessageView[]
        status: string
        ticketRef?: string
        createdAt: string
      }>(`/inbox/conversations/${historyId}/history`),
    enabled: Boolean(historyId),
  })

  const { data: ticketDetail } = useQuery({
    queryKey: ['inbox-ticket-notes', conv.ticketRef],
    queryFn: () =>
      api.get<{ internalNotesList: InboxTicketInternalNote[] }>(
        `/inbox/tickets/${encodeURIComponent(conv.ticketRef!)}`,
      ),
    enabled: Boolean(conv.ticketRef),
  })

  const ticketNotes = ticketDetail?.internalNotesList ?? []
  const firstContact = previousConversations.length
    ? previousConversations[previousConversations.length - 1]?.createdAt
    : conv.createdAt

  const handleSaveNote = async () => {
    const text = noteDraft.trim()
    if (!text || !onSaveInternalNote) return
    await onSaveInternalNote(text)
    setNoteDraft('')
  }

  return (
    <aside
      className={cn(
        'w-full xl:w-[320px] shrink-0 flex flex-col border-t xl:border-t-0 xl:border-l border-[var(--rz-border)]/80 bg-[var(--rz-surface)]/40 min-h-[200px] xl:min-h-0 xl:max-h-full overflow-hidden',
        className,
      )}
    >
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4 border-b border-[var(--rz-border)]/80">
          <div className="flex items-start gap-3">
            <ContactAvatar name={conv.contactName} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm text-[var(--rz-text-primary)] truncate">{conv.contactName}</p>
              <p className="text-xs text-[var(--rz-text-muted)] mt-0.5 truncate">
                {isWebChat
                  ? conv.contactIdentifier
                  : formatContactIdentifier(conv.contactIdentifier, conv.contactName)}
              </p>
              <div className="flex flex-wrap gap-1 mt-2">
                <InboxChannelBadge channel={conv.channel} size="md" />
                {conv.ticketRef && (
                  <Link
                    to={`/platform/inbox/tickets/${conv.ticketRef}`}
                    className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded hover:bg-amber-500/20"
                  >
                    {conv.ticketRef}
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <DetailRow label="E-mail" value={contact?.email} />
            <DetailRow label="Empresa" value={contact?.organization} />
            {isWebChat && conv.widgetName && <DetailRow label="Widget" value={conv.widgetName} />}
            {isWebChat && conv.pageUrl && (
              <div className="flex justify-between gap-3 text-xs">
                <span className="text-[var(--rz-text-muted)]">Página</span>
                <a
                  href={conv.pageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-400 hover:underline truncate max-w-[160px]"
                >
                  {conv.pageUrl.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
            <DetailRow
              label="Primeiro contato"
              value={firstContact ? formatInboxMsgTime(firstContact, true) : undefined}
            />
            <DetailRow
              label="Último contato"
              value={conv.lastMessageAt ? formatInboxMsgTime(conv.lastMessageAt, true) : undefined}
            />
            <DetailRow
              label="Total conversas"
              value={contactStats ? String(contactStats.totalConversations) : undefined}
            />
          </div>

          {contact && onEditContact && (
            <Button size="sm" variant="secondary" className="w-full mt-3" onClick={onEditContact}>
              <UserPen size={14} /> Ver perfil completo
            </Button>
          )}
        </div>

        <div className="p-4 border-b border-[var(--rz-border)]/80 space-y-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--rz-text-muted)]">
            Detalhes do atendimento
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              label={STATUS_LABEL[conv.status] ?? conv.status}
              variant={STATUS_VARIANT[conv.status] ?? 'gray'}
            />
          </div>
          <DetailRow label="Setor" value={conv.departmentName} />
          <DetailRow label="Responsável" value={conv.assignedUserName ?? '—'} />
          {conv.acceptedAt && (
            <DetailRow label="Aceito em" value={formatInboxMsgTime(conv.acceptedAt, true)} />
          )}
          {conv.resolvedAt && (
            <DetailRow label="Encerrado em" value={formatInboxMsgTime(conv.resolvedAt, true)} />
          )}
        </div>

        {!isTerminal && (showAccept || showPull || showAssume || onResolve || onConvertTicket) && (
          <div className="p-4 border-b border-[var(--rz-border)]/80 space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--rz-text-muted)]">
              Ações rápidas
            </h3>
            <div className="flex flex-wrap gap-2">
              {showAccept && onAssign && (
                <Button size="sm" onClick={onAssign} disabled={assignPending} className="bg-yellow-600 hover:bg-yellow-500">
                  <UserCheck size={14} /> Aceitar
                </Button>
              )}
              {showPull && onAssign && (
                <Button size="sm" variant="secondary" onClick={onAssign} disabled={assignPending}>
                  Puxar
                </Button>
              )}
              {showAssume && onAssign && (
                <Button size="sm" variant="secondary" onClick={onAssign} disabled={assignPending}>
                  Assumir
                </Button>
              )}
              {onConvertTicket && !isWebChat && (
                <Button size="sm" variant="secondary" onClick={onConvertTicket} disabled={ticketPending}>
                  <Ticket size={14} /> Ticket
                </Button>
              )}
              {onResolve && (
                <Button size="sm" variant="secondary" onClick={onResolve} disabled={resolvePending}>
                  <CheckCircle2 size={14} /> Encerrar
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="p-4 border-b border-[var(--rz-border)]/80 space-y-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--rz-text-muted)] flex items-center gap-1.5">
            <StickyNote size={12} />
            Notas internas
          </h3>
          <p className="text-[10px] text-[var(--rz-text-muted)]">
            Visíveis só para a equipe — não são enviadas ao cliente.
          </p>

          {ticketNotes.length > 0 && (
            <ul className="space-y-2 max-h-32 overflow-y-auto">
              {ticketNotes.map(note => (
                <li
                  key={note._id}
                  className="rounded-lg bg-[var(--rz-surface-muted)]/50 border border-[var(--rz-border)]/60 px-2.5 py-2 text-xs"
                >
                  <p className="text-[var(--rz-text-secondary)] whitespace-pre-wrap">{note.body}</p>
                  <p className="text-[10px] text-[var(--rz-text-muted)] mt-1">
                    {note.authorUserName ?? 'Equipe'} · {formatInboxMsgTime(note.createdAt, true)}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {contact?.notes?.trim() && !conv.ticketRef && (
            <div className="rounded-lg bg-[var(--rz-surface-muted)]/50 border border-[var(--rz-border)]/60 px-2.5 py-2 text-xs text-[var(--rz-text-secondary)] whitespace-pre-wrap max-h-24 overflow-y-auto">
              {contact.notes}
            </div>
          )}

          {onSaveInternalNote && (
            <div className="space-y-2">
              <textarea
                value={noteDraft}
                onChange={e => setNoteDraft(e.target.value)}
                placeholder="Adicionar nota interna…"
                rows={3}
                className={cn(textareaCls, 'text-xs')}
              />
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                disabled={!noteDraft.trim() || savingNote}
                onClick={() => void handleSaveNote()}
              >
                {savingNote ? 'Salvando…' : 'Salvar nota'}
              </Button>
            </div>
          )}
        </div>

        <div className="p-4">
          <button
            type="button"
            onClick={() => setHistoryOpen(v => !v)}
            className="w-full flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[var(--rz-text-muted)]"
          >
            <span className="flex items-center gap-1.5">
              <History size={12} />
              Histórico ({previousConversations.length})
            </span>
            {historyOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {historyOpen && (
            <div className="mt-3 space-y-1 max-h-48 overflow-y-auto">
              {previousConversations.length === 0 ? (
                <p className="text-xs text-[var(--rz-text-muted)]">Primeiro atendimento deste contato.</p>
              ) : (
                previousConversations.map(c => {
                  const active = historyConvId === c._id
                  return (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => onSelectHistory(active ? null : c._id)}
                      className={cn(
                        'w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors',
                        active
                          ? 'bg-brand-500/10 border border-brand-500/30'
                          : 'hover:bg-[var(--rz-surface-muted)]/60 border border-transparent',
                      )}
                    >
                      <div className="flex justify-between gap-2">
                        <span className="text-[var(--rz-text-secondary)]">
                          {formatInboxMsgTime(c.createdAt, false)}
                        </span>
                        <span className="text-[var(--rz-text-muted)]">{STATUS_LABEL[c.status] ?? c.status}</span>
                      </div>
                      <p className="text-[var(--rz-text-muted)] mt-0.5 truncate">
                        {c.messageCount} msg{c.departmentName ? ` · ${c.departmentName}` : ''}
                      </p>
                    </button>
                  )
                })
              )}
            </div>
          )}

          {historyId && (
            <div className="mt-3 border-t border-[var(--rz-border)]/60 pt-3 max-h-56 overflow-y-auto space-y-2">
              <p className="text-[10px] text-[var(--rz-text-muted)] uppercase tracking-wider">
                Mensagens do atendimento selecionado
              </p>
              {loadingHistory ? (
                <LoadingState rows={2} className="py-2" />
              ) : (historyData?.messages ?? []).length === 0 ? (
                <p className="text-xs text-[var(--rz-text-muted)]">Sem mensagens.</p>
              ) : (
                (historyData?.messages ?? []).map(m => <InboxMessageBubble key={m._id} message={m} />)
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
