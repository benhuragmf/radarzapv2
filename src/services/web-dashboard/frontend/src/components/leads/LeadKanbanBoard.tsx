import { useMemo, useState } from 'react'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import type { LeadCaptureListItem, LeadCaptureStatus } from '@radarzap-types/lead-form'
import {
  LEAD_KANBAN_COLUMNS,
  LEAD_ORIGIN_DISPLAY,
  LEAD_STATUS_DISPLAY,
  canQuickAssumeLead,
  formatPhoneDisplay,
  formatRelativeEntry,
  leadOriginBadgeVariant,
  priorityLabel,
} from '../../lib/leadUi'
import { LEAD_TEMPERATURE_VARIANT } from '@radarzap-types/lead-form'

type Props = {
  items: LeadCaptureListItem[]
  canManage: boolean
  canReply?: boolean
  selectedId: string | null
  onSelect: (id: string) => void
  onStatusChange: (id: string, status: LeadCaptureStatus) => void
  onAssume?: (id: string) => void
  assumingId?: string | null
}

export function LeadKanbanBoard({
  items,
  canManage,
  canReply,
  selectedId,
  onSelect,
  onStatusChange,
  onAssume,
  assumingId,
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
    <div className="flex gap-1.5 h-full min-h-0 overflow-x-auto pb-0.5">
      {LEAD_KANBAN_COLUMNS.map(col => {
        const dropStatus = col.statuses[0]
        return (
          <div
            key={col.key}
            className={`flex flex-col min-w-[150px] w-[16.5%] max-w-[200px] shrink-0 rounded-md border ${
              overCol === col.key ? 'border-[var(--rz-primary)] bg-[var(--rz-primary)]/5' : 'border-[var(--rz-border)]'
            } bg-[var(--rz-surface-muted)]/15`}
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
            <div className="shrink-0 px-2 py-1.5 border-b border-[var(--rz-border)] flex items-center justify-between">
              <p className="text-[10px] font-semibold truncate">{col.label}</p>
              <span className="text-[9px] tabular-nums text-[var(--rz-text-muted)]">{byColumn[col.key].length}</span>
            </div>
            <ul className="flex-1 min-h-0 overflow-y-auto p-1 space-y-1">
              {byColumn[col.key].length === 0 ? (
                <li className="text-[9px] text-center text-[var(--rz-text-muted)] py-4 px-1 leading-snug">
                  {col.emptyLabel}
                </li>
              ) : (
                byColumn[col.key].map(item => {
                  const showAssume = Boolean(canReply && onAssume && canQuickAssumeLead(item))
                  const assuming = assumingId === item.id
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
                        className={`w-full text-left rounded-md border px-2 py-1.5 transition-colors cursor-grab active:cursor-grabbing ${
                          selectedId === item.id
                            ? 'border-[var(--rz-primary)] bg-[var(--rz-primary)]/10 ring-1 ring-[var(--rz-primary)]/25'
                            : 'border-[var(--rz-border)] hover:border-[var(--rz-primary)]/35 bg-[var(--rz-surface)]'
                        } ${dragId === item.id ? 'opacity-50' : ''} ${showAssume ? 'pr-14' : ''}`}
                      >
                        <p className="font-medium truncate text-[12px]">{item.name}</p>
                        <p className="text-[10px] text-[var(--rz-text-muted)] truncate">
                          {formatPhoneDisplay(item.phone)}
                        </p>
                        <p className="text-[9px] text-[var(--rz-text-muted)] mt-0.5 truncate">
                          {LEAD_ORIGIN_DISPLAY[item.origin]} · {formatRelativeEntry(item.createdAt)}
                        </p>
                        <div className="flex flex-wrap gap-0.5 mt-1">
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
                          {!item.assignedUserName && item.status !== 'converted' && (
                            <Badge label="Sem resp." variant="gray" />
                          )}
                          {item.linkedContactName && <Badge label="Contato" variant="green" />}
                          {item.inboxConversationId && <Badge label="Inbox" variant="blue" />}
                          {item.webchatConversationId && !item.inboxConversationId && (
                            <Badge label="Chat site" variant="blue" />
                          )}
                          {item.possibleDuplicate && <Badge label="Dup." variant="yellow" />}
                        </div>
                      </button>
                      {showAssume && (
                        <Button
                          size="sm"
                          className="absolute top-1 right-1 h-6 px-1.5 text-[9px] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shadow-sm"
                          disabled={assuming}
                          onClick={e => {
                            e.stopPropagation()
                            onAssume?.(item.id)
                          }}
                        >
                          {assuming ? '…' : 'Assumir'}
                        </Button>
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
