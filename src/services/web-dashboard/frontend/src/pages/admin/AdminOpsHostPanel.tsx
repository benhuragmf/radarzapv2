import type { AdminOpsHostReport } from '@radarchat-types/admin-ops-host'
import {
  formatHostCpuPercent,
  formatHostMemMb,
  hostDataStatusLabel,
  hostDataStatusVariant,
} from '@radarchat-types/admin-ops-host.util'
import { formatOpsDate, formatOpsUptime } from '@radarchat-types/admin-ops-summary.util'
import { SectionCard, StatusBadge } from '@/design-system'
import { Spinner } from '@/components/ui/Spinner'

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[var(--rz-border)] py-2 text-sm last:border-0">
      <span className="text-[var(--rz-text-muted)]">{label}</span>
      <span className="font-medium text-[var(--rz-text-primary)] tabular-nums">{value}</span>
    </div>
  )
}

interface Props {
  data?: AdminOpsHostReport
  isLoading: boolean
  isError: boolean
}

export default function AdminOpsHostPanel({ data, isLoading, isError }: Props) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8" data-testid="admin-ops-host-loading">
        <Spinner />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <SectionCard title="VPS / Host">
        <p className="text-sm text-[var(--rz-text-muted)]">Não foi possível carregar métricas do servidor.</p>
      </SectionCard>
    )
  }

  const snap = data.hostMetrics.snapshot
  const hostStatus = data.hostMetrics.status
  const coolify = data.coolify

  return (
    <div className="space-y-4" data-testid="admin-ops-host-panel">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge
          status={hostDataStatusVariant(hostStatus)}
          text={`Host: ${hostDataStatusLabel(hostStatus)}`}
        />
        <StatusBadge
          status={hostDataStatusVariant(coolify.status)}
          text={`Coolify API: ${hostDataStatusLabel(coolify.status)}`}
        />
        {snap ? (
          <span className="text-xs text-[var(--rz-text-muted)]">
            Reporte VPS: {formatOpsDate(snap.reportedAt)}
          </span>
        ) : null}
      </div>

      {data.hostMetrics.message ? (
        <p className="text-sm text-[var(--rz-text-secondary)]">{data.hostMetrics.message}</p>
      ) : null}

      <div className="grid lg:grid-cols-2 gap-4">
        <SectionCard title="Servidor (VPS)" description="Enviado pelo cron no host a cada ~5 min">
          {snap ? (
            <>
              <StatRow label="Load 1m / 5m / 15m" value={`${snap.host.load1} / ${snap.host.load5} / ${snap.host.load15}`} />
              <StatRow label="CPUs" value={snap.host.cpuCount ?? '—'} />
              {snap.host.uptimeSeconds != null ? (
                <StatRow label="Uptime host" value={formatOpsUptime(snap.host.uptimeSeconds)} />
              ) : null}
              <StatRow
                label="RAM"
                value={
                  snap.host.memoryUsedMb != null && snap.host.memoryTotalMb != null
                    ? `${snap.host.memoryUsedMb} / ${snap.host.memoryTotalMb} MB`
                    : '—'
                }
              />
              <StatRow label="RAM disponível" value={formatHostMemMb(snap.host.memoryAvailableMb)} />
              <StatRow label="Swap usado" value={formatHostMemMb(snap.host.swapUsedMb)} />
            </>
          ) : (
            <p className="text-sm text-[var(--rz-text-muted)]">
              Sem dados do host. No VPS: defina <code className="text-xs">OPS_HOST_METRICS_SECRET</code> e agende{' '}
              <code className="text-xs">scripts/vps-push-host-metrics.sh</code>.
            </p>
          )}
        </SectionCard>

        <SectionCard title="Coolify" description="API interna (opcional)">
          {coolify.status === 'not_configured' ? (
            <p className="text-sm text-[var(--rz-text-muted)]">{coolify.message}</p>
          ) : (
            <>
              {coolify.version ? <StatRow label="Versão" value={coolify.version} /> : null}
              {coolify.service?.status ? (
                <StatRow label="Serviço Radar Chat" value={coolify.service.status} />
              ) : null}
              {coolify.service?.name ? <StatRow label="Nome" value={coolify.service.name} /> : null}
              {coolify.service?.fqdn ? <StatRow label="FQDN" value={coolify.service.fqdn} /> : null}
              {coolify.servers?.length ? (
                <StatRow
                  label="Servidores"
                  value={coolify.servers.map(s => `${s.name ?? s.uuid}: ${s.status ?? '?'}`).join(' · ')}
                />
              ) : null}
              {coolify.message ? (
                <p className="mt-2 text-xs text-[var(--rz-text-muted)]">{coolify.message}</p>
              ) : null}
            </>
          )}
        </SectionCard>
      </div>

      {snap && snap.containers.length > 0 ? (
        <SectionCard title="Containers Docker" description="CPU e memória no momento do último reporte">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--rz-border)] text-left text-[var(--rz-text-muted)]">
                  <th className="py-2 pr-4 font-medium">Container</th>
                  <th className="py-2 pr-4 font-medium">CPU</th>
                  <th className="py-2 pr-4 font-medium">Memória</th>
                  <th className="py-2 font-medium">Mem %</th>
                </tr>
              </thead>
              <tbody>
                {snap.containers.map(c => (
                  <tr key={c.name} className="border-b border-[var(--rz-border)] last:border-0">
                    <td className="py-2 pr-4 font-mono text-xs">{c.name}</td>
                    <td className="py-2 pr-4 tabular-nums">{formatHostCpuPercent(c.cpuPercent)}</td>
                    <td className="py-2 pr-4 tabular-nums">
                      {formatHostMemMb(c.memUsedMb)}
                      {c.memLimitMb ? ` / ${Math.round(c.memLimitMb)} MB` : ''}
                    </td>
                    <td className="py-2 tabular-nums">
                      {c.memPercent != null ? formatHostCpuPercent(c.memPercent) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}

      {snap?.issues?.length ? (
        <SectionCard title="Alertas do host">
          <ul className="list-disc list-inside space-y-1 text-sm text-[var(--rz-text-secondary)]">
            {snap.issues.map(issue => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </SectionCard>
      ) : null}
    </div>
  )
}
