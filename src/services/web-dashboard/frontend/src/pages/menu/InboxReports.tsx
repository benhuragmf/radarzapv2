import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { BarChart3 } from 'lucide-react'

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

  const { data, isLoading } = useQuery({
    queryKey: ['inbox-reports', days],
    queryFn: () =>
      api.get<Report>(
        `/inbox/reports?from=${from.toISOString()}&to=${to.toISOString()}`,
      ),
  })

  const s = data?.summary

  return (
    <PlatformPage
      title="Relatórios de atendimento"
      description="Tempo na fila, primeira resposta e volume por setor e atendente."
    >
      <div className="flex flex-wrap gap-2 mb-4">
        <Link to="/platform/inbox">
          <Button size="sm" variant="secondary">← Inbox</Button>
        </Link>
        <select
          value={days}
          onChange={e => setDays(Number(e.currentTarget.value))}
          className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-200"
        >
          <option value={7}>Últimos 7 dias</option>
          <option value={30}>Últimos 30 dias</option>
          <option value={90}>Últimos 90 dias</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size={28} /></div>
      ) : s ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Conversas', value: s.totalConversations },
              { label: 'Finalizadas', value: s.resolvedCount },
              { label: 'Tempo médio na fila', value: fmtSec(s.avgQueueTimeSec) },
              { label: '1ª resposta média', value: fmtSec(s.avgFirstResponseTimeSec) },
            ].map(item => (
              <Card key={item.label} className="p-4">
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className="text-xl font-semibold text-white mt-1">{item.value}</p>
              </Card>
            ))}
          </div>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <BarChart3 size={16} className="text-brand-400" /> Por setor
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                    <th className="pb-2 pr-4">Setor</th>
                    <th className="pb-2 pr-4">Conversas</th>
                    <th className="pb-2 pr-4">Fila média</th>
                    <th className="pb-2">Resolução média</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.byDepartment ?? []).map(row => (
                    <tr key={row.departmentId} className="border-b border-gray-800/60">
                      <td className="py-2 pr-4 text-gray-200">{row.departmentName}</td>
                      <td className="py-2 pr-4 text-gray-400">{row.conversations}</td>
                      <td className="py-2 pr-4 text-gray-400">{fmtSec(row.avgQueueTimeSec)}</td>
                      <td className="py-2 text-gray-400">{fmtSec(row.avgResolutionTimeSec)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-white mb-3">Por atendente</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                    <th className="pb-2 pr-4">Atendente</th>
                    <th className="pb-2 pr-4">Conversas</th>
                    <th className="pb-2 pr-4">1ª resposta</th>
                    <th className="pb-2">Resolução</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.byAgent ?? []).map(row => (
                    <tr key={row.userId} className="border-b border-gray-800/60">
                      <td className="py-2 pr-4 text-gray-200">{row.agentName}</td>
                      <td className="py-2 pr-4 text-gray-400">{row.conversations}</td>
                      <td className="py-2 pr-4 text-gray-400">
                        {fmtSec(row.avgFirstResponseTimeSec)}
                      </td>
                      <td className="py-2 text-gray-400">{fmtSec(row.avgResolutionTimeSec)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : (
        <p className="text-sm text-gray-500">Sem dados no período.</p>
      )}
    </PlatformPage>
  )
}
