import { useState } from 'react'
import { Building2, ChevronDown } from 'lucide-react'
import { switchOrganization, type AuthUser } from '../../lib/auth'
import { Spinner } from '../ui/Spinner'

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Dono',
  ADMIN: 'Admin',
  ATTENDANT: 'Atendente',
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
        className="flex items-center gap-2 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 hover:border-gray-600 hover:bg-gray-800/80 transition-colors max-w-[220px]"
        title="Trocar empresa"
      >
        <Building2 size={14} className="text-brand-400 shrink-0" />
        <span className="truncate">{current.organizationName}</span>
        <ChevronDown size={14} className="text-gray-500 shrink-0" />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Fechar"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-gray-900 border border-gray-700 rounded-xl shadow-xl py-1 overflow-hidden">
            <p className="px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
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
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-800 transition-colors ${
                    active ? 'bg-brand-600/10' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${active ? 'text-brand-300' : 'text-gray-200'}`}>
                      {org.organizationName}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
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
