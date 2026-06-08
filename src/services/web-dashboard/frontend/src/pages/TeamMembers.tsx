import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { can, getMe, isCompanyOwner, type AuthUser } from '../lib/auth'
import { Card, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { Users, UserPlus, Trash2 } from 'lucide-react'

interface Member {
  _id: string
  email?: string
  displayEmail?: string
  companyRole: 'OWNER' | 'ADMIN' | 'ATTENDANT'
  userId?: string
  linked?: boolean
  createdAt: string
}

const ROLE_LABEL: Record<Member['companyRole'], string> = {
  OWNER: 'Dono',
  ADMIN: 'Administrador',
  ATTENDANT: 'Atendente',
}

const inputCls =
  'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500'

export default function TeamMembers() {
  const qc = useQueryClient()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'ADMIN' | 'ATTENDANT'>('ATTENDANT')

  const { data: me } = useQuery<AuthUser | null>({
    queryKey: ['auth-me'],
    queryFn: getMe,
  })

  const canManage = can(me ?? null, 'company:members:manage')

  const { data: members = [], isLoading } = useQuery<Member[]>({
    queryKey: ['team-members'],
    queryFn: () => api.get('/team/members'),
    enabled: canManage,
  })

  const invite = useMutation({
    mutationFn: () => api.post('/team/members', { email, role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-members'] })
      setEmail('')
    },
    onError: (err: Error) => alert(err.message),
  })

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
    <div className="max-w-2xl space-y-5">
      <h1 className="text-lg font-semibold text-white">Cargos e acessos</h1>
      <p className="text-sm text-gray-500">
        Convide funcionários da sua empresa — use o papel <strong className="text-gray-400">Atendente</strong> para
        quem responderá o <strong className="text-gray-400">Inbox WhatsApp</strong>. Depois vincule-os aos setores em{' '}
        <a href="/platform/inbox/setores" className="text-brand-400 hover:underline">Setores do Inbox</a>.
        Login via Google (e-mail convidado) ou Discord.
      </p>

      {canManage && (
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
              <label className="text-xs text-gray-500 mb-1 block">Papel na empresa</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as 'ADMIN' | 'ATTENDANT')}
                className={inputCls}
              >
                <option value="ADMIN">Administrador</option>
                <option value="ATTENDANT">Atendente</option>
              </select>
            </div>
          </div>
          <Button
            className="mt-4"
            disabled={!email.trim() || invite.isPending}
            onClick={() => invite.mutate()}
          >
            {invite.isPending ? <Spinner size={12} /> : <UserPlus size={12} />} Enviar convite
          </Button>
        </Card>
      )}

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
                <div>
                  <p className="text-sm font-medium">{m.displayEmail ?? m.email ?? '—'}</p>
                  <p className="text-xs text-gray-500">
                    {ROLE_LABEL[m.companyRole]}
                    {m.companyRole !== 'OWNER' && m.linked === false && (
                      <span className="text-amber-500/90"> · aguardando primeiro login</span>
                    )}
                  </p>
                </div>
                {isCompanyOwner(me ?? null) && m.companyRole !== 'OWNER' && (
                  <button
                    type="button"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (window.confirm('Remover este membro da equipe?')) remove.mutate(m._id)
                    }}
                    className="text-gray-600 hover:text-red-400 p-1"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
