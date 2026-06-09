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
      <div className="rounded-lg border border-gray-700 overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-4 py-2 bg-gray-800/80 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
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
              className={`w-full grid grid-cols-[1fr_auto_auto] gap-2 px-4 py-3 text-left border-t border-gray-800 transition-colors ${
                active
                  ? 'bg-brand-600/15 border-l-2 border-l-brand-500'
                  : 'hover:bg-gray-800/60 border-l-2 border-l-transparent'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-sm font-medium ${active ? 'text-brand-300' : 'text-gray-200'}`}>
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
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{model.description}</p>
              </div>
              <span className="text-xs text-gray-400 w-28 text-right self-center">
                {fmtUsdPer1M(model.inputUsdPer1M)}
              </span>
              <span className="text-xs text-gray-400 w-28 text-right self-center">
                {fmtUsdPer1M(model.outputUsdPer1M)}
              </span>
            </button>
          )
        })}
      </div>

      {selected && (
        <div className="rounded-lg bg-gray-800/40 border border-gray-800 px-4 py-3 text-sm text-gray-400 space-y-1">
          <p>
            <span className="text-gray-300">Custo estimado por resposta:</span>{' '}
            {fmtUsdMicro(selected.typicalTurnCostUsd)}{' '}
            <span className="text-xs text-gray-600">(~800 entrada + ~200 saída)</span>
          </p>
          {dailyLimit != null && dailyLimit > 0 && (
            <p>
              <span className="text-gray-300">Estimativa no limite diário ({dailyLimit} respostas):</span>{' '}
              US$ {(selected.typicalTurnCostUsd * dailyLimit).toFixed(2)}/dia
            </p>
          )}
          <p className="text-[11px] text-gray-600 pt-1">
            Preços de referência Google AI / OpenAI (tier pago). Atualize o catálogo em{' '}
            <code className="text-gray-500">src/constants/ai-model-catalog.ts</code> quando surgirem novos modelos.
          </p>
        </div>
      )}
    </div>
  )
}
