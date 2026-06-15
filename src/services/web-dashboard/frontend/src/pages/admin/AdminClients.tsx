import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Card } from '../../components/ui/Card'
import { RadarPageShell, PageHeader, LoadingState, EmptyState } from '@/design-system'

export default function AdminClients() {
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get<Array<{ _id: string; discordUserId: string; plan: string }>>('/users'),
  })

  return (
    <RadarPageShell>
      <PageHeader title="Clientes" subtitle="Usuários Discord cadastrados no sistema." />

      {isLoading ? (
        <LoadingState rows={4} className="pt-4" />
      ) : users.length === 0 ? (
        <EmptyState title="Nenhum cliente" description="Nenhum usuário cadastrado ainda." />
      ) : (
        <div className="grid gap-3">
          {users.map(u => (
            <Card key={u._id} className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium">{u.discordUserId}</p>
                <p className="text-xs text-[var(--rz-text-muted)]">ID: {u._id}</p>
              </div>
              <span className="text-xs capitalize text-[var(--rz-primary)]">{u.plan}</span>
            </Card>
          ))}
        </div>
      )}
    </RadarPageShell>
  )
}
