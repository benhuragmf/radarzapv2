import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { getSocket } from '../../lib/socket'
import { cn } from '../../lib/utils'
import { Globe } from 'lucide-react'
import type { WebChatLiveVisitorRow } from './InboxLiveVisitors'

interface LiveVisitorsResponse {
  count: number
  visitors: WebChatLiveVisitorRow[]
}

/** Faixa compacta — visível mesmo com conversa aberta (chatFocus). */
export function InboxLiveVisitorsStrip({ className }: { className?: string }) {
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ['webchat-live-visitors'],
    queryFn: () => api.get<LiveVisitorsResponse>('/webchat/live-visitors'),
    refetchInterval: 15_000,
  })

  useEffect(() => {
    const socket = getSocket()
    const onPresence = () => {
      qc.invalidateQueries({ queryKey: ['webchat-live-visitors'] })
    }
    socket.on('webchat:presence', onPresence)
    return () => {
      socket.off('webchat:presence', onPresence)
    }
  }, [qc])

  const count = data?.visitors?.length ?? 0

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/50 px-3 py-2 text-xs',
        className,
      )}
    >
      <div className="flex items-center gap-2 text-[var(--rz-text-secondary)]">
        <Globe className="h-3.5 w-3.5 text-brand-400" />
        <span>
          <strong className="text-[var(--rz-text-primary)]">{count}</strong> visitante(s) no site
        </span>
      </div>
      <Link
        to="/platform/inbox"
        className="text-brand-400 hover:underline"
        title="Feche a conversa para ver a lista completa de visitantes"
      >
        Ver lista completa
      </Link>
    </div>
  )
}
