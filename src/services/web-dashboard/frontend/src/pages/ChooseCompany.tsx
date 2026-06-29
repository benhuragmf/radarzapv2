import { useState } from 'react'
import { Building2, Zap } from 'lucide-react'
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
    <div className="rz-auth-page px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-[var(--rz-primary)] rounded-xl flex items-center justify-center shadow-lg">
            <Zap size={24} className="text-white rz-on-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--rz-text-primary)]">Radar Chat</h1>
            <p className="text-xs text-[var(--rz-text-muted)]">Escolha onde trabalhar</p>
          </div>
        </div>

        <div className="rz-card rounded-2xl p-8">
          <h2 className="text-lg font-semibold text-[var(--rz-text-primary)] mb-2">Selecione a empresa</h2>
          <p className="text-sm text-[var(--rz-text-secondary)] mb-6 leading-relaxed">
            Olá, <strong className="text-[var(--rz-text-primary)]">{user.username}</strong>. Você tem acesso a mais de
            uma empresa — escolha qual deseja abrir agora. Pode trocar depois no topo do painel.
          </p>

          {error && (
            <div className="mb-4 px-4 py-2 bg-[var(--rz-danger-bg)] border border-[var(--rz-danger-text)]/30 rounded-lg text-sm text-[var(--rz-danger-text)]">
              {error}
            </div>
          )}

          <div className="space-y-3">
            {user.organizations.map(org => (
              <button
                key={org.organizationId}
                type="button"
                disabled={loadingId !== null}
                onClick={() => handleSelect(org.organizationId)}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-[var(--rz-border)] bg-[var(--rz-surface-muted)] hover:border-[var(--rz-primary)]/50 hover:bg-[var(--rz-primary)]/5 transition-colors text-left disabled:opacity-60"
              >
                <div className="w-10 h-10 rounded-lg bg-[var(--rz-surface)] border border-[var(--rz-border)] flex items-center justify-center shrink-0">
                  <Building2 size={18} className="text-[var(--rz-primary)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--rz-text-primary)] truncate">{org.organizationName}</p>
                  <p className="text-xs text-[var(--rz-text-muted)]">
                    {ROLE_LABEL[org.companyRole]}
                    {org.companyRole !== 'OWNER' && org.ownerEmail && (
                      <> · Dono: <span className="text-[var(--rz-text-secondary)]">{org.ownerEmail}</span></>
                    )}
                  </p>
                </div>
                {loadingId === org.organizationId ? (
                  <Spinner size={18} />
                ) : (
                  <span className="text-xs text-[var(--rz-primary)] font-medium">Entrar</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
