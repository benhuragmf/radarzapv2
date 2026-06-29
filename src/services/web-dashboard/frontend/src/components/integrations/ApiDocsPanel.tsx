import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { api } from '../../lib/api'
import { DataTable, ErrorState, InlineNotice, LoadingState } from '@/design-system'

interface ApiDocRow {
  key: string
  method: string
  path: string
  summary: string
}

const columns: ColumnDef<ApiDocRow, unknown>[] = [
  {
    accessorKey: 'path',
    header: 'Endpoint',
    cell: ({ row }) => (
      <span className="font-mono text-xs text-brand-300">
        <span className="mr-2 text-[var(--rz-text-muted)]">{row.original.method}</span>
        {row.original.path}
      </span>
    ),
  },
  {
    accessorKey: 'summary',
    header: 'Descrição',
    cell: ({ row }) => (
      <span className="text-xs text-[var(--rz-text-secondary)]">{row.original.summary}</span>
    ),
  },
]

export function ApiDocsPanel() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['openapi-dashboard'],
    queryFn: () => api.get<Record<string, unknown>>('/integrations/openapi'),
  })

  const rows = useMemo<ApiDocRow[]>(() => {
    const paths = (data?.paths ?? {}) as Record<string, Record<string, { summary?: string }>>
    return Object.entries(paths).flatMap(([path, methods]) =>
      Object.entries(methods).map(([method, meta]) => ({
        key: `${method}${path}`,
        method: method.toUpperCase(),
        path,
        summary: meta.summary ?? '-',
      })),
    )
  }, [data])

  if (isLoading) {
    return <LoadingState rows={5} className="py-4" label="Carregando documentação da API" />
  }

  if (isError) {
    return (
      <ErrorState
        message={(error as Error).message}
        title="Não foi possível carregar a documentação"
        onRetry={() => void refetch()}
      />
    )
  }

  return (
    <div className="space-y-4">
      <InlineNotice tone="info" title="REST autenticado em /api">
        Integrações externas usam <code className="text-[var(--rz-text-secondary)]">X-API-Key</code>. No
        painel, a sessão continua usando cookie.
      </InlineNotice>

      <DataTable
        ariaLabel="Endpoints da API Radar Chat"
        columns={columns}
        data={rows}
        tableOptions={{ getRowId: row => row.key }}
        empty={{
          title: 'Nenhum endpoint documentado',
          description: 'A documentação aparecerá quando o contrato OpenAPI estiver disponível.',
        }}
      />

      <InlineNotice tone="neutral" title="Exemplo de envio">
        <pre className="mb-2 overflow-x-auto rounded-lg bg-[var(--rz-surface-muted)] p-3 text-[11px] leading-relaxed text-[var(--rz-text-secondary)]">{`POST /api/integrations/playground
X-API-Key: rz_...
{"destination":"5511999999999","message":"Olá!"}`}</pre>
        Destino precisa estar cadastrado.{' '}
        <Link to="/integrations/playground" className="text-[var(--rz-primary)] hover:underline">
          Abrir playground
        </Link>
      </InlineNotice>
    </div>
  )
}
