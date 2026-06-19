import { CheckCircle2, CircleOff, LayoutGrid, Plus } from 'lucide-react'
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
  const activeCount = widgets.filter(w => w.active).length

  return (
    <aside className="flex flex-col rounded-xl border border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/25 lg:w-64 lg:shrink-0">
      <div className="border-b border-[var(--rz-border)]/80 p-3">
        <div className="flex items-center gap-2 text-xs text-[var(--rz-text-muted)]">
          <LayoutGrid className="h-3.5 w-3.5 text-brand-400" />
          <span>
            {widgets.length} widget{widgets.length === 1 ? '' : 's'} · {activeCount} ativo
            {activeCount === 1 ? '' : 's'}
          </span>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <input
            className={inputCls + ' text-sm'}
            value={newWidgetName}
            onChange={e => onNewWidgetNameChange(e.target.value)}
            placeholder="Nome do novo widget"
          />
          <Button type="button" size="sm" onClick={onCreate} disabled={creating} className="w-full">
            <Plus className="h-4 w-4" />
            Criar widget
          </Button>
        </div>
      </div>

      <div className="flex max-h-[min(420px,50vh)] flex-col gap-0.5 overflow-y-auto p-2 lg:max-h-none lg:flex-1">
        {widgets.map(w => {
          const selected = w.id === selectedId
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => onSelect(w.id)}
              className={cn(
                'w-full rounded-lg border px-3 py-2.5 text-left transition-colors',
                selected
                  ? 'border-brand-500/40 bg-brand-500/10'
                  : 'border-transparent hover:border-[var(--rz-border)] hover:bg-[var(--rz-surface-muted)]/60',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="truncate text-sm font-medium text-[var(--rz-text-primary)]">
                  {w.name}
                </span>
                {w.active ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-label="Ativo" />
                ) : (
                  <CircleOff className="h-3.5 w-3.5 shrink-0 text-[var(--rz-text-muted)]" aria-label="Inativo" />
                )}
              </div>
              <p className="mt-0.5 truncate text-[11px] text-[var(--rz-text-muted)]">
                {w.appearance.title || 'Sem título'}
              </p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/20"
                  style={{ backgroundColor: w.appearance.primaryColor }}
                />
                <span className="truncate font-mono text-[10px] text-[var(--rz-text-muted)]">
                  {w.publicKey.slice(0, 12)}…
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
