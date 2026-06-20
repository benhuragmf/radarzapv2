import { useState } from 'react'
import { ExternalLink, Gem, Lock, Palette } from 'lucide-react'
import { Button } from '../../ui/Button'
import { Badge } from '../../ui/Badge'
import { cn } from '@/lib/utils'
import type { ChatBoxModel } from '@/lib/chatBoxModels'
import { ChatBoxPreview } from './ChatBoxPreview'
import { ChatBoxModelModal } from './ChatBoxModelModal'

type Props = {
  model: ChatBoxModel
  active: boolean
  locked?: boolean
  onApply?: (model: ChatBoxModel) => void
}

export function ChatBoxModelCard({ model, active, locked, onApply }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'preview' | 'details'>('preview')

  const openModal = (mode: 'preview' | 'details') => {
    setModalMode(mode)
    setModalOpen(true)
  }

  const handleApply = () => {
    if (locked) return
    onApply?.(model)
  }

  return (
    <>
      <article
        className={cn(
          'flex min-h-[520px] max-h-[620px] flex-col overflow-hidden rounded-[18px] border bg-[var(--rz-surface)] transition-all',
          'border-slate-400/20 shadow-sm',
          active
            ? 'border-brand-500/60 ring-1 ring-brand-500/30'
            : 'hover:border-slate-400/35 hover:shadow-md',
        )}
        aria-current={active ? 'true' : undefined}
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--rz-border)]/60 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {model.isPremium ? (
              <Badge variant="premium" label="Premium" />
            ) : (
              <Badge variant="blue" label="Free" />
            )}
            {active && <Badge variant="green" label="Aplicado" />}
            {locked && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                <Lock className="h-3 w-3" aria-hidden="true" />
                Upgrade
              </span>
            )}
          </div>
          {model.isNew && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-400">Novo</span>
          )}
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-4 py-3 min-h-[220px] max-h-[340px] overflow-hidden bg-[var(--rz-surface-muted)]/25">
          <ChatBoxPreview model={model} size="card" />
        </div>

        <div className="flex flex-1 flex-col gap-3 p-4 pt-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--rz-text-primary)]">{model.name}</h3>
            <p className="mt-1 text-xs leading-relaxed text-[var(--rz-text-muted)] line-clamp-2">
              {model.description}
            </p>
          </div>

          <div className="flex flex-wrap gap-1">
            {model.tags.slice(0, 4).map(tag => (
              <span
                key={tag}
                className="rounded-full bg-[var(--rz-surface-muted)] px-2 py-0.5 text-[10px] text-[var(--rz-text-muted)]"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="mt-auto flex flex-wrap gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              aria-label={`Abrir preview de ${model.name}`}
              onClick={() => openModal('preview')}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir
            </Button>
            <Button
              type="button"
              variant={active ? 'primary' : 'secondary'}
              size="sm"
              disabled={locked}
              aria-label={locked ? `${model.name} — requer plano premium` : `Aplicar ${model.name}`}
              onClick={handleApply}
            >
              {model.isPremium ? <Gem className="h-3.5 w-3.5" /> : <Palette className="h-3.5 w-3.5" />}
              {active ? 'Aplicado' : locked ? 'Premium' : 'Aplicar'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs"
              aria-label={`Ver detalhes de ${model.name}`}
              onClick={() => openModal('details')}
            >
              Ver detalhes
            </Button>
          </div>
        </div>
      </article>

      <ChatBoxModelModal
        model={model}
        open={modalOpen}
        mode={modalMode}
        locked={locked}
        active={active}
        onClose={() => setModalOpen(false)}
        onApply={handleApply}
      />
    </>
  )
}
