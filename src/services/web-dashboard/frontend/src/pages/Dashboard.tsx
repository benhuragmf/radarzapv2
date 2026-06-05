import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '../lib/api'
import { getSocket } from '../lib/socket'
import { Card, CardTitle, CardValue } from '../components/ui/Card'
import { Spinner } from '../components/ui/Spinner'
import {
  MessageSquare, Smartphone, AlertTriangle, Clock, Phone, Send, FileText, ScrollText,
} from 'lucide-react'

interface Stats {
  totalMessages: number
  activeSessions: number
  pendingJobs: number
  failedJobs: number
  messagesPerHour: { hour: string; count: number }[]
}

interface PlatformStats {
  contactsCount: number
  messagesToday: number
  waStatus: string
  queuePending: number
}

const WA_LABEL: Record<string, string> = {
  connected: 'Conectado',
  connecting: 'Conectando',
  'qr-required': 'Aguardando QR',
  disconnected: 'Desconectado',
}

const QUICK_LINKS = [
  { to: '/send', label: 'Enviar agora', icon: Send },
  { to: '/contact', label: 'Contatos', icon: Phone },
  { to: '/platform/templates', label: 'Modelos', icon: FileText },
  { to: '/platform/reports', label: 'Relatórios', icon: ScrollText },
] as const

export default function Dashboard() {
  const [liveStats, setLiveStats] = useState<Stats | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.get<Stats>('/stats'),
    refetchInterval: 30_000,
  })

  const { data: platform } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: () => api.get<PlatformStats>('/platform/stats'),
    refetchInterval: 30_000,
  })

  useEffect(() => {
    const socket = getSocket()
    socket.on('stats', (s: Stats) => setLiveStats(s))
    return () => { socket.off('stats') }
  }, [])

  const stats = liveStats ?? data

  if (isLoading) return <div className="flex justify-center pt-20"><Spinner size={32} /></div>

  const cards = [
    { label: 'Mensagens hoje', value: stats?.totalMessages ?? platform?.messagesToday ?? 0, icon: MessageSquare, color: 'text-brand-400' },
    { label: 'Sessões ativas', value: stats?.activeSessions ?? 0, icon: Smartphone, color: 'text-blue-400' },
    { label: 'Fila pendente', value: stats?.pendingJobs ?? platform?.queuePending ?? 0, icon: Clock, color: 'text-yellow-400' },
    { label: 'Falhas recentes', value: stats?.failedJobs ?? 0, icon: AlertTriangle, color: 'text-red-400' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Visão geral</h1>
        <p className="text-sm text-gray-500 mt-1">
          Resumo da sua conta — envios, WhatsApp, fila e atalhos rápidos.
          {platform && (
            <span className="ml-2 text-gray-600">
              · {platform.contactsCount} contato(s) · WA{' '}
              {WA_LABEL[platform.waStatus] ?? platform.waStatus}
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <div className="flex items-center justify-between mb-3">
              <CardTitle>{label}</CardTitle>
              <Icon size={18} className={color} />
            </div>
            <CardValue>{value.toLocaleString('pt-BR')}</CardValue>
          </Card>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {QUICK_LINKS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-2 px-4 py-3 rounded-lg border border-gray-800 bg-gray-900/40 hover:border-brand-500/40 text-sm text-gray-300 transition-colors"
          >
            <Icon size={16} className="text-brand-400 shrink-0" />
            {label}
          </Link>
        ))}
      </div>

      <Card>
        <CardTitle>Mensagens por hora</CardTitle>
        <div className="mt-4 h-48">
          {stats?.messagesPerHour?.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.messagesPerHour}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="hour" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#9ca3af' }}
                  itemStyle={{ color: '#22c55e' }}
                />
                <Area type="monotone" dataKey="count" stroke="#22c55e" strokeWidth={2} fill="url(#grad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-600 text-sm">
              Sem dados de mensagens ainda
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
