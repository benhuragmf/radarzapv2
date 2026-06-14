import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { can, getMe } from '../../lib/auth'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { Lock, UserCog, ShieldCheck } from 'lucide-react'

const ROLE_HINTS: Record<string, string> = {
  OWNER: 'Acesso total à empresa, plano e equipe',
  ADMIN: 'Gerencia envios, contatos e configurações',
  MANAGER: 'Supervisão operacional e relatórios',
  ATTENDANT: 'Operação de inbox e envios conforme RBAC',
  INTEGRATION: 'Acesso técnico para integrações e API',
}

interface RolePreset {
  role: string
  name?: string
  capabilities?: string[]
  isCustom?: boolean
}

interface TeamRolesResponse {
  presets: RolePreset[]
  permissionGroups?: Array<{ label: string; capabilities: string[] }>
}

export default function PermissionsPage() {
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
  })
  const canManage = can(me ?? null, 'company:members:manage')

  const { data, isLoading, isError } = useQuery<TeamRolesResponse>({
    queryKey: ['team-roles-permissions-page'],
    queryFn: () => api.get('/team/roles'),
    enabled: canManage,
    retry: false,
  })

  const presets = data?.presets ?? []

  return (
    <div className="space-y-5 max-w-3xl">
      <h1 className="text-lg font-semibold text-white flex items-center gap-2">
        <Lock size={20} className="text-brand-400" />
        Permissões da empresa
      </h1>
      <p className="text-sm text-gray-500">
        Papéis controlam o que cada membro vê no painel. Edite capacidades em{' '}
        <Link to="/settings/team" className="text-brand-400 hover:underline">
          Configurações → Equipe
        </Link>
        .
      </p>

      {canManage ? (
        isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : isError ? (
          <Card className="text-sm text-gray-500">
            Não foi possível carregar papéis. Abra{' '}
            <Link to="/settings/team" className="text-brand-400 hover:underline">
              Equipe
            </Link>{' '}
            para gerenciar permissões.
          </Card>
        ) : (
          <div className="space-y-2">
            {presets.map(r => (
              <Card key={r.role}>
                <p className="text-sm font-medium text-white flex items-center gap-2">
                  <UserCog size={14} className="text-gray-500" />
                  {r.name ?? r.role}
                  {r.isCustom && (
                    <span className="text-[10px] uppercase tracking-wide text-brand-400">custom</span>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {ROLE_HINTS[r.role] ?? 'Papel customizado com capacidades próprias'}
                </p>
                <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                  <ShieldCheck size={12} />
                  {(r.capabilities ?? []).length} capacidade(s) ativa(s)
                </p>
              </Card>
            ))}
          </div>
        )
      ) : (
        <Card className="text-sm text-gray-500">
          Você não tem permissão para editar papéis. Peça a um administrador da empresa em{' '}
          <Link to="/settings/team" className="text-brand-400 hover:underline">
            Equipe
          </Link>
          .
        </Card>
      )}

      <Card className="text-xs text-gray-500 space-y-2">
        <p>
          <strong className="text-gray-400">Seu papel atual:</strong>{' '}
          {me?.companyRole ?? '—'}
        </p>
        <p>
          Capacidades efetivas: {(me?.capabilities ?? []).length}. Rotas bloqueadas retornam 403 na API.
        </p>
      </Card>
    </div>
  )
}
