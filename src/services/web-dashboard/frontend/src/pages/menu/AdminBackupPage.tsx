import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Database,
  CheckCircle2,
  XCircle,
  SkipForward,
  Cloud,
  Clock,
  RefreshCw,
} from 'lucide-react'
import { api } from '../../lib/api'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import {
  RadarPageShell,
  PageHeader,
  LoadingState,
  inputCls,
  ConfigSaveFooter,
} from '@/design-system'
import { notifyConfigSaved, mutationError } from '../../lib/notify'

type BackupSettings = {
  enabled: boolean
  timezone: string
  hourly: { enabled: boolean; keep: number; intervalHours: number }
  daily: { enabled: boolean; keep: number; hour: number }
  every3d: { enabled: boolean; keep: number; intervalDays: number }
  weekly: { enabled: boolean; keep: number; dayOfWeek: number }
  atlas: { enabled: boolean }
  minOrganizations: number
  updatedAt?: string
}

type BackupRun = {
  id: string
  status: 'success' | 'failed' | 'skipped'
  startedAt: string
  finishedAt: string
  durationMs: number
  organizations: number
  tiers: { hourly: boolean; daily: boolean; every3d: boolean; weekly: boolean; atlas: boolean }
  retentionCounts: { hourly: number; daily: number; every3d: number; weekly: number }
  message?: string
  error?: string
}

type BackupStatus = {
  settings: BackupSettings
  lastRun: BackupRun | null
  runs: BackupRun[]
  summary: {
    totalRuns: number
    successRuns: number
    failedRuns: number
    skippedRuns: number
    lastSuccessAt: string | null
    atlasConfigured: boolean
  }
  scheduleHint: string
}

const WEEKDAYS = [
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
  { value: 7, label: 'Domingo' },
]

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR')
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function StatusBadge({ status }: { status: BackupRun['status'] }) {
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium">
        <CheckCircle2 className="w-3.5 h-3.5" /> Sucesso
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 text-red-600 text-xs font-medium">
        <XCircle className="w-3.5 h-3.5" /> Falha
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium">
      <SkipForward className="w-3.5 h-3.5" /> Ignorado
    </span>
  )
}

function TierPills({ tiers }: { tiers: BackupRun['tiers'] }) {
  const labels: Array<[keyof BackupRun['tiers'], string]> = [
    ['hourly', 'Hora'],
    ['daily', 'Dia'],
    ['every3d', '3d'],
    ['weekly', 'Sem'],
    ['atlas', 'Atlas'],
  ]
  return (
    <div className="flex flex-wrap gap-1">
      {labels.map(([key, label]) => (
        <span
          key={key}
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
            tiers[key]
              ? 'bg-[var(--rz-primary-muted)] text-[var(--rz-primary)]'
              : 'bg-[var(--rz-surface-muted)] text-[var(--rz-text-muted)]'
          }`}
        >
          {label}
        </span>
      ))}
    </div>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer py-2">
      <input
        type="checkbox"
        className="mt-1 rounded border-[var(--rz-border)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="text-sm font-medium text-[var(--rz-text-primary)]">{label}</span>
        {description ? (
          <span className="block text-xs text-[var(--rz-text-muted)] mt-0.5">{description}</span>
        ) : null}
      </span>
    </label>
  )
}

export default function AdminBackupPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState<BackupSettings | null>(null)

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-backup-status'],
    queryFn: () => api.get<BackupStatus>('/admin/backup/status'),
    refetchInterval: 60_000,
  })

  useEffect(() => {
    if (data?.settings) setForm(data.settings)
  }, [data?.settings])

  const saveMut = useMutation({
    mutationFn: (body: Partial<BackupSettings>) => api.patch<BackupSettings>('/admin/backup/settings', body),
    onSuccess: () => {
      notifyConfigSaved()
      qc.invalidateQueries({ queryKey: ['admin-backup-status'] })
    },
    onError: mutationError,
  })

  if (isLoading || !form || !data) {
    return (
      <RadarPageShell>
        <PageHeader title="Backup" subtitle="Política MongoDB e relatório de execuções na VPS." />
        <LoadingState label="Carregando backup…" />
      </RadarPageShell>
    )
  }

  const { summary, runs, scheduleHint, lastRun } = data

  return (
    <RadarPageShell>
      <PageHeader
        title="Backup MongoDB"
        subtitle="Retenção em camadas na VPS + espelho Atlas. Distinto do export de contatos por empresa."
        actions={
          <Button variant="secondary" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-[var(--rz-text-muted)] text-xs mb-1">
            <Database className="w-4 h-4" /> Último sucesso
          </div>
          <p className="text-lg font-semibold">{fmtDate(summary.lastSuccessAt)}</p>
          {lastRun ? <StatusBadge status={lastRun.status} /> : null}
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-[var(--rz-text-muted)] text-xs mb-1">
            <Clock className="w-4 h-4" /> Execuções
          </div>
          <p className="text-lg font-semibold">
            {summary.successRuns} ok · {summary.failedRuns} falha · {summary.skippedRuns} ignorado
          </p>
          <p className="text-xs text-[var(--rz-text-muted)]">{summary.totalRuns} total registradas</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-[var(--rz-text-muted)] text-xs mb-1">
            <Cloud className="w-4 h-4" /> Atlas
          </div>
          <p className="text-lg font-semibold">
            {summary.atlasConfigured ? 'URL configurada no servidor' : 'Não configurado'}
          </p>
          <p className="text-xs text-[var(--rz-text-muted)]">
            {form.atlas.enabled ? 'Espelho ativo no painel' : 'Espelho desligado no painel'}
          </p>
        </Card>
      </div>

      <Card className="p-4 mb-6 text-sm text-[var(--rz-text-secondary)]">
        <p className="font-medium text-[var(--rz-text-primary)] mb-1">Política atual</p>
        <p>{scheduleHint}</p>
        <p className="text-xs text-[var(--rz-text-muted)] mt-2">
          Cron na VPS executa a cada hora; camadas diária/semanal disparam no horário configurado (
          {form.timezone}). Clientes exportam contatos em{' '}
          <Link to="/settings/backup" className="text-[var(--rz-primary)] hover:underline">
            Empresa → Backup
          </Link>
          .
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5 space-y-4">
          <h2 className="text-base font-semibold">Configuração</h2>

          <ToggleRow
            label="Backup automático ativo"
            description="Desligar pausa novos dumps (cron continua registrando como ignorado)."
            checked={form.enabled}
            onChange={(enabled) => setForm({ ...form, enabled })}
          />

          <div>
            <label className="text-xs text-[var(--rz-text-muted)]">Fuso horário</label>
            <input
              className={inputCls}
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              placeholder="America/Sao_Paulo"
            />
          </div>

          <div>
            <label className="text-xs text-[var(--rz-text-muted)]">Mínimo de organizations (proteção)</label>
            <input
              type="number"
              min={0}
              max={1000}
              className={inputCls}
              value={form.minOrganizations}
              onChange={(e) => setForm({ ...form, minOrganizations: Number(e.target.value) })}
            />
          </div>

          <fieldset className="border border-[var(--rz-border)] rounded-lg p-3 space-y-2">
            <legend className="text-sm font-medium px-1">Horário</legend>
            <ToggleRow
              label="Ativo"
              checked={form.hourly.enabled}
              onChange={(enabled) => setForm({ ...form, hourly: { ...form.hourly, enabled } })}
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--rz-text-muted)]">Intervalo (h)</label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  className={inputCls}
                  value={form.hourly.intervalHours}
                  onChange={(e) =>
                    setForm({ ...form, hourly: { ...form.hourly, intervalHours: Number(e.target.value) } })
                  }
                />
              </div>
              <div>
                <label className="text-xs text-[var(--rz-text-muted)]">Manter cópias</label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  className={inputCls}
                  value={form.hourly.keep}
                  onChange={(e) =>
                    setForm({ ...form, hourly: { ...form.hourly, keep: Number(e.target.value) } })
                  }
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="border border-[var(--rz-border)] rounded-lg p-3 space-y-2">
            <legend className="text-sm font-medium px-1">Diário</legend>
            <ToggleRow
              label="Ativo"
              checked={form.daily.enabled}
              onChange={(enabled) => setForm({ ...form, daily: { ...form.daily, enabled } })}
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--rz-text-muted)]">Hora (0–23)</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  className={inputCls}
                  value={form.daily.hour}
                  onChange={(e) =>
                    setForm({ ...form, daily: { ...form.daily, hour: Number(e.target.value) } })
                  }
                />
              </div>
              <div>
                <label className="text-xs text-[var(--rz-text-muted)]">Manter cópias</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  className={inputCls}
                  value={form.daily.keep}
                  onChange={(e) =>
                    setForm({ ...form, daily: { ...form.daily, keep: Number(e.target.value) } })
                  }
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="border border-[var(--rz-border)] rounded-lg p-3 space-y-2">
            <legend className="text-sm font-medium px-1">A cada N dias</legend>
            <ToggleRow
              label="Ativo"
              checked={form.every3d.enabled}
              onChange={(enabled) => setForm({ ...form, every3d: { ...form.every3d, enabled } })}
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--rz-text-muted)]">Intervalo (dias)</label>
                <input
                  type="number"
                  min={2}
                  max={14}
                  className={inputCls}
                  value={form.every3d.intervalDays}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      every3d: { ...form.every3d, intervalDays: Number(e.target.value) },
                    })
                  }
                />
              </div>
              <div>
                <label className="text-xs text-[var(--rz-text-muted)]">Manter cópias</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  className={inputCls}
                  value={form.every3d.keep}
                  onChange={(e) =>
                    setForm({ ...form, every3d: { ...form.every3d, keep: Number(e.target.value) } })
                  }
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="border border-[var(--rz-border)] rounded-lg p-3 space-y-2">
            <legend className="text-sm font-medium px-1">Semanal</legend>
            <ToggleRow
              label="Ativo"
              checked={form.weekly.enabled}
              onChange={(enabled) => setForm({ ...form, weekly: { ...form.weekly, enabled } })}
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--rz-text-muted)]">Dia da semana</label>
                <select
                  className={inputCls}
                  value={form.weekly.dayOfWeek}
                  onChange={(e) =>
                    setForm({ ...form, weekly: { ...form.weekly, dayOfWeek: Number(e.target.value) } })
                  }
                >
                  {WEEKDAYS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--rz-text-muted)]">Manter cópias</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  className={inputCls}
                  value={form.weekly.keep}
                  onChange={(e) =>
                    setForm({ ...form, weekly: { ...form.weekly, keep: Number(e.target.value) } })
                  }
                />
              </div>
            </div>
          </fieldset>

          <ToggleRow
            label="Espelhar no MongoDB Atlas"
            description="Após cada backup horário bem-sucedido (requer MONGODB_BACKUP_URL na VPS)."
            checked={form.atlas.enabled}
            onChange={(enabled) => setForm({ ...form, atlas: { enabled } })}
          />

          <ConfigSaveFooter
            onSave={() => saveMut.mutate(form)}
            saving={saveMut.isPending}
            saveLabel="Salvar política"
          />
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold mb-4">Relatório de execuções</h2>
          {runs.length === 0 ? (
            <p className="text-sm text-[var(--rz-text-muted)]">
              Nenhuma execução registrada ainda. Após o próximo cron na VPS, o histórico aparece aqui.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--rz-text-muted)] border-b border-[var(--rz-border)]">
                    <th className="py-2 px-2">Quando</th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 px-2">Camadas</th>
                    <th className="py-2 px-2">Retenção</th>
                    <th className="py-2 px-2">Detalhe</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id} className="border-b border-[var(--rz-border-subtle)]">
                      <td className="py-2 px-2 whitespace-nowrap">
                        <div>{fmtDate(run.startedAt)}</div>
                        <div className="text-xs text-[var(--rz-text-muted)]">
                          {fmtDuration(run.durationMs)} · {run.organizations} orgs
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <StatusBadge status={run.status} />
                      </td>
                      <td className="py-2 px-2">
                        <TierPills tiers={run.tiers} />
                      </td>
                      <td className="py-2 px-2 text-xs text-[var(--rz-text-muted)] whitespace-nowrap">
                        H{run.retentionCounts.hourly} D{run.retentionCounts.daily} 3d
                        {run.retentionCounts.every3d} S{run.retentionCounts.weekly}
                      </td>
                      <td className="py-2 px-2 text-xs text-[var(--rz-text-secondary)] max-w-[180px] truncate">
                        {run.error || run.message || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </RadarPageShell>
  )
}
