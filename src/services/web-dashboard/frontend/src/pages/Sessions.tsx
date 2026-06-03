import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { getSocket } from '../lib/socket'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { Smartphone, RefreshCw, Power, QrCode, User } from 'lucide-react'

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
        className="w-12 h-12 rounded-full object-cover border border-gray-700 shrink-0"
      />
    )
  }
  return (
    <div className="w-12 h-12 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center shrink-0">
      <User size={20} className="text-gray-500" />
    </div>
  )
}

export default function Sessions() {
  const qc = useQueryClient()
  const [liveQr, setLiveQr] = useState<Record<string, string>>({})

  const { data: sessions = [], isLoading } = useQuery<Session[]>({
    queryKey: ['sessions'],
    queryFn: () => api.get('/sessions'),
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
      if (payload.status === 'connected' || payload.event === 'CONNECTION_UPDATE') {
        setLiveQr(prev => {
          const next = { ...prev }
          if (payload.status === 'connected') delete next[payload.clientId]
          return next
        })
      }
      qc.invalidateQueries({ queryKey: ['sessions'] })
    }

    const onSessions = (list: Session[]) => {
      qc.setQueryData(['sessions'], list)
    }

    socket.on('session:update', onSessionUpdate)
    socket.on('sessions', onSessions)
    return () => {
      socket.off('session:update', onSessionUpdate)
      socket.off('sessions', onSessions)
    }
  }, [qc])

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
    onError: (err: Error) => alert(err.message ?? 'Falha ao iniciar conexão WhatsApp'),
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

  if (isLoading) return <div className="flex justify-center pt-20"><Spinner size={32} /></div>

  const waitingQr = sessions.some(s => s.status === 'connecting' || s.status === 'qr-required')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          Conecte o WhatsApp escaneando o QR code abaixo ou use <code className="text-gray-300">/connect-whatsapp</code> no Discord.
        </p>
        <Button
          size="sm"
          onClick={() => startConnect.mutate()}
          disabled={startConnect.isPending}
        >
          <QrCode size={14} />
          {startConnect.isPending ? 'Gerando QR…' : 'Conectar WhatsApp'}
        </Button>
      </div>

      {sessions.length === 0 && (
        <Card className="text-center py-12 text-gray-500">
          <Smartphone size={32} className="mx-auto mb-3 opacity-30" />
          <p className="mb-1">Nenhum WhatsApp conectado.</p>
          <p className="text-xs mb-4">Clique abaixo para iniciar a conexão via QR code.</p>
          <Button onClick={() => startConnect.mutate()} disabled={startConnect.isPending}>
            <QrCode size={14} />
            Conectar WhatsApp
          </Button>
        </Card>
      )}

      {sessions.map((s) => {
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
                  <div className="w-12 h-12 rounded-full bg-gray-800/80 border border-dashed border-gray-600 flex items-center justify-center shrink-0">
                    <QrCode size={18} className="text-gray-500" />
                  </div>
                )}

                <div className="min-w-0 space-y-1">
                  {isConnected ? (
                    <>
                      <p className="text-sm font-medium truncate">
                        {s.profileName || s.phoneNumber || 'WhatsApp'}
                      </p>
                      {s.phoneNumber && (
                        <p className="text-xs text-green-400/90 font-mono">{s.phoneNumber}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        Conectado · {s.lastActivity ? new Date(s.lastActivity).toLocaleString('pt-BR') : '—'}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium">Conectar WhatsApp</p>
                      <p className="text-xs text-gray-500">
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
              <div className="mt-4 flex flex-col items-center gap-2 p-4 bg-gray-900/50 rounded-lg border border-yellow-500/20">
                <p className="text-sm text-yellow-400 font-medium">Escaneie com WhatsApp → Aparelhos conectados</p>
                <img src={qr} alt="QR Code WhatsApp" className="w-72 h-72 sm:w-80 sm:h-80 rounded-lg border border-gray-700 bg-white p-3" />
                <p className="text-xs text-gray-500">
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
}
