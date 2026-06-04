import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { Card, CardTitle, CardValue } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { api } from '../../lib/api'
import {
  LayoutDashboard, FileText, Activity, Phone, MessageSquare,
  Smartphone, Clock, Hash,
} from 'lucide-react'

interface PlatformStats {
  contactsCount: number
  messagesToday: number
  waStatus: string
  waState: string
  queuePending: number
  discord: { linkedGuilds: number; activeRules: number; enabled: boolean }
}

const WA_LABEL: Record<string, string> = {
  connected: 'Conectado',
  connecting: 'Conectando',
  'qr-required': 'Aguardando QR',
  disconnected: 'Desconectado',
}

const LINKS = [
  { to: '/dashboard', label: 'Dashboard operacional', icon: LayoutDashboard, hint: 'Gráfico de mensagens em tempo real' },
  { to: '/platform/templates', label: 'Modelos de mensagem', icon: FileText, hint: 'Aniversário, informativos, campanhas' },
  { to: '/platform/reports', label: 'Relatórios', icon: Activity, hint: 'Logs e fila do seu tenant' },
  { to: '/platform/contacts', label: 'Contatos', icon: Phone, hint: 'Import/export CSV' },
] as const

export default function PlatformOverview() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: () => api.get<PlatformStats>('/platform/stats'),
    refetchInterval: 30_000,
  })

  const cards = stats
    ? [
        { label: 'Contatos ativos', value: stats.contactsCount, icon: Phone, color: 'text-brand-400' },
        { label: 'Mensagens hoje', value: stats.messagesToday, icon: MessageSquare, color: 'text-emerald-400' },
        {
          label: 'WhatsApp',
          value: WA_LABEL[stats.waStatus] ?? stats.waStatus,
          icon: Smartphone,
          color: stats.waStatus === 'connected' ? 'text-blue-400' : 'text-amber-400',
          isText: true,
        },
        { label: 'Fila pendente', value: stats.queuePending, icon: Clock, color: 'text-yellow-400' },
      ]
    : []

  return (
    <PlatformPage
      title="Plataforma"
      description="Hub da área Plataforma: modelos, contatos e relatórios do seu tenant — separado da automação Discord → WhatsApp."
      phase="MVP"
    >
      {isLoading && (
        <div className="flex justify-center py-8">
          <Spinner size={28} />
        </div>
      )}

      {!isLoading && stats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map(({ label, value, icon: Icon, color, isText }) => (
              <Card key={label}>
                <div className="flex items-center justify-between mb-3">
                  <CardTitle>{label}</CardTitle>
                  <Icon size={18} className={color} />
                </div>
                {isText ? (
                  <p className="text-lg font-semibold text-white">{value}</p>
                ) : (
                  <CardValue>{typeof value === 'number' ? value.toLocaleString('pt-BR') : value}</CardValue>
                )}
              </Card>
            ))}
          </div>

          {stats.discord.enabled && (
            <Card className="border-violet-800/40 bg-violet-950/20">
              <div className="flex items-center gap-2 text-violet-200 font-medium text-sm">
                <Hash size={16} />
                Discord vinculado
              </div>
              <p className="text-xs text-violet-200/70 mt-2">
                {stats.discord.linkedGuilds} servidor(es) · {stats.discord.activeRules} regra(s) ativa(s)
              </p>
            </Card>
          )}
        </>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {LINKS.map(({ to, label, icon: Icon, hint }) => (
          <Link key={to} to={to}>
            <Card className="hover:border-brand-600/50 transition-colors h-full">
              <div className="flex items-center gap-2 text-white font-medium">
                <Icon size={18} className="text-brand-500" />
                {label}
              </div>
              <p className="text-xs text-gray-500 mt-2">{hint}</p>
            </Card>
          </Link>
        ))}
      </div>

      <p className="text-xs text-gray-500">
        Equipe e convites:{' '}
        <Link to="/settings/team" className="text-brand-400 hover:underline">
          Configurações → Equipe
        </Link>
      </p>
    </PlatformPage>
  )
}
