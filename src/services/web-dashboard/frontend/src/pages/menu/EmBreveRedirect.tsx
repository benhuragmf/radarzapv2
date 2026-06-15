import { Link, Navigate, useParams } from 'react-router-dom'
import { RadarPageShell, EmptyState } from '../../design-system'
import { Button } from '../../components/ui/Button'

/** Redireciona URLs legadas /em-breve/:slug para rotas definitivas */
const SLUG_REDIRECTS: Record<string, string> = {
  'auditoria-resumida': '/platform/audit',
  campanhas: '/platform/campanhas',
  segmentos: '/platform/segmentos',
  gatilhos: '/platform/gatilhos',
  'wa-logs': '/platform/wa-logs',
  'wa-status': '/platform/wa-status',
  monitoramento: '/admin/monitoring',
  erros: '/admin/errors',
  permissoes: '/settings/permissions',
  seguranca: '/settings/security',
  backup: '/settings/backup',
}

export default function EmBreveRedirect() {
  const { slug } = useParams<{ slug: string }>()
  const target = slug ? SLUG_REDIRECTS[slug] : undefined
  if (target) return <Navigate to={target} replace />
  return (
    <RadarPageShell maxWidth="wide">
      <EmptyState
        title="Página não mapeada"
        description="O atalho legado não possui rota definitiva. Volte ao início do painel."
        action={
          <Link to="/dashboard">
            <Button size="sm" variant="secondary">
              Voltar ao dashboard
            </Button>
          </Link>
        }
      />
    </RadarPageShell>
  )
}

export { SLUG_REDIRECTS }
