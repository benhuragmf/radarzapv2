import { Card } from '../components/ui/Card'
import type { AuthUser } from '../lib/auth'

interface Props {
  user: AuthUser
}

export default function Settings({ user }: Props) {
  return (
    <div className="space-y-4 max-w-lg">
      <h2 className="text-lg font-semibold">Configurações da Conta</h2>
      <Card className="space-y-3">
        <div>
          <p className="text-xs text-gray-500">Discord</p>
          <p className="text-sm font-medium">{user.username}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Papel</p>
          <p className="text-sm">{user.primaryRole}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Plano</p>
          <p className="text-sm capitalize">{user.plan}</p>
        </div>
        {user.guilds.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Servidores Discord</p>
            <ul className="text-sm space-y-1">
              {user.guilds.map(g => (
                <li key={g.id} className="text-gray-300">
                  {g.name ?? g.id} · <span className="text-gray-500">{g.role}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  )
}
