import { Link } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { Key } from 'lucide-react'
import { RadarPageShell, PageHeader } from '@/design-system'

export default function AdminSecurityPage() {
  return (
    <RadarPageShell>
      <PageHeader
        title="Segurança"
        subtitle="Proteção interna da plataforma: API, acesso staff e boas práticas operacionais."
      />
      <Card className="text-sm text-[var(--rz-text-secondary)] space-y-2">
        <p className="flex items-center gap-2 text-[var(--rz-text-primary)]">
          <Key size={14} /> Checklist recomendado
        </p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>Revogar chaves API de clientes inativos via suporte</li>
          <li>Monitorar erros de autenticação em Erros do sistema</li>
          <li>Registrar ações sensíveis na Auditoria admin</li>
        </ul>
        <p className="pt-2">
          Chaves globais e políticas por tenant:{' '}
          <Link to="/admin/api" className="text-[var(--rz-primary)] hover:underline">
            API global
          </Link>
        </p>
      </Card>
    </RadarPageShell>
  )
}
