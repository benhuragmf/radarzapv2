import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import type { AuthUser } from '../lib/auth'
import { can } from '../lib/auth'

interface Props {
  user: AuthUser
}

const API_SECTIONS = [
  { id: 'api-chaves', title: 'Chaves de API', desc: 'Gere e revogue chaves para integração externa.' },
  { id: 'api-webhooks', title: 'Webhooks', desc: 'Receba eventos do RadarZap no seu sistema.' },
  { id: 'api-docs', title: 'Documentação', desc: 'Referência dos endpoints disponíveis.' },
  { id: 'api-rate', title: 'Rate Limit', desc: 'Limites de requisição do seu plano.' },
]

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
          <div className="space-y-3">
            {API_SECTIONS.map(s => (
              <div key={s.id} id={s.id} className="scroll-mt-4">
                <Card className={hash === `#${s.id}` ? 'ring-1 ring-brand-600/50' : ''}>
                  <p className="text-sm font-medium text-white">{s.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{s.desc}</p>
                  <p className="text-xs text-gray-600 mt-3">Em desenvolvimento.</p>
                </Card>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
