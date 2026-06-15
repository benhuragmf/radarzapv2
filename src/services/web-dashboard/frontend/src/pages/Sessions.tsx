import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { getSocket } from '../lib/socket'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Smartphone, RefreshCw, Power, QrCode, User } from 'lucide-react'
import { formatPhone } from '../lib/destinationFormat'
import { notifyError, notifySuccess, notifyInfo, mutationError } from '../lib/notify'
import { RadarPageShell, PageHeader, EmptyState, LoadingState } from '@/design-system'

interface Session {
  clientId: string
  discordUserId: string
  displayName: string
  status: 'connected' | 'disconnected' | 'connecting' | 'qr-required'
  state?: 'open' | 'connecting' | 'close'
  lastActivity: string
  qrCode?: string
  qrCount?: number
  profileName?: string
  phoneNumber?: string
  profilePictureUrl?: string
  wuid?: string
  hasPersistedSession?: boolean
}

interface ConnectResponse {
  ok?: boolean
  clientId?: string
  instance?: { clientId: string; state: string }
  qrcode?: { base64: string; code: string; count: number }
}

function statusBadge(status: Session['status']) {
  const map = {
    connected:    { label: 'Conectado',    variant: 'green'  },
    disconnected: { label: 'Desconectado', variant: 'red'    },
    connecting:   { label: 'Conectando',   variant: 'yellow' },
    'qr-required':{ label: 'QR Pendente',  variant: 'blue'   },
  } as const
  const { label, variant } = map[status] ?? { label: status, variant: 'gray' as const }
  return <Badge label={label} variant={variant} />
}

function WaAvatar({ url, name }: { url?: string; name?: string }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name ?? 'WhatsApp'}
        className="w-12 h-12 rounded-full object-cover border border-[var(--rz-border)] shrink-0"
      />
    )
  }
  return (
    <div className="w-12 h-12 rounded-full bg-[var(--rz-surface-muted)] border border-[var(--rz-border)] flex items-center justify-center shrink-0">
      <User size={20} className="text-[var(--rz-text-muted)]" />
    </div>
  )
}

export default function Sessions() {
  const qc = useQueryClient()
  const { pathname } = useLocation()
  const isAdminScope = pathname.startsWith('/admin/sessions')
  const [liveQr, setLiveQr] = useState<Record<string, string>>({})

  const sessionScope = isAdminScope ? 'all' : 'tenant'
  const sessionQueryKey = useMemo(() => ['sessions', sessionScope] as const, [sessionScope])

  const { data: sessions = [], isLoading } = useQuery<Session[]>({
    queryKey: sessionQueryKey,
    queryFn: () => api.get(isAdminScope ? '/sessions?scope=all' : '/sessions'),
    refetchInterval: (query) => {
      const list = query.state.data ?? []
      const needsFastPoll = list.some(s =>
        s.status === 'connecting' || s.status === 'qr-required',
      )
      return needsFastPoll ? 2_000 : 10_000
    },
  })

  useEffect(() => {
    const socket = getSocket()

    const onSessionUpdate = (payload: {
      clientId: string
      qrCode?: string
      status?: string
      event?: string
      data?: { qrcode?: { base64?: string } }
    }) => {
      const qr =
        payload.qrCode ??
        payload.data?.qrcode?.base64
      if (qr) {
        setLiveQr(prev => ({ ...prev, [payload.clientId]: qr }))
      }
      if (
        payload.status === 'connected' ||
        payload.status === 'disconnected' ||
        payload.event === 'CONNECTION_UPDATE'
      ) {
        setLiveQr(prev => {
          const next = { ...prev }
          if (payload.status === 'connected') delete next[payload.clientId]
          return next
        })
      }
      qc.invalidateQueries({ queryKey: ['sessions'] })
    }

    const onSessions = (list: Session[]) => {
      qc.setQueryData(sessionQueryKey, list)
    }

    socket.on('session:update', onSessionUpdate)
    socket.on('sessions', onSessions)
    return () => {
      socket.off('session:update', onSessionUpdate)
      socket.off('sessions', onSessions)
    }
  }, [qc, sessionQueryKey])

  const uniqueSessions = useMemo(() => {
    const map = new Map<string, Session>()
    for (const s of sessions) {
      if (!map.has(s.clientId)) map.set(s.clientId, s)
    }
    return [...map.values()]
  }, [sessions])

  const applyConnectResult = (clientId: string, data: ConnectResponse) => {
    if (data.qrcode?.base64) {
      setLiveQr(prev => ({ ...prev, [clientId]: data.qrcode!.base64 }))
    }
    qc.invalidateQueries({ queryKey: ['sessions'] })
  }

  const startConnect = useMutation({
    mutationFn: () => api.post<ConnectResponse>('/sessions/connect', { forceQr: true }),
    onSuccess: (data) => {
      const id = data.instance?.clientId ?? data.clientId
      if (id) applyConnectResult(id, data)
      else qc.invalidateQueries({ queryKey: ['sessions'] })
    },
    onError: mutationError,
  })

  const connect = useMutation({
    mutationFn: (id: string) => api.post<ConnectResponse>(`/sessions/${id}/connect`),
    onSuccess: (data, id) => applyConnectResult(id, data),
  })

  const logout = useMutation({
    mutationFn: (id: string) => api.delete(`/sessions/${id}/logout`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  })

  const restart = useMutation({
    mutationFn: (id: string) => api.post(`/sessions/${id}/restart`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  })

  if (isLoading) {
    return (
      <RadarPageShell>
        <LoadingState rows={4} className="pt-12" />
      </RadarPageShell>
    )
  }

  const hasConnected = uniqueSessions.some(s => s.status === 'connected')

  const content = (
    <div className="space-y-4">
      {!isAdminScope && (
        <PageHeader
          title="Sessões e QR Code"
          subtitle={
            <>
              Conexão ativa da empresa. Histórico de eventos em{' '}
              <Link to="/platform/wa-status" className="text-[var(--rz-primary)] hover:underline">
                Status das conexões
              </Link>
              .
            </>
          }
        />
      )}

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-[var(--rz-text-muted)]">
          {hasConnected
            ? 'WhatsApp conectado. Use Reiniciar ou Desconectar no card abaixo.'
            : (
              <>
                Conecte o WhatsApp escaneando o QR code abaixo ou use{' '}
                <code className="text-[var(--rz-text-secondary)]">/connect-whatsapp</code> no Discord.
              </>
            )}
        </p>
        {!hasConnected && (
          <Button
            size="sm"
            onClick={() => startConnect.mutate()}
            disabled={startConnect.isPending}
            className="shrink-0"
          >
            <QrCode size={14} />
            {startConnect.isPending ? 'Gerando QR…' : 'Conectar WhatsApp'}
          </Button>
        )}
      </div>

      {uniqueSessions.length === 0 && (
        <EmptyState
          icon={Smartphone}
          title="Nenhum WhatsApp conectado"
          description="Clique abaixo para iniciar a conexão via QR code."
          action={
            <Button onClick={() => startConnect.mutate()} disabled={startConnect.isPending}>
              <QrCode size={14} />
              Conectar WhatsApp
            </Button>
          }
        />
      )}

      {uniqueSessions.map((s) => {
        const qr = liveQr[s.clientId] ?? s.qrCode
        const isConnected = s.status === 'connected'
        const isPending = s.status === 'connecting' || s.status === 'qr-required'

        return (
          <Card key={s.clientId}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                {isConnected ? (
                  <WaAvatar url={s.profilePictureUrl} name={s.profileName} />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[var(--rz-surface-muted)]/80 border border-dashed border-[var(--rz-border)] flex items-center justify-center shrink-0">
                    <QrCode size={18} className="text-[var(--rz-text-muted)]" />
                  </div>
                )}

                <div className="min-w-0 space-y-1">
                  {isConnected ? (
                    <>
                      <p className="text-sm font-medium truncate">
                        {s.profileName ||
                          (s.phoneNumber ? formatPhone(s.phoneNumber) : 'WhatsApp')}
                      </p>
                      {s.phoneNumber && s.profileName && (
                        <p className="text-xs text-green-400/90 font-mono">
                          {formatPhone(s.phoneNumber)}
                        </p>
                      )}
                      <p className="text-xs text-[var(--rz-text-muted)]">
                        Conectado · {s.lastActivity ? new Date(s.lastActivity).toLocaleString('pt-BR') : '—'}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium">Conectar WhatsApp</p>
                      <p className="text-xs text-[var(--rz-text-muted)]">
                        {isPending ? 'Escaneie o QR code abaixo com seu celular' : 'Aguardando início da conexão…'}
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {statusBadge(s.status)}

                {isPending && (
                  <Button
                    size="sm" variant="secondary"
                    onClick={() => connect.mutate(s.clientId)}
                    disabled={connect.isPending}
                  >
                    <RefreshCw size={12} />
                    Novo QR
                  </Button>
                )}

                {isConnected && (
                  <>
                    <Button
                      size="sm" variant="secondary"
                      onClick={() => restart.mutate(s.clientId)}
                      disabled={restart.isPending}
                    >
                      <RefreshCw size={12} />
                      Reiniciar
                    </Button>
                    <Button
                      size="sm" variant="danger"
                      onClick={() => logout.mutate(s.clientId)}
                      disabled={logout.isPending}
                    >
                      <Power size={12} />
                      Desconectar
                    </Button>
                  </>
                )}
              </div>
            </div>

            {qr && isPending && (
              <div className="mt-4 flex flex-col items-center gap-2 p-4 bg-[var(--rz-surface)]/50 rounded-lg border border-yellow-500/20">
                <p className="text-sm text-yellow-400 font-medium">Escaneie com WhatsApp → Aparelhos conectados</p>
                <img src={qr} alt="QR Code WhatsApp" className="w-72 h-72 sm:w-80 sm:h-80 rz-qr-frame" />
                <p className="text-xs text-[var(--rz-text-muted)]">
                  {s.qrCount ? `QR #${s.qrCount} · ` : ''}
                  O QR expira em ~2 minutos. Clique Novo QR se expirar.
                </p>
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )

  return isAdminScope ? content : <RadarPageShell>{content}</RadarPageShell>
}
