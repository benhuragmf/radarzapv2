import { useEffect, useState } from 'react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'

export type KindKey = 'conversation' | 'marketing' | 'alert'

export interface KindLimitRow {
  enabled: boolean
  maxPerMinute: number
}

export interface CampaignProtectedTierRow {
  id: 'minimum' | 'normal' | 'optimal'
  label: string
  baseSec: number
  jitterMinSec: number
  jitterMaxSec: number
  enabled: boolean
}

export interface CampaignDelaysFormState {
  protectedTiers: CampaignProtectedTierRow[]
  protectedDefaultTierId: CampaignProtectedTierRow['id']
  riskDelaysSec: [number, number, number]
  riskMinSec: number
}

export interface WhatsAppLimitsFormState {
  humanizeEnabled: boolean
  composingEnabled: boolean
  limitsDisabled?: boolean
  allowMembersDisableCampaignProtection?: boolean
  caps?: Record<KindKey, number>
  conversation: KindLimitRow
  marketing: KindLimitRow
  alert: KindLimitRow
  campaignDelays?: CampaignDelaysFormState
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
          <>
            <label className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
              <input
                type="checkbox"
                checked={state.limitsDisabled === true}
                onChange={e => setState(s => ({ ...s, limitsDisabled: e.target.checked }))}
              />
              Desativar limites por minuto (aceito risco de bloqueio WhatsApp)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={state.allowMembersDisableCampaignProtection === true}
                onChange={e =>
                  setState(s => ({
                    ...s,
                    allowMembersDisableCampaignProtection: e.target.checked,
                  }))
                }
              />
              Permitir que a equipe desative a proteção anti-ban no Enviar agora
            </label>
            <p className="text-[11px] text-[var(--rz-text-muted)] -mt-2">
              Você (dono) sempre pode desativar a proteção no envio. Esta opção libera o checkbox para
              atendentes.
            </p>
          </>
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

      {mode === 'admin' && state.campaignDelays && (
        <Card className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--rz-text-primary)]">
              Intervalos de campanha (Enviar agora)
            </h3>
            <p className="text-xs text-[var(--rz-text-secondary)] mt-1">
              Modo protegido: tiers com jitter aleatório entre envios. Modo risco (quando liberado):
              opções rápidas antes de 30s.
            </p>
          </div>

          <div className="space-y-3">
            {state.campaignDelays.protectedTiers.map((tier, idx) => (
              <div
                key={tier.id}
                className="rounded-lg border border-[var(--rz-border)] p-3 space-y-2 bg-[var(--rz-surface-muted)]/20"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <input
                    type="text"
                    value={tier.label}
                    onChange={e => {
                      const label = e.target.value
                      setState(s => {
                        if (!s.campaignDelays) return s
                        const tiers = [...s.campaignDelays.protectedTiers]
                        tiers[idx] = { ...tiers[idx], label }
                        return { ...s, campaignDelays: { ...s.campaignDelays, protectedTiers: tiers } }
                      })
                    }}
                    className="text-sm font-medium bg-transparent border-b border-[var(--rz-border)] focus:outline-none focus:border-brand-500 min-w-[6rem]"
                  />
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={tier.enabled}
                      onChange={e => {
                        const enabled = e.target.checked
                        setState(s => {
                          if (!s.campaignDelays) return s
                          const tiers = [...s.campaignDelays.protectedTiers]
                          tiers[idx] = { ...tiers[idx], enabled }
                          return { ...s, campaignDelays: { ...s.campaignDelays, protectedTiers: tiers } }
                        })
                      }}
                    />
                    Ativo no /send
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <label className="space-y-1">
                    <span className="text-[var(--rz-text-muted)]">Base (s)</span>
                    <input
                      type="number"
                      min={5}
                      max={600}
                      value={tier.baseSec}
                      onChange={e => {
                        const baseSec = Number(e.target.value)
                        setState(s => {
                          if (!s.campaignDelays) return s
                          const tiers = [...s.campaignDelays.protectedTiers]
                          tiers[idx] = { ...tiers[idx], baseSec }
                          return { ...s, campaignDelays: { ...s.campaignDelays, protectedTiers: tiers } }
                        })
                      }}
                      className="w-full rounded border border-[var(--rz-border)] bg-[var(--rz-surface)] px-2 py-1.5"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[var(--rz-text-muted)]">Jitter mín. (s)</span>
                    <input
                      type="number"
                      min={5}
                      max={900}
                      value={tier.jitterMinSec}
                      onChange={e => {
                        const jitterMinSec = Number(e.target.value)
                        setState(s => {
                          if (!s.campaignDelays) return s
                          const tiers = [...s.campaignDelays.protectedTiers]
                          tiers[idx] = { ...tiers[idx], jitterMinSec }
                          return { ...s, campaignDelays: { ...s.campaignDelays, protectedTiers: tiers } }
                        })
                      }}
                      className="w-full rounded border border-[var(--rz-border)] bg-[var(--rz-surface)] px-2 py-1.5"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[var(--rz-text-muted)]">Jitter máx. (s)</span>
                    <input
                      type="number"
                      min={5}
                      max={900}
                      value={tier.jitterMaxSec}
                      onChange={e => {
                        const jitterMaxSec = Number(e.target.value)
                        setState(s => {
                          if (!s.campaignDelays) return s
                          const tiers = [...s.campaignDelays.protectedTiers]
                          tiers[idx] = { ...tiers[idx], jitterMaxSec }
                          return { ...s, campaignDelays: { ...s.campaignDelays, protectedTiers: tiers } }
                        })
                      }}
                      className="w-full rounded border border-[var(--rz-border)] bg-[var(--rz-surface)] px-2 py-1.5"
                    />
                  </label>
                </div>
                <p className="text-[10px] text-[var(--rz-text-muted)]">
                  Envio real: {tier.jitterMinSec}–{tier.jitterMaxSec}s entre cada número (não fixo em{' '}
                  {tier.baseSec}s).
                </p>
              </div>
            ))}
          </div>

          <label className="block text-xs space-y-1">
            <span className="text-[var(--rz-text-secondary)]">Padrão no /send (modo protegido)</span>
            <select
              value={state.campaignDelays.protectedDefaultTierId}
              onChange={e =>
                setState(s =>
                  s.campaignDelays
                    ? {
                        ...s,
                        campaignDelays: {
                          ...s.campaignDelays,
                          protectedDefaultTierId: e.target.value as CampaignProtectedTierRow['id'],
                        },
                      }
                    : s,
                )
              }
              className="w-full rounded border border-[var(--rz-border)] bg-[var(--rz-surface)] px-2 py-1.5 text-sm"
            >
              {state.campaignDelays.protectedTiers
                .filter(t => t.enabled)
                .map(t => (
                  <option key={t.id} value={t.id}>
                    {t.label} ({t.baseSec}s)
                  </option>
                ))}
            </select>
          </label>

          <div className="border-t border-[var(--rz-border)] pt-3 space-y-2">
            <h4 className="text-xs font-medium text-[var(--rz-text-secondary)]">
              Modo risco (proteção desligada)
            </h4>
            <label className="block text-xs space-y-1">
              <span className="text-[var(--rz-text-muted)]">Mínimo (s)</span>
              <input
                type="number"
                min={1}
                max={29}
                value={state.campaignDelays.riskMinSec}
                onChange={e =>
                  setState(s =>
                    s.campaignDelays
                      ? {
                          ...s,
                          campaignDelays: {
                            ...s.campaignDelays,
                            riskMinSec: Number(e.target.value),
                          },
                        }
                      : s,
                  )
                }
                className="w-full rounded border border-[var(--rz-border)] bg-[var(--rz-surface)] px-2 py-1.5"
              />
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([0, 1, 2] as const).map(i => (
                <label key={i} className="text-xs space-y-1">
                  <span className="text-[var(--rz-text-muted)]">Opção {i + 1} (s)</span>
                  <input
                    type="number"
                    min={state.campaignDelays!.riskMinSec}
                    max={29}
                    value={state.campaignDelays!.riskDelaysSec[i]}
                    onChange={e => {
                      const v = Number(e.target.value)
                      setState(s => {
                        if (!s.campaignDelays) return s
                        const riskDelaysSec = [...s.campaignDelays.riskDelaysSec] as [
                          number,
                          number,
                          number,
                        ]
                        riskDelaysSec[i] = v
                        return {
                          ...s,
                          campaignDelays: { ...s.campaignDelays, riskDelaysSec },
                        }
                      })
                    }}
                    className="w-full rounded border border-[var(--rz-border)] bg-[var(--rz-surface)] px-2 py-1.5"
                  />
                </label>
              ))}
            </div>
          </div>
        </Card>
      )}

      <Button onClick={() => onSave(state)} disabled={saving}>
        {saving ? 'Salvando…' : 'Salvar limites'}
      </Button>
    </div>
  )
}
