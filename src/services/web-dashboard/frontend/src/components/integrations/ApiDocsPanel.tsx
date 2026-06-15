import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Card } from '../ui/Card'
import { LoadingState, ErrorState } from '@/design-system'

export function ApiDocsPanel() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['openapi-dashboard'],
    queryFn: () => api.get<Record<string, unknown>>('/integrations/openapi'),
  })

  if (isLoading) {
    return <LoadingState rows={5} className="py-4" />
  }

  if (isError) {
    return (
      <ErrorState
        message={(error as Error).message}
        title="Não foi possível carregar a documentação"
      />
    )
  }

  const paths = (data?.paths ?? {}) as Record<string, Record<string, { summary?: string }>>
  const rows = Object.entries(paths).flatMap(([path, methods]) =>
    Object.entries(methods).map(([method, meta]) => ({
      key: `${method}${path}`,
      method: method.toUpperCase(),
      path,
      summary: meta.summary ?? '—',
    })),
  )

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--rz-text-muted)] leading-relaxed">
        REST em <code className="text-[var(--rz-text-muted)]">/api</code>. Integrações externas: header{' '}
        <code className="text-[var(--rz-text-muted)]">X-API-Key</code>. No painel, a sessão usa cookie.
      </p>

      <div className="overflow-x-auto rounded-lg border border-[var(--rz-border)]">
        <table className="w-full text-xs text-left">
          <thead className="bg-[var(--rz-surface-muted)]/50">
            <tr className="text-[var(--rz-text-muted)] border-b border-[var(--rz-border)]">
              <th className="py-2.5 px-3 font-medium">Endpoint</th>
              <th className="py-2.5 px-3 font-medium">Descrição</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.key} className="border-b border-[var(--rz-border)]/60 last:border-0">
                <td className="py-2 px-3 font-mono text-brand-300 whitespace-nowrap">
                  <span className="text-[var(--rz-text-muted)] mr-2">{row.method}</span>
                  {row.path}
                </td>
                <td className="py-2 px-3 text-[var(--rz-text-muted)]">{row.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Card className="text-xs text-[var(--rz-text-muted)] space-y-2 bg-[var(--rz-surface-muted)]/30">
        <p className="text-[var(--rz-text-secondary)] font-medium">Exemplo de envio</p>
        <pre className="bg-[var(--rz-surface-muted)] p-3 rounded-lg overflow-x-auto text-[var(--rz-text-secondary)] text-[11px] leading-relaxed">{`POST /api/integrations/playground
X-API-Key: rz_…
{"destination":"5511999999999","message":"Olá!"}`}</pre>
        <p>
          Destino precisa estar cadastrado.{' '}
          <Link to="/integrations/playground" className="text-brand-400 hover:underline">
            Abrir playground
          </Link>
        </p>
      </Card>
    </div>
  )
}
