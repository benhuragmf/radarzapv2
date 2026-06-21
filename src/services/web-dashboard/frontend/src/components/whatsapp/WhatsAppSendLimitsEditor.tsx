import { useEffect, useState } from 'react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'

export type KindKey = 'conversation' | 'marketing' | 'alert'

export interface KindLimitRow {
  enabled: boolean
  maxPerMinute: number
}

export interface WhatsAppLimitsFormState {
  humanizeEnabled: boolean
  composingEnabled: boolean
  limitsDisabled?: boolean
  caps?: Record<KindKey, number>
  conversation: KindLimitRow
  marketing: KindLimitRow
  alert: KindLimitRow
}

const KIND_LABELS: Record<KindKey, string> = {
  conversation: 'Chat ao vivo (Inbox / WebChat → WA)',
  marketing: 'Marketing / campanhas / regras',
  alert: 'Alertas internos (bridge, fallback)',
}

interface Props {
  mode: 'admin' | 'tenant'
  initial: WhatsAppLimitsFormState
  saving?: boolean
  onSave: (state: WhatsAppLimitsFormState) => void
}

export function WhatsAppSendLimitsEditor({ mode, initial, saving, onSave }: Props) {
  const [state, setState] = useState(initial)

  useEffect(() => {
    setState(initial)
  }, [initial])

  const setKind = (kind: KindKey, patch: Partial<KindLimitRow>) => {
    setState(prev => ({ ...prev, [kind]: { ...prev[kind], ...patch } }))
  }

  const capFor = (kind: KindKey) => state.caps?.[kind] ?? 60

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--rz-text-primary)]">Comportamento humano</h3>
          <p className="text-xs text-[var(--rz-text-secondary)] mt-1">
            Mensagens entram na fila, simulam digitação no WhatsApp e respeitam o limite por minuto — reduz risco de ban.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={state.humanizeEnabled}
            onChange={e => setState(s => ({ ...s, humanizeEnabled: e.target.checked }))}
          />
          Delay proporcional ao tamanho do texto (parecer pessoa digitando)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={state.composingEnabled}
            onChange={e => setState(s => ({ ...s, composingEnabled: e.target.checked }))}
          />
          Mostrar &quot;digitando…&quot; no WhatsApp antes de enviar
        </label>
        {mode === 'tenant' && (
          <label className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
            <input
              type="checkbox"
              checked={state.limitsDisabled === true}
              onChange={e => setState(s => ({ ...s, limitsDisabled: e.target.checked }))}
            />
            Desativar limites por minuto (aceito risco de bloqueio WhatsApp)
          </label>
        )}
      </Card>

      {(Object.keys(KIND_LABELS) as KindKey[]).map(kind => (
        <Card key={kind} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-[var(--rz-text-primary)]">{KIND_LABELS[kind]}</h3>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={state[kind].enabled}
                disabled={mode === 'tenant' && state.limitsDisabled}
                onChange={e => setKind(kind, { enabled: e.target.checked })}
              />
              Limite ativo
            </label>
          </div>
          <div>
            <div className="flex justify-between text-xs text-[var(--rz-text-secondary)] mb-1">
              <span>Máx. por minuto</span>
              <span className="font-mono">{state[kind].maxPerMinute}/min</span>
            </div>
            <input
              type="range"
              min={1}
              max={capFor(kind)}
              value={state[kind].maxPerMinute}
              disabled={(mode === 'tenant' && state.limitsDisabled) || !state[kind].enabled}
              onChange={e => setKind(kind, { maxPerMinute: Number(e.target.value) })}
              className="w-full"
            />
          </div>
          {mode === 'admin' && (
            <div>
              <div className="flex justify-between text-xs text-[var(--rz-text-secondary)] mb-1">
                <span>Teto do slider (empresas)</span>
                <span className="font-mono">{state.caps?.[kind] ?? capFor(kind)}</span>
              </div>
              <input
                type="range"
                min={1}
                max={200}
                value={state.caps?.[kind] ?? capFor(kind)}
                onChange={e =>
                  setState(s => ({
                    ...s,
                    caps: { ...s.caps, [kind]: Number(e.target.value) } as Record<KindKey, number>,
                    [kind]: {
                      ...s[kind],
                      maxPerMinute: Math.min(s[kind].maxPerMinute, Number(e.target.value)),
                    },
                  }))
                }
                className="w-full"
              />
            </div>
          )}
        </Card>
      ))}

      <Button onClick={() => onSave(state)} disabled={saving}>
        {saving ? 'Salvando…' : 'Salvar limites'}
      </Button>
    </div>
  )
}
