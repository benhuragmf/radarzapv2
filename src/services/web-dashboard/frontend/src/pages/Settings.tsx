import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import type { AuthUser } from '../lib/auth'
import { can } from '../lib/auth'
import { ApiKeysPanel } from '../components/integrations/ApiKeysPanel'
import { WebhooksPanel } from '../components/integrations/WebhooksPanel'
import { ApiDocsPanel } from '../components/integrations/ApiDocsPanel'
import { RateLimitPanel } from '../components/integrations/RateLimitPanel'
import { CompanyProfilePanel } from '../components/settings/CompanyProfilePanel'
import { MyProfilePanel } from '../components/settings/MyProfilePanel'
import AccountConnectionsPanel from '../components/settings/AccountConnectionsPanel'
import DeleteOrganizationPanel from '../components/settings/DeleteOrganizationPanel'
import { isCompanyOwner } from '../lib/auth'
import { RadarPageShell, PageHeader } from '@/design-system'

interface Props {
  user: AuthUser
  onUserUpdate?: (user: AuthUser) => void
}

const API_SECTIONS = [
  { id: 'api-chaves', title: 'Chaves de API', Component: ApiKeysPanel, permission: 'api:key:create' as const },
  { id: 'api-webhooks', title: 'Webhooks', Component: WebhooksPanel, permission: 'api:key:create' as const },
  { id: 'api-docs', title: 'Documentação', Component: ApiDocsPanel, permission: 'api:logs:view' as const },
  { id: 'api-rate', title: 'Limites da API', Component: RateLimitPanel, permission: 'billing:view' as const },
] as const

export default function Settings({ user, onUserUpdate }: Props) {
  const { hash } = useLocation()
  const visibleSections = API_SECTIONS.filter(s => can(user, s.permission))
  const showApiBlock = visibleSections.length > 0
  const showCompanyProfile = can(user, 'billing:view')
  const isAttendantOnly = !showCompanyProfile && !showApiBlock

  useEffect(() => {
    if (!hash) return
    const id = hash.replace('#', '')
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash])

  return (
    <RadarPageShell maxWidth="wide">
      <PageHeader
        title={isAttendantOnly ? 'Minha conta' : 'Configurações'}
        subtitle={
          isAttendantOnly
            ? 'Seu perfil, e-mail e WhatsApp pessoal para comandos e alertas.'
            : 'Conta, integrações API, equipe e limites.'
        }
      />
      <div className="space-y-6 w-full max-w-4xl">
      <section id="perfil">
        <h2 className="text-lg font-semibold mb-3">Meu perfil</h2>
        <Card>
          <MyProfilePanel user={user} />
        </Card>
      </section>

      {showCompanyProfile && (
        <section id="empresa">
          <h2 className="text-lg font-semibold mb-3">Dados da empresa</h2>
          <Card>
            <CompanyProfilePanel user={user} />
          </Card>
        </section>
      )}

      <section id="conta">
        <h2 className="text-lg font-semibold mb-3">Conta vinculada</h2>
        <Card>
          <AccountConnectionsPanel user={user} onUserUpdate={onUserUpdate} />
        </Card>
        {user.guilds.length > 0 && (
          <Card className="mt-4">
            <p className="text-xs text-[var(--rz-text-muted)] mb-2">Servidores Discord vinculados à empresa</p>
            <ul className="text-sm space-y-1">
              {user.guilds.map(g => (
                <li key={g.id} className="text-[var(--rz-text-secondary)]">
                  {g.name ?? g.id} · <span className="text-[var(--rz-text-muted)]">{g.role}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {isCompanyOwner(user) && user.organizationId && (
          <Card className="mt-4 border-red-900/40">
            <DeleteOrganizationPanel user={user} />
          </Card>
        )}
      </section>

      {showApiBlock && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Integrações API</h2>
          <p className="text-xs text-[var(--rz-text-muted)] mb-4">
            Padrão REST em <code className="text-[var(--rz-text-muted)]">/api</code> — integrações externas usam{' '}
            <code className="text-[var(--rz-text-muted)]">X-API-Key</code>; o painel usa cookie de sessão.
          </p>
          <div className="space-y-6">
            {visibleSections.map(({ id, title, Component }) => (
              <div key={id} id={id} className="scroll-mt-4">
                <h3 className="text-sm font-medium text-[var(--rz-text-secondary)] mb-2">{title}</h3>
                <Card className={hash === `#${id}` ? 'ring-1 ring-brand-600/50' : ''}>
                  <Component />
                </Card>
              </div>
            ))}
          </div>
        </section>
      )}
      </div>
    </RadarPageShell>
  )
}
