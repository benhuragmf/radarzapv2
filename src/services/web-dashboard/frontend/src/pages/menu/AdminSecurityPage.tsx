import { Link } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { Shield, Key } from 'lucide-react'

export default function AdminSecurityPage() {
  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-lg font-semibold text-white flex items-center gap-2">
        <Shield size={20} className="text-brand-400" />
        Segurança
      </h1>
      <p className="text-sm text-gray-500">
        Proteção interna da plataforma: API, acesso staff e boas práticas operacionais.
      </p>
      <Card className="text-sm text-gray-400 space-y-2">
        <p className="flex items-center gap-2 text-gray-300">
          <Key size={14} /> Checklist recomendado
        </p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>Revogar chaves API de clientes inativos via suporte</li>
          <li>Monitorar erros de autenticação em Erros do sistema</li>
          <li>Registrar ações sensíveis na Auditoria admin</li>
        </ul>
        <p className="pt-2">
          Chaves globais e políticas por tenant:{' '}
          <Link to="/admin/api" className="text-brand-400 hover:underline">
            API global
          </Link>
        </p>
      </Card>
    </div>
  )
}
