import { useMemo, useState } from 'react'
import { Badge } from '../ui/Badge'
import type { LeadCaptureListItem, LeadCaptureStatus } from '@radarzap-types/lead-form'
import {
  LEAD_CAPTURE_ORIGIN_LABEL,
  LEAD_CAPTURE_STATUS_LABEL,
  LEAD_TEMPERATURE_LABEL,
  LEAD_TEMPERATURE_VARIANT,
} from '@radarzap-types/lead-form'

const KANBAN_COLUMNS: LeadCaptureStatus[] = ['new', 'in_progress', 'qualified', 'converted', 'lost']

type Props = {
  items: LeadCaptureListItem[]
  canManage: boolean
  selectedId: string | null
  onSelect: (id: string) => void
  onStatusChange: (id: string, status: LeadCaptureStatus) => void
}

function shortTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function LeadKanbanBoard({ items, canManage, selectedId, onSelect, onStatusChange }: Props) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<LeadCaptureStatus | null>(null)

  const byStatus = useMemo(() => {
    const map = Object.fromEntries(KANBAN_COLUMNS.map(s => [s, [] as LeadCaptureListItem[]])) as Record<
      LeadCaptureStatus,
      LeadCaptureListItem[]
    >
    for (const item of items) {
      const col = KANBAN_COLUMNS.includes(item.status) ? item.status : 'new'
      map[col].push(item)
    }
    return map
  }, [items])

  return (
    <div className="flex gap-2 h-full min-h-0 overflow-x-auto pb-1">
      {KANBAN_COLUMNS.map(status => (
        <div
          key={status}
          className={`flex flex-col min-w-[168px] w-[19%] max-w-[220px] shrink-0 rounded-lg border ${
            overCol === status ? 'border-[var(--rz-primary)] bg-[var(--rz-primary)]/5' : 'border-[var(--rz-border)]'
          } bg-[var(--rz-surface-muted)]/20`}
          onDragOver={e => {
            if (!canManage || !dragId) return
            e.preventDefault()
            setOverCol(status)
          }}
          onDragLeave={() => setOverCol(null)}
          onDrop={e => {
            e.preventDefault()
            setOverCol(null)
            if (dragId && canManage) onStatusChange(dragId, status)
            setDragId(null)
          }}
        >
          <div className="shrink-0 px-2.5 py-2 border-b border-[var(--rz-border)] flex items-center justify-between gap-1">
            <p className="text-[11px] font-semibold truncate">{LEAD_CAPTURE_STATUS_LABEL[status]}</p>
            <span className="text-[10px] tabular-nums text-[var(--rz-text-muted)] bg-[var(--rz-surface)] rounded px-1.5 py-0.5">
              {byStatus[status].length}
            </span>
          </div>
          <ul className="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-1.5">
            {byStatus[status].length === 0 ? (
              <li className="text-[10px] text-center text-[var(--rz-text-muted)] py-6 px-1">Vazio</li>
            ) : (
              byStatus[status].map(item => (
                <li key={item.id}>
                  <button
                    type="button"
                    draggable={canManage}
                    onDragStart={() => setDragId(item.id)}
                    onDragEnd={() => {
                      setDragId(null)
                      setOverCol(null)
                    }}
                    onClick={() => onSelect(item.id)}
                    className={`w-full text-left rounded-md border px-2 py-2 text-xs transition-colors cursor-grab active:cursor-grabbing ${
                      selectedId === item.id
                        ? 'border-[var(--rz-primary)] bg-[var(--rz-primary)]/10 ring-1 ring-[var(--rz-primary)]/30'
                        : 'border-[var(--rz-border)] hover:border-[var(--rz-primary)]/40 bg-[var(--rz-surface)]'
                    } ${dragId === item.id ? 'opacity-50' : ''}`}
                  >
                    <p className="font-medium truncate text-[13px]">{item.name}</p>
                    <p className="text-[10px] text-[var(--rz-text-muted)] truncate mt-0.5">
                      {item.phone.startsWith('email:') ? item.email : item.phone}
                    </p>
                    <p className="text-[9px] text-[var(--rz-text-muted)] mt-0.5 truncate">
                      {LEAD_CAPTURE_ORIGIN_LABEL[item.origin]} · {shortTime(item.createdAt)}
                    </p>
                    <div className="flex flex-wrap gap-0.5 mt-1.5">
                      {item.temperature && (
                        <Badge label={LEAD_TEMPERATURE_LABEL[item.temperature]} variant={LEAD_TEMPERATURE_VARIANT[item.temperature]} />
                      )}
                      {item.contactGroupNames?.slice(0, 1).map(n => (
                        <Badge key={n} label={n} variant="purple" />
                      ))}
                      {item.possibleDuplicate && <Badge label="Dup." variant="yellow" />}
                      {item.consentAccepted === true && <Badge label="LGPD" variant="green" />}
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ))}
    </div>
  )
}
