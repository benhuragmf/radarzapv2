import { can, type AuthUser } from '../../lib/auth'
import { useWebChatSocket } from '../../hooks/useWebChatSocket'

/** Socket + notificações globais do WebChat (qualquer página do painel). */
export function WebChatGlobalListener({ user }: { user: AuthUser }) {
  const enabled = can(user, 'inbox:view')
  useWebChatSocket(enabled, { notifyBrowser: true })
  return null
}
