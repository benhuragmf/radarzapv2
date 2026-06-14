import { Link } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { Lock, UserCog, ScrollText, Shield } from 'lucide-react'

const STAFF_ROLES = [
  { role: 'SYSTEM_ADMIN', desc: 'Acesso total ao Admin RadarZap e operação global' },
  { role: 'SYSTEM_MODERATOR', desc: 'Moderação, clientes e logs limitados' },
]

export default function AdminPermissionsPage() {
  return (
    <div className="space-y-5 max-w-3xl">
      <h1 className="text-lg font-semibold text-white flex items-center gap-2">
        <Lock size={20} className="text-brand-400" />
        Permissões do staff
      </h1>
      <p className="text-sm text-gray-500">
        Papéis internos do RadarZap — separados das permissões de empresa (menu Plataforma).
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

      <Card className="space-y-3">
        <p className="text-sm font-medium text-white flex items-center gap-2">
          <Shield size={14} className="text-brand-400" />
          Auditoria e segurança
        </p>
        <ul className="text-sm text-gray-400 space-y-2 list-disc pl-5">
          <li>
            <Link to="/admin/audit" className="text-brand-400 hover:underline inline-flex items-center gap-1">
              <ScrollText size={14} />
              Logs de auditoria
            </Link>{' '}
            — ações sensíveis (consentimento, IA, equipe).
          </li>
          <li>
            <Link to="/admin/moderation" className="text-brand-400 hover:underline">
              Moderação
            </Link>{' '}
            — bloqueios e revisão de contas.
          </li>
        </ul>
      </Card>

      <Card className="text-xs text-gray-500">
        Permissões de membros da empresa (OWNER, ADMIN, ATTENDANT) ficam em Plataforma → Empresa →{' '}
        <Link to="/platform/permissions" className="text-brand-400 hover:underline">
          Permissões
        </Link>
        .
      </Card>
    </div>
  )
}
