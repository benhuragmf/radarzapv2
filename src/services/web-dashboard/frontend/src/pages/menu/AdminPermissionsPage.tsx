import { Link } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { UserCog, ScrollText } from 'lucide-react'
import { RadarPageShell, PageHeader } from '@/design-system'

const STAFF_ROLES = [
  { role: 'SYSTEM_ADMIN', desc: 'Acesso total ao Admin Radar Chat e operação global' },
  { role: 'SYSTEM_MODERATOR', desc: 'Moderação, clientes e logs limitados' },
]

export default function AdminPermissionsPage() {
  return (
    <RadarPageShell maxWidth="wide">
      <PageHeader
        title="Permissões do staff"
        subtitle="Papéis internos do Radar Chat — separados das permissões de empresa (menu Plataforma)."
      />

      <div className="space-y-2">
        {STAFF_ROLES.map(r => (
          <Card key={r.role}>
            <p className="text-sm font-medium text-[var(--rz-text-primary)] flex items-center gap-2">
              <UserCog size={14} className="text-[var(--rz-text-muted)]" />
              {r.role}
            </p>
            <p className="text-xs text-[var(--rz-text-muted)] mt-1">{r.desc}</p>
          </Card>
        ))}
      </div>

      <Card className="space-y-3">
        <p className="text-sm font-medium text-[var(--rz-text-primary)]">Auditoria e segurança</p>
        <ul className="text-sm text-[var(--rz-text-secondary)] space-y-2 list-disc pl-5">
          <li>
            <Link to="/admin/audit" className="text-[var(--rz-primary)] hover:underline inline-flex items-center gap-1">
              <ScrollText size={14} />
              Logs de auditoria
            </Link>{' '}
            — ações sensíveis (consentimento, IA, equipe).
          </li>
          <li>
            <Link to="/admin/moderation" className="text-[var(--rz-primary)] hover:underline">
              Moderação
            </Link>{' '}
            — bloqueios e revisão de contas.
          </li>
        </ul>
      </Card>

      <Card className="text-xs text-[var(--rz-text-muted)]">
        Permissões de membros da empresa (OWNER, ADMIN, ATTENDANT) ficam em Plataforma → Empresa →{' '}
        <Link to="/platform/permissions" className="text-[var(--rz-primary)] hover:underline">
          Permissões
        </Link>
        .
      </Card>
    </RadarPageShell>
  )
}
