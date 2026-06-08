import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { can, getMe, type AuthUser } from '../../lib/auth'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { Building2, Plus, Pencil, Users, UserPlus, Bot } from 'lucide-react'

interface Department {
  _id: string
  name: string
  description?: string
  menuKey: string
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

const inputCls =
  'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500'

export default function InboxSectors() {
  const qc = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formMembers, setFormMembers] = useState<string[]>([])

  const { data: me } = useQuery<AuthUser | null>({
    queryKey: ['auth-me'],
    queryFn: getMe,
  })

  const canManage = can(me ?? null, 'inbox:department:manage')

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ['inbox-departments'],
    queryFn: () => api.get<Department[]>('/inbox/departments'),
    enabled: canManage,
  })

  const { data: team = [] } = useQuery({
    queryKey: ['inbox-team'],
    queryFn: () => api.get<TeamOption[]>('/inbox/members'),
    enabled: canManage,
  })

  const resetForm = () => {
    setFormName('')
    setFormDesc('')
    setFormMembers([])
    setCreating(false)
    setEditingId(null)
  }

  const startEdit = (d: Department) => {
    setEditingId(d._id)
    setFormName(d.name)
    setFormDesc(d.description ?? '')
    setFormMembers(d.memberUserIds ?? [])
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
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox-departments'] })
      resetForm()
    },
    onError: (e: Error) => alert(e.message),
  })

  const saveUpdate = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/inbox/departments/${id}`, {
        name: formName,
        description: formDesc,
        memberUserIds: formMembers,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox-departments'] })
      resetForm()
    },
    onError: (e: Error) => alert(e.message),
  })

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/inbox/departments/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbox-departments'] }),
    onError: (e: Error) => alert(e.message),
  })

  if (!canManage) {
    return (
      <PlatformPage title="Setores do Inbox">
        <Card className="text-center py-12 text-gray-500">
          Apenas dono ou administrador pode gerenciar setores.
        </Card>
      </PlatformPage>
    )
  }

  const linkedTeam = team.filter(t => t.linked && t.userId)

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
                : 'border-gray-700 text-gray-400'
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
            <span className="text-gray-600">({m.companyRole === 'ADMIN' ? 'Admin' : 'Atendente'})</span>
          </label>
        ))}
      </div>
    )
  }

  return (
    <PlatformPage
      title="Setores do Inbox"
      description="Crie filas de atendimento e vincule atendentes da sua equipe. O menu WhatsApp usa estes setores automaticamente."
    >
      <div className="flex flex-wrap gap-2 mb-4">
        <Link to="/platform/inbox">
          <Button size="sm" variant="secondary">← Voltar ao Inbox</Button>
        </Link>
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

      {(creating || editingId) && (
        <Card className="mb-4 space-y-3">
          <p className="text-sm font-medium text-brand-400">
            {creating ? 'Novo setor' : 'Editar setor'}
          </p>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Nome *</label>
            <input value={formName} onChange={e => setFormName(e.currentTarget.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Descrição</label>
            <input value={formDesc} onChange={e => setFormDesc(e.currentTarget.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-2 block">Atendentes deste setor</label>
            <p className="text-xs text-gray-600 mb-2">
              Vazio = todos os atendentes veem a fila. Selecione para restringir.
            </p>
            <MemberPicker />
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
        <div className="flex justify-center py-12"><Spinner size={28} /></div>
      ) : (
        <div className="space-y-3">
          {departments.map(d => (
            <Card key={d._id} className={!d.isActive ? 'opacity-60' : undefined}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 size={16} className="text-brand-400" />
                    <span className="font-medium text-sm">{d.name}</span>
                    <Badge label={`Tecla ${d.menuKey}`} variant="blue" />
                    {!d.isActive && <Badge label="Inativo" variant="gray" />}
                  </div>
                  {d.description && <p className="text-xs text-gray-500">{d.description}</p>}
                  <p className="text-xs text-gray-600 mt-1">
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
