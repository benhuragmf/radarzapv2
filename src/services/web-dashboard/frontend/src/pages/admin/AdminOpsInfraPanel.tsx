import type { AdminOpsSummary } from '@radarzap-types/admin-ops-summary'
import {
  formatOpsNumber,
  formatOpsUptime,
  serviceStatusLabel,
} from '@radarzap-types/admin-ops-summary.util'
import { SectionCard } from '@/design-system'

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[var(--rz-border)] py-2 text-sm last:border-0">
      <span className="text-[var(--rz-text-muted)]">{label}</span>
      <span className="font-medium text-[var(--rz-text-primary)] tabular-nums">{value}</span>
    </div>
  )
}

interface Props {
  data: AdminOpsSummary
  title?: string
}

export default function AdminOpsInfraPanel({ data, title = 'Infraestrutura' }: Props) {
  return (
    <div data-testid="admin-ops-infra-panel">
      <SectionCard title={title}>
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-xs font-semibold text-[var(--rz-text-muted)] mb-2">Sistema</h3>
          <StatRow label="Versão" value={data.system.version} />
          <StatRow label="Ambiente" value={data.system.nodeEnv} />
          <StatRow label="Uptime" value={formatOpsUptime(data.system.uptimeSeconds)} />
          <StatRow label="Node" value={data.system.nodeVersion} />
          <StatRow label="Heap usado" value={`${data.system.memoryMb.heapUsed} MB`} />
          <StatRow label="RSS" value={`${data.system.memoryMb.rss} MB`} />
          {data.system.cpu ? (
            <>
              <StatRow label="Load 1m" value={data.system.cpu.load1?.toFixed(2) ?? '—'} />
              <StatRow label="CPUs" value={data.system.cpu.cpuCount ?? '—'} />
            </>
          ) : null}
        </div>
        <div>
          <h3 className="text-xs font-semibold text-[var(--rz-text-muted)] mb-2">Serviços</h3>
          <StatRow
            label="Mongo"
            value={`${serviceStatusLabel(data.services.mongo.status)}${data.services.mongo.latencyMs != null ? ` (${data.services.mongo.latencyMs} ms)` : ''}`}
          />
          <StatRow
            label="Redis"
            value={`${serviceStatusLabel(data.services.redis.status)}${data.services.redis.latencyMs != null ? ` (${data.services.redis.latencyMs} ms)` : ''}`}
          />
          <StatRow label="Filas — waiting" value={formatOpsNumber(data.services.queues.waiting)} />
          <StatRow label="Filas — active" value={formatOpsNumber(data.services.queues.active)} />
          <StatRow label="Filas — failed" value={formatOpsNumber(data.services.queues.failed)} />
          <StatRow label="Filas — delayed" value={formatOpsNumber(data.services.queues.delayed)} />
        </div>
        </div>
      </SectionCard>
    </div>
  )
}
