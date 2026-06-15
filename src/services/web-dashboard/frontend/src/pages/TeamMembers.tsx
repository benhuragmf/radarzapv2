import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { can, getMe, isCompanyOwner, type AuthUser, type CompanyRole } from '../lib/auth'
import { Card, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { Users, UserPlus, Trash2, Pencil, MessageSquare, Ticket, Building2, Zap, Mail } from 'lucide-react'
import { notifyError, notifySuccess, notifyInfo, mutationError } from '../lib/notify'
import { RadarPageShell, PageHeader, PermissionState, LoadingState } from '@/design-system'
import { inputCls } from '@/design-system/formClasses'
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
  customRoleId?: string
  customRoleName?: string
  userId?: string
  linked?: boolean
  whatsappPhone?: string
  effectiveCapabilities?: string[]
  inviteEmailSentAt?: string
  inviteEmailLastError?: string
  createdAt: string
}

interface InviteEmailResult {
  sent: boolean
  transport: 'resend' | 'smtp' | 'console' | 'none'
  error?: string
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

type Tab = 'equipe' | 'papeis'

export default function TeamMembers() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('equipe')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<string>('ATTENDANT')
  const [editingRole, setEditingRole] = useState<string>('ATTENDANT')
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

  const [inviteNotice, setInviteNotice] = useState<string | null>(null)

  const invite = useMutation({
    mutationFn: () =>
      api.post<Member & { inviteEmail: InviteEmailResult }>('/team/members', { email, roleKey: role }),
    onSuccess: data => {
      qc.invalidateQueries({ queryKey: ['team-members'] })
      setEmail('')
      if (data.inviteEmail?.sent) {
        const via =
          data.inviteEmail.transport === 'console'
            ? ' (modo dev — veja o log do servidor)'
            : ''
        setInviteNotice(`Convite enviado para ${data.email ?? email}${via}`)
      } else {
        setInviteNotice(
          data.inviteEmail?.error ??
            'Membro adicionado, mas o e-mail não foi enviado. Configure RESEND_API_KEY ou SMTP.',
        )
      }
      setTimeout(() => setInviteNotice(null), 6000)
    },
    onError: mutationError,
  })

  const resendInvite = useMutation({
    mutationFn: (memberId: string) =>
      api.post<Member & { inviteEmail: InviteEmailResult }>(`/team/members/${memberId}/resend-invite`),
    onSuccess: data => {
      qc.invalidateQueries({ queryKey: ['team-members'] })
      if (data.inviteEmail?.sent) {
        notifySuccess(`Convite reenviado${data.inviteEmail.transport === 'console' ? ' (log do servidor)' : ''}.`)
      } else {
        notifyError(data.inviteEmail?.error ?? 'Não foi possível reenviar o e-mail.')
      }
    },
    onError: mutationError,
  })

  const updateMemberRole = async (id: string, roleKey: string, whatsappPhone?: string) => {
    await api.patch(`/team/members/${id}`, { roleKey, whatsappPhone: whatsappPhone ?? null })
    qc.invalidateQueries({ queryKey: ['team-members'] })
  }

  const saveRolePreset = async (roleKey: string, capabilities: string[]) => {
    if (roleKey.startsWith('custom:')) {
      await api.patch(`/team/custom-roles/${roleKey.slice(7)}`, { capabilities })
    } else {
      await api.patch(`/team/roles/${roleKey}`, { capabilities })
    }
    await qc.invalidateQueries({ queryKey: ['team-roles'] })
    await qc.invalidateQueries({ queryKey: ['team-members'] })
  }

  const resetRolePreset = async (roleKey: string) => {
    if (roleKey.startsWith('custom:')) {
      await api.delete(`/team/custom-roles/${roleKey.slice(7)}`)
      setEditingRole('ATTENDANT')
    } else {
      await api.delete(`/team/roles/${roleKey}`)
    }
    await qc.invalidateQueries({ queryKey: ['team-roles'] })
    await qc.invalidateQueries({ queryKey: ['team-members'] })
  }

  const createCustomRole = async () => {
    const name = window.prompt('Nome do novo papel personalizado:')
    if (!name?.trim()) return
    const created = await api.post<{ id: string }>('/team/custom-roles', {
      name: name.trim(),
      capabilities: ['dashboard:view'],
    })
    await qc.invalidateQueries({ queryKey: ['team-roles'] })
    setEditingRole(`custom:${created.id}`)
    setTab('papeis')
  }

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/team/members/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-members'] }),
    onError: mutationError,
  })

  if (!canManage) {
    return (
      <RadarPageShell>
        <PermissionState
          title="Sem permissão"
          description="Apenas dono ou administrador pode gerenciar a equipe."
        />
      </RadarPageShell>
    )
  }

  return (
    <RadarPageShell>
      <PageHeader
        title="Equipe e permissões"
        subtitle="Gerencie quem acessa sua empresa. Convide em Equipe e defina o que cada papel pode fazer em Papéis do sistema."
      />

      <div className="inline-flex p-1 rounded-xl bg-[var(--rz-surface-muted)] border border-[var(--rz-border)]">
        <button
          type="button"
          onClick={() => setTab('equipe')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'equipe'
              ? 'bg-[var(--rz-surface)] text-[var(--rz-text-primary)] shadow-sm'
              : 'text-[var(--rz-text-muted)] hover:text-[var(--rz-text-primary)]'
          }`}
        >
          Equipe
        </button>
        <button
          type="button"
          onClick={() => setTab('papeis')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'papeis'
              ? 'bg-[var(--rz-surface)] text-[var(--rz-text-primary)] shadow-sm'
              : 'text-[var(--rz-text-muted)] hover:text-[var(--rz-text-primary)]'
          }`}
        >
          Papéis do sistema
        </button>
      </div>

      <p className="text-xs text-[var(--rz-text-muted)]">
        Papéis fixos (Dono, Admin, Atendente…) + quantos personalizados quiser em{' '}
        <span className="text-[var(--rz-text-secondary)]">+ Novo papel</span>.
      </p>

      <div className="space-y-5">
      <Card className="border-brand-500/20 bg-brand-500/[0.03]">
        <CardTitle>
          <span className="flex items-center gap-2 text-sm">
            <MessageSquare size={16} className="text-brand-400" />
            Atendimento WhatsApp
          </span>
        </CardTitle>
        <p className="text-xs text-gray-500 mt-2 max-w-xl">
          Membros com papel <span className="text-gray-400">Atendente</span>,{' '}
          <span className="text-gray-400">Atendente 2ª instância</span> ou{' '}
          <span className="text-gray-400">Gerente</span> podem usar o Inbox. Crie papéis
          personalizados em <span className="text-gray-400">Papéis do sistema</span> (+ Novo papel).
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          {can(me ?? null, 'inbox:view') && (
            <Link to="/platform/inbox">
              <Button size="sm" variant="secondary">
                <MessageSquare size={14} /> Inbox
              </Button>
            </Link>
          )}
          {can(me ?? null, 'inbox:view') && (
            <Link to="/platform/inbox/tickets">
              <Button size="sm" variant="secondary">
                <Ticket size={14} /> Tickets
              </Button>
            </Link>
          )}
          {can(me ?? null, 'inbox:department:manage') && (
            <>
              <Link to="/platform/inbox/setores">
                <Button size="sm" variant="secondary">
                  <Building2 size={14} /> Setores
                </Button>
              </Link>
              <Link to="/platform/inbox/respostas">
                <Button size="sm" variant="secondary">
                  <Zap size={14} /> Respostas rápidas
                </Button>
              </Link>
            </>
          )}
        </div>
        {(role === 'ATTENDANT' || role === 'MANAGER') && tab === 'equipe' && (
          <p className="text-[11px] text-amber-500/80 mt-3">
            Convite selecionado: {ROLE_LABEL[role]} — inclui permissões de Inbox conforme o papel
            configurado em Papéis do sistema.
          </p>
        )}
      </Card>

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
                  onChange={e => setRole(e.currentTarget.value)}
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
            {inviteNotice && (
              <p className="mt-2 text-xs text-brand-400">{inviteNotice}</p>
            )}
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
              <LoadingState rows={4} className="py-4" />
            ) : members.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum membro cadastrado.</p>
            ) : (
              <ul className="space-y-2">
                {members.map(m => {
                  const initial = (m.displayEmail ?? m.email ?? '?').charAt(0).toUpperCase()
                  return (
                  <li
                    key={m._id}
                    className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl bg-gray-800/40 border border-gray-800/80 hover:border-gray-700/80 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-full bg-gray-700/80 flex items-center justify-center text-sm font-medium text-gray-300 shrink-0">
                        {initial}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate text-gray-100">{m.displayEmail ?? m.email ?? '—'}</p>
                        <p className="text-xs text-gray-500">
                          {m.customRoleName ?? ROLE_LABEL[m.companyRole]}
                          {m.whatsappPhone && (
                            <span className="text-gray-600"> · WA cadastrado</span>
                          )}
                          {m.companyRole !== 'OWNER' && m.linked === false && (
                            <span className="text-amber-500/90"> · aguardando login</span>
                          )}
                          {m.companyRole !== 'OWNER' && m.linked === false && m.inviteEmailSentAt && (
                            <span className="text-gray-600"> · convite enviado</span>
                          )}
                          {m.inviteEmailLastError && m.linked === false && (
                            <span className="text-red-400/90"> · e-mail falhou</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {canManage && m.companyRole !== 'OWNER' && m.linked === false && (
                        <button
                          type="button"
                          disabled={resendInvite.isPending}
                          onClick={() => resendInvite.mutate(m._id)}
                          className="text-gray-600 hover:text-brand-400 p-1.5"
                          title="Reenviar convite por e-mail"
                        >
                          <Mail size={15} />
                        </button>
                      )}
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
                  )
                })}
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
          onCreateCustomRole={isOwner ? createCustomRole : undefined}
        />
      )}

      {editingMember && rolesData && (
        <TeamMemberRoleModal
          member={editingMember}
          presets={presets}
          isOwner={isOwner}
          onClose={() => setEditingMember(null)}
          onSave={(newRole, whatsappPhone) => updateMemberRole(editingMember._id, newRole, whatsappPhone)}
        />
      )}
      </div>
    </RadarPageShell>
  )
}
