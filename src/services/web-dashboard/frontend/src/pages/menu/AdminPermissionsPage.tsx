import { Card } from '../../components/ui/Card'
import { Lock, UserCog } from 'lucide-react'

const STAFF_ROLES = [
  { role: 'SYSTEM_ADMIN', desc: 'Acesso total ao Admin RadarZap e operação global' },
  { role: 'SYSTEM_MODERATOR', desc: 'Moderação, clientes e logs limitados' },
]

export default function AdminPermissionsPage() {
  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-lg font-semibold text-white flex items-center gap-2">
        <Lock size={20} className="text-brand-400" />
        Permissões
      </h1>
      <p className="text-sm text-gray-500">
        Papéis internos do staff RadarZap — separados das permissões de empresa (aba Plataforma).
      </p>
      <div className="space-y-2">
        {STAFF_ROLES.map(r => (
          <Card key={r.role}>
            <p className="text-sm font-medium text-white flex items-center gap-2">
              <UserCog size={14} className="text-gray-500" />
              {r.role}
            </p>
            <p className="text-xs text-gray-500 mt-1">{r.desc}</p>
          </Card>
        ))}
      </div>
      <Card className="text-xs text-gray-500">
        Permissões de membros da empresa (OWNER, ADMIN, ATTENDANT) ficam em Plataforma → Empresa → Permissões.
      </Card>
    </div>
  )
}
