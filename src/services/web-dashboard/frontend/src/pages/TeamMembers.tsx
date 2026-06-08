import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { can, getMe, isCompanyOwner, type AuthUser, type CompanyRole } from '../lib/auth'
import { Card, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { Users, UserPlus, Trash2, Pencil } from 'lucide-react'
import {
  RolesSystemPanel,
  TeamMemberRoleModal,
  type PermissionGroup,
  type RolePreset,
} from '../components/team/TeamPermissionsEditor'

interface Member {
  _id: string
  email?: string
  displayEmail?: string
  companyRole: CompanyRole
  userId?: string
  linked?: boolean
  effectiveCapabilities?: string[]
  createdAt: string
}

interface TeamRolesResponse {
  presets: RolePreset[]
  permissionGroups: PermissionGroup[]
  inviteableRoles: CompanyRole[]
  hasDiscordIntegration?: boolean
}

const ROLE_LABEL: Record<CompanyRole, string> = {
  OWNER: 'Dono',
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  ATTENDANT: 'Atendente',
  INTEGRATION: 'Integração API',
  CUSTOM: 'Personalizado',
}

const inputCls =
  'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500'

type Tab = 'equipe' | 'papeis'

export default function TeamMembers() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('equipe')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<CompanyRole>('ATTENDANT')
  const [editingRole, setEditingRole] = useState<CompanyRole>('ATTENDANT')
  const [editingMember, setEditingMember] = useState<Member | null>(null)

  const { data: me } = useQuery<AuthUser | null>({
    queryKey: ['auth-me'],
    queryFn: getMe,
  })

  const canManage = can(me ?? null, 'company:members:manage')
  const canRemoveMember =
    isCompanyOwner(me ?? null) || can(me ?? null, 'company:members:remove')
  const isOwner = isCompanyOwner(me ?? null)

  const { data: rolesData } = useQuery<TeamRolesResponse>({
    queryKey: ['team-roles'],
    queryFn: () => api.get('/team/roles'),
    enabled: canManage,
  })

  const { data: members = [], isLoading } = useQuery<Member[]>({
    queryKey: ['team-members'],
    queryFn: () => api.get('/team/members'),
    enabled: canManage,
  })

  const presets = rolesData?.presets ?? []
  const permissionGroups = rolesData?.permissionGroups ?? []
  const hasDiscordIntegration = rolesData?.hasDiscordIntegration === true
  const invitePreset = presets.find(p => p.role === role)

  const invite = useMutation({
    mutationFn: () => api.post('/team/members', { email, role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-members'] })
      setEmail('')
    },
    onError: (err: Error) => alert(err.message),
  })

  const updateMemberRole = async (id: string, newRole: CompanyRole) => {
    await api.patch(`/team/members/${id}`, { role: newRole })
    qc.invalidateQueries({ queryKey: ['team-members'] })
  }

  const saveRolePreset = async (roleKey: CompanyRole, capabilities: string[]) => {
    await api.patch(`/team/roles/${roleKey}`, { capabilities })
    await qc.invalidateQueries({ queryKey: ['team-roles'] })
    await qc.invalidateQueries({ queryKey: ['team-members'] })
  }

  const resetRolePreset = async (roleKey: CompanyRole) => {
    await api.delete(`/team/roles/${roleKey}`)
    await qc.invalidateQueries({ queryKey: ['team-roles'] })
    await qc.invalidateQueries({ queryKey: ['team-members'] })
  }

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/team/members/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-members'] }),
    onError: (err: Error) => alert(err.message),
  })

  if (!canManage) {
    return (
      <Card className="text-center py-12 text-gray-500">
        <p>Apenas dono ou administrador pode gerenciar a equipe.</p>
      </Card>
    )
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-white">Equipe e permissões</h1>
        <p className="text-sm text-gray-500 mt-1">
          Convide membros em <span className="text-gray-400">Equipe</span> e configure o acesso em{' '}
          <span className="text-gray-400">Papéis do sistema</span>.
        </p>
      </div>

      <div className="flex gap-1 p-1 bg-gray-900 rounded-lg border border-gray-800 w-fit">
        <button
          type="button"
          onClick={() => setTab('equipe')}
          className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
            tab === 'equipe' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Equipe
        </button>
        <button
          type="button"
          onClick={() => setTab('papeis')}
          className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
            tab === 'papeis' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Papéis do sistema
        </button>
      </div>

      {tab === 'equipe' && (
        <>
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <CardTitle>
                <span className="flex items-center gap-2">
                  <UserPlus size={16} /> Convidar membro
                </span>
              </CardTitle>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="funcionario@empresa.com"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Papel</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as CompanyRole)}
                  className={inputCls}
                >
                  {presets
                    .filter(p => p.inviteable)
                    .filter(p => isOwner || p.role !== 'ADMIN')
                    .map(p => (
                      <option key={p.role} value={p.role}>
                        {p.label}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            {invitePreset && (
              <p className="text-xs text-gray-500 mt-2">
                {invitePreset.description}
                {isOwner && (
                  <>
                    {' · '}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRole(role)
                        setTab('papeis')
                      }}
                      className="text-brand-400 hover:underline"
                    >
                      Configurar papel
                    </button>
                  </>
                )}
              </p>
            )}
            <Button
              className="mt-4"
              disabled={!email.trim() || invite.isPending}
              onClick={() => invite.mutate()}
            >
              {invite.isPending ? <Spinner size={12} /> : <UserPlus size={12} />} Enviar convite
            </Button>
          </Card>

          <Card>
            <div className="mb-4">
              <CardTitle>
                <span className="flex items-center gap-2">
                  <Users size={16} /> Equipe ({members.length})
                </span>
              </CardTitle>
            </div>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner size={24} />
              </div>
            ) : members.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum membro cadastrado.</p>
            ) : (
              <ul className="space-y-2">
                {members.map(m => (
                  <li
                    key={m._id}
                    className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-gray-800/50 border border-gray-800"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{m.displayEmail ?? m.email ?? '—'}</p>
                      <p className="text-xs text-gray-500">
                        {ROLE_LABEL[m.companyRole]}
                        {m.companyRole !== 'OWNER' && m.linked === false && (
                          <span className="text-amber-500/90"> · aguardando login</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {canManage && m.companyRole !== 'OWNER' && (
                        <button
                          type="button"
                          onClick={() => setEditingMember(m)}
                          className="text-gray-600 hover:text-brand-400 p-1.5"
                          title="Alterar papel"
                        >
                          <Pencil size={15} />
                        </button>
                      )}
                      {canRemoveMember && m.companyRole !== 'OWNER' && (
                        <button
                          type="button"
                          disabled={remove.isPending}
                          onClick={() => {
                            if (window.confirm('Remover este membro da equipe?')) remove.mutate(m._id)
                          }}
                          className="text-gray-600 hover:text-red-400 p-1.5"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {tab === 'papeis' && presets.length > 0 && (
        <RolesSystemPanel
          presets={presets}
          permissionGroups={permissionGroups}
          hasDiscordIntegration={hasDiscordIntegration}
          canEdit={isOwner}
          selectedRole={editingRole}
          onSelectRole={setEditingRole}
          onSave={saveRolePreset}
          onReset={resetRolePreset}
        />
      )}

      {editingMember && rolesData && (
        <TeamMemberRoleModal
          member={editingMember}
          presets={presets}
          isOwner={isOwner}
          onClose={() => setEditingMember(null)}
          onSave={newRole => updateMemberRole(editingMember._id, newRole)}
        />
      )}
    </div>
  )
}
