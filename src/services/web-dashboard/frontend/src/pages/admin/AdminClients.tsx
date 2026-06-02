import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'

export default function AdminClients() {
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get<Array<{ _id: string; discordUserId: string; plan: string }>>('/users'),
  })

  if (isLoading) return <div className="flex justify-center pt-20"><Spinner size={32} /></div>

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Clientes</h2>
      <div className="grid gap-3">
        {users.map(u => (
          <Card key={u._id} className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium">{u.discordUserId}</p>
              <p className="text-xs text-gray-500">ID: {u._id}</p>
            </div>
            <span className="text-xs capitalize text-brand-400">{u.plan}</span>
          </Card>
        ))}
      </div>
    </div>
  )
}
