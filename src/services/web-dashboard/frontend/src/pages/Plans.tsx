import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { Users, RefreshCw, Crown } from 'lucide-react'

interface UserData {
  _id: string
  discordUserId: string
  plan: 'free' | 'starter' | 'pro' | 'enterprise'
  limits: { messagesPerDay: number; groupsMax: number; templatesMax: number }
  usage: { messagesUsed: number; lastReset: string }
  createdAt: string
}

const PLANS = [
  {
    id: 'free',
    label: 'Free',
    color: 'gray' as const,
    limits: { msg: '10/dia', dest: '2 destinos', tpl: '2 templates' },
  },
  {
    id: 'starter',
    label: 'Starter',
    color: 'blue' as const,
    limits: { msg: '100/dia', dest: '5 destinos', tpl: '5 templates' },
  },
  {
    id: 'pro',
    label: 'Pro',
    color: 'yellow' as const,
    limits: { msg: '500/dia', dest: '15 destinos', tpl: '10 templates' },
  },
  {
    id: 'enterprise',
    label: 'Enterprise',
    color: 'green' as const,
    limits: { msg: 'Ilimitado', dest: 'Ilimitado', tpl: 'Ilimitado' },
  },
]

const planVariant: Record<string, 'gray' | 'blue' | 'yellow' | 'green'> = {
  free: 'gray', starter: 'blue', pro: 'yellow', enterprise: 'green',
}

function usageBar(used: number, limit: number) {
  if (limit === -1) return null
  const pct = Math.min(100, Math.round((used / limit) * 100))
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-brand-500'
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{used} / {limit} mensagens hoje</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function Plans() {
  const qc = useQueryClient()

  const { data: users = [], isLoading } = useQuery<UserData[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users'),
    refetchInterval: 30_000,
  })

  const changePlan = useMutation({
    mutationFn: ({ id, plan }: { id: string; plan: string }) =>
      api.put(`/users/${id}/plan`, { plan }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    onError: (e: any) => alert(`Erro: ${e.message}`),
  })

  const resetUsage = useMutation({
    mutationFn: (id: string) => api.post(`/users/${id}/reset-usage`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  if (isLoading) return <div className="flex justify-center pt-20"><Spinner size={32} /></div>

  return (
    <div className="space-y-6">
      {/* Plan cards overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {PLANS.map(p => (
          <Card key={p.id} className={`border-${p.color === 'green' ? 'brand' : p.color}-800/50`}>
            <div className="flex items-center gap-2 mb-2">
              {p.id === 'enterprise' && <Crown size={14} className="text-brand-400" />}
              <span className="font-semibold text-sm">{p.label}</span>
            </div>
            <div className="text-xs text-gray-500 space-y-0.5">
              <p>📨 {p.limits.msg}</p>
              <p>📞 {p.limits.dest}</p>
              <p>📄 {p.limits.tpl}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Users list */}
      <div>
        <h2 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
          <Users size={14} /> Usuários ({users.length})
        </h2>

        {users.length === 0 && (
          <Card className="text-center py-10 text-gray-500">
            <Users size={28} className="mx-auto mb-2 opacity-30" />
            <p>Nenhum usuário registrado.</p>
          </Card>
        )}

        <div className="space-y-3">
          {users.map(u => (
            <Card key={u._id}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm font-mono">{u.discordUserId}</span>
                    <Badge label={u.plan} variant={planVariant[u.plan] ?? 'gray'} />
                  </div>
                  <p className="text-xs text-gray-500">
                    Desde {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                  {usageBar(u.usage.messagesUsed, u.limits.messagesPerDay)}
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  {/* Plan selector */}
                  <select
                    value={u.plan}
                    onChange={e => changePlan.mutate({ id: u._id, plan: e.currentTarget.value })}
                    disabled={changePlan.isPending}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-brand-500"
                  >
                    {PLANS.map(p => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>

                  {/* Reset usage */}
                  <Button
                    size="sm" variant="ghost"
                    onClick={() => resetUsage.mutate(u._id)}
                    disabled={resetUsage.isPending}
                    title="Resetar contador de mensagens"
                  >
                    <RefreshCw size={11} /> Resetar uso
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
