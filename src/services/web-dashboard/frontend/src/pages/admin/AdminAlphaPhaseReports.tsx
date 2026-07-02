import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FlaskConical } from 'lucide-react'
import { api } from '../../lib/api'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import {
  EmptyState,
  LoadingState,
  PageHeader,
  RadarPageShell,
  selectCls,
  textareaCls,
} from '@/design-system'

type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed'
type ReportSeverity = 'low' | 'medium' | 'high'

interface AlphaPhaseReportRow {
  _id: string
  organizationName?: string
  reporterUsername: string
  reporterEmail?: string
  title: string
  summary: string
  expectedBehavior?: string
  stepsToReproduce?: string
  affectedArea?: string
  severity: ReportSeverity
  pageUrl?: string
  status: ReportStatus
  adminNotes?: string
  createdAt: string
  updatedAt: string
}

const STATUS_LABEL: Record<ReportStatus, string> = {
  open: 'Aberto',
  reviewing: 'Em análise',
  resolved: 'Resolvido',
  dismissed: 'Descartado',
}

const SEVERITY_LABEL: Record<ReportSeverity, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
}

function statusVariant(status: ReportStatus): 'yellow' | 'blue' | 'green' | 'gray' {
  switch (status) {
    case 'reviewing':
      return 'blue'
    case 'resolved':
      return 'green'
    case 'dismissed':
      return 'gray'
    default:
      return 'yellow'
  }
}

function severityVariant(severity: ReportSeverity): 'gray' | 'yellow' | 'red' {
  switch (severity) {
    case 'high':
      return 'red'
    case 'medium':
      return 'yellow'
    default:
      return 'gray'
  }
}

export default function AdminAlphaPhaseReports() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<'' | ReportStatus>('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [nextStatus, setNextStatus] = useState<ReportStatus>('reviewing')
  const [adminNotes, setAdminNotes] = useState('')

  const queryKey = useMemo(
    () => ['admin-alpha-phase-reports', statusFilter],
    [statusFilter],
  )

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    queryFn: () => {
      const qs = statusFilter ? `?status=${statusFilter}&limit=100` : '?limit=100'
      return api.get<{ reports: AlphaPhaseReportRow[] }>(`/admin/alpha-phase-reports${qs}`)
    },
    refetchInterval: 30_000,
  })

  const reports = data?.reports ?? []
  const selected = reports.find(r => r._id === selectedId) ?? reports[0] ?? null

  const patchMutation = useMutation({
    mutationFn: (payload: { id: string; status: ReportStatus; adminNotes?: string }) =>
      api.patch<AlphaPhaseReportRow>(`/admin/alpha-phase-reports/${payload.id}`, {
        status: payload.status,
        adminNotes: payload.adminNotes,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-alpha-phase-reports'] })
    },
  })

  const handleSelect = (row: AlphaPhaseReportRow) => {
    setSelectedId(row._id)
    setNextStatus(row.status)
    setAdminNotes(row.adminNotes ?? '')
  }

  return (
    <RadarPageShell maxWidth="wide" className="space-y-6">
      <PageHeader
        title="Reportes Fase Alfa"
        subtitle="Feedback enviado pelos participantes da fase de testes."
      />

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-[var(--rz-text-secondary)]" htmlFor="alpha-status-filter">
          Filtrar status
        </label>
        <select
          id="alpha-status-filter"
          className={`${selectCls} w-auto min-w-[180px]`}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as '' | ReportStatus)}
        >
          <option value="">Todos</option>
          <option value="open">Abertos</option>
          <option value="reviewing">Em análise</option>
          <option value="resolved">Resolvidos</option>
          <option value="dismissed">Descartados</option>
        </select>
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-lg border border-[var(--rz-border)] px-3 py-2 text-sm text-[var(--rz-text-primary)] hover:bg-[var(--rz-surface-muted)]"
        >
          Atualizar
        </button>
      </div>

      {isLoading ? (
        <LoadingState rows={4} />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="Nenhum reporte ainda"
          description="Quando usuários enviarem erros pela página Fase Alfa, eles aparecerão aqui."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {reports.map(row => (
              <button
                key={row._id}
                type="button"
                onClick={() => handleSelect(row)}
                className={`w-full text-left rounded-lg border p-3 transition-colors ${
                  selected?._id === row._id
                    ? 'border-[var(--rz-primary)] bg-[var(--rz-primary)]/10'
                    : 'border-[var(--rz-border)] hover:bg-[var(--rz-surface-muted)]'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <Badge label={STATUS_LABEL[row.status]} variant={statusVariant(row.status)} />
                  <Badge label={SEVERITY_LABEL[row.severity]} variant={severityVariant(row.severity)} />
                  <span className="text-[10px] text-[var(--rz-text-muted)] ml-auto">
                    {new Date(row.createdAt).toLocaleString('pt-BR')}
                  </span>
                </div>
                <p className="text-sm font-medium text-[var(--rz-text-primary)] truncate">{row.title}</p>
                <p className="text-xs text-[var(--rz-text-muted)] truncate">
                  {row.organizationName ?? 'Empresa'} · {row.reporterUsername}
                </p>
              </button>
            ))}
          </div>

          {selected && (
            <Card className="space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="flex flex-wrap items-center gap-2">
                <Badge label={STATUS_LABEL[selected.status]} variant={statusVariant(selected.status)} />
                <Badge label={SEVERITY_LABEL[selected.severity]} variant={severityVariant(selected.severity)} />
              </div>

              <div>
                <h3 className="text-base font-semibold text-[var(--rz-text-primary)]">{selected.title}</h3>
                <p className="text-xs text-[var(--rz-text-muted)] mt-1">
                  {selected.organizationName ?? 'Empresa'} · {selected.reporterUsername}
                  {selected.reporterEmail ? ` · ${selected.reporterEmail}` : ''}
                </p>
              </div>

              <section className="space-y-1">
                <h4 className="text-xs uppercase tracking-wide text-[var(--rz-text-muted)]">Resumo</h4>
                <p className="text-sm text-[var(--rz-text-secondary)] whitespace-pre-wrap">{selected.summary}</p>
              </section>

              {selected.expectedBehavior && (
                <section className="space-y-1">
                  <h4 className="text-xs uppercase tracking-wide text-[var(--rz-text-muted)]">Esperado</h4>
                  <p className="text-sm text-[var(--rz-text-secondary)] whitespace-pre-wrap">
                    {selected.expectedBehavior}
                  </p>
                </section>
              )}

              {selected.stepsToReproduce && (
                <section className="space-y-1">
                  <h4 className="text-xs uppercase tracking-wide text-[var(--rz-text-muted)]">Como reproduzir</h4>
                  <p className="text-sm text-[var(--rz-text-secondary)] whitespace-pre-wrap">
                    {selected.stepsToReproduce}
                  </p>
                </section>
              )}

              {(selected.affectedArea || selected.pageUrl) && (
                <section className="space-y-1 text-sm text-[var(--rz-text-secondary)]">
                  {selected.affectedArea && <p><strong>Tela/canal:</strong> {selected.affectedArea}</p>}
                  {selected.pageUrl && (
                    <p className="break-all">
                      <strong>URL:</strong> {selected.pageUrl}
                    </p>
                  )}
                </section>
              )}

              <section className="space-y-2 border-t border-[var(--rz-border)] pt-4">
                <h4 className="text-sm font-medium text-[var(--rz-text-primary)]">Atualizar status</h4>
                <select
                  className={selectCls}
                  value={nextStatus}
                  onChange={e => setNextStatus(e.target.value as ReportStatus)}
                >
                  <option value="open">Aberto</option>
                  <option value="reviewing">Em análise</option>
                  <option value="resolved">Resolvido</option>
                  <option value="dismissed">Descartado</option>
                </select>
                <textarea
                  className={textareaCls}
                  rows={3}
                  placeholder="Notas internas (opcional)"
                  value={adminNotes}
                  onChange={e => setAdminNotes(e.target.value)}
                />
                <button
                  type="button"
                  disabled={patchMutation.isPending}
                  onClick={() =>
                    patchMutation.mutate({
                      id: selected._id,
                      status: nextStatus,
                      adminNotes: adminNotes.trim() || undefined,
                    })
                  }
                  className="rounded-lg bg-[var(--rz-primary)] px-3 py-2 text-sm font-medium text-white rz-on-primary hover:opacity-90 disabled:opacity-60"
                >
                  {patchMutation.isPending ? 'Salvando…' : 'Salvar status'}
                </button>
              </section>
            </Card>
          )}
        </div>
      )}
    </RadarPageShell>
  )
}
