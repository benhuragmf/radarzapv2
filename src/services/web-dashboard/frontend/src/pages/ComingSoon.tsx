import { Link, useParams } from 'react-router-dom'
import { Construction } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

const TITLES: Record<string, string> = {
  campanhas: 'Campanhas',
  segmentos: 'Segmentos',
  'auditoria-resumida': 'Auditoria',
  gatilhos: 'Gatilhos',
  'regras-envio': 'Regras de envio',
  'wa-status': 'Status',
  'wa-logs': 'Logs',
  monitoramento: 'Monitoramento',
  erros: 'Erros do sistema',
  permissoes: 'Permissões',
  seguranca: 'Segurança',
  backup: 'Backup',
  pagamentos: 'Pagamentos',
  moderacao: 'Moderação',
  'audit-global': 'Auditoria',
}

export default function ComingSoon() {
  const { slug } = useParams<{ slug: string }>()
  const title = (slug && TITLES[slug]) || 'Em breve'

  return (
    <div className="max-w-lg mx-auto py-12">
      <Card className="text-center space-y-4 p-8">
        <Construction className="mx-auto text-amber-500" size={40} />
        <h1 className="text-xl font-semibold text-white">{title}</h1>
        <p className="text-sm text-gray-400">
          Esta área está no roadmap da plataforma. Use os atalhos do menu que já estão ativos
          (contatos, envios, WhatsApp, equipe).
        </p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Link to="/dashboard">
            <Button size="sm" variant="secondary">
              Início
            </Button>
          </Link>
          <Link to="/settings/team">
            <Button size="sm" variant="secondary">
              Equipe e cargos
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}
