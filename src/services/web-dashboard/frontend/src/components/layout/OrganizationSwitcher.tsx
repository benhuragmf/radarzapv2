import { useState } from 'react'
import { Building2, ChevronDown } from 'lucide-react'
import { switchOrganization, type AuthUser } from '../../lib/auth'
import { Spinner } from '../ui/Spinner'

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Dono',
  ADMIN: 'Admin',
  MANAGER: 'Gerente',
  ATTENDANT: 'Atendente',
  INTEGRATION: 'API',
  CUSTOM: 'Custom',
}

interface Props {
  user: AuthUser
  onOrganizationChange: (user: AuthUser) => void
}

export default function OrganizationSwitcher({ user, onOrganizationChange }: Props) {
  const [open, setOpen] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  if (user.organizations.length <= 1) return null

  const current =
    user.organizations.find(o => o.organizationId === user.organizationId) ??
    user.organizations[0]

  const handleSelect = async (organizationId: string) => {
    if (organizationId === user.organizationId) {
      setOpen(false)
      return
    }
    setLoadingId(organizationId)
    try {
      const updated = await switchOrganization(organizationId)
      onOrganizationChange(updated)
      setOpen(false)
      window.location.href = '/dashboard'
    } catch {
      setLoadingId(null)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex h-8 items-center gap-2 border border-[var(--rz-border)] rounded-lg px-2 sm:px-3 text-sm text-[var(--rz-text-secondary)] hover:bg-[var(--rz-surface-muted)] transition-colors max-w-[2.25rem] sm:max-w-[180px] lg:max-w-[220px] overflow-hidden"
        title={`Empresa atual: ${current.organizationName}. Trocar empresa.`}
        aria-label={`Empresa atual: ${current.organizationName}. Trocar empresa.`}
        aria-expanded={open}
      >
        <Building2 size={14} className="text-brand-400 shrink-0" />
        <span className="hidden sm:block truncate">{current.organizationName}</span>
        <ChevronDown size={14} className="hidden sm:block text-[var(--rz-text-muted)] shrink-0" />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Fechar"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-[var(--rz-surface)] border border-[var(--rz-border)] rounded-xl shadow-xl py-1 overflow-hidden">
            <p className="px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--rz-text-muted)] font-semibold">
              Suas empresas
            </p>
            {user.organizations.map(org => {
              const active = org.organizationId === user.organizationId
              return (
                <button
                  key={org.organizationId}
                  type="button"
                  disabled={loadingId !== null}
                  onClick={() => handleSelect(org.organizationId)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--rz-surface-muted)] transition-colors ${
                    active ? 'bg-brand-600/10' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${active ? 'text-brand-300' : 'text-[var(--rz-text-primary)]'}`}>
                      {org.organizationName}
                    </p>
                    <p className="text-xs text-[var(--rz-text-muted)] truncate">
                      {ROLE_LABEL[org.companyRole] ?? org.companyRole}
                      {org.companyRole !== 'OWNER' && org.ownerEmail && (
                        <> · {org.ownerEmail}</>
                      )}
                    </p>
                  </div>
                  {loadingId === org.organizationId && <Spinner size={14} />}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
