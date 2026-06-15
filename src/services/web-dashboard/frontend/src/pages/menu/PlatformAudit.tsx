import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { Card } from '../../components/ui/Card'
import { api } from '../../lib/api'
import { ShieldCheck } from 'lucide-react'
import { LoadingState, MetricCard } from '@/design-system'

export default function PlatformAudit() {
  const { data, isLoading } = useQuery({
    queryKey: ['audit-summary'],
    queryFn: () =>
      api.get<{
        periodDays: number
        messagesSent: number
        errors: number
        campaigns: number
        activeContacts: number
      }>('/integrations/audit-summary'),
  })

  return (
    <PlatformPage
      title="Auditoria"
      description="Resumo dos últimos 7 dias da sua conta — envios, erros e base de contatos."
    >
      {isLoading ? (
        <LoadingState rows={3} className="pt-4" />
      ) : data ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard title="Envios (logs)" value={data.messagesSent} icon={ShieldCheck} />
            <MetricCard title="Erros" value={data.errors} status={data.errors > 0 ? { status: 'danger', text: 'Atenção' } : undefined} />
            <MetricCard title="Campanhas" value={data.campaigns} />
            <MetricCard title="Contatos ativos" value={data.activeContacts} />
          </div>
          <Card className="flex items-start gap-3 text-sm text-[var(--rz-text-muted)]">
            <ShieldCheck size={18} className="text-brand-500 shrink-0 mt-0.5" />
            <p>
              Detalhes completos em{' '}
              <Link to="/platform/reports" className="text-brand-400 hover:underline">
                Relatórios
              </Link>{' '}
              e{' '}
              <Link to="/send/historico" className="text-brand-400 hover:underline">
                Histórico de envios
              </Link>
              .
            </p>
          </Card>
        </>
      ) : null}
    </PlatformPage>
  )
}
