import { Link, Navigate, useParams } from 'react-router-dom'

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
    <div className="max-w-lg mx-auto py-12 text-center text-gray-500 text-sm">
      <p>Página não mapeada.</p>
      <Link to="/dashboard" className="text-brand-400 hover:underline mt-2 inline-block">
        Voltar ao dashboard
      </Link>
    </div>
  )
}

export { SLUG_REDIRECTS }
