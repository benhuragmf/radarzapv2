import { Link } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { RadarPageShell, PageHeader } from '@/design-system'

export default function AdminBackupPage() {
  return (
    <RadarPageShell>
      <PageHeader
        title="Backup"
        subtitle="Backup administrativo do sistema — distinto do backup de contatos por empresa."
      />
      <Card className="text-sm text-[var(--rz-text-secondary)] space-y-2">
        <p>Rotinas de backup completo (MongoDB, filas, sessões) são operadas na infraestrutura.</p>
        <p>
          Clientes exportam contatos em Plataforma →{' '}
          <Link to="/settings/backup" className="text-[var(--rz-primary)] hover:underline">
            Empresa → Backup
          </Link>
          .
        </p>
        <p className="text-xs text-[var(--rz-text-muted)] pt-2">
          Em produção: agendar snapshots do banco e retenção conforme política Radar Chat.
        </p>
      </Card>
    </RadarPageShell>
  )
}
