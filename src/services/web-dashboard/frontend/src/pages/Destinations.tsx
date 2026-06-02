import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useGuild } from '../lib/guildContext'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { Users, Phone, Plus, Trash2, RefreshCw } from 'lucide-react'

interface Destination {
  _id: string
  name: string
  identifier: string
  type: 'contact' | 'group'
  isActive: boolean
  lastMessageSent?: string
}

interface WAGroup {
  id: string
  name: string
  participantsCount: number
  isAdmin: boolean
}

interface Session {
  clientId: string
  status: string
}

export default function Destinations() {
  const qc = useQueryClient()
  const { guildId } = useGuild()
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState({ type: 'contact', identifier: '', name: '' })
  const [activeTab, setActiveTab] = useState<'contacts' | 'groups'>('contacts')

  const { data: destinations = [], isLoading } = useQuery<Destination[]>({
    queryKey: ['destinations', guildId],
    queryFn: () => api.get('/destinations'),
    refetchInterval: 30_000,
  })

  const { data: sessions = [] } = useQuery<Session[]>({
    queryKey: ['sessions'],
    queryFn: () => api.get('/sessions'),
  })

  const connectedSession = sessions.find(s => s.status === 'connected')

  const { data: waGroups = [], isLoading: loadingGroups, refetch: refetchGroups } = useQuery<WAGroup[]>({
    queryKey: ['wa-groups', connectedSession?.clientId],
    queryFn: () => connectedSession
      ? api.get(`/sessions/${connectedSession.clientId}/groups`)
      : Promise.resolve([]),
    enabled: !!connectedSession && activeTab === 'groups',
  })

  const add = useMutation({
    mutationFn: () => api.post('/destinations', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['destinations'] })
      setShowAddForm(false)
      setForm({ type: 'contact', identifier: '', name: '' })
    },
    onError: (err: any) => {
      alert(`Erro: ${err.message}`)
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/destinations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['destinations'] }),
  })

  // Add WhatsApp group as destination
  const addGroup = useMutation({
    mutationFn: (g: WAGroup) => api.post('/destinations', {
      type: 'group',
      identifier: g.id,
      name: g.name,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['destinations'] })
    },
    onError: (err: any) => {
      alert(`Erro ao adicionar grupo: ${err.message}`)
    },
  })

  const contacts = destinations.filter(d => d.type === 'contact')
  const groups   = destinations.filter(d => d.type === 'group')
  const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500'

  // Avatar from WhatsApp CDN (best-effort)
  const avatar = (identifier: string) =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(identifier)}&background=1f2937&color=4ade80&size=40&bold=true`

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1">
          {(['contacts', 'groups'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'contacts' ? `Contatos (${contacts.length})` : `Grupos (${groups.length})`}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setShowAddForm(v => !v)}>
          <Plus size={12} /> Adicionar
        </Button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <Card className="border-brand-700">
          <p className="text-sm font-medium text-brand-400 mb-3">Novo Destino</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.currentTarget.value }))}
              className={inputCls}>
              <option value="contact">Contato</option>
              <option value="group">Grupo</option>
            </select>
            <input value={form.identifier}
              onChange={e => setForm(f => ({ ...f, identifier: e.currentTarget.value }))}
              placeholder={form.type === 'contact' ? '+5511976904921' : '120363...@g.us'}
              className={inputCls} />
            <input value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.currentTarget.value }))}
              placeholder="Nome de exibição"
              className={inputCls} />
          </div>
          <div className="flex gap-2 mt-3">
            <Button onClick={() => add.mutate()} disabled={!form.identifier || !form.name || add.isPending}>
              {add.isPending ? <Spinner size={12} /> : <Plus size={12} />} Salvar
            </Button>
            <Button variant="ghost" onClick={() => setShowAddForm(false)}>Cancelar</Button>
          </div>
        </Card>
      )}

      {isLoading && <div className="flex justify-center pt-10"><Spinner size={28} /></div>}

      {/* Contacts tab */}
      {activeTab === 'contacts' && (
        <div className="space-y-2">
          {contacts.length === 0 && !isLoading && (
            <Card className="text-center py-10 text-gray-500">
              <Phone size={28} className="mx-auto mb-2 opacity-30" />
              <p>Nenhum contato cadastrado.</p>
            </Card>
          )}
          {contacts.map(d => (
            <Card key={d._id} className="flex items-center gap-4">
              <img src={avatar(d.name)} alt={d.name}
                className="w-10 h-10 rounded-full shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{d.name}</p>
                <p className="text-xs text-gray-500">{d.identifier}</p>
                {d.lastMessageSent && (
                  <p className="text-xs text-gray-600">
                    Último envio: {new Date(d.lastMessageSent).toLocaleString('pt-BR')}
                  </p>
                )}
              </div>
              <Badge label="contato" variant="blue" />
              <button onClick={() => { if (window.confirm('Remover este contato?')) remove.mutate(d._id) }}
                className="text-gray-600 hover:text-red-400 transition-colors shrink-0">
                <Trash2 size={15} />
              </button>
            </Card>
          ))}
        </div>
      )}

      {/* Groups tab */}
      {activeTab === 'groups' && (
        <div className="space-y-4">
          {/* Registered groups */}
          {groups.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Grupos cadastrados</p>
              {groups.map(d => (
                <Card key={d._id} className="flex items-center gap-4">
                  <img src={avatar(d.name)} alt={d.name}
                    className="w-10 h-10 rounded-full shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{d.name}</p>
                    <p className="text-xs text-gray-500 font-mono truncate">{d.identifier}</p>
                  </div>
                  <Badge label="grupo" variant="green" />
                  <button onClick={() => { if (window.confirm('Remover este grupo?')) remove.mutate(d._id) }}
                    className="text-gray-600 hover:text-red-400 transition-colors shrink-0">
                    <Trash2 size={15} />
                  </button>
                </Card>
              ))}
            </div>
          )}

          {/* WhatsApp groups from active session */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                Grupos do WhatsApp {connectedSession ? '' : '(WhatsApp desconectado)'}
              </p>
              {connectedSession && (
                <button onClick={() => refetchGroups()}
                  className="text-gray-500 hover:text-white transition-colors">
                  <RefreshCw size={13} />
                </button>
              )}
            </div>

            {!connectedSession && (
              <Card className="text-center py-8 text-gray-500">
                <Users size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Conecte o WhatsApp para ver os grupos.</p>
              </Card>
            )}

            {loadingGroups && <div className="flex justify-center py-6"><Spinner size={24} /></div>}

            {!loadingGroups && waGroups.length > 0 && (
              <div className="space-y-2">
                {waGroups.map(g => {
                  const alreadyAdded = groups.some(d => d.identifier === g.id)
                  return (
                    <Card key={g.id} className="flex items-center gap-4">
                      <img src={avatar(g.name)} alt={g.name}
                        className="w-10 h-10 rounded-full shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{g.name}</p>
                          {g.isAdmin && <Badge label="admin" variant="yellow" />}
                        </div>
                        <p className="text-xs text-gray-500">{g.participantsCount} participantes</p>
                      </div>
                      {alreadyAdded ? (
                        <Badge label="cadastrado" variant="green" />
                      ) : (
                        <Button size="sm" variant="secondary"
                          onClick={() => addGroup.mutate(g)}
                          disabled={addGroup.isPending}>
                          <Plus size={11} /> Adicionar
                        </Button>
                      )}
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
