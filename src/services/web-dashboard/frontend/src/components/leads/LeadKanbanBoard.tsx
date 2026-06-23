import { useMemo, useState } from 'react'
import { Badge } from '../ui/Badge'
import type { LeadCaptureListItem, LeadCaptureStatus } from '@radarzap-types/lead-form'
import { LEAD_CAPTURE_STATUS_LABEL } from '@radarzap-types/lead-form'

const KANBAN_COLUMNS: LeadCaptureStatus[] = ['new', 'in_progress', 'qualified', 'converted', 'lost']

type Props = {
  items: LeadCaptureListItem[]
  canManage: boolean
  selectedId: string | null
  onSelect: (id: string) => void
  onStatusChange: (id: string, status: LeadCaptureStatus) => void
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
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 mb-4 overflow-x-auto">
      {KANBAN_COLUMNS.map(status => (
        <div
          key={status}
          className={`rounded-lg border min-h-[200px] flex flex-col ${
            overCol === status ? 'border-[var(--rz-primary)] bg-[var(--rz-primary)]/5' : 'border-[var(--rz-border)]'
          }`}
          onDragOver={e => {
            if (!canManage || !dragId) return
            e.preventDefault()
            setOverCol(status)
          }}
          onDragLeave={() => setOverCol(null)}
          onDrop={e => {
            e.preventDefault()
            setOverCol(null)
            if (dragId && canManage) {
              onStatusChange(dragId, status)
            }
            setDragId(null)
          }}
        >
          <div className="px-3 py-2 border-b border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/50">
            <p className="text-xs font-semibold">{LEAD_CAPTURE_STATUS_LABEL[status]}</p>
            <p className="text-[10px] text-[var(--rz-text-muted)]">{byStatus[status].length} lead(s)</p>
          </div>
          <ul className="p-2 space-y-2 flex-1">
            {byStatus[status].map(item => (
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
                  className={`w-full text-left rounded-lg border p-2.5 text-sm transition-colors cursor-grab active:cursor-grabbing ${
                    selectedId === item.id
                      ? 'border-[var(--rz-primary)] bg-[var(--rz-primary)]/10'
                      : 'border-[var(--rz-border)] hover:border-[var(--rz-primary)]/40 bg-[var(--rz-surface)]'
                  } ${dragId === item.id ? 'opacity-50' : ''}`}
                >
                  <p className="font-medium truncate">{item.name}</p>
                  <p className="text-[10px] text-[var(--rz-text-muted)] truncate">
                    {item.phone.startsWith('email:') ? item.email : item.phone}
                  </p>
                  {item.possibleDuplicate && (
                    <Badge label="Duplicado?" variant="yellow" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
