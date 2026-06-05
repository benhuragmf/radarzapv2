import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Card } from '../ui/Card'
import { Spinner } from '../ui/Spinner'

export function ApiDocsPanel() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['openapi-dashboard'],
    queryFn: () => api.get<Record<string, unknown>>('/integrations/openapi'),
  })

  if (isLoading) {
    return <div className="flex justify-center py-8"><Spinner size={24} /></div>
  }

  if (isError) {
    return (
      <p className="text-sm text-amber-200/90">
        Não foi possível carregar: {(error as Error).message}
      </p>
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
      <p className="text-xs text-gray-500 leading-relaxed">
        REST em <code className="text-gray-400">/api</code>. Integrações externas: header{' '}
        <code className="text-gray-400">X-API-Key</code>. No painel, a sessão usa cookie.
      </p>

      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full text-xs text-left">
          <thead className="bg-gray-950/50">
            <tr className="text-gray-500 border-b border-gray-800">
              <th className="py-2.5 px-3 font-medium">Endpoint</th>
              <th className="py-2.5 px-3 font-medium">Descrição</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.key} className="border-b border-gray-800/60 last:border-0">
                <td className="py-2 px-3 font-mono text-brand-300 whitespace-nowrap">
                  <span className="text-gray-500 mr-2">{row.method}</span>
                  {row.path}
                </td>
                <td className="py-2 px-3 text-gray-400">{row.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Card className="text-xs text-gray-500 space-y-2 bg-gray-950/30">
        <p className="text-gray-300 font-medium">Exemplo de envio</p>
        <pre className="bg-gray-900 p-3 rounded-lg overflow-x-auto text-gray-400 text-[11px] leading-relaxed">{`POST /api/integrations/playground
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
