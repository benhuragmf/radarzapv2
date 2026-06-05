import { Link } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { Shield, UserX, Ban } from 'lucide-react'

export default function AdminModeration() {
  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-lg font-semibold text-white flex items-center gap-2">
        <Shield size={20} className="text-brand-400" />
        Moderação
      </h1>
      <p className="text-sm text-gray-500">
        Ferramentas para bloquear contatos, revisar consentimento e agir sobre abusos.
      </p>
      <div className="grid gap-3">
        <Card className="flex gap-3">
          <UserX size={20} className="text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-200">Bloqueio manual de contato</p>
            <p className="text-xs text-gray-500 mt-1">
              Via API <code className="text-gray-400">POST /api/admin/destinations/:id/block</code>
            </p>
          </div>
        </Card>
        <Card className="flex gap-3">
          <Ban size={20} className="text-red-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-200">Consentimento recusado</p>
            <p className="text-xs text-gray-500 mt-1">
              Filtre em{' '}
              <Link to="/contact?consent=refused" className="text-brand-400 hover:underline">
                Contatos → Recusados
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
