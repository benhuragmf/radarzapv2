import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { Plus, Trash2, Webhook } from 'lucide-react'
import { mutationError } from '../../lib/notify'
import { EmptyState, InlineNotice, LoadingState, StatusBadge, inputCls } from '@/design-system'

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
  'inbox.csat.rated',
  'ticket.created',
  'ticket.client_replied',
  'ticket.closed',
  'webchat.message.received',
  'webchat.conversation.escalated',
  'webchat.conversation.closed',
  'webchat.bridge.started',
  'webchat.bridge.closed',
  'discord.voice.join',
  'discord.voice.leave',
  'discord.member.join',
  'discord.member.leave',
  'discord.member.kick',
  'discord.member.ban',
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

function deliveryVariant(status?: number): 'success' | 'warning' | 'neutral' {
  if (status == null) return 'neutral'
  if (status >= 200 && status < 300) return 'success'
  return 'warning'
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
    onError: mutationError,
  })

  return (
    <div className="space-y-4">
      <InlineNotice tone="info" title="Entrega assinada por HMAC">
        O Radar Chat envia POST JSON para a sua URL com o header{' '}
        <code className="text-[var(--rz-text-secondary)]">X-RadarZap-Signature</code>.
      </InlineNotice>

      {newSecret && (
        <InlineNotice tone="warning" title="Secret do webhook. Guarde com segurança.">
          <code className="block text-xs text-[var(--rz-text-secondary)] break-all">{newSecret}</code>
        </InlineNotice>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://seu-sistema.com/webhooks/radarchat"
          className={`${inputCls} min-w-[240px] flex-1`}
        />
        <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending || !url.trim()}>
          {create.isPending ? <Spinner size={14} /> : <Plus size={14} />}
          Adicionar
        </Button>
      </div>

      <p className="text-[11px] leading-relaxed text-[var(--rz-text-muted)]">
        Eventos disponíveis: {EVENTS.join(', ')}
      </p>

      {isLoading ? (
        <LoadingState rows={3} className="py-2" label="Carregando webhooks" />
      ) : hooks.length === 0 ? (
        <EmptyState
          title="Nenhum webhook"
          description="Adicione uma URL HTTPS para receber eventos da plataforma com assinatura."
          size="sm"
        />
      ) : (
        <div className="space-y-2">
          {hooks.map(h => {
            const statusLabel =
              h.lastDeliveryStatus == null ? 'Sem entrega' : `HTTP ${h.lastDeliveryStatus}`

            return (
              <Card key={h._id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm text-[var(--rz-text-primary)]">
                    <Webhook size={14} className="shrink-0 text-brand-500" />
                    <span className="truncate">{h.url}</span>
                    <StatusBadge
                      status={h.active ? 'success' : 'neutral'}
                      text={h.active ? 'Ativo' : 'Inativo'}
                      size="sm"
                    />
                  </p>
                  <p className="mt-1 text-xs text-[var(--rz-text-muted)]">{h.events.join(', ')}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-[var(--rz-text-muted)]">
                    <StatusBadge
                      status={deliveryVariant(h.lastDeliveryStatus)}
                      text={statusLabel}
                      size="sm"
                      title="Status da última entrega"
                    />
                    {h.lastDeliveryAt ? (
                      <span>Última entrega: {new Date(h.lastDeliveryAt).toLocaleString('pt-BR')}</span>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => window.confirm('Remover webhook?') && remove.mutate(h._id)}
                  className="shrink-0 p-2 text-[var(--rz-text-muted)] hover:text-red-400"
                  title="Remover webhook"
                  aria-label={`Remover webhook ${h.url}`}
                >
                  <Trash2 size={16} />
                </button>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
