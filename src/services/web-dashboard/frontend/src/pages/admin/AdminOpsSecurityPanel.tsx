import { useCallback, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, ShieldAlert } from 'lucide-react'
import type { AdminOpsSummary } from '@radarchat-types/admin-ops-summary'
import type {
  AdminOpsSecurityEventLevel,
  AdminOpsSecurityEventRow,
  AdminOpsSecurityEventsPage,
  AdminOpsSecurityEventSource,
} from '@radarchat-types/admin-ops-security-events'
import {
  formatOpsDate,
  formatOpsNumber,
  sanitizeOpsDisplayText,
  sortAlertsBySeverity,
} from '@radarchat-types/admin-ops-summary.util'
import { api } from '../../lib/api'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SectionCard,
  StatusBadge,
} from '@/design-system'

type WindowPreset = '24h' | '7d'

const LEVEL_OPTIONS: Array<{ value: '' | AdminOpsSecurityEventLevel; label: string }> = [
  { value: '', label: 'Todos os níveis' },
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warning' },
  { value: 'error', label: 'Error' },
  { value: 'info', label: 'Info' },
]

const SOURCE_OPTIONS: Array<{ value: '' | AdminOpsSecurityEventSource; label: string }> = [
  { value: '', label: 'Todas as fontes' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'system', label: 'System' },
  { value: 'audit', label: 'Audit' },
  { value: 'billing', label: 'Billing' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'ai', label: 'IA' },
  { value: 'bridge', label: 'Bridge' },
  { value: 'ticket', label: 'Ticket' },
  { value: 'form', label: 'Form' },
]

function levelBadgeVariant(
  level: AdminOpsSecurityEventLevel,
): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  switch (level) {
    case 'critical':
      return 'danger'
    case 'error':
      return 'danger'
    case 'warning':
      return 'warning'
    case 'info':
      return 'info'
    default:
      return 'neutral'
  }
}

function windowToRange(preset: WindowPreset): { from: string; to: string } {
  const to = new Date()
  const from = new Date(
    to.getTime() - (preset === '7d' ? 7 * 24 : 24) * 60 * 60 * 1000,
  )
  return { from: from.toISOString(), to: to.toISOString() }
}

function buildEventsQuery(params: {
  window: WindowPreset
  page: number
  level: '' | AdminOpsSecurityEventLevel
  source: '' | AdminOpsSecurityEventSource
  kind: string
}) {
  const qs = new URLSearchParams()
  qs.set('page', String(params.page))
  qs.set('limit', '25')
  const range = windowToRange(params.window)
  qs.set('from', range.from)
  qs.set('to', range.to)
  if (params.level) qs.set('level', params.level)
  if (params.source) qs.set('source', params.source)
  if (params.kind.trim()) qs.set('kind', params.kind.trim())
  return `/admin/ops/security-events?${qs.toString()}`
}

function sanitizeCell(value: string): string {
  return sanitizeOpsDisplayText(value)
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[var(--rz-border)] py-2 text-sm last:border-0">
      <span className="text-[var(--rz-text-muted)]">{label}</span>
      <span className="font-medium text-[var(--rz-text-primary)] tabular-nums">{value}</span>
    </div>
  )
}

function AlertsList({ alerts }: { alerts: AdminOpsSummary['alerts'] }) {
  const sorted = sortAlertsBySeverity(alerts)
  if (!sorted.length) {
    return <EmptyState title="Nenhum alerta" description="Nenhum alerta operacional no momento." />
  }
  return (
    <ul className="space-y-2" data-testid="admin-ops-alerts">
      {sorted.map(alert => (
        <li
          key={`${alert.kind}-${alert.title}`}
          className="rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/40 px-3 py-2"
        >
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={
                alert.level === 'critical'
                  ? 'danger'
                  : alert.level === 'warning'
                    ? 'warning'
                    : 'info'
              }
              text={alert.level}
            />
            <span className="text-sm font-medium text-[var(--rz-text-primary)]">
              {sanitizeCell(alert.title)}
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--rz-text-secondary)]">
            {sanitizeCell(alert.message)}
          </p>
        </li>
      ))}
    </ul>
  )
}

interface Props {
  security: AdminOpsSummary['security']
  alerts: AdminOpsSummary['alerts']
  /** Pré-seleciona filtro de nível (ex.: página /admin/errors). */
  initialLevelFilter?: '' | AdminOpsSecurityEventLevel
}

export default function AdminOpsSecurityPanel({
  security,
  alerts,
  initialLevelFilter = '',
}: Props) {
  const queryClient = useQueryClient()
  const [windowPreset, setWindowPreset] = useState<WindowPreset>('24h')
  const [page, setPage] = useState(1)
  const [levelFilter, setLevelFilter] = useState<'' | AdminOpsSecurityEventLevel>(initialLevelFilter)
  const [sourceFilter, setSourceFilter] = useState<'' | AdminOpsSecurityEventSource>('')
  const [kindFilter, setKindFilter] = useState('')

  const queryKey = useMemo(
    () =>
      ['admin-ops-security-events', windowPreset, page, levelFilter, sourceFilter, kindFilter] as const,
    [windowPreset, page, levelFilter, sourceFilter, kindFilter],
  )

  const eventsQuery = useQuery({
    queryKey,
    queryFn: () =>
      api.get<AdminOpsSecurityEventsPage>(
        buildEventsQuery({
          window: windowPreset,
          page,
          level: levelFilter,
          source: sourceFilter,
          kind: kindFilter,
        }),
      ),
  })

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['admin-ops-security-events'] })
    void eventsQuery.refetch()
  }, [queryClient, eventsQuery])

  const rows = eventsQuery.data?.items ?? []

  return (
    <div data-testid="admin-ops-security" className="space-y-4 mt-4">
      <div className="grid lg:grid-cols-2 gap-4">
        <SectionCard title="Segurança (24h / mês)">
          <StatRow label="Erros sistema (24h)" value={formatOpsNumber(security.errorsLast24h)} />
          <StatRow
            label="Lookup ticket inválido"
            value={formatOpsNumber(security.invalidTicketLookupsLast24h)}
          />
          <StatRow label="Form blocked" value={formatOpsNumber(security.formBlocksLast24h)} />
          <StatRow
            label="Billing limit blocked"
            value={formatOpsNumber(security.billingLimitBlocksLast24h)}
          />
          <StatRow
            label="Webhook failures"
            value={formatOpsNumber(security.webhookFailuresLast24h)}
          />
        </SectionCard>
        <SectionCard title="Alertas">
          <AlertsList alerts={alerts} />
        </SectionCard>
      </div>

      <SectionCard
        title="Eventos críticos globais"
        actions={
          <button
            type="button"
            data-testid="admin-ops-security-refresh"
            onClick={handleRefresh}
            disabled={eventsQuery.isFetching}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--rz-border)] px-2.5 py-1.5 text-xs font-medium text-[var(--rz-text-secondary)] hover:bg-[var(--rz-surface-muted)] disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${eventsQuery.isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        }
      >
        <div className="mb-4 flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-xs text-[var(--rz-text-muted)]">
            Janela
            <select
              data-testid="admin-ops-security-window"
              value={windowPreset}
              onChange={e => {
                setWindowPreset(e.target.value as WindowPreset)
                setPage(1)
              }}
              className="rounded-md border border-[var(--rz-border)] bg-[var(--rz-surface)] px-2 py-1.5 text-sm"
            >
              <option value="24h">Últimas 24h</option>
              <option value="7d">Últimos 7 dias</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--rz-text-muted)]">
            Nível
            <select
              data-testid="admin-ops-security-level"
              value={levelFilter}
              onChange={e => {
                setLevelFilter(e.target.value as '' | AdminOpsSecurityEventLevel)
                setPage(1)
              }}
              className="rounded-md border border-[var(--rz-border)] bg-[var(--rz-surface)] px-2 py-1.5 text-sm"
            >
              {LEVEL_OPTIONS.map(o => (
                <option key={o.label} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--rz-text-muted)]">
            Fonte
            <select
              data-testid="admin-ops-security-source"
              value={sourceFilter}
              onChange={e => {
                setSourceFilter(e.target.value as '' | AdminOpsSecurityEventSource)
                setPage(1)
              }}
              className="rounded-md border border-[var(--rz-border)] bg-[var(--rz-surface)] px-2 py-1.5 text-sm"
            >
              {SOURCE_OPTIONS.map(o => (
                <option key={o.label} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--rz-text-muted)] min-w-[180px]">
            Tipo (kind)
            <input
              data-testid="admin-ops-security-kind"
              type="text"
              value={kindFilter}
              onChange={e => {
                setKindFilter(e.target.value)
                setPage(1)
              }}
              placeholder="ex. billing.invoice.failed"
              className="rounded-md border border-[var(--rz-border)] bg-[var(--rz-surface)] px-2 py-1.5 text-sm"
            />
          </label>
        </div>

        {eventsQuery.isLoading ? (
          <LoadingState rows={4} />
        ) : eventsQuery.isError ? (
          <ErrorState
            title="Não foi possível carregar eventos de segurança."
            message="Verifique a conexão ou tente novamente."
            onRetry={() => void eventsQuery.refetch()}
          />
        ) : rows.length === 0 ? (
          <div data-testid="admin-ops-security-empty">
            <EmptyState
              icon={ShieldAlert}
              title="Nenhum evento crítico encontrado na janela selecionada."
              description="Ajuste os filtros ou aguarde novos eventos operacionais."
            />
          </div>
        ) : (
          <div className="overflow-x-auto" data-testid="admin-ops-security-feed">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-[var(--rz-border)] text-left text-xs text-[var(--rz-text-muted)]">
                  <th className="py-2 pr-3 font-medium">Data</th>
                  <th className="py-2 pr-3 font-medium">Nível</th>
                  <th className="py-2 pr-3 font-medium">Fonte</th>
                  <th className="py-2 pr-3 font-medium">Tipo</th>
                  <th className="py-2 pr-3 font-medium">Organização</th>
                  <th className="py-2 font-medium">Mensagem</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row: AdminOpsSecurityEventRow) => (
                  <tr
                    key={row.id}
                    data-testid="admin-ops-security-row"
                    className="border-b border-[var(--rz-border)]/60 last:border-0"
                  >
                    <td className="py-2 pr-3 whitespace-nowrap text-xs text-[var(--rz-text-muted)]">
                      {formatOpsDate(row.createdAt)}
                    </td>
                    <td className="py-2 pr-3">
                      <StatusBadge status={levelBadgeVariant(row.level)} text={row.level} />
                    </td>
                    <td className="py-2 pr-3 text-xs">{sanitizeCell(row.source)}</td>
                    <td className="py-2 pr-3 text-xs font-mono">{sanitizeCell(row.kind)}</td>
                    <td className="py-2 pr-3 text-xs">
                      {row.organizationName
                        ? sanitizeCell(row.organizationName)
                        : '—'}
                    </td>
                    <td className="py-2 text-xs text-[var(--rz-text-secondary)]">
                      <span className="font-medium text-[var(--rz-text-primary)]">
                        {sanitizeCell(row.title)}
                      </span>
                      {row.message ? (
                        <span className="block mt-0.5">{sanitizeCell(row.message)}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {eventsQuery.data && eventsQuery.data.totalPages > 1 ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-[var(--rz-text-muted)]">
                  Página {eventsQuery.data.page} de {eventsQuery.data.totalPages} ·{' '}
                  {formatOpsNumber(eventsQuery.data.total)} evento(s)
                  {eventsQuery.data.truncated ? ' (janela parcial)' : ''}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-[var(--rz-border)] px-3 py-1.5 disabled:opacity-50"
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-[var(--rz-border)] px-3 py-1.5 disabled:opacity-50"
                    disabled={page >= eventsQuery.data.totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Próxima
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
