import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { getSocket } from '../../lib/socket'
import { cn } from '../../lib/utils'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { Globe, MapPin, ExternalLink, MessageSquare } from 'lucide-react'
import { inboxWebChatUrl } from '../../lib/webchatInbox'
import { notifySuccess, mutationError } from '../../lib/notify'

export interface WebChatLiveVisitorRow {
  id: string
  widgetName?: string
  visitorName?: string
  pageUrl: string
  pageTitle?: string
  trafficSource: string
  referrer?: string
  city?: string
  region?: string
  country?: string
  chatOpened: boolean
  chatEverOpened: boolean
  proactiveInviteClicked?: boolean
  notificationDismissed: boolean
  lastSeenAt: string
  conversationId?: string
}

interface LiveVisitorsResponse {
  count: number
  visitors: WebChatLiveVisitorRow[]
}

function formatPagePath(url: string): string {
  try {
    const u = new URL(url)
    const path = u.pathname + (u.search ? u.search.slice(0, 40) : '')
    return path || '/'
  } catch {
    return url.replace(/^https?:\/\//, '').slice(0, 48)
  }
}

function locationLabel(v: WebChatLiveVisitorRow): string {
  const parts = [v.city, v.region, v.country].filter(Boolean)
  return parts.length ? parts.join(', ') : '—'
}

function secondsAgo(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
}

export function InboxLiveVisitors({
  className,
  canEngage = true,
}: {
  className?: string
  canEngage?: boolean
}) {
  const qc = useQueryClient()
  const navigate = useNavigate()

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['webchat-live-visitors'],
    queryFn: () => api.get<LiveVisitorsResponse>('/webchat/live-visitors'),
    refetchInterval: 15_000,
  })

  const engage = useMutation({
    mutationFn: (input: { presenceId: string; openOnly?: boolean }) =>
      api.post<{ conversationId: string; created: boolean }>(
        `/webchat/live-visitors/${encodeURIComponent(input.presenceId)}/engage`,
        { openOnly: !!input.openOnly },
      ),
    onSuccess: (result, input) => {
      qc.invalidateQueries({ queryKey: ['webchat-live-visitors'] })
      qc.invalidateQueries({ queryKey: ['inbox-conversations'] })
      notifySuccess(input.openOnly ? 'Chat aberto no visitante' : 'Visitante chamado no chat')
      navigate(inboxWebChatUrl(result.conversationId))
    },
    onError: mutationError,
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

  const visitors = data?.visitors ?? []
  const engagingId = engage.isPending ? engage.variables?.presenceId : null

  return (
    <section
      className={cn(
        'rounded-xl border border-[var(--rz-border)] bg-[var(--rz-surface)] overflow-hidden',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--rz-border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-brand-400" />
          <h2 className="text-sm font-semibold text-[var(--rz-text-primary)]">
            Visitantes no site agora
          </h2>
          <Badge
            variant={visitors.length > 0 ? 'green' : 'gray'}
            label={`${visitors.length} online`}
          />
          {isFetching && !isLoading && (
            <span className="text-[10px] text-[var(--rz-text-muted)]">atualizando…</span>
          )}
        </div>
        <p className="text-xs text-[var(--rz-text-muted)]">
          Use <strong className="font-medium text-[var(--rz-text-secondary)]">Chamar</strong> para
          abrir o chat no visitante e conversar no Inbox
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : visitors.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-[var(--rz-text-muted)]">
          Nenhum visitante com o widget ativo no momento. Abra o preview do chat do site para testar.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/50 text-[var(--rz-text-muted)]">
                <th className="px-3 py-2 font-medium">Página</th>
                <th className="px-3 py-2 font-medium">Origem</th>
                <th className="px-3 py-2 font-medium">Cidade</th>
                <th className="px-3 py-2 font-medium">Chat</th>
                <th className="px-3 py-2 font-medium">Convite</th>
                <th className="px-3 py-2 font-medium">Ativo</th>
                <th className="px-3 py-2 font-medium">Ação</th>
              </tr>
            </thead>
            <tbody>
              {visitors.map(v => {
                const ago = secondsAgo(v.lastSeenAt)
                const convLink = v.conversationId ? inboxWebChatUrl(v.conversationId) : null
                return (
                  <tr
                    key={v.id}
                    className="border-b border-[var(--rz-border)]/60 last:border-0 hover:bg-[var(--rz-surface-muted)]/30"
                  >
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-[var(--rz-text)] truncate max-w-[200px]">
                        {v.pageTitle || formatPagePath(v.pageUrl)}
                      </div>
                      {v.pageUrl && (
                        <a
                          href={v.pageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-brand-400 hover:underline truncate max-w-[200px]"
                        >
                          {formatPagePath(v.pageUrl)}
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      )}
                      {v.widgetName && (
                        <div className="text-[10px] text-[var(--rz-text-muted)] mt-0.5">
                          {v.widgetName}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--rz-text-secondary)]">
                      <span className="font-medium">{v.trafficSource}</span>
                      {v.referrer && v.trafficSource !== 'Direto' && (
                        <div className="text-[10px] text-[var(--rz-text-muted)] truncate max-w-[140px]">
                          {v.referrer.replace(/^https?:\/\//, '')}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--rz-text-secondary)]">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-[var(--rz-text-muted)]" />
                        {locationLabel(v)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {v.chatOpened ? (
                        <Badge variant="green" label="Aberto" />
                      ) : v.chatEverOpened || v.proactiveInviteClicked ? (
                        <Badge variant="blue" label="Clicou" />
                      ) : (
                        <span className="text-[var(--rz-text-muted)]">Não clicou</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {v.proactiveInviteClicked ? (
                        <Badge variant="green" label="Clicou no convite" />
                      ) : v.notificationDismissed ? (
                        <Badge variant="yellow" label="Fechou convite" />
                      ) : (
                        <span className="text-[var(--rz-text-muted)]">Exibido</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--rz-text-muted)] whitespace-nowrap">
                      {ago < 60 ? `${ago}s` : `${Math.floor(ago / 60)}min`}
                      {convLink && v.visitorName && (
                        <div>
                          <Link to={convLink} className="text-brand-400 hover:underline">
                            {v.visitorName}
                          </Link>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {canEngage ? (
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant={convLink ? 'secondary' : 'primary'}
                            disabled={engagingId === v.id}
                            onClick={() =>
                              engage.mutate({
                                presenceId: v.id,
                                openOnly: !!convLink,
                              })
                            }
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            {engagingId === v.id
                              ? 'Chamando…'
                              : convLink
                                ? 'Abrir chat'
                                : 'Chamar no chat'}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-[var(--rz-text-muted)]">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
