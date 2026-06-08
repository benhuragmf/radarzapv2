import { useState } from 'react'
import { Building2, Zap } from 'lucide-react'
import { switchOrganization, type AuthUser, type UserOrganization } from '../lib/auth'
import { Spinner } from '../components/ui/Spinner'

const ROLE_LABEL: Record<UserOrganization['companyRole'], string> = {
  OWNER: 'Dono',
  ADMIN: 'Administrador',
  ATTENDANT: 'Atendente',
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
      window.location.href = '/dashboard'
    } catch (e) {
      setError((e as Error).message)
      setLoadingId(null)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center">
            <Zap size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">RadarZap</h1>
            <p className="text-xs text-gray-500">Escolha onde trabalhar</p>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <h2 className="text-lg font-semibold text-white mb-2">Selecione a empresa</h2>
          <p className="text-sm text-gray-400 mb-6 leading-relaxed">
            Olá, <strong className="text-gray-300">{user.username}</strong>. Você tem acesso a mais de
            uma empresa — escolha qual deseja abrir agora. Pode trocar depois no topo do painel.
          </p>

          {error && (
            <div className="mb-4 px-4 py-2 bg-red-900/40 border border-red-800 rounded-lg text-sm text-red-400">
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
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-800 bg-gray-950/60 hover:border-brand-600/50 hover:bg-brand-600/5 transition-colors text-left disabled:opacity-60"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
                  <Building2 size={18} className="text-brand-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{org.organizationName}</p>
                  <p className="text-xs text-gray-500">{ROLE_LABEL[org.companyRole]}</p>
                </div>
                {loadingId === org.organizationId ? (
                  <Spinner size={18} />
                ) : (
                  <span className="text-xs text-brand-400 font-medium">Entrar</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
