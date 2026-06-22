import { useQuery } from '@tanstack/react-query'
import { Bell, CheckCheck } from 'lucide-react'
import { api } from '../lib/api'
import { useEventNotifications, type PanelEvent } from '../context/EventNotificationContext'
import { PanelNotificationRow } from '../components/layout/PanelNotificationRow'
import { PANEL_EVENT_TYPE_LABEL } from '../lib/panelEventLabels'
import { RadarPageShell, PageHeader, EmptyState, LoadingState } from '@/design-system'
import { Button } from '../components/ui/Button'

export default function DashboardNotifications() {
  const { events, unreadCount, markAllRead, markRead } = useEventNotifications()

  const { isLoading } = useQuery<PanelEvent[]>({
    queryKey: ['panel-notifications'],
    queryFn: () => api.get('/panel/notifications?limit=80'),
    staleTime: 30_000,
  })

  const displayEvents = events

  return (
    <RadarPageShell>
      <PageHeader
        title="Notificações"
        subtitle="Histórico de alertas do painel — atendimento, WhatsApp, plano e sistema."
        actions={
          unreadCount > 0 ? (
            <Button size="sm" variant="secondary" onClick={() => markAllRead()}>
              <CheckCheck size={14} />
              Marcar todas como lidas
            </Button>
          ) : undefined
        }
      />

      {isLoading && displayEvents.length === 0 ? (
        <LoadingState rows={6} className="pt-8" />
      ) : displayEvents.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Nenhuma notificação"
          description="Quando houver novos chats, mensagens, alertas de WhatsApp ou do plano, eles aparecerão aqui e no sino do topo."
        />
      ) : (
        <div className="rounded-xl border border-[var(--rz-border)] bg-[var(--rz-surface)] overflow-hidden divide-y divide-[var(--rz-border)]/80">
          {displayEvents.map(ev => (
            <PanelNotificationRow
              key={ev.id}
              ev={ev}
              onNavigate={() => markRead(ev.id)}
            />
          ))}
        </div>
      )}

      {displayEvents.length > 0 && (
        <p className="text-xs text-[var(--rz-text-muted)] mt-4">
          Tipos:{' '}
          {[...new Set(displayEvents.map(e => PANEL_EVENT_TYPE_LABEL[e.type] ?? e.type))].join(' · ')}
        </p>
      )}
    </RadarPageShell>
  )
}
