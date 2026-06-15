import { Link } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { ApiKeysPanel } from '../../components/integrations/ApiKeysPanel'
import { RadarPageShell, PageHeader } from '@/design-system'

export default function SecuritySettings() {
  return (
    <RadarPageShell>
      <PageHeader
        title="Segurança"
        subtitle="Revogue chaves comprometidas e limite integrações externas."
      />
      <ApiKeysPanel />
      <Card className="text-xs text-[var(--rz-text-muted)]">
        Sessão do painel: cookie HttpOnly. Para integrações use apenas HTTPS e rotacionar chaves
        periodicamente.{' '}
        <Link to="/settings#api-webhooks" className="text-[var(--rz-primary)] hover:underline">
          Webhooks
        </Link>
      </Card>
    </RadarPageShell>
  )
}
