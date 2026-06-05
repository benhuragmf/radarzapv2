import { Link } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { CreditCard } from 'lucide-react'

export default function AdminPaymentsPage() {
  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-lg font-semibold text-white flex items-center gap-2">
        <CreditCard size={20} className="text-brand-400" />
        Pagamentos
      </h1>
      <p className="text-sm text-gray-500">
        Controle de assinaturas, pagamentos pendentes e vencimentos dos clientes RadarZap.
      </p>
      <Card className="text-sm text-gray-400 space-y-3">
        <p>Módulo financeiro em expansão. Enquanto isso:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>
            Consulte planos em{' '}
            <Link to="/admin/plans" className="text-brand-400 hover:underline">
              Planos
            </Link>
          </li>
          <li>
            Veja clientes e status em{' '}
            <Link to="/admin/clients" className="text-brand-400 hover:underline">
              Clientes
            </Link>
          </li>
        </ul>
      </Card>
    </div>
  )
}
