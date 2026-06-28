import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../../lib/api'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { inputCls, LoadingState, EmptyState } from '@/design-system'
import { Download, Search, Shield, Trash2 } from 'lucide-react'
import { notifySuccess, mutationError } from '../../lib/notify'

interface LgpdLookupItem {
  id: string
  name: string
  identifierMasked: string
  consentStatus: string
  isActive: boolean
}

interface LgpdEventRow {
  id: string
  kind: string
  createdAt: string
  actorUserId: string | null
  meta: Record<string, unknown>
}

const EVENT_LABEL: Record<string, string> = {
  'lgpd.export_requested': 'Exportação solicitada',
  'lgpd.delete_requested': 'Exclusão solicitada',
  'lgpd.anonymized': 'Titular anonimizado',
}

export default function LgpdPortal() {
  const qc = useQueryClient()
  const [phone, setPhone] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const lookup = useQuery({
    queryKey: ['lgpd-lookup', phone],
    enabled: false,
    queryFn: () =>
      api.get<{ items: LgpdLookupItem[] }>(
        `/lgpd/lookup?phone=${encodeURIComponent(phone)}`,
      ),
  })

  const events = useQuery({
    queryKey: ['lgpd-events'],
    queryFn: () => api.get<{ events: LgpdEventRow[] }>('/lgpd/events'),
  })

  const anonymize = useMutation({
    mutationFn: async (destinationId: string) => {
      await api.post(`/lgpd/destinations/${destinationId}/anonymize`, {
        confirm: 'ANONIMIZAR',
        reason: reason.trim() || undefined,
      })
    },
    onSuccess: () => {
      notifySuccess('Contato anonimizado com sucesso.')
      setSelectedId(null)
      setReason('')
      void qc.invalidateQueries({ queryKey: ['lgpd-events'] })
      void lookup.refetch()
    },
    onError: mutationError,
  })

  const handleSearch = () => {
    if (phone.replace(/\D/g, '').length < 8) {
      mutationError(new Error('Informe um telefone válido (mín. 8 dígitos).'))
      return
    }
    void lookup.refetch()
  }

  const handleExport = async (destinationId: string) => {
    try {
      const res = await fetch(`/api/lgpd/destinations/${destinationId}/export`, {
        credentials: 'include',
      })
      if (!res.ok) {
        const body = await res.text()
        throw new Error(body || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `lgpd-export-${destinationId.slice(-8)}.json`
      a.click()
      URL.revokeObjectURL(url)
      notifySuccess('Exportação JSON baixada.')
      void qc.invalidateQueries({ queryKey: ['lgpd-events'] })
    } catch (e) {
      mutationError(e)
    }
  }

  const items = lookup.data?.items ?? []

  return (
    <PlatformPage
      title="Portal LGPD — titular"
      description="Exportação e anonimização de dados de contato (direitos do titular). Ações registradas em auditoria."
    >
      <Card className="p-4 space-y-3">
        <p className="text-sm font-medium text-[var(--rz-text-primary)] flex items-center gap-2">
          <Search className="w-4 h-4" /> Buscar contato por telefone
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            className={`${inputCls} max-w-xs`}
            placeholder="5511999999999"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <Button type="button" variant="secondary" onClick={handleSearch} disabled={lookup.isFetching}>
            Buscar
          </Button>
        </div>
        {lookup.isFetching && <LoadingState rows={2} />}
        {lookup.isFetched && items.length === 0 && (
          <EmptyState title="Nenhum contato encontrado" description="Verifique o número informado." />
        )}
        {items.length > 0 && (
          <ul className="divide-y divide-[var(--rz-border)] text-sm">
            {items.map((item: LgpdLookupItem) => (
              <li key={item.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-[var(--rz-text-primary)]">{item.name}</p>
                  <p className="text-xs text-[var(--rz-text-muted)]">
                    {item.identifierMasked} · {item.consentStatus}
                    {!item.isActive && ' · inativo'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={() => handleExport(item.id)}>
                    <Download className="w-3 h-3 mr-1" /> Exportar JSON
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setSelectedId(selectedId === item.id ? null : item.id)}
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> Anonimizar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {selectedId && (
          <Card className="p-3 bg-[var(--rz-surface-muted)] space-y-2 border border-amber-500/40">
            <p className="text-xs text-amber-200">
              Anonimização irreversível: remove PII e desativa o contato. Digite o motivo (opcional) e confirme.
            </p>
            <textarea
              className={`${inputCls} min-h-[60px] w-full`}
              placeholder="Motivo interno (opcional)"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
            <Button
              type="button"
              variant="danger"
              disabled={anonymize.isPending}
              onClick={() => anonymize.mutate(selectedId)}
            >
              Confirmar anonimização
            </Button>
          </Card>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <p className="text-sm font-medium text-[var(--rz-text-primary)] flex items-center gap-2">
          <Shield className="w-4 h-4" /> Registro recente (90 dias)
        </p>
        {events.isLoading && <LoadingState rows={3} />}
        {events.data && events.data.events.length === 0 && (
          <EmptyState title="Sem eventos LGPD ainda" description="Exportações e anonimizações aparecem aqui." />
        )}
        {events.data && events.data.events.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[var(--rz-text-muted)] border-b border-[var(--rz-border)]">
                  <th className="py-2 pr-2">Quando</th>
                  <th className="py-2 pr-2">Ação</th>
                  <th className="py-2">Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {events.data.events.map((ev: LgpdEventRow) => (
                  <tr key={ev.id} className="border-b border-[var(--rz-border)]/50">
                    <td className="py-2 pr-2 whitespace-nowrap">
                      {new Date(ev.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-2 pr-2">{EVENT_LABEL[ev.kind] ?? ev.kind}</td>
                    <td className="py-2 text-[var(--rz-text-muted)]">
                      {(ev.meta.destinationId as string)?.slice(-8) ??
                        (ev.meta.identifierMasked as string) ??
                        '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PlatformPage>
  )
}
