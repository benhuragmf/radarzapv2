import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '../lib/api'
import { getSocket } from '../lib/socket'
import { Card, CardTitle, CardValue } from '../components/ui/Card'
import { Spinner } from '../components/ui/Spinner'
import { MessageSquare, Smartphone, AlertTriangle, Clock } from 'lucide-react'

interface Stats {
  totalMessages: number
  activeSessions: number
  pendingJobs: number
  failedJobs: number
  messagesPerHour: { hour: string; count: number }[]
}

export default function Dashboard() {
  const [liveStats, setLiveStats] = useState<Stats | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.get<Stats>('/stats'),
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
    { label: 'Mensagens Hoje',    value: stats?.totalMessages  ?? 0, icon: MessageSquare, color: 'text-brand-400' },
    { label: 'Sessões Ativas',    value: stats?.activeSessions ?? 0, icon: Smartphone,    color: 'text-blue-400'  },
    { label: 'Jobs Pendentes',    value: stats?.pendingJobs    ?? 0, icon: Clock,         color: 'text-yellow-400'},
    { label: 'Falhas',            value: stats?.failedJobs     ?? 0, icon: AlertTriangle, color: 'text-red-400'   },
  ]

  return (
    <div className="space-y-6">
      {/* Stat cards */}
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

      {/* Chart */}
      <Card>
        <CardTitle>Mensagens por hora</CardTitle>
        <div className="mt-4 h-48">
          {stats?.messagesPerHour?.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.messagesPerHour}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}   />
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
