import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import { can, getMe } from '../../lib/auth'
import { Card } from '../../components/ui/Card'
import { UserCog, ShieldCheck } from 'lucide-react'
import { RadarPageShell, PageHeader, LoadingState, ErrorState } from '@/design-system'

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
    <RadarPageShell>
      <PageHeader
        title="Permissões da empresa"
        subtitle={
          <>
            Papéis controlam o que cada membro vê no painel. Edite capacidades em{' '}
            <Link to="/settings/team" className="text-[var(--rz-primary)] hover:underline">
              Configurações → Equipe
            </Link>
            .
          </>
        }
      />

      {canManage ? (
        isLoading ? (
          <LoadingState rows={4} className="pt-4" />
        ) : isError ? (
          <ErrorState
            title="Não foi possível carregar papéis"
            message="Abra Equipe para gerenciar permissões."
          />
        ) : (
          <div className="space-y-2">
            {presets.map(r => (
              <Card key={r.role}>
                <p className="text-sm font-medium text-[var(--rz-text-primary)] flex items-center gap-2">
                  <UserCog size={14} className="text-[var(--rz-text-muted)]" />
                  {r.name ?? r.role}
                  {r.isCustom && (
                    <span className="text-[10px] uppercase tracking-wide text-[var(--rz-primary)]">custom</span>
                  )}
                </p>
                <p className="text-xs text-[var(--rz-text-muted)] mt-1">
                  {ROLE_HINTS[r.role] ?? 'Papel customizado com capacidades próprias'}
                </p>
                <p className="text-xs text-[var(--rz-text-secondary)] mt-2 flex items-center gap-1">
                  <ShieldCheck size={12} />
                  {(r.capabilities ?? []).length} capacidade(s) ativa(s)
                </p>
              </Card>
            ))}
          </div>
        )
      ) : (
        <Card className="text-sm text-[var(--rz-text-secondary)]">
          Você não tem permissão para editar papéis. Peça a um administrador da empresa em{' '}
          <Link to="/settings/team" className="text-[var(--rz-primary)] hover:underline">
            Equipe
          </Link>
          .
        </Card>
      )}

      <Card className="text-xs text-[var(--rz-text-muted)] space-y-2">
        <p>
          <strong className="text-[var(--rz-text-secondary)]">Seu papel atual:</strong>{' '}
          {me?.companyRole ?? '—'}
        </p>
        <p>
          Capacidades efetivas: {(me?.capabilities ?? []).length}. Rotas bloqueadas retornam 403 na API.
        </p>
      </Card>
    </RadarPageShell>
  )
}
