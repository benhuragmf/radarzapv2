import { useState } from 'react'
import { CheckCircle2, CircleOff, Plus, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { inputCls } from '@/design-system'
import { cn } from '@/lib/utils'

export type WebChatWidgetListItem = {
  id: string
  name: string
  active: boolean
  publicKey: string
  appearance: { title: string; primaryColor: string }
}

type Props = {
  widgets: WebChatWidgetListItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  newWidgetName: string
  onNewWidgetNameChange: (name: string) => void
  onCreate: () => void
  creating?: boolean
}

export function WebChatWidgetList({
  widgets,
  selectedId,
  onSelect,
  newWidgetName,
  onNewWidgetNameChange,
  onCreate,
  creating,
}: Props) {
  const [createOpen, setCreateOpen] = useState(false)
  const activeCount = widgets.filter(w => w.active).length

  const handleCreate = () => {
    if (!newWidgetName.trim()) return
    onCreate()
    setCreateOpen(false)
    onNewWidgetNameChange('')
  }

  return (
    <div className="border-b border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/20 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--rz-text-muted)] shrink-0">
          Widgets
        </span>
        <span className="hidden h-4 w-px bg-[var(--rz-border)] sm:block" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {widgets.map(w => {
            const selected = w.id === selectedId
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => onSelect(w.id)}
                className={cn(
                  'inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-left text-xs font-medium transition-colors',
                  selected
                    ? 'border-brand-500/45 bg-brand-500/12 text-brand-200 shadow-sm shadow-brand-500/10'
                    : 'border-[var(--rz-border)]/90 bg-[var(--rz-surface)]/50 text-[var(--rz-text-secondary)] hover:border-[var(--rz-border)] hover:bg-[var(--rz-surface-muted)]/60',
                )}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/15"
                  style={{ backgroundColor: w.appearance.primaryColor }}
                  aria-hidden
                />
                <span className="truncate">{w.name}</span>
                {w.active ? (
                  <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" aria-label="Ativo" />
                ) : (
                  <CircleOff className="h-3 w-3 shrink-0 text-[var(--rz-text-muted)]" aria-label="Inativo" />
                )}
              </button>
            )
          })}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[10px] text-[var(--rz-text-muted)] tabular-nums">
            {activeCount}/{widgets.length} ativo{activeCount === 1 ? '' : 's'}
          </span>
          {!createOpen ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setCreateOpen(true)}
              className="h-8"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo
            </Button>
          ) : (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                className={cn(inputCls, 'h-8 w-36 text-xs sm:w-44')}
                value={newWidgetName}
                onChange={e => onNewWidgetNameChange(e.target.value)}
                placeholder="Ex.: Site principal"
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreate()
                  if (e.key === 'Escape') setCreateOpen(false)
                }}
              />
              <Button type="button" size="sm" onClick={handleCreate} disabled={creating || !newWidgetName.trim()}>
                Criar
              </Button>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg p-1.5 text-[var(--rz-text-muted)] hover:bg-[var(--rz-surface-muted)] hover:text-[var(--rz-text-primary)]"
                aria-label="Cancelar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
