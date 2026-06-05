import { Link } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { Lock, UserCog } from 'lucide-react'

const ROLES = [
  { role: 'OWNER', desc: 'Acesso total à empresa, plano e equipe' },
  { role: 'ADMIN', desc: 'Gerencia envios, contatos e configurações' },
  { role: 'ATTENDANT', desc: 'Operação limitada conforme permissões RBAC' },
]

export default function PermissionsPage() {
  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-lg font-semibold text-white flex items-center gap-2">
        <Lock size={20} className="text-brand-400" />
        Permissões
      </h1>
      <p className="text-sm text-gray-500">
        Papéis da empresa controlam o que cada membro vê no painel (independente do Discord).
      </p>
      <Link to="/settings/team" className="text-sm text-brand-400 hover:underline">
        Gerenciar equipe →
      </Link>
      <div className="space-y-2">
        {ROLES.map(r => (
          <Card key={r.role}>
            <p className="text-sm font-medium text-white flex items-center gap-2">
              <UserCog size={14} className="text-gray-500" />
              {r.role}
            </p>
            <p className="text-xs text-gray-500 mt-1">{r.desc}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}
