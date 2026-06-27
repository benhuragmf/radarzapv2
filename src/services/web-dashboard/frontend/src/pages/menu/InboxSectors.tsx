import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { can, getMe, type AuthUser } from '../../lib/auth'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Building2, Plus, Pencil, Users, UserPlus, Bot } from 'lucide-react'
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

interface Department {
  _id: string
  name: string
  description?: string
  menuKey: string
  clientVisible: boolean
  internalRank?: number
  internalRankLabel?: string
  memberUserIds: string[]
  isActive: boolean
  sortOrder: number
}

interface TeamOption {
  memberId: string
  userId: string | null
  email?: string
  companyRole: string
  displayName: string
  linked: boolean
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

  const linkedTeam = team.filter(t => t.linked && t.userId)

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
    setFormClientVisible(d.clientVisible !== false)
    setFormInternalRank(d.internalRank && d.internalRank >= 2 ? d.internalRank : 2)
    setCreating(false)
  }

  const toggleMember = (userId: string) => {
    setFormMembers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId],
    )
  }

  const saveCreate = useMutation({
    mutationFn: () =>
      api.post('/inbox/departments', {
        name: formName,
        description: formDesc,
        memberUserIds: formMembers,
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
        clientVisible: formClientVisible,
        internalRank: formClientVisible ? undefined : formInternalRank,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox-departments'] })
      resetForm()
    },
    onError: mutationError,
  })

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
        <p className="text-xs text-amber-500/90">
          Nenhum atendente com conta vinculada.{' '}
          <Link to="/settings/team" className="text-brand-400 hover:underline">
            Convide a equipe em Equipe e cargos
          </Link>
          {' '}(papel Atendente).
        </p>
      )
    }
    return (
      <div className="flex flex-wrap gap-2">
        {linkedTeam.map(m => (
          <label
            key={m.userId!}
            className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border cursor-pointer ${
              formMembers.includes(m.userId!)
                ? 'border-brand-500 bg-brand-950/40 text-brand-200'
                : 'border-[var(--rz-border)] text-[var(--rz-text-muted)]'
            }`}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={formMembers.includes(m.userId!)}
              onChange={() => toggleMember(m.userId!)}
            />
            <Users size={12} />
            {m.displayName}
            <span className="text-[var(--rz-text-muted)]">({m.companyRole === 'ADMIN' ? 'Admin' : 'Atendente'})</span>
          </label>
        ))}
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
        <Card className="mb-4 space-y-3">
          <p className="text-sm font-medium text-brand-400">
            {creating ? 'Novo setor' : 'Editar setor'}
          </p>
          <div>
            <label className="text-xs text-[var(--rz-text-muted)] mb-1 block">Nome *</label>
            <input value={formName} onChange={e => setFormName(e.currentTarget.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-[var(--rz-text-muted)] mb-1 block">Descrição</label>
            <input value={formDesc} onChange={e => setFormDesc(e.currentTarget.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-[var(--rz-text-muted)] mb-2 block">Atendentes deste setor</label>
            <p className="text-xs text-[var(--rz-text-muted)] mb-2">
              Vazio = todos os atendentes veem a fila. Selecione para restringir (recomendado em setores internos).
            </p>
            <MemberPicker />
          </div>
          <div>
            <label className="text-xs text-[var(--rz-text-muted)] mb-2 block">Tipo de setor</label>
            <div className="flex flex-wrap gap-2 mb-1">
              <button
                type="button"
                className={sectorTypeBtnCls(formClientVisible)}
                onClick={() => setFormClientVisible(true)}
              >
                Público — aparece no menu WhatsApp
              </button>
              <button
                type="button"
                className={sectorTypeBtnCls(!formClientVisible)}
                onClick={() => {
                  setFormClientVisible(false)
                  if (formInternalRank < 2) setFormInternalRank(2)
                }}
              >
                Interno — só equipe transfere
              </button>
            </div>
            <p className="text-xs text-[var(--rz-text-muted)]">
              {formClientVisible
                ? 'O cliente escolhe este setor na triagem pelo WhatsApp.'
                : 'Invisível ao cliente. Escolha a instância de escalação abaixo.'}
            </p>
          </div>
          <div>
            <label className="text-xs text-[var(--rz-text-muted)] mb-1 block">Instância interna</label>
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
            <p className="text-xs text-[var(--rz-text-muted)] mt-1">
              {formClientVisible
                ? 'Disponível ao escolher setor interno.'
                : INTERNAL_RANK_TIERS.find(t => t.rank === formInternalRank)?.hint}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!formName.trim() || saveCreate.isPending || saveUpdate.isPending}
              onClick={() =>
                creating ? saveCreate.mutate() : editingId && saveUpdate.mutate(editingId)
              }
            >
              Salvar
            </Button>
            <Button size="sm" variant="secondary" onClick={resetForm}>Cancelar</Button>
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
                </div>
                <div className="flex gap-2 shrink-0">
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
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PlatformPage>
  )
}
