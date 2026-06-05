import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import type { AuthUser } from '../lib/auth'
import { can } from '../lib/auth'
import { ApiKeysPanel } from '../components/integrations/ApiKeysPanel'
import { WebhooksPanel } from '../components/integrations/WebhooksPanel'
import { ApiDocsPanel } from '../components/integrations/ApiDocsPanel'
import { RateLimitPanel } from '../components/integrations/RateLimitPanel'

interface Props {
  user: AuthUser
}

const API_SECTIONS = [
  { id: 'api-chaves', title: 'Chaves de API', Component: ApiKeysPanel },
  { id: 'api-webhooks', title: 'Webhooks', Component: WebhooksPanel },
  { id: 'api-docs', title: 'Documentação', Component: ApiDocsPanel },
  { id: 'api-rate', title: 'Limites da API', Component: RateLimitPanel },
] as const

export default function Settings({ user }: Props) {
  const { hash } = useLocation()
  const showApi = can(user, 'api:key:create')

  useEffect(() => {
    if (!hash) return
    const id = hash.replace('#', '')
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash])

  return (
    <div className="space-y-6 max-w-2xl">
      <section id="conta">
        <h2 className="text-lg font-semibold mb-3">Configurações da Conta</h2>
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
      </section>

      {showApi && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Integrações API</h2>
          <p className="text-xs text-gray-500 mb-4">
            Padrão REST em <code className="text-gray-400">/api</code> — qualquer sistema pode integrar
            com header <code className="text-gray-400">X-API-Key</code>.
          </p>
          <div className="space-y-6">
            {API_SECTIONS.map(({ id, title, Component }) => (
              <div key={id} id={id} className="scroll-mt-4">
                <h3 className="text-sm font-medium text-gray-300 mb-2">{title}</h3>
                <Card className={hash === `#${id}` ? 'ring-1 ring-brand-600/50' : ''}>
                  <Component />
                </Card>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
