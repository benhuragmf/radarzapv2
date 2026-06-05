import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { Card, CardTitle, CardValue } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { api } from '../../lib/api'
import { ShieldCheck } from 'lucide-react'

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
      title="Auditoria resumida"
      description="Resumo dos últimos 7 dias da sua conta — envios, erros e base de contatos."
    >
      {isLoading ? (
        <div className="flex justify-center py-10"><Spinner size={28} /></div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card>
              <CardTitle>Envios (logs)</CardTitle>
              <CardValue>{data.messagesSent}</CardValue>
            </Card>
            <Card>
              <CardTitle>Erros</CardTitle>
              <CardValue>{data.errors}</CardValue>
            </Card>
            <Card>
              <CardTitle>Campanhas</CardTitle>
              <CardValue>{data.campaigns}</CardValue>
            </Card>
            <Card>
              <CardTitle>Contatos ativos</CardTitle>
              <CardValue>{data.activeContacts}</CardValue>
            </Card>
          </div>
          <Card className="flex items-start gap-3 text-sm text-gray-400">
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
