import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { inputCls, LoadingState, EmptyState } from '@/design-system'
import { ContactClassificationBadges } from './ContactClassificationBadges'
import type { ContactClassificationFilterKey } from './ContactClassificationFilterBar'
import type { ContactClassificationView } from '../../lib/contactClassificationUi'
import { Sparkles, Send, RefreshCw, Users } from 'lucide-react'
import { mutationError, notifySuccess } from '../../lib/notify'

interface SmartSegmentPreset {
  id: string
  label: string
  description: string
  count: number
}

interface SmartMemberRow {
  _id: string
  name: string
  identifier: string
  email?: string
  consentStatus?: string
  classification?: ContactClassificationView
}

interface Props {
  selectedPresetId: string | null
  onSelectPreset: (id: string | null) => void
}

const PRESET_CONTACT_CLASS: Partial<Record<string, ContactClassificationFilterKey>> = {
  opt_in_leads: 'opt_in',
  active_clients: 'client',
  hot_leads: 'hot',
  pending_consent: 'pending',
  blocked_send: 'blocked',
}

export function SmartSegmentsSection({ selectedPresetId, onSelectPreset }: Props) {
  const qc = useQueryClient()
  const [memberSearch, setMemberSearch] = useState('')

  const { data: presets = [], isLoading } = useQuery<SmartSegmentPreset[]>({
    queryKey: ['destinations-smart-segments'],
    queryFn: () => api.get('/destinations/smart-segments'),
  })

  const selected = presets.find(p => p.id === selectedPresetId) ?? null

  const { data: members = [], isLoading: loadingMembers } = useQuery<SmartMemberRow[]>({
    queryKey: ['smart-segment-members', selectedPresetId],
    queryFn: () => api.get(`/destinations/smart-segments/${selectedPresetId}/members`),
    enabled: Boolean(selectedPresetId),
  })

  const { data: backfillStatus } = useQuery<{ pending: number }>({
    queryKey: ['classification-backfill-status'],
    queryFn: () => api.get('/destinations/classification-backfill-status'),
  })

  const backfill = useMutation({
    mutationFn: (dryRun: boolean) =>
      api.post<{ ok: boolean; scanned: number; updated: number; pending: number }>(
        '/destinations/backfill-classification',
        { limit: 500, dryRun },
      ),
    onSuccess: res => {
      qc.invalidateQueries({ queryKey: ['classification-backfill-status'] })
      qc.invalidateQueries({ queryKey: ['destinations-smart-segments'] })
      qc.invalidateQueries({ queryKey: ['destinations'] })
      if (selectedPresetId) {
        qc.invalidateQueries({ queryKey: ['smart-segment-members', selectedPresetId] })
      }
      notifySuccess(
        res.updated > 0
          ? `${res.updated} contato(s) classificado(s). Restam ${res.pending} sem campos persistidos.`
          : `Nenhuma alteração (${res.scanned} analisados). Restam ${res.pending} pendentes.`,
      )
    },
    onError: mutationError,
  })

  const filteredMembers = members.filter(m => {
    const q = memberSearch.trim().toLowerCase()
    if (!q) return true
    return (
      m.name.toLowerCase().includes(q) ||
      m.identifier.includes(q) ||
      (m.email ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-4">
      {(backfillStatus?.pending ?? 0) > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-amber-800/40 bg-amber-950/15 p-4">
          <div className="min-w-0">
            <p className="text-sm text-amber-100 font-medium">
              {backfillStatus?.pending} contato(s) sem classificação salva no cadastro
            </p>
            <p className="text-xs text-[var(--rz-text-muted)] mt-1">
              Os segmentos inteligentes já funcionam por inferência. O backfill grava tipo, origem,
              funil e temperatura para edição manual e relatórios.
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            disabled={backfill.isPending}
            onClick={() => backfill.mutate(false)}
          >
            <RefreshCw size={14} className={backfill.isPending ? 'animate-spin' : ''} />
            Classificar em lote (500)
          </Button>
        </Card>
      )}

      {isLoading ? (
        <LoadingState rows={3} className="pt-2" />
      ) : presets.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Nenhum contato para segmentar"
          description="Cadastre contatos em Contatos ou importe CSV para ver segmentos dinâmicos."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(260px,1fr)_2fr]">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--rz-text-muted)] px-1">
              Segmentos dinâmicos
            </p>
            {presets.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectPreset(selectedPresetId === p.id ? null : p.id)}
                className={`w-full text-left rounded-lg border p-3 transition-colors ${
                  selectedPresetId === p.id
                    ? 'border-brand-500 bg-brand-950/35'
                    : 'border-[var(--rz-border)] hover:border-[var(--rz-border)]/90 bg-[var(--rz-surface-muted)]/20'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--rz-text-primary)]">{p.label}</p>
                    <p className="text-[11px] text-[var(--rz-text-muted)] mt-0.5 leading-snug">
                      {p.description}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-brand-300 shrink-0">{p.count}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="min-w-0">
            {!selected ? (
              <Card className="text-center py-16 text-[var(--rz-text-muted)] text-sm">
                <Sparkles size={28} className="mx-auto mb-3 opacity-40" />
                Selecione um segmento dinâmico para ver os contatos e enviar campanha.
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-medium text-white">
                    {selected.label}{' '}
                    <span className="text-[var(--rz-text-muted)] font-normal">
                      ({selected.count} contatos)
                    </span>
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_CONTACT_CLASS[selected.id] && (
                      <Link to={`/contact?class=${PRESET_CONTACT_CLASS[selected.id]}`}>
                        <Button size="sm" variant="ghost">
                          <Users size={14} /> Ver em Contatos
                        </Button>
                      </Link>
                    )}
                    <Link
                      to="/send"
                      state={{
                        smartSegmentId: selected.id,
                        destinationScope: 'segments',
                      }}
                    >
                      <Button size="sm" variant="secondary">
                        <Send size={14} /> Usar no envio
                      </Button>
                    </Link>
                  </div>
                </div>

                <input
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  placeholder="Buscar nome ou telefone…"
                  className={inputCls}
                />

                {loadingMembers ? (
                  <LoadingState rows={4} className="py-4" />
                ) : filteredMembers.length === 0 ? (
                  <Card className="text-center py-8 text-[var(--rz-text-muted)] text-sm">
                    {members.length === 0
                      ? 'Nenhum contato neste segmento no momento.'
                      : 'Nenhum resultado na busca.'}
                  </Card>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-[var(--rz-border)] max-h-[480px] overflow-y-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-[var(--rz-surface)]/80 text-xs text-[var(--rz-text-muted)] uppercase sticky top-0">
                        <tr>
                          <th className="px-3 py-2">Nome</th>
                          <th className="px-3 py-2">Telefone</th>
                          <th className="px-3 py-2">Classificação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--rz-border)]">
                        {filteredMembers.map(m => (
                          <tr key={m._id} className="hover:bg-[var(--rz-surface-muted)]/40">
                            <td className="px-3 py-2 text-[var(--rz-text-primary)]">{m.name || '—'}</td>
                            <td className="px-3 py-2 text-[var(--rz-text-muted)] font-mono text-xs">
                              {m.identifier}
                            </td>
                            <td className="px-3 py-2">
                              <ContactClassificationBadges
                                classification={m.classification}
                                compact
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {members.length >= 500 && (
                  <p className="text-[10px] text-[var(--rz-text-muted)]">
                    Exibindo até 500 contatos. Use &quot;Usar no envio&quot; para campanha completa.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <Card className="flex items-start gap-3 p-4 text-xs text-[var(--rz-text-muted)]">
        <Users size={16} className="shrink-0 mt-0.5 text-brand-400" />
        <p>
          <strong className="text-[var(--rz-text-secondary)]">Listas fixas</strong> são grupos que
          você monta manualmente. <strong className="text-[var(--rz-text-secondary)]">Segmentos
          dinâmicos</strong> atualizam sozinhos conforme tipo, opt-in, temperatura e bloqueios de
          campanha.
        </p>
      </Card>
    </div>
  )
}
