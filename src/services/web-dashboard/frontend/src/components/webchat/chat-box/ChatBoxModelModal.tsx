import { Crown, X } from 'lucide-react'
import { Button } from '../../ui/Button'
import { Badge } from '../../ui/Badge'
import type { ChatBoxModel } from '@/lib/chatBoxModels'
import { ChatBoxPreview } from './ChatBoxPreview'

type Props = {
  model: ChatBoxModel
  open: boolean
  mode: 'preview' | 'details'
  locked?: boolean
  active?: boolean
  onClose: () => void
  onApply: () => void
}

export function ChatBoxModelModal({
  model,
  open,
  mode,
  locked,
  active,
  onClose,
  onApply,
}: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chatbox-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Fechar modal"
        onClick={onClose}
      />
      <div
        className="relative z-[1] flex w-full max-w-3xl max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-[var(--rz-border)] bg-[var(--rz-surface)] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--rz-border)] px-5 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="chatbox-modal-title" className="text-lg font-semibold text-[var(--rz-text-primary)]">
                {model.name}
              </h2>
              {model.isPremium ? (
                <Badge variant="premium" label="Premium" />
              ) : (
                <Badge variant="blue" label="Free" />
              )}
              {active && <Badge variant="green" label="Aplicado" />}
            </div>
            <p className="mt-1 text-sm text-[var(--rz-text-muted)]">{model.description}</p>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-[var(--rz-text-muted)] hover:bg-[var(--rz-surface-muted)]"
            aria-label="Fechar"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-5 overflow-auto p-5 lg:flex-row">
          <div className="flex flex-1 items-center justify-center rounded-xl bg-[var(--rz-surface-muted)]/30 p-4 min-h-[320px]">
            <ChatBoxPreview model={model} size="modal" />
          </div>

          <div className="flex flex-col gap-4 lg:w-72 shrink-0">
            {mode === 'details' ? (
              <>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--rz-text-muted)]">
                    Melhor uso
                  </p>
                  <p className="mt-1 text-sm text-[var(--rz-text-secondary)]">{model.bestFor}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--rz-text-muted)]">
                    Formato
                  </p>
                  <p className="mt-1 text-sm capitalize text-[var(--rz-text-secondary)]">{model.format}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--rz-text-muted)]">
                    Dimensões (desktop)
                  </p>
                  <ul className="mt-1 space-y-0.5 text-sm text-[var(--rz-text-secondary)]">
                    <li>{model.dimensions.widgetWidth}×{model.dimensions.widgetHeight}px</li>
                    <li>Header {model.dimensions.headerHeight}px</li>
                    <li>Input {model.dimensions.inputHeight}px</li>
                    <li>Radius {model.dimensions.borderRadius}px</li>
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--rz-text-muted)]">
                    Recursos
                  </p>
                  <ul className="mt-1 list-disc pl-4 text-sm text-[var(--rz-text-secondary)]">
                    {model.features.map(f => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <p className="text-sm text-[var(--rz-text-secondary)]">
                Preview ampliado do chat box. Use <strong>Aplicar</strong> para salvar cores, textos e layout no
                widget selecionado.
              </p>
            )}

            <div className="flex flex-wrap gap-1.5">
              {model.tags.map(tag => (
                <span
                  key={tag}
                  className="rounded-full bg-[var(--rz-surface-muted)] px-2 py-0.5 text-[10px] text-[var(--rz-text-muted)]"
                >
                  {tag}
                </span>
              ))}
            </div>

            {locked && (
              <p className="flex items-center gap-2 text-xs text-amber-400">
                <Crown className="h-4 w-4 shrink-0" />
                Disponível nos planos Starter, Pro e Enterprise.
              </p>
            )}

            <div className="mt-auto flex gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={onClose}>Fechar</Button>
              <Button
                type="button"
                variant="primary"
                disabled={locked}
                onClick={() => {
                  onApply()
                  onClose()
                }}
              >
                {active ? 'Já aplicado' : locked ? 'Requer Premium' : 'Aplicar modelo'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
