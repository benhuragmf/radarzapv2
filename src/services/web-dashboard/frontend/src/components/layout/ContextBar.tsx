import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Smartphone } from 'lucide-react'
import { can, type AuthUser } from '../../lib/auth'
import { formatWaSessionLabel } from '../../lib/destinationFormat'

interface Props {
  user: AuthUser
}

interface WaSession {
  status: 'connected' | 'disconnected' | 'connecting' | 'qr-required'
  phoneNumber?: string
  profileName?: string
}

export default function ContextBar({ user }: Props) {
  const showWhatsApp = can(user, 'whatsapp:session:view')

  const { data: sessions = [] } = useQuery<WaSession[]>({
    queryKey: ['sessions'],
    queryFn: () => api.get('/sessions'),
    enabled: showWhatsApp,
    refetchInterval: 15_000,
  })

  const connected = sessions.find(s => s.status === 'connected')
  const waLabel = connected
    ? formatWaSessionLabel({
        phoneNumber: connected.phoneNumber,
        profileName: connected.profileName,
      })
    : sessions.some(s => s.status === 'qr-required')
      ? 'QR pendente'
      : 'Desconectado'

  const waColor = connected
    ? 'text-brand-400 border-brand-600/40 bg-brand-600/10'
    : sessions.some(s => s.status === 'connecting' || s.status === 'qr-required')
      ? 'text-yellow-400 border-yellow-600/40 bg-yellow-600/10'
      : 'text-gray-400 border-gray-700 bg-gray-800'

  if (!showWhatsApp) return null

  return (
    <div className="bg-gray-900/80 border-b border-gray-800 px-6 py-2.5 flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold shrink-0">
          WhatsApp
        </span>
        <Link
          to="/sessions"
          className={`flex items-center gap-2 border rounded-lg px-3 py-1.5 text-sm transition-colors hover:opacity-90 ${waColor}`}
        >
          <Smartphone size={14} className="shrink-0" />
          <span className="truncate max-w-[200px]">{waLabel}</span>
          <span className={`w-2 h-2 rounded-full shrink-0 ${connected ? 'bg-brand-500' : 'bg-gray-600'}`} />
        </Link>
      </div>
    </div>
  )
}
