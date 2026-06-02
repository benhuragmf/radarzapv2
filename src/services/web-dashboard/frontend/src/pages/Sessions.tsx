import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { getSocket } from '../lib/socket'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { Smartphone, RefreshCw, Power, QrCode } from 'lucide-react'

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
}

interface ConnectResponse {
  ok?: boolean
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
    mutationFn: () => api.post<ConnectResponse>('/sessions/connect', {}),
    onSuccess: (data) => {
      const id = data.instance?.clientId
      if (id) applyConnectResult(id, data)
      else qc.invalidateQueries({ queryKey: ['sessions'] })
    },
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
          disabled={startConnect.isPending || waitingQr}
        >
          <QrCode size={14} />
          {waitingQr ? 'Aguardando QR…' : 'Conectar WhatsApp'}
        </Button>
      </div>

      {sessions.length === 0 && (
        <Card className="text-center py-12 text-gray-500">
          <Smartphone size={32} className="mx-auto mb-3 opacity-30" />
          <p className="mb-4">Nenhuma sessão encontrada.</p>
          <Button onClick={() => startConnect.mutate()} disabled={startConnect.isPending}>
            <QrCode size={14} />
            Conectar WhatsApp
          </Button>
        </Card>
      )}

      {sessions.map((s) => {
        const qr = liveQr[s.clientId] ?? s.qrCode
        return (
          <Card key={s.clientId}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone size={18} className="text-gray-500" />
                <div>
                  <p className="text-sm font-medium">{s.displayName || s.discordUserId}</p>
                  {s.profileName && s.status === 'connected' && (
                    <p className="text-xs text-green-500/80">WhatsApp: {s.profileName}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    Última atividade: {s.lastActivity ? new Date(s.lastActivity).toLocaleString('pt-BR') : '—'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {statusBadge(s.status)}

                {s.status !== 'connected' && (
                  <Button
                    size="sm" variant="secondary"
                    onClick={() => connect.mutate(s.clientId)}
                    disabled={connect.isPending || s.status === 'connecting' || s.status === 'qr-required'}
                  >
                    <RefreshCw size={12} />
                    Conectar
                  </Button>
                )}

                {s.status === 'connected' && (
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

            {qr && s.status !== 'connected' && (
              <div className="mt-4 flex flex-col items-center gap-2 p-4 bg-gray-900/50 rounded-lg border border-yellow-500/20">
                <p className="text-sm text-yellow-400 font-medium">Escaneie com WhatsApp → Aparelhos conectados</p>
                <img src={qr} alt="QR Code WhatsApp" className="w-72 h-72 sm:w-80 sm:h-80 rounded-lg border border-gray-700 bg-white p-3" />
                <p className="text-xs text-gray-500">
                  {s.qrCount ? `QR #${s.qrCount} · ` : ''}
                  O QR expira em ~2 minutos. Clique Conectar novamente se expirar.
                </p>
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
