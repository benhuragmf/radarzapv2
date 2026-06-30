import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ExternalLink,
  Inbox,
  MessageSquare,
  User,
  UserPlus,
} from 'lucide-react'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import type { LeadCaptureListItem, LeadCaptureStatus } from '@radarchat-types/lead-form'
import {
  LEAD_KANBAN_COLUMNS,
  LEAD_ORIGIN_DISPLAY,
  LEAD_STATUS_DISPLAY,
  canQuickOpenLeadAtendimento,
  canQuickConvertLead,
  canQuickOpenLeadInbox,
  canQuickWhatsAppLead,
  formatPhoneDisplay,
  formatRelativeEntry,
  leadInboxHref,
  leadOriginBadgeVariant,
  priorityLabel,
} from '../../lib/leadUi'
import { LEAD_TEMPERATURE_VARIANT } from '@radarchat-types/lead-form'
import { cn } from '@/lib/utils'

type Props = {
  items: LeadCaptureListItem[]
  canManage: boolean
  canReply?: boolean
  selectedId: string | null
  onSelect: (id: string) => void
  onStatusChange: (id: string, status: LeadCaptureStatus) => void
  onAssume?: (id: string) => void
  onWhatsApp?: (item: LeadCaptureListItem) => void
  onConvert?: (id: string) => void
  assumingId?: string | null
  convertingId?: string | null
}

function LeadCardIndicators({ item }: { item: LeadCaptureListItem }) {
  const indicators: { icon: typeof Inbox; title: string; className: string }[] = []
  if (item.inboxConversationId || item.webchatConversationId) {
    indicators.push({
      icon: Inbox,
      title: item.webchatConversationId && !item.inboxConversationId ? 'Chat do site' : 'Inbox aberto',
      className: 'text-[var(--rz-primary)]',
    })
  }
  if (item.linkedContactName || item.destinationId) {
    indicators.push({ icon: User, title: 'Contato vinculado', className: 'text-emerald-500' })
  }
  if (item.possibleDuplicate) {
    indicators.push({ icon: AlertTriangle, title: 'Possível duplicado', className: 'text-amber-500' })
  }
  if (!item.assignedUserName && item.status !== 'converted') {
    indicators.push({ icon: User, title: 'Sem responsável', className: 'text-[var(--rz-text-muted)]' })
  }
  if (!indicators.length) return null
  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      {indicators.map((ind, i) => {
        const Icon = ind.icon
        return (
          <span key={i} title={ind.title} className={cn('inline-flex', ind.className)}>
            <Icon size={12} aria-hidden />
          </span>
        )
      })}
    </div>
  )
}

export function LeadKanbanBoard({
  items,
  canManage,
  canReply,
  selectedId,
  onSelect,
  onStatusChange,
  onAssume,
  onWhatsApp,
  onConvert,
  assumingId,
  convertingId,
}: Props) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)

  const byColumn = useMemo(() => {
    const map = Object.fromEntries(LEAD_KANBAN_COLUMNS.map(c => [c.key, [] as LeadCaptureListItem[]])) as Record<
      string,
      LeadCaptureListItem[]
    >
    for (const item of items) {
      const col = LEAD_KANBAN_COLUMNS.find(c => c.statuses.includes(item.status)) ?? LEAD_KANBAN_COLUMNS[0]
      map[col.key].push(item)
    }
    return map
  }, [items])

  return (
    <div className="flex gap-2 h-full min-h-0 overflow-x-auto pb-1">
      {LEAD_KANBAN_COLUMNS.map(col => {
        const dropStatus = col.statuses[0]
        const count = byColumn[col.key].length
        return (
          <div
            key={col.key}
            className={cn(
              'flex flex-col min-w-[188px] flex-1 max-w-[280px] shrink-0 rounded-xl border',
              overCol === col.key
                ? 'border-[var(--rz-primary)] bg-[var(--rz-primary)]/5'
                : 'border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/10',
            )}
            onDragOver={e => {
              if (!canManage || !dragId) return
              e.preventDefault()
              setOverCol(col.key)
            }}
            onDragLeave={() => setOverCol(null)}
            onDrop={e => {
              e.preventDefault()
              setOverCol(null)
              if (dragId && canManage) onStatusChange(dragId, dropStatus)
              setDragId(null)
            }}
          >
            <div className="shrink-0 px-3 py-2.5 border-b border-[var(--rz-border)] flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[var(--rz-text-secondary)] truncate">{col.label}</p>
              <span
                className={cn(
                  'text-[10px] tabular-nums font-medium px-1.5 py-0.5 rounded-full',
                  count > 0
                    ? 'bg-[var(--rz-primary)]/15 text-[var(--rz-primary)]'
                    : 'bg-[var(--rz-surface-muted)] text-[var(--rz-text-muted)]',
                )}
              >
                {count}
              </span>
            </div>
            <ul className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
              {count === 0 ? (
                <li className="flex flex-col items-center justify-center text-center py-8 px-2">
                  <Inbox size={18} className="text-[var(--rz-text-muted)]/50 mb-2" aria-hidden />
                  <p className="text-[11px] text-[var(--rz-text-muted)] leading-snug">{col.emptyLabel}</p>
                </li>
              ) : (
                byColumn[col.key].map(item => {
                  const showOpen = Boolean(canReply && onAssume && canQuickOpenLeadAtendimento(item))
                  const showWhatsApp = Boolean(canReply && onWhatsApp && canQuickWhatsAppLead(item))
                  const showConvert = Boolean(canManage && onConvert && canQuickConvertLead(item))
                  const showInbox = Boolean(canReply && canQuickOpenLeadInbox(item))
                  const inboxHref = leadInboxHref(item)
                  const showActions = showOpen || showWhatsApp || showConvert || showInbox
                  const assuming = assumingId === item.id
                  const converting = convertingId === item.id
                  return (
                    <li key={item.id} className="group relative">
                      <button
                        type="button"
                        draggable={canManage}
                        onDragStart={() => setDragId(item.id)}
                        onDragEnd={() => {
                          setDragId(null)
                          setOverCol(null)
                        }}
                        onClick={() => onSelect(item.id)}
                        className={cn(
                          'w-full text-left rounded-xl border px-3 py-2.5 transition-all cursor-grab active:cursor-grabbing',
                          selectedId === item.id
                            ? 'border-[var(--rz-primary)] bg-[var(--rz-primary)]/10 ring-1 ring-[var(--rz-primary)]/30'
                            : 'border-[var(--rz-border)] hover:border-[var(--rz-primary)]/40 bg-[var(--rz-surface)] hover:shadow-sm',
                          dragId === item.id && 'opacity-50',
                          showActions && 'pb-9',
                        )}
                      >
                        <p className="font-semibold truncate text-[13px] text-[var(--rz-text-primary)]">{item.name}</p>
                        <p className="text-[11px] text-[var(--rz-text-muted)] truncate mt-0.5">
                          {formatPhoneDisplay(item.phone)}
                        </p>
                        <p className="text-[10px] text-[var(--rz-text-muted)] mt-1 truncate">
                          {LEAD_ORIGIN_DISPLAY[item.origin]} · {formatRelativeEntry(item.createdAt)}
                        </p>
                        {item.message && (
                          <p className="text-[10px] text-[var(--rz-text-secondary)] mt-1 line-clamp-2 leading-snug">
                            {item.message}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-1 mt-2">
                          <Badge
                            label={LEAD_ORIGIN_DISPLAY[item.origin]}
                            variant={leadOriginBadgeVariant(item.origin)}
                          />
                          {item.temperature && (
                            <Badge
                              label={priorityLabel(item.temperature)}
                              variant={LEAD_TEMPERATURE_VARIANT[item.temperature]}
                            />
                          )}
                          {item.consentAccepted === true && <Badge label="Opt-in" variant="green" />}
                          {item.consentAccepted === false && <Badge label="Pendente" variant="yellow" />}
                        </div>
                        <LeadCardIndicators item={item} />
                      </button>
                      {showActions && (
                        <div className="absolute bottom-1.5 left-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                          {showOpen && (
                            <Button
                              size="sm"
                              className="h-7 flex-1 px-1.5 text-[10px] min-w-0"
                              disabled={assuming}
                              onClick={e => {
                                e.stopPropagation()
                                onAssume?.(item.id)
                              }}
                            >
                              {assuming ? '…' : 'Abrir'}
                            </Button>
                          )}
                          {showWhatsApp && (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-7 px-2 text-[10px] shrink-0"
                              title="WhatsApp"
                              onClick={e => {
                                e.stopPropagation()
                                onWhatsApp?.(item)
                              }}
                            >
                              <MessageSquare size={12} />
                            </Button>
                          )}
                          {showConvert && (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-7 px-2 text-[10px] shrink-0"
                              title="Salvar como contato"
                              disabled={converting}
                              onClick={e => {
                                e.stopPropagation()
                                onConvert?.(item.id)
                              }}
                            >
                              <UserPlus size={12} />
                            </Button>
                          )}
                          {showInbox && inboxHref && (
                            <Link
                              to={inboxHref}
                              title="Abrir Inbox"
                              className="inline-flex h-7 items-center justify-center px-2 rounded-md border border-[var(--rz-border)] bg-[var(--rz-surface)] hover:bg-[var(--rz-surface-muted)] shrink-0"
                              onClick={e => e.stopPropagation()}
                            >
                              <ExternalLink size={12} />
                            </Link>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })
              )}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

export { LEAD_STATUS_DISPLAY }
