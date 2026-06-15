import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { Webhook, Plus, Trash2 } from 'lucide-react'
import { notifyError, notifySuccess, notifyInfo, mutationError } from '../../lib/notify'
import { inputCls, LoadingState, EmptyState } from '@/design-system'

const EVENTS = [
  'campaign.sent',
  'campaign.failed',
  'consent.updated',
  'session.connected',
  'session.disconnected',
  'inbox.conversation.created',
  'inbox.message.received',
  'inbox.conversation.resolved',
  'inbox.conversation.closed',
] as const

interface WebhookRow {
  _id: string
  url: string
  events: string[]
  active: boolean
  description?: string
  lastDeliveryAt?: string
  lastDeliveryStatus?: number
}

export function WebhooksPanel() {
  const qc = useQueryClient()
  const [url, setUrl] = useState('')
  const [newSecret, setNewSecret] = useState<string | null>(null)

  const { data: hooks = [], isLoading } = useQuery<WebhookRow[]>({
    queryKey: ['webhooks'],
    queryFn: () => api.get('/integrations/webhooks'),
  })

  const create = useMutation({
    mutationFn: () =>
      api.post<{ secret: string; url: string }>('/integrations/webhooks', {
        url: url.trim(),
        events: ['campaign.sent', 'campaign.failed'],
      }),
    onSuccess: data => {
      setNewSecret(data.secret)
      setUrl('')
      qc.invalidateQueries({ queryKey: ['webhooks'] })
    },
    onError: mutationError,
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/integrations/webhooks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  })

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--rz-text-muted)]">
        POST JSON para sua URL com header <code className="text-[var(--rz-text-muted)]">X-RadarZap-Signature</code>{' '}
        (HMAC com o secret abaixo).
      </p>

      {newSecret && (
        <Card className="border-amber-800/40 bg-amber-950/20 space-y-1">
          <p className="text-sm text-amber-200">Secret do webhook (guarde com segurança)</p>
          <code className="text-xs break-all text-[var(--rz-text-secondary)]">{newSecret}</code>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://seu-sistema.com/webhooks/radarzap"
          className={`${inputCls} flex-1 min-w-[240px]`}
        />
        <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending || !url.trim()}>
          {create.isPending ? <Spinner size={14} /> : <Plus size={14} />}
          Adicionar
        </Button>
      </div>

      <p className="text-[11px] text-[var(--rz-text-muted)]">Eventos disponíveis: {EVENTS.join(', ')}</p>

      {isLoading ? (
        <LoadingState rows={3} className="py-2" />
      ) : hooks.length === 0 ? (
        <EmptyState title="Nenhum webhook" description="Adicione uma URL HTTPS para receber eventos da plataforma." />
      ) : (
        <div className="space-y-2">
          {hooks.map(h => (
            <Card key={h._id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-[var(--rz-text-primary)] flex items-center gap-2 truncate">
                  <Webhook size={14} className="text-brand-500 shrink-0" />
                  <span className="truncate">{h.url}</span>
                </p>
                <p className="text-xs text-[var(--rz-text-muted)] mt-1">{h.events.join(', ')}</p>
                {h.lastDeliveryAt && (
                  <p className="text-[10px] text-[var(--rz-text-muted)] mt-1">
                    Última entrega: {new Date(h.lastDeliveryAt).toLocaleString('pt-BR')}
                    {h.lastDeliveryStatus != null && (
                      <span
                        className={
                          h.lastDeliveryStatus >= 200 && h.lastDeliveryStatus < 300
                            ? ' text-brand-400'
                            : ' text-red-400/80'
                        }
                      >
                        {' '}
                        · HTTP {h.lastDeliveryStatus}
                      </span>
                    )}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => window.confirm('Remover webhook?') && remove.mutate(h._id)}
                className="p-2 text-[var(--rz-text-muted)] hover:text-red-400 shrink-0"
              >
                <Trash2 size={16} />
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
