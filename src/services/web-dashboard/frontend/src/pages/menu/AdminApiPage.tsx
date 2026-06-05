import { Link } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { Key } from 'lucide-react'

export default function AdminApiPage() {
  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-lg font-semibold text-white flex items-center gap-2">
        <Key size={20} className="text-brand-400" />
        API global
      </h1>
      <p className="text-sm text-gray-500">
        Visão administrativa das integrações e uso da API em todo o RadarZap.
      </p>
      <Card className="text-sm text-gray-400 space-y-2">
        <p>Operações recomendadas:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>
            Investigar falhas de integração em{' '}
            <Link to="/admin/errors" className="text-brand-400 hover:underline">
              Erros do sistema
            </Link>
          </li>
          <li>
            Ver fila e gargalos em{' '}
            <Link to="/admin/queue" className="text-brand-400 hover:underline">
              Fila global
            </Link>
          </li>
          <li>
            Saúde dos serviços em{' '}
            <Link to="/admin/monitoring" className="text-brand-400 hover:underline">
              Monitoramento
            </Link>
          </li>
        </ul>
        <p className="text-xs text-gray-500 pt-2">
          Chaves e webhooks por empresa: aba Plataforma → Integrações (contexto do tenant).
        </p>
      </Card>
    </div>
  )
}
