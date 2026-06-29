import { useState } from 'react'
import { ArrowRight, Building2 } from 'lucide-react'
import { AuthBrand } from '../components/auth/AuthBrand'
import { AuthHero } from '../components/auth/AuthHero'
import { switchOrganization, type AuthUser, type UserOrganization } from '../lib/auth'
import { Spinner } from '../components/ui/Spinner'

const ROLE_LABEL: Record<UserOrganization['companyRole'], string> = {
  OWNER: 'Dono',
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  ATTENDANT: 'Atendente',
  INTEGRATION: 'Integração API',
  CUSTOM: 'Personalizado',
}

interface Props {
  user: AuthUser
  onSelected: (user: AuthUser) => void
}

export default function ChooseCompany({ user, onSelected }: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSelect = async (organizationId: string) => {
    setLoadingId(organizationId)
    setError(null)
    try {
      const updated = await switchOrganization(organizationId)
      onSelected(updated)
      window.location.assign('/dashboard')
    } catch (e) {
      setError((e as Error).message)
      setLoadingId(null)
    }
  }

  return (
    <div className="rz-auth-shell">
      <AuthHero />

      <main className="rz-auth-main">
        <div className="rz-auth-main-inner rz-auth-main-inner-wide">
          <div className="rz-auth-mobile-brand lg:hidden">
            <AuthBrand subtitle="Escolha onde trabalhar" />
          </div>

          <div className="rz-auth-card">
            <header className="rz-auth-card-header">
              <h2 className="rz-auth-card-title">Selecione a empresa</h2>
              <p className="rz-auth-card-subtitle">
                Olá, <strong className="text-[var(--rz-text-primary)]">{user.username}</strong>. Você tem acesso a{' '}
                {user.organizations.length === 1 ? 'uma empresa' : 'mais de uma empresa'} — escolha qual abrir agora.
                Pode trocar depois no topo do painel.
              </p>
            </header>

            {error ? (
              <div className="rz-auth-error" role="alert">
                {error}
              </div>
            ) : null}

            <ul className="rz-auth-org-list">
              {user.organizations.map(org => {
                const loading = loadingId === org.organizationId
                const disabled = loadingId !== null && !loading

                return (
                  <li key={org.organizationId}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => handleSelect(org.organizationId)}
                      className="rz-auth-org-item"
                      aria-busy={loading}
                    >
                      <span className="rz-auth-org-icon">
                        <Building2 size={20} strokeWidth={1.75} aria-hidden />
                      </span>
                      <span className="rz-auth-org-body">
                        <span className="rz-auth-org-name">{org.organizationName}</span>
                        <span className="rz-auth-org-meta">
                          <span className="rz-auth-org-role">{ROLE_LABEL[org.companyRole]}</span>
                          {org.companyRole !== 'OWNER' && org.ownerEmail ? (
                            <>
                              <span className="rz-auth-org-dot" aria-hidden>
                                ·
                              </span>
                              <span>Dono: {org.ownerEmail}</span>
                            </>
                          ) : null}
                        </span>
                      </span>
                      <span className="rz-auth-org-action">
                        {loading ? (
                          <Spinner size={18} />
                        ) : (
                          <>
                            Entrar
                            <ArrowRight size={16} aria-hidden />
                          </>
                        )}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          <footer className="rz-auth-footer">
            <p>
              {user.organizations.length} {user.organizations.length === 1 ? 'empresa disponível' : 'empresas disponíveis'}{' '}
              para sua conta.
            </p>
          </footer>
        </div>
      </main>
    </div>
  )
}
