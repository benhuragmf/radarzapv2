import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { getMe, type AuthUser } from '../../lib/auth'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { InboxAtendimentoNav } from '../../components/inbox/InboxAtendimentoNav'
import {
  BarChart3,
  MessageSquare,
  CheckCircle2,
  Clock,
  Users,
  Building2,
  Timer,
  AlertTriangle,
} from 'lucide-react'
import { LoadingState, MetricCard, EmptyState, selectCls } from '@/design-system'

function fmtSec(sec: number | null): string {
  if (sec == null) return '—'
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}m ${s}s`
}

interface Report {
  period: { from: string; to: string }
  summary: {
    totalConversations: number
    resolvedCount: number
    inProgressCount: number
    waitingCount: number
    avgQueueTimeSec: number | null
    avgFirstResponseTimeSec: number | null
    avgResolutionTimeSec: number | null
  }
  byDepartment: Array<{
    departmentId: string
    departmentName: string
    conversations: number
    avgQueueTimeSec: number | null
    avgResolutionTimeSec: number | null
  }>
  byAgent: Array<{
    userId: string
    agentName: string
    conversations: number
    avgFirstResponseTimeSec: number | null
    avgResolutionTimeSec: number | null
  }>
}

export default function InboxReports() {
  const [days, setDays] = useState(30)
  const to = new Date()
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000)

  const { data: me } = useQuery<AuthUser | null>({
    queryKey: ['auth-me'],
    queryFn: getMe,
  })

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['inbox-reports', days],
    queryFn: () =>
      api.get<Report>(
        `/inbox/reports?from=${from.toISOString()}&to=${to.toISOString()}`,
      ),
  })

  const s = data?.summary

  return (
    <PlatformPage
      title="Métricas de atendimento"
      description="Volume, tempos de fila, primeira resposta e desempenho por setor e atendente."
    >
      <InboxAtendimentoNav me={me} className="mb-4" />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select
          value={days}
          onChange={e => setDays(Number(e.currentTarget.value))}
          className={`${selectCls} text-xs py-1.5`}
          aria-label="Período do relatório"
        >
          <option value={7}>Últimos 7 dias</option>
          <option value={30}>Últimos 30 dias</option>
          <option value={90}>Últimos 90 dias</option>
        </select>
        <Button size="sm" variant="secondary" onClick={() => refetch()}>
          Atualizar
        </Button>
      </div>

      {isLoading ? (
        <LoadingState rows={4} className="pt-4" />
      ) : isError ? (
        <EmptyState
          icon={AlertTriangle}
          title="Não foi possível carregar os relatórios"
          description="Verifique sua conexão e tente novamente."
          action={
            <Button size="sm" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          }
        />
      ) : s ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            <MetricCard
              title="Conversas"
              value={s.totalConversations}
              icon={MessageSquare}
              description="No período"
            />
            <MetricCard
              title="Finalizadas"
              value={s.resolvedCount}
              icon={CheckCircle2}
              description="Encerradas com sucesso"
            />
            <MetricCard
              title="Em atendimento"
              value={s.inProgressCount}
              icon={Users}
              description="Snapshot atual"
            />
            <MetricCard
              title="Na fila"
              value={s.waitingCount}
              icon={Clock}
              description="Aguardando agente"
            />
            <MetricCard
              title="Fila média"
              value={fmtSec(s.avgQueueTimeSec)}
              icon={Timer}
            />
            <MetricCard
              title="1ª resposta"
              value={fmtSec(s.avgFirstResponseTimeSec)}
              icon={BarChart3}
            />
          </div>

          {s.avgResolutionTimeSec != null && (
            <p className="text-xs text-[var(--rz-text-muted)] -mt-2">
              Tempo médio de resolução no período: <strong className="text-[var(--rz-text-secondary)]">{fmtSec(s.avgResolutionTimeSec)}</strong>
            </p>
          )}

          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/30">
              <h2 className="text-sm font-semibold text-[var(--rz-text-primary)] flex items-center gap-2">
                <Building2 size={16} className="text-brand-400" /> Por setor
              </h2>
            </div>
            {(data?.byDepartment ?? []).length === 0 ? (
              <EmptyState
                title="Sem dados por setor"
                description="Não houve conversas com setor identificado neste período."
                className="py-8"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wider text-[var(--rz-text-muted)] border-b border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/20">
                      <th className="px-4 py-2.5 font-medium">Setor</th>
                      <th className="px-4 py-2.5 font-medium">Conversas</th>
                      <th className="px-4 py-2.5 font-medium">Fila média</th>
                      <th className="px-4 py-2.5 font-medium">Resolução média</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.byDepartment ?? []).map(row => (
                      <tr
                        key={row.departmentId}
                        className="border-b border-[var(--rz-border)]/60 hover:bg-[var(--rz-surface-muted)]/30 transition-colors"
                      >
                        <td className="px-4 py-3 text-[var(--rz-text-primary)]">{row.departmentName}</td>
                        <td className="px-4 py-3 text-[var(--rz-text-muted)] tabular-nums">{row.conversations}</td>
                        <td className="px-4 py-3 text-[var(--rz-text-muted)]">{fmtSec(row.avgQueueTimeSec)}</td>
                        <td className="px-4 py-3 text-[var(--rz-text-muted)]">{fmtSec(row.avgResolutionTimeSec)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/30">
              <h2 className="text-sm font-semibold text-[var(--rz-text-primary)] flex items-center gap-2">
                <Users size={16} className="text-brand-400" /> Por atendente
              </h2>
            </div>
            {(data?.byAgent ?? []).length === 0 ? (
              <EmptyState
                title="Sem dados por atendente"
                description="Nenhum atendente registrou conversas neste período."
                className="py-8"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wider text-[var(--rz-text-muted)] border-b border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/20">
                      <th className="px-4 py-2.5 font-medium">Atendente</th>
                      <th className="px-4 py-2.5 font-medium">Conversas</th>
                      <th className="px-4 py-2.5 font-medium">1ª resposta</th>
                      <th className="px-4 py-2.5 font-medium">Resolução</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.byAgent ?? []).map(row => (
                      <tr
                        key={row.userId}
                        className="border-b border-[var(--rz-border)]/60 hover:bg-[var(--rz-surface-muted)]/30 transition-colors"
                      >
                        <td className="px-4 py-3 text-[var(--rz-text-primary)]">{row.agentName}</td>
                        <td className="px-4 py-3 text-[var(--rz-text-muted)] tabular-nums">{row.conversations}</td>
                        <td className="px-4 py-3 text-[var(--rz-text-muted)]">
                          {fmtSec(row.avgFirstResponseTimeSec)}
                        </td>
                        <td className="px-4 py-3 text-[var(--rz-text-muted)]">{fmtSec(row.avgResolutionTimeSec)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      ) : (
        <EmptyState
          title="Sem dados no período"
          description="Ajuste o intervalo de dias ou aguarde novos atendimentos."
        />
      )}
    </PlatformPage>
  )
}
