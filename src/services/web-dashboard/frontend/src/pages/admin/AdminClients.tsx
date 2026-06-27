import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Card } from '../../components/ui/Card'
import { RadarPageShell, PageHeader, LoadingState, EmptyState } from '@/design-system'

interface AdminUserRow {
  _id: string
  discordUserId: string | null
  email: string | null
  displayName: string
  organizationName: string | null
  plan: string
}

function userSubtitle(u: AdminUserRow): string {
  const parts = [
    u.organizationName,
    u.discordUserId ? `Discord ${u.discordUserId}` : null,
    u.email,
    `Conta ${u._id}`,
  ].filter(Boolean)
  return parts.join(' · ')
}

export default function AdminClients() {
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get<AdminUserRow[]>('/users'),
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
            <Card key={u._id} className="flex justify-between items-center gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{u.displayName}</p>
                <p className="text-xs text-[var(--rz-text-muted)] truncate">{userSubtitle(u)}</p>
              </div>
              <span className="text-xs capitalize text-[var(--rz-primary)] shrink-0">{u.plan}</span>
            </Card>
          ))}
        </div>
      )}
    </RadarPageShell>
  )
}
