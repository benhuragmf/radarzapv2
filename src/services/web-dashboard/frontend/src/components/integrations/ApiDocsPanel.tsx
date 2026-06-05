import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Card } from '../ui/Card'
import { Spinner } from '../ui/Spinner'

export function ApiDocsPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['openapi-dashboard'],
    queryFn: () => api.get<Record<string, unknown>>('/integrations/openapi'),
  })

  if (isLoading) {
    return <div className="flex justify-center py-8"><Spinner size={24} /></div>
  }

  const paths = (data?.paths ?? {}) as Record<string, Record<string, { summary?: string; tags?: string[] }>>
  const entries = Object.entries(paths)

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Base URL: <code className="text-gray-400">/api</code> · Autenticação: cookie de sessão (painel) ou{' '}
        <code className="text-gray-400">X-API-Key</code>
      </p>

      <Card className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="text-gray-500 border-b border-gray-800">
              <th className="py-2 pr-3">Método / path</th>
              <th className="py-2">Descrição</th>
            </tr>
          </thead>
          <tbody>
            {entries.flatMap(([path, methods]) =>
              Object.entries(methods).map(([method, meta]) => (
                <tr key={`${method}${path}`} className="border-b border-gray-800/60">
                  <td className="py-2 pr-3 font-mono text-brand-300 whitespace-nowrap">
                    {method.toUpperCase()} {path}
                  </td>
                  <td className="py-2 text-gray-400">{meta.summary ?? '—'}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </Card>

      <Card className="text-xs text-gray-500 space-y-2">
        <p className="font-medium text-gray-300">Exemplo — enviar mensagem (playground ou curl)</p>
        <pre className="bg-gray-900 p-3 rounded-lg overflow-x-auto text-gray-400">{`curl -X POST /api/integrations/playground \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: rz_…" \\
  -d '{"destination":"5511999999999","message":"Olá!"}'`}</pre>
      </Card>
    </div>
  )
}
