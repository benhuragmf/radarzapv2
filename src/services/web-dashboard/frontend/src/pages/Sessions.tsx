import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { Smartphone, RefreshCw, Power } from 'lucide-react'

interface Session {
  clientId: string
  discordUserId: string
  status: 'connected' | 'disconnected' | 'connecting' | 'qr-required'
  lastActivity: string
  qrCode?: string
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
  const [qrVisible, setQrVisible] = useState<string | null>(null)

  const { data: sessions = [], isLoading } = useQuery<Session[]>({
    queryKey: ['sessions'],
    queryFn: () => api.get('/sessions'),
    refetchInterval: 10_000,
  })

  const connect = useMutation({
    mutationFn: (id: string) => api.post(`/sessions/${id}/connect`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  })

  const disconnect = useMutation({
    mutationFn: (id: string) => api.post(`/sessions/${id}/disconnect`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  })

  if (isLoading) return <div className="flex justify-center pt-20"><Spinner size={32} /></div>

  return (
    <div className="space-y-4">
      {sessions.length === 0 && (
        <Card className="text-center py-12 text-gray-500">
          <Smartphone size={32} className="mx-auto mb-3 opacity-30" />
          <p>Nenhuma sessão encontrada.</p>
        </Card>
      )}

      {sessions.map((s) => (
        <Card key={s.clientId}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Smartphone size={18} className="text-gray-500" />
              <div>
                <p className="text-sm font-medium">{s.discordUserId}</p>
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
                  disabled={connect.isPending}
                >
                  <RefreshCw size={12} />
                  Conectar
                </Button>
              )}

              {s.status === 'connected' && (
                <Button
                  size="sm" variant="danger"
                  onClick={() => disconnect.mutate(s.clientId)}
                  disabled={disconnect.isPending}
                >
                  <Power size={12} />
                  Desconectar
                </Button>
              )}
            </div>
          </div>

          {/* QR Code inline */}
          {s.qrCode && (
            <div className="mt-4 flex flex-col items-center gap-2">
              <p className="text-xs text-yellow-400">Escaneie o QR code com seu WhatsApp</p>
              <img src={s.qrCode} alt="QR Code" className="w-48 h-48 rounded-lg border border-gray-700" />
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}
