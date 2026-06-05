import { Link } from 'react-router-dom'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { Card } from '../../components/ui/Card'
import { Zap, Calendar, Repeat } from 'lucide-react'

const TRIGGERS = [
  { icon: Calendar, title: 'Aniversário do contato', hint: 'Dia mês+dia do campo birthday' },
  { icon: Calendar, title: 'Dia fixo do calendário', hint: 'Ex.: todo dia 10 do mês' },
  { icon: Repeat, title: 'Semanal / mensal', hint: 'Rotinas recorrentes' },
  { icon: Zap, title: 'Envio único', hint: 'Data e hora exata (once_at)' },
]

export default function PlatformTriggers() {
  return (
    <PlatformPage
      title="Gatilhos avançados"
      description="Configure quando as mensagens automáticas disparam. Todos os gatilhos ficam em Mensagens automáticas."
    >
      <Link
        to="/platform/automacoes"
        className="inline-flex text-sm text-brand-400 hover:underline mb-4"
      >
        Abrir Mensagens automáticas →
      </Link>
      <div className="grid gap-3 sm:grid-cols-2">
        {TRIGGERS.map(({ icon: Icon, title, hint }) => (
          <Card key={title} className="flex gap-3">
            <Icon size={20} className="text-brand-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-200">{title}</p>
              <p className="text-xs text-gray-500 mt-1">{hint}</p>
            </div>
          </Card>
        ))}
      </div>
    </PlatformPage>
  )
}
