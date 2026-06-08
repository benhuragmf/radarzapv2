import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { can, getMe, type AuthUser } from '../../lib/auth'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { MessageSquare, UserCheck, ArrowRightLeft, CheckCircle2, Send, Settings2 } from 'lucide-react'

interface Department {
  _id: string
  name: string
  menuKey: string
}

interface Conversation {
  _id: string
  contactName: string
  contactIdentifier: string
  status: string
  departmentName?: string
  departmentId?: string
  assignedUserId?: string
  assignedUserName?: string
  lastMessageAt: string
}

interface InboxMessage {
  _id: string
  direction: 'inbound' | 'outbound' | 'system'
  body: string
  createdAt: string
}

const STATUS_LABEL: Record<string, string> = {
  bot_triage: 'Triagem',
  waiting_queue: 'Na fila',
  in_progress: 'Em atendimento',
  transferred: 'Transferido',
  resolved: 'Finalizado',
  closed: 'Encerrado',
}

const STATUS_VARIANT: Record<string, 'yellow' | 'blue' | 'green' | 'gray' | 'red'> = {
  bot_triage: 'yellow',
  waiting_queue: 'blue',
  in_progress: 'green',
  transferred: 'yellow',
  resolved: 'gray',
  closed: 'gray',
}

export default function Inbox() {
  const qc = useQueryClient()
  const { data: me } = useQuery<AuthUser | null>({
    queryKey: ['auth-me'],
    queryFn: getMe,
  })
  const canManageSectors = can(me ?? null, 'inbox:department:manage')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [mineOnly, setMineOnly] = useState(false)
  const [reply, setReply] = useState('')
  const [transferDept, setTransferDept] = useState('')

  const { data: departments = [] } = useQuery({
    queryKey: ['inbox-departments'],
    queryFn: () => api.get<Department[]>('/inbox/departments'),
  })

  const listParams = new URLSearchParams()
  if (filterStatus) listParams.set('status', filterStatus)
  if (filterDept) listParams.set('departmentId', filterDept)
  if (mineOnly) listParams.set('mine', '1')

  const { data: conversations = [], isLoading: loadingList } = useQuery({
    queryKey: ['inbox-conversations', filterStatus, filterDept, mineOnly],
    queryFn: () => api.get<Conversation[]>(`/inbox/conversations?${listParams}`),
    refetchInterval: 8000,
  })

  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ['inbox-conversation', selectedId],
    queryFn: () =>
      api.get<{ conversation: Conversation; messages: InboxMessage[] }>(
        `/inbox/conversations/${selectedId}`,
      ),
    enabled: Boolean(selectedId),
    refetchInterval: 5000,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['inbox-conversations'] })
    if (selectedId) qc.invalidateQueries({ queryKey: ['inbox-conversation', selectedId] })
  }

  const assign = useMutation({
    mutationFn: (id: string) => api.post(`/inbox/conversations/${id}/assign`, {}),
    onSuccess: invalidate,
  })

  const sendReply = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      api.post(`/inbox/conversations/${id}/reply`, { text }),
    onSuccess: () => {
      setReply('')
      invalidate()
    },
  })

  const transfer = useMutation({
    mutationFn: ({ id, departmentId }: { id: string; departmentId: string }) =>
      api.post(`/inbox/conversations/${id}/transfer`, { departmentId }),
    onSuccess: invalidate,
  })

  const resolve = useMutation({
    mutationFn: (id: string) => api.post(`/inbox/conversations/${id}/resolve`, {}),
    onSuccess: invalidate,
  })

  const conv = detail?.conversation
  const messages = detail?.messages ?? []
  const isTerminal = conv?.status === 'resolved' || conv?.status === 'closed'

  const selectCls = 'bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-200'

  return (
    <PlatformPage
      title="Inbox"
      description="Quem escreve no WhatsApp entra direto no menu de setores. Ao assumir, o cliente recebe o nome do atendente."
    >
      <div className="flex flex-wrap gap-2 mb-4">
        {canManageSectors && (
          <Link to="/platform/inbox/setores">
            <Button size="sm" variant="secondary">
              <Settings2 size={14} /> Setores e equipe
            </Button>
          </Link>
        )}
        <select value={filterStatus} onChange={e => setFilterStatus(e.currentTarget.value)} className={selectCls}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select value={filterDept} onChange={e => setFilterDept(e.currentTarget.value)} className={selectCls}>
          <option value="">Todos os setores</option>
          {departments.map(d => (
            <option key={d._id} value={d._id}>{d.name}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-gray-400">
          <input type="checkbox" checked={mineOnly} onChange={e => setMineOnly(e.currentTarget.checked)} />
          Só minhas
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[520px]">
        <Card className="lg:col-span-1 p-0 overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-gray-800 text-xs text-gray-500">
            {conversations.length} conversa(s)
          </div>
          <div className="flex-1 overflow-y-auto max-h-[480px]">
            {loadingList ? (
              <div className="flex justify-center py-8"><Spinner size={24} /></div>
            ) : conversations.length === 0 ? (
              <p className="text-sm text-gray-500 p-4 text-center">Nenhuma conversa na fila.</p>
            ) : (
              conversations.map(c => (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => setSelectedId(c._id)}
                  className={`w-full text-left px-3 py-3 border-b border-gray-800/80 hover:bg-gray-800/50 ${
                    selectedId === c._id ? 'bg-brand-950/40 border-l-2 border-l-brand-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-medium truncate">{c.contactName}</span>
                    <Badge
                      label={STATUS_LABEL[c.status] ?? c.status}
                      variant={STATUS_VARIANT[c.status] ?? 'gray'}
                    />
                  </div>
                  <p className="text-xs text-gray-500 truncate">{c.contactIdentifier}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {[c.departmentName, c.assignedUserName ? `· ${c.assignedUserName}` : null]
                      .filter(Boolean)
                      .join(' ')}
                  </p>
                </button>
              ))
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2 p-0 flex flex-col min-h-[480px]">
          {!selectedId ? (
            <div className="flex flex-col items-center justify-center flex-1 text-gray-500 py-16">
              <MessageSquare size={40} className="opacity-30 mb-3" />
              <p className="text-sm">Selecione uma conversa</p>
            </div>
          ) : loadingDetail ? (
            <div className="flex justify-center py-16"><Spinner size={28} /></div>
          ) : conv ? (
            <>
              <div className="px-4 py-3 border-b border-gray-800 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-sm">{conv.contactName}</p>
                  <p className="text-xs text-gray-500">{conv.contactIdentifier}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!isTerminal && conv.status !== 'in_progress' && (
                    <Button size="sm" variant="secondary" onClick={() => assign.mutate(conv._id)} disabled={assign.isPending}>
                      <UserCheck size={14} /> Assumir
                    </Button>
                  )}
                  {!isTerminal && (
                    <Button size="sm" variant="secondary" onClick={() => resolve.mutate(conv._id)} disabled={resolve.isPending}>
                      <CheckCircle2 size={14} /> Finalizar
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[320px]">
                {messages.map(m => (
                  <div
                    key={m._id}
                    className={`text-sm rounded-lg px-3 py-2 max-w-[85%] whitespace-pre-wrap ${
                      m.direction === 'outbound'
                        ? 'ml-auto bg-brand-900/50 text-brand-100'
                        : m.direction === 'system'
                          ? 'mx-auto bg-gray-800/60 text-gray-400 text-xs text-center max-w-full'
                          : 'bg-gray-800 text-gray-200'
                    }`}
                  >
                    {m.body}
                  </div>
                ))}
              </div>

              {!isTerminal && (
                <div className="border-t border-gray-800 p-3 space-y-2">
                  <div className="flex gap-2">
                    <input
                      value={reply}
                      onChange={e => setReply(e.currentTarget.value)}
                      placeholder="Digite sua resposta…"
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey && reply.trim()) {
                          e.preventDefault()
                          sendReply.mutate({ id: conv._id, text: reply })
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      onClick={() => sendReply.mutate({ id: conv._id, text: reply })}
                      disabled={!reply.trim() || sendReply.isPending}
                    >
                      <Send size={14} />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={transferDept}
                      onChange={e => setTransferDept(e.currentTarget.value)}
                      className={selectCls}
                    >
                      <option value="">Transferir para…</option>
                      {departments.filter(d => d._id !== conv.departmentId).map(d => (
                        <option key={d._id} value={d._id}>{d.name}</option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!transferDept || transfer.isPending}
                      onClick={() => {
                        transfer.mutate({ id: conv._id, departmentId: transferDept })
                        setTransferDept('')
                      }}
                    >
                      <ArrowRightLeft size={14} /> Transferir
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </Card>
      </div>
    </PlatformPage>
  )
}
