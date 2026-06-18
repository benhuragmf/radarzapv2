import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '../lib/api'
import { getSocket } from '../lib/socket'
import { RadarPageShell, PageHeader, DashboardShell, MetricCard, LoadingState } from '@/design-system'
import { Card, CardTitle } from '../components/ui/Card'
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

  if (isLoading) {
    return (
      <RadarPageShell>
        <LoadingState rows={4} className="pt-12" />
      </RadarPageShell>
    )
  }

  const subtitle = platform
    ? `Resumo da sua conta — envios, WhatsApp, fila e atalhos. · ${platform.contactsCount} contato(s) · WA ${WA_LABEL[platform.waStatus] ?? platform.waStatus}`
    : 'Resumo da sua conta — envios, WhatsApp, fila e atalhos rápidos.'

  const metrics = (
    <>
      <MetricCard title="Mensagens hoje" value={(stats?.totalMessages ?? platform?.messagesToday ?? 0).toLocaleString('pt-BR')} icon={MessageSquare} />
      <MetricCard title="Sessões ativas" value={stats?.activeSessions ?? 0} icon={Smartphone} />
      <MetricCard title="Fila pendente" value={stats?.pendingJobs ?? platform?.queuePending ?? 0} icon={Clock} />
      <MetricCard title="Falhas recentes" value={stats?.failedJobs ?? 0} icon={AlertTriangle} status={stats?.failedJobs ? { status: 'danger', text: 'Atenção' } : undefined} />
    </>
  )

  return (
    <RadarPageShell>
      <PageHeader title="Visão geral" subtitle={subtitle} />
      <DashboardShell metrics={metrics}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {QUICK_LINKS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-2 px-4 py-3 rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface)] hover:border-[var(--rz-primary)]/40 text-sm text-[var(--rz-text-secondary)] hover:text-[var(--rz-text-primary)] transition-colors shadow-[var(--rz-shadow-card)]"
            >
              <Icon size={16} className="text-[var(--rz-primary)] shrink-0" />
              {label}
            </Link>
          ))}
        </div>

        <Card>
          <CardTitle>Mensagens por hora</CardTitle>
          <div className="mt-4 h-48 w-full min-w-0">
            {stats?.messagesPerHour?.length ? (
              <ResponsiveContainer width="100%" height={192} minWidth={0}>
                <AreaChart data={stats.messagesPerHour}>
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="hour" tick={{ fill: 'var(--rz-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--rz-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--rz-surface)',
                      border: '1px solid var(--rz-border)',
                      borderRadius: 8,
                    }}
                    labelStyle={{ color: 'var(--rz-text-secondary)' }}
                    itemStyle={{ color: 'var(--rz-primary)' }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fill="url(#grad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-[var(--rz-text-muted)] text-sm">
                Sem dados de mensagens ainda
              </div>
            )}
          </div>
        </Card>
      </DashboardShell>
    </RadarPageShell>
  )
}
