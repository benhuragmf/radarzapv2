import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { can, getMe, type AuthUser } from '../../lib/auth'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Building2, Plus, Pencil, Users, UserPlus, Bot, Trash2, Smartphone, Clock, ShieldCheck, AlertCircle, X } from 'lucide-react'
import { formatPhone } from '../../lib/destinationFormat'
import { notifyError, notifySuccess, notifyInfo, mutationError } from '../../lib/notify'
import { inputCls, LoadingState, MetricCard } from '@/design-system'
import { InboxAtendimentoNav } from '../../components/inbox/InboxAtendimentoNav'

const INTERNAL_RANK_TIERS = [
  { rank: 2, title: '2ª instância', hint: 'Atendentes da 1ª linha podem transferir para cá.' },
  { rank: 3, title: '3ª instância', hint: 'Só quem está na 2ª instância pode transferir.' },
  { rank: 4, title: '4ª instância', hint: 'Só quem está na 3ª instância pode transferir.' },
  { rank: 5, title: '5ª instância', hint: 'Só quem está na 4ª instância pode transferir.' },
] as const

function internalRankLabel(rank: number): string {
  const tier = INTERNAL_RANK_TIERS.find(t => t.rank === rank)
  if (tier) return tier.title
  if (rank <= 0) return 'Público'
  return `${rank}ª instância`
}

interface DepartmentMemberConfig {
  userId: string
  whatsappBridgeEnabled: boolean
  bridgeHoursMode: 'always' | 'business_hours' | 'never'
}

interface Department {
  _id: string
  name: string
  description?: string
  menuKey: string
  clientVisible: boolean
  internalRank?: number
  internalRankLabel?: string
  memberUserIds: string[]
  memberConfigs?: DepartmentMemberConfig[]
  isActive: boolean
  sortOrder: number
}

interface InboxSettingsBrief {
  businessHoursEnabled: boolean
  whatsappFallbackEnabled: boolean
  timezone?: string
}

interface TeamOption {
  memberId: string
  userId: string | null
  email?: string
  companyRole: string
  displayName: string
  linked: boolean
  whatsappPhone?: string
  whatsappPhoneVerified?: boolean
}

function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  return (parts[0]?.slice(0, 2) ?? '?').toUpperCase()
}

function bridgeHoursLabel(mode: DepartmentMemberConfig['bridgeHoursMode']): string {
  if (mode === 'business_hours') return 'Comercial'
  if (mode === 'never') return 'Desligado'
  return '24h'
}

function canReceiveBridgeAlerts(member: TeamOption): boolean {
  return Boolean(member.whatsappPhone?.trim() && member.whatsappPhoneVerified)
}

const sectorTypeBtnCls = (active: boolean) =>
  `flex items-center gap-2 text-xs px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
    active
      ? 'border-brand-500 bg-brand-950/40 text-brand-200'
      : 'border-[var(--rz-border)] text-[var(--rz-text-muted)] hover:border-[var(--rz-border)]'
  }`

export default function InboxSectors() {
  const qc = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formMembers, setFormMembers] = useState<string[]>([])
  const [formMemberConfigs, setFormMemberConfigs] = useState<Record<string, DepartmentMemberConfig>>({})
  const [formClientVisible, setFormClientVisible] = useState(true)
  const [formInternalRank, setFormInternalRank] = useState<number>(2)

  const { data: me } = useQuery<AuthUser | null>({
    queryKey: ['auth-me'],
    queryFn: getMe,
  })

  const canManage = can(me ?? null, 'inbox:department:manage')

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ['inbox-departments', 'all'],
    queryFn: () => api.get<Department[]>('/inbox/departments?all=1'),
    enabled: canManage,
  })

  const { data: team = [] } = useQuery({
    queryKey: ['inbox-team'],
    queryFn: () => api.get<TeamOption[]>('/inbox/members'),
    enabled: canManage,
  })

  const { data: inboxSettings } = useQuery({
    queryKey: ['inbox-settings-brief'],
    queryFn: () =>
      api.get<InboxSettingsBrief>('/inbox/settings').then(s => ({
        businessHoursEnabled: Boolean(s.businessHoursEnabled),
        whatsappFallbackEnabled: Boolean(s.whatsappFallbackEnabled),
        timezone: s.timezone,
      })),
    enabled: canManage,
  })

  const linkedTeam = team.filter(t => t.linked && t.userId)

  const buildMemberConfigsPayload = (): DepartmentMemberConfig[] =>
    formMembers.map(userId => {
      const row = formMemberConfigs[userId]
      return {
        userId,
        whatsappBridgeEnabled: row?.whatsappBridgeEnabled !== false,
        bridgeHoursMode: row?.bridgeHoursMode ?? 'always',
      }
    })

  const memberConfigFor = (userId: string): DepartmentMemberConfig =>
    formMemberConfigs[userId] ?? {
      userId,
      whatsappBridgeEnabled: true,
      bridgeHoursMode: 'always',
    }

  const patchMemberConfig = (userId: string, patch: Partial<DepartmentMemberConfig>) => {
    setFormMemberConfigs(prev => ({
      ...prev,
      [userId]: { ...memberConfigFor(userId), ...patch, userId },
    }))
  }

  const sectorStats = useMemo(() => {
    const active = departments.filter(d => d.isActive).length
    const publicMenus = departments.filter(d => d.clientVisible !== false).length
    const internal = departments.filter(d => d.clientVisible === false).length
    return { total: departments.length, active, publicMenus, internal }
  }, [departments])

  const resetForm = () => {
    setFormName('')
    setFormDesc('')
    setFormMembers([])
    setFormMemberConfigs({})
    setFormClientVisible(true)
    setFormInternalRank(2)
    setCreating(false)
    setEditingId(null)
  }

  const startEdit = (d: Department) => {
    setEditingId(d._id)
    setFormName(d.name)
    setFormDesc(d.description ?? '')
    setFormMembers(d.memberUserIds ?? [])
    const configs: Record<string, DepartmentMemberConfig> = {}
    for (const id of d.memberUserIds ?? []) {
      const row = d.memberConfigs?.find(c => c.userId === id)
      configs[id] = {
        userId: id,
        whatsappBridgeEnabled: row?.whatsappBridgeEnabled !== false,
        bridgeHoursMode: row?.bridgeHoursMode ?? 'always',
      }
    }
    setFormMemberConfigs(configs)
    setFormClientVisible(d.clientVisible !== false)
    setFormInternalRank(d.internalRank && d.internalRank >= 2 ? d.internalRank : 2)
    setCreating(false)
  }

  const toggleMember = (userId: string) => {
    setFormMembers(prev => {
      if (prev.includes(userId)) {
        setFormMemberConfigs(cf => {
          const next = { ...cf }
          delete next[userId]
          return next
        })
        return prev.filter(id => id !== userId)
      }
      setFormMemberConfigs(cf => ({
        ...cf,
        [userId]: {
          userId,
          whatsappBridgeEnabled: canReceiveBridgeAlerts(
            linkedTeam.find(t => t.userId === userId) ?? { memberId: '', userId, displayName: '', companyRole: '', linked: true },
          ),
          bridgeHoursMode: 'always',
        },
      }))
      return [...prev, userId]
    })
  }

  const saveCreate = useMutation({
    mutationFn: () =>
      api.post('/inbox/departments', {
        name: formName,
        description: formDesc,
        memberUserIds: formMembers,
        memberConfigs: buildMemberConfigsPayload(),
        clientVisible: formClientVisible,
        internalRank: formClientVisible ? undefined : formInternalRank,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox-departments'] })
      resetForm()
    },
    onError: mutationError,
  })

  const saveUpdate = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/inbox/departments/${id}`, {
        name: formName,
        description: formDesc,
        memberUserIds: formMembers,
        memberConfigs: buildMemberConfigsPayload(),
        clientVisible: formClientVisible,
        internalRank: formClientVisible ? undefined : formInternalRank,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox-departments'] })
      resetForm()
    },
    onError: mutationError,
  })

  const deleteDept = useMutation({
    mutationFn: (id: string) => api.delete(`/inbox/departments/${id}`),
    onSuccess: () => {
      notifySuccess('Setor excluído.')
      qc.invalidateQueries({ queryKey: ['inbox-departments'] })
      resetForm()
    },
    onError: mutationError,
  })

  const handleDelete = (d: Department) => {
    if (
      !window.confirm(
        `Excluir o setor "${d.name}" permanentemente?\n\nSó é possível se não houver conversas ou chamados abertos neste setor.`,
      )
    ) {
      return
    }
    deleteDept.mutate(d._id)
  }

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/inbox/departments/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbox-departments'] }),
    onError: mutationError,
  })

  if (!canManage) {
    return (
      <PlatformPage title="Setores de atendimento">
        <Card className="text-center py-12 text-[var(--rz-text-muted)]">
          Apenas dono ou administrador pode gerenciar setores.
        </Card>
      </PlatformPage>
    )
  }

  function MemberPicker() {
    if (linkedTeam.length === 0) {
      return (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.04] px-4 py-3 text-sm text-amber-200/90">
          Nenhum atendente com conta vinculada.{' '}
          <Link to="/settings/team" className="text-brand-400 hover:underline font-medium">
            Convide a equipe
          </Link>
        </div>
      )
    }

    const unselected = linkedTeam.filter(m => !formMembers.includes(m.userId!))
    const selected = linkedTeam.filter(m => formMembers.includes(m.userId!))

    return (
      <div className="space-y-4">
        {unselected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[var(--rz-text-muted)] shrink-0">Adicionar:</span>
            {unselected.map(m => (
              <button
                key={m.userId!}
                type="button"
                onClick={() => toggleMember(m.userId!)}
                className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border border-[var(--rz-border)] bg-[var(--rz-surface)] text-[var(--rz-text-secondary)] hover:border-brand-500/40 hover:bg-brand-500/[0.06] transition-colors"
              >
                <span className="w-6 h-6 rounded-full bg-brand-500/15 text-brand-300 text-[10px] font-semibold inline-flex items-center justify-center">
                  {memberInitials(m.displayName)}
                </span>
                {m.displayName}
                <Plus size={12} className="text-brand-400" />
              </button>
            ))}
          </div>
        )}

        {selected.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/30 px-4 py-6 text-center">
            <Users size={28} className="mx-auto text-[var(--rz-text-muted)] mb-2 opacity-60" />
            <p className="text-sm text-[var(--rz-text-secondary)]">Fila aberta para toda a equipe</p>
            <p className="text-xs text-[var(--rz-text-muted)] mt-1 max-w-md mx-auto">
              Sem restrição por pessoa. Alertas bridge seguem a lista global de WhatsApp verificado.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--rz-border)] overflow-hidden bg-[var(--rz-surface)]/40 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <colgroup>
                  <col className="w-[30%]" />
                  <col className="w-[34%]" />
                  <col className="w-[12%]" />
                  <col className="w-[18%]" />
                  <col className="w-[6%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/70">
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--rz-text-muted)]">
                      Atendente
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--rz-text-muted)]">
                      WhatsApp cadastrado
                    </th>
                    <th
                      className="px-3 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--rz-text-muted)]"
                      title="Alertas !assumir no WhatsApp pessoal"
                    >
                      Bridge
                    </th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--rz-text-muted)]">
                      Horário
                    </th>
                    <th className="px-2 py-3" aria-label="Ações" />
                  </tr>
                </thead>
                <tbody>
                  {selected.map((m, index) => {
                    const cfg = memberConfigFor(m.userId!)
                    const bridgeReady = canReceiveBridgeAlerts(m)
                    const phoneLabel = m.whatsappPhone ? formatPhone(m.whatsappPhone) : null
                    const bridgeOn = cfg.whatsappBridgeEnabled && bridgeReady

                    return (
                      <tr
                        key={m.userId!}
                        className={`border-b border-[var(--rz-border)]/80 last:border-b-0 transition-colors hover:bg-[var(--rz-surface-muted)]/35 ${
                          index % 2 === 1 ? 'bg-[var(--rz-surface-muted)]/15' : ''
                        }`}
                      >
                        <td className="px-4 py-3.5 align-middle">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-br from-brand-500/30 to-brand-600/5 ring-1 ring-brand-500/25 text-brand-100 text-[11px] font-bold inline-flex items-center justify-center">
                              {memberInitials(m.displayName)}
                            </span>
                            <div className="min-w-0">
                              <p className="font-medium text-[var(--rz-text-primary)] truncate leading-tight">
                                {m.displayName}
                              </p>
                              <p className="text-[11px] text-[var(--rz-text-muted)] mt-0.5">
                                {m.companyRole === 'ADMIN' ? 'Admin' : 'Atendente'}
                                <span className="mx-1 opacity-40">·</span>
                                fila restrita
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 align-middle">
                          {phoneLabel ? (
                            <div className="space-y-1.5">
                              <p className="font-mono text-[13px] text-[var(--rz-text-primary)] tracking-tight">
                                {phoneLabel}
                              </p>
                              {m.whatsappPhoneVerified ? (
                                <span
                                  className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 ring-1 ring-emerald-500/20"
                                  title="Número usado nos alertas !assumir"
                                >
                                  <ShieldCheck size={11} strokeWidth={2.25} />
                                  Verificado
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400 ring-1 ring-amber-500/20">
                                  <AlertCircle size={11} strokeWidth={2.25} />
                                  OTP pendente
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <span className="inline-flex items-center gap-1.5 text-[13px] text-[var(--rz-text-muted)]">
                                <Smartphone size={13} className="opacity-50" />
                                Sem número
                              </span>
                              <Link
                                to="/settings/team"
                                className="inline-block text-[11px] font-medium text-brand-400 hover:text-brand-300 hover:underline"
                              >
                                Cadastrar em Equipe
                              </Link>
                            </div>
                          )}
                        </td>

                        <td className="px-3 py-3.5 align-middle text-center">
                          <div className="inline-flex flex-col items-center gap-1">
                            <label
                              className={`relative inline-flex ${bridgeReady ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                              title={
                                bridgeReady
                                  ? 'Receber alertas bridge neste setor'
                                  : 'Verifique o WhatsApp em Equipe'
                              }
                            >
                              <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={bridgeOn}
                                disabled={!bridgeReady}
                                onChange={e =>
                                  patchMemberConfig(m.userId!, {
                                    whatsappBridgeEnabled: e.target.checked,
                                  })
                                }
                              />
                              <span className="relative block h-6 w-11 rounded-full bg-[var(--rz-surface-muted)] ring-1 ring-[var(--rz-border)] transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500/50 peer-disabled:opacity-40 peer-checked:bg-brand-500 peer-checked:ring-brand-500/60 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-5" />
                            </label>
                            <span
                              className={`text-[10px] font-medium ${bridgeOn ? 'text-brand-300' : 'text-[var(--rz-text-muted)]'}`}
                            >
                              {bridgeReady ? (bridgeOn ? 'Ativo' : 'Off') : '—'}
                            </span>
                          </div>
                        </td>

                        <td className="px-3 py-3.5 align-middle">
                          <select
                            className={`w-full max-w-[148px] rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface)] px-2.5 py-1.5 text-xs text-[var(--rz-text-primary)] focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:cursor-not-allowed disabled:opacity-35 ${
                              !bridgeOn ? 'text-[var(--rz-text-muted)]' : ''
                            }`}
                            value={cfg.bridgeHoursMode}
                            disabled={!bridgeOn}
                            onChange={e =>
                              patchMemberConfig(m.userId!, {
                                bridgeHoursMode: e.target.value as DepartmentMemberConfig['bridgeHoursMode'],
                              })
                            }
                          >
                            <option value="always">24 horas</option>
                            <option value="business_hours">Comercial</option>
                            <option value="never">Desligado</option>
                          </select>
                        </td>

                        <td className="px-2 py-3.5 align-middle text-center">
                          <button
                            type="button"
                            onClick={() => toggleMember(m.userId!)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--rz-text-muted)] hover:bg-red-500/10 hover:text-red-400 transition-colors"
                            title="Remover do setor"
                            aria-label={`Remover ${m.displayName}`}
                          >
                            <X size={15} strokeWidth={2} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/40 px-4 py-2 text-[11px] text-[var(--rz-text-muted)]">
              <span>
                {selected.length} atendente{selected.length !== 1 ? 's' : ''} neste setor
              </span>
              <span>
                Bridge ativo:{' '}
                <strong className="text-[var(--rz-text-secondary)] font-medium">
                  {
                    selected.filter(m => {
                      const c = memberConfigFor(m.userId!)
                      return c.whatsappBridgeEnabled && canReceiveBridgeAlerts(m)
                    }).length
                  }
                </strong>
              </span>
            </div>
          </div>
        )}

        {selected.some(m => memberConfigFor(m.userId!).bridgeHoursMode === 'business_hours') && (
          <p className="text-[11px] text-[var(--rz-text-muted)] flex items-start gap-1.5">
            <Clock size={12} className="shrink-0 mt-0.5" />
            {inboxSettings?.businessHoursEnabled
              ? `Horário comercial: ${inboxSettings.timezone ?? 'America/Sao_Paulo'}.`
              : 'Horário comercial desligado — alertas bridge funcionam como 24h.'}{' '}
            <Link to="/platform/inbox/bot" className="text-brand-400 hover:underline shrink-0">
              Configurar
            </Link>
          </p>
        )}

        {!inboxSettings?.whatsappFallbackEnabled && (
          <p className="text-xs text-amber-500/90 flex items-start gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-3 py-2">
            <Smartphone size={14} className="shrink-0 mt-0.5" />
            Bridge WhatsApp desligado globalmente.{' '}
            <Link to="/platform/inbox/bot" className="text-brand-400 hover:underline font-medium">
              Ativar em Triagem e Bot
            </Link>
          </p>
        )}
      </div>
    )
  }

  return (
    <PlatformPage
      title="Setores de atendimento"
      description="Setores visíveis aparecem no menu WhatsApp do cliente. Setores internos usam instâncias (2ª, 3ª…) — só quem está no nível anterior pode transferir para o próximo."
    >
      <InboxAtendimentoNav me={me} className="mb-4" />

      <div className="flex flex-wrap gap-2 mb-4">
        <Link to="/platform/inbox/bot">
          <Button size="sm" variant="secondary">
            <Bot size={14} /> Bot e horários
          </Button>
        </Link>
        <Link to="/settings/team">
          <Button size="sm" variant="secondary">
            <UserPlus size={14} /> Equipe e cargos
          </Button>
        </Link>
        {!creating && !editingId && (
          <Button size="sm" onClick={() => { resetForm(); setCreating(true) }}>
            <Plus size={14} /> Novo setor
          </Button>
        )}
      </div>

      {!isLoading && departments.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <MetricCard title="Total de setores" value={sectorStats.total} icon={Building2} />
          <MetricCard title="Setores ativos" value={sectorStats.active} icon={Users} />
          <MetricCard title="Menus públicos" value={sectorStats.publicMenus} icon={Bot} />
          <MetricCard title="Instâncias internas" value={sectorStats.internal} icon={Building2} />
        </div>
      )}

      {(creating || editingId) && (
        <Card className="mb-4 overflow-hidden border-brand-500/15">
          <div className="px-5 py-4 border-b border-[var(--rz-border)] bg-gradient-to-r from-brand-500/[0.06] to-transparent">
            <p className="text-base font-semibold text-[var(--rz-text-primary)]">
              {creating ? 'Novo setor' : 'Editar setor'}
            </p>
            <p className="text-xs text-[var(--rz-text-muted)] mt-0.5">
              Dados do setor, equipe e bridge WhatsApp por atendente (número vem do cadastro em Equipe).
            </p>
          </div>

          <div className="p-5 space-y-6">
            <section className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-[var(--rz-text-muted)] mb-1.5 block">Nome *</label>
                <input value={formName} onChange={e => setFormName(e.currentTarget.value)} className={inputCls} placeholder="Ex.: Comercial" />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--rz-text-muted)] mb-1.5 block">Descrição</label>
                <input value={formDesc} onChange={e => setFormDesc(e.currentTarget.value)} className={inputCls} placeholder="Ex.: Vendas e propostas" />
              </div>
            </section>

            <section>
              <div className="flex items-center gap-2 mb-3">
                <Users size={16} className="text-brand-400" />
                <h3 className="text-sm font-medium text-[var(--rz-text-primary)]">Equipe e bridge WhatsApp</h3>
              </div>
              <p className="text-xs text-[var(--rz-text-muted)] mb-3">
                O alerta <code className="text-brand-300">!assumir</code> usa o WhatsApp verificado de cada membro em{' '}
                <Link to="/settings/team" className="text-brand-400 hover:underline">Equipe</Link>.
              </p>
              <MemberPicker />
            </section>

            <section>
              <div className="flex items-center gap-2 mb-3">
                <Building2 size={16} className="text-brand-400" />
                <h3 className="text-sm font-medium text-[var(--rz-text-primary)]">Visibilidade</h3>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  type="button"
                  className={sectorTypeBtnCls(formClientVisible)}
                  onClick={() => setFormClientVisible(true)}
                >
                  Público — menu WhatsApp
                </button>
                <button
                  type="button"
                  className={sectorTypeBtnCls(!formClientVisible)}
                  onClick={() => {
                    setFormClientVisible(false)
                    if (formInternalRank < 2) setFormInternalRank(2)
                  }}
                >
                  Interno — só equipe
                </button>
              </div>
              <p className="text-xs text-[var(--rz-text-muted)] mb-3">
                {formClientVisible
                  ? 'O cliente escolhe este setor na triagem pelo WhatsApp.'
                  : 'Invisível ao cliente. Escolha a instância de escalação.'}
              </p>
              <div className="max-w-xs">
                <label className="text-xs font-medium text-[var(--rz-text-muted)] mb-1.5 block">Instância interna</label>
                <select
                  value={formClientVisible ? '' : formInternalRank}
                  disabled={formClientVisible}
                  onChange={e => setFormInternalRank(Number(e.currentTarget.value))}
                  className={`${inputCls} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {formClientVisible && <option value="">— Setor público —</option>}
                  {INTERNAL_RANK_TIERS.map(tier => (
                    <option key={tier.rank} value={tier.rank}>
                      {tier.title}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <div className="flex gap-2 pt-2 border-t border-[var(--rz-border)]">
              <Button
                size="sm"
                disabled={!formName.trim() || saveCreate.isPending || saveUpdate.isPending}
                onClick={() =>
                  creating ? saveCreate.mutate() : editingId && saveUpdate.mutate(editingId)
                }
              >
                Salvar setor
              </Button>
              <Button size="sm" variant="secondary" onClick={resetForm}>
                Cancelar
              </Button>
            </div>
          </div>
        </Card>
      )}

      {isLoading ? (
        <LoadingState rows={4} className="pt-4" />
      ) : (
        <div className="space-y-3">
          {departments.map(d => (
            <Card key={d._id} className={!d.isActive ? 'opacity-60 border-dashed' : 'border-[var(--rz-border)]/80'}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Building2 size={16} className="text-brand-400" />
                    <span className="font-medium text-sm">{d.name}</span>
                    {d.clientVisible !== false ? (
                      <Badge label={`Menu ${d.menuKey}`} variant="blue" />
                    ) : (
                      <Badge label={d.internalRankLabel ?? internalRankLabel(d.internalRank ?? 2)} variant="yellow" />
                    )}
                    {!d.isActive && <Badge label="Inativo" variant="gray" />}
                  </div>
                  {d.description && <p className="text-xs text-[var(--rz-text-muted)]">{d.description}</p>}
                  <p className="text-xs text-[var(--rz-text-muted)] mt-1">
                    {d.clientVisible === false
                      ? `${d.internalRankLabel ?? internalRankLabel(d.internalRank ?? 2)} — transferência só pela equipe (nível anterior).`
                      : 'Aparece no menu WhatsApp do cliente.'}
                  </p>
                  <p className="text-xs text-[var(--rz-text-muted)] mt-1">
                    Atendentes:{' '}
                    {d.memberUserIds?.length
                      ? d.memberUserIds
                          .map(id => team.find(t => t.userId === id)?.displayName ?? id)
                          .join(', ')
                      : 'todos da equipe'}
                  </p>
                  {d.memberUserIds?.length ? (
                    <p className="text-xs text-[var(--rz-text-muted)] mt-0.5">
                      Bridge:{' '}
                      {d.memberConfigs?.filter(c => c.whatsappBridgeEnabled).length
                        ? d.memberConfigs
                            .filter(c => c.whatsappBridgeEnabled)
                            .map(c => {
                              const member = team.find(t => t.userId === c.userId)
                              const name = member?.displayName ?? c.userId
                              const phone = member?.whatsappPhone
                                ? formatPhone(member.whatsappPhone)
                                : null
                              return phone
                                ? `${name} · ${phone} (${bridgeHoursLabel(c.bridgeHoursMode)})`
                                : `${name} (${bridgeHoursLabel(c.bridgeHoursMode)})`
                            })
                            .join(' · ')
                        : 'nenhum atendente'}
                    </p>
                  ) : null}
                </div>
                <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                  <Button size="sm" variant="secondary" onClick={() => startEdit(d)}>
                    <Pencil size={12} />
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => toggleActive.mutate({ id: d._id, isActive: !d.isActive })}
                  >
                    {d.isActive ? 'Desativar' : 'Ativar'}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="text-red-400 hover:text-red-300"
                    onClick={() => handleDelete(d)}
                    disabled={deleteDept.isPending}
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PlatformPage>
  )
}
