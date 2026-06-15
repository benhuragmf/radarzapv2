export interface AiModelOption {
  id: string
  label: string
  description: string
  inputUsdPer1M: number
  outputUsdPer1M: number
  tier: string
  recommended?: boolean
  deprecated?: boolean
  typicalTurnCostUsd: number
}

function fmtUsdPer1M(value: number): string {
  if (value >= 1) return `US$ ${value.toFixed(2)}`
  if (value >= 0.1) return `US$ ${value.toFixed(2)}`
  return `US$ ${value.toFixed(3)}`
}

function fmtUsdMicro(value: number): string {
  if (value < 0.0001) return `< US$ 0,0001`
  return `US$ ${value.toFixed(4)}`
}

interface Props {
  models: AiModelOption[]
  selectedId: string
  onSelect: (id: string) => void
  disabled?: boolean
  dailyLimit?: number
}

export function AiModelPicker({ models, selectedId, onSelect, disabled, dailyLimit }: Props) {
  const selected = models.find(m => m.id === selectedId) ?? models[0]

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[var(--rz-border)] overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-4 py-2 bg-[var(--rz-surface-muted)] text-[10px] uppercase tracking-wider text-[var(--rz-text-muted)] font-semibold">
          <span>Modelo</span>
          <span className="text-right w-28">Entrada / 1M</span>
          <span className="text-right w-28">Saída / 1M</span>
        </div>
        {models.map(model => {
          const active = model.id === selectedId
          return (
            <button
              key={model.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(model.id)}
              className={`w-full grid grid-cols-[1fr_auto_auto] gap-2 px-4 py-3 text-left border-t border-[var(--rz-border)] transition-colors ${
                active
                  ? 'bg-brand-600/15 border-l-2 border-l-brand-500'
                  : 'hover:bg-[var(--rz-surface-muted)] border-l-2 border-l-transparent'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-sm font-medium ${active ? 'text-brand-300' : 'text-[var(--rz-text-primary)]'}`}>
                    {model.label}
                  </span>
                  {model.recommended && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-600/30 text-brand-300">
                      Recomendado
                    </span>
                  )}
                  {model.deprecated && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-400">
                      Legado
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--rz-text-muted)] mt-0.5 line-clamp-2">{model.description}</p>
              </div>
              <span className="text-xs text-[var(--rz-text-muted)] w-28 text-right self-center">
                {fmtUsdPer1M(model.inputUsdPer1M)}
              </span>
              <span className="text-xs text-[var(--rz-text-muted)] w-28 text-right self-center">
                {fmtUsdPer1M(model.outputUsdPer1M)}
              </span>
            </button>
          )
        })}
      </div>

      {selected && (
        <div className="rounded-lg bg-[var(--rz-surface-muted)]/40 border border-[var(--rz-border)] px-4 py-3 text-sm text-[var(--rz-text-secondary)] space-y-1">
          <p>
            <span className="text-[var(--rz-text-primary)]">Custo estimado por resposta:</span>{' '}
            {fmtUsdMicro(selected.typicalTurnCostUsd)}{' '}
            <span className="text-xs text-[var(--rz-text-muted)]">(~800 entrada + ~200 saída)</span>
          </p>
          {dailyLimit != null && dailyLimit > 0 && (
            <p>
              <span className="text-[var(--rz-text-secondary)]">Estimativa no limite diário ({dailyLimit} respostas):</span>{' '}
              US$ {(selected.typicalTurnCostUsd * dailyLimit).toFixed(2)}/dia
            </p>
          )}
          <p className="text-[11px] text-[var(--rz-text-muted)] pt-1">
            Preços de referência Google AI / OpenAI (tier pago). Atualize o catálogo em{' '}
            <code className="text-[var(--rz-text-muted)]">src/constants/ai-model-catalog.ts</code> quando surgirem novos modelos.
          </p>
        </div>
      )}
    </div>
  )
}
