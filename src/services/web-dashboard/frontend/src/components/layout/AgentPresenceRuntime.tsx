import { can, type AuthUser } from '../../lib/auth'
import { useAgentPresenceHeartbeat } from '../../hooks/useAgentPresenceHeartbeat'

/** Roda heartbeat uma única vez por sessão autenticada (evita loops no seletor). */
export function AgentPresenceRuntime({ user }: { user: AuthUser }) {
  useAgentPresenceHeartbeat(Boolean(user) && can(user, 'inbox:reply'))
  return null
}
