import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { api, downloadFile } from '../../lib/api'
import {
import { notifyError, notifySuccess, notifyInfo, mutationError } from '../../lib/notify'
  ListOrdered,
  Plus,
  Pencil,
  Trash2,
  Download,
  Copy,
  Upload,
  Users,
  X,
} from 'lucide-react'

interface GroupRow {
  _id: string
  name: string
  description?: string
  memberCount: number
}

interface MemberRow {
  _id: string
  name: string
  identifier: string
  email?: string
  birthday?: string
  consentStatus?: string
}

const inputCls =
  'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500'

export default function ContactSegments() {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [importFromId, setImportFromId] = useState('')
  const [memberSearch, setMemberSearch] = useState('')

  const { data: groups = [], isLoading } = useQuery<GroupRow[]>({
    queryKey: ['contact-groups'],
    queryFn: () => api.get('/contact-groups'),
  })

  const selected = groups.find(g => g._id === selectedId) ?? null

  const { data: members = [], isLoading: loadingMembers } = useQuery<MemberRow[]>({
    queryKey: ['contact-group-members', selectedId],
    queryFn: () => api.get(`/contact-groups/${selectedId}/members`),
    enabled: !!selectedId,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['contact-groups'] })
    if (selectedId) qc.invalidateQueries({ queryKey: ['contact-group-members', selectedId] })
  }

  const createGroup = useMutation({
    mutationFn: (name: string) => api.post('/contact-groups', { name }),
    onSuccess: g => {
      invalidate()
      setCreating(false)
      setNewName('')
      setSelectedId((g as GroupRow)._id)
    },
    onError: mutationError,
  })

  const updateGroup = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.patch(`/contact-groups/${id}`, { name }),
    onSuccess: () => {
      invalidate()
      setEditingId(null)
    },
    onError: mutationError,
  })

  const deleteGroup = useMutation({
    mutationFn: (id: string) => api.delete(`/contact-groups/${id}`),
    onSuccess: () => {
      invalidate()
      setSelectedId(null)
    },
    onError: mutationError,
  })

  const copyFromGroup = useMutation({
    mutationFn: ({ targetId, fromGroupId }: { targetId: string; fromGroupId: string }) =>
      api.post<{ affected: number; memberCount: number }>(
        `/contact-groups/${targetId}/members/bulk`,
        { fromGroupId, action: 'add' },
      ),
    onSuccess: res => {
      invalidate()
      setImportFromId('')
      notifySuccess(`${res.affected} contato(s) copiado(s). Total no segmento: ${res.memberCount}.`)
    },
    onError: mutationError,
  })

  const removeMember = useMutation({
    mutationFn: ({ groupId, destinationId }: { groupId: string; destinationId: string }) =>
      api.post(`/contact-groups/${groupId}/members/bulk`, {
        destinationIds: [destinationId],
        action: 'remove',
      }),
    onSuccess: () => invalidate(),
    onError: mutationError,
  })

  const filteredMembers = members.filter(m => {
    const q = memberSearch.trim().toLowerCase()
    if (!q) return true
    return (
      m.name.toLowerCase().includes(q) ||
      m.identifier.includes(q) ||
      (m.email ?? '').toLowerCase().includes(q)
    )
  })

  const otherGroups = groups.filter(g => g._id !== selectedId)

  return (
    <PlatformPage
      title="Segmentos / Listas"
      description="Crie listas de contatos, copie membros entre segmentos e exporte CSV para campanhas e automações."
    >
      <div className="flex flex-wrap gap-2 mb-4">
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus size={14} /> Novo segmento
        </Button>
        <Link
          to={
            selectedId
              ? `/platform/contacts?segment=${selectedId}`
              : '/platform/contacts'
          }
        >
          <Button size="sm" variant="secondary">
            <Upload size={14} />
            {selectedId ? 'Importar para este segmento' : 'Importar contatos (CSV/VCF)'}
          </Button>
        </Link>
        <Link to="/contact">
          <Button size="sm" variant="ghost">
            <Users size={14} /> Ver todos os contatos
          </Button>
        </Link>
      </div>

      {creating && (
        <Card className="mb-4 flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-gray-500 block mb-1">Nome do segmento</label>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className={inputCls}
              placeholder="Ex.: Clientes VIP"
              autoFocus
            />
          </div>
          <Button
            size="sm"
            disabled={!newName.trim() || createGroup.isPending}
            onClick={() => createGroup.mutate(newName.trim())}
          >
            Criar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setCreating(false); setNewName('') }}>
            <X size={14} />
          </Button>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size={28} />
        </div>
      ) : groups.length === 0 ? (
        <Card className="text-center py-12 text-gray-500">
          <ListOrdered size={32} className="mx-auto mb-2 opacity-40" />
          <p>Nenhum segmento criado.</p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="text-brand-400 text-sm hover:underline mt-2"
          >
            Criar primeiro segmento
          </button>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(240px,1fr)_2fr]">
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-900/80 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-3 py-2">Segmento</th>
                  <th className="px-3 py-2 text-right">Qtd</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {groups.map(g => (
                  <tr
                    key={g._id}
                    className={`cursor-pointer hover:bg-gray-900/50 ${
                      selectedId === g._id ? 'bg-brand-950/30' : ''
                    }`}
                    onClick={() => setSelectedId(g._id)}
                  >
                    <td className="px-3 py-2">
                      {editingId === g._id ? (
                        <input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className={inputCls}
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <span className="text-gray-200">{g.name}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500">{g.memberCount}</td>
                    <td className="px-3 py-2 text-right" onClick={e => e.stopPropagation()}>
                      {editingId === g._id ? (
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            onClick={() => updateGroup.mutate({ id: g._id, name: editName.trim() })}
                            disabled={!editName.trim()}
                          >
                            Salvar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            <X size={12} />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-1 justify-end">
                          <button
                            type="button"
                            className="p-1 text-gray-500 hover:text-gray-300"
                            title="Renomear"
                            onClick={() => {
                              setEditingId(g._id)
                              setEditName(g.name)
                            }}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className="p-1 text-gray-500 hover:text-red-400"
                            title="Excluir"
                            onClick={() => {
                              if (window.confirm(`Excluir segmento "${g.name}"? Os contatos não são apagados.`)) {
                                deleteGroup.mutate(g._id)
                              }
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="min-w-0">
            {!selected ? (
              <Card className="text-center py-16 text-gray-500 text-sm">
                Selecione um segmento à esquerda para ver membros, copiar de outro grupo ou exportar.
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-medium text-white">
                    {selected.name}{' '}
                    <span className="text-gray-500 font-normal">({selected.memberCount} contatos)</span>
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        downloadFile(`/contact-groups/${selected._id}/export-csv`).catch(mutationError)
                      }
                    >
                      <Download size={14} /> Exportar CSV
                    </Button>
                  </div>
                </div>

                {otherGroups.length > 0 && (
                  <Card className="flex flex-wrap gap-2 items-end text-sm">
                    <div className="flex-1 min-w-[180px]">
                      <label className="text-xs text-gray-500 block mb-1">
                        Copiar contatos de outro segmento
                      </label>
                      <select
                        value={importFromId}
                        onChange={e => setImportFromId(e.target.value)}
                        className={inputCls}
                      >
                        <option value="">Selecione origem…</option>
                        {otherGroups.map(g => (
                          <option key={g._id} value={g._id}>
                            {g.name} ({g.memberCount})
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      size="sm"
                      disabled={!importFromId || copyFromGroup.isPending}
                      onClick={() =>
                        copyFromGroup.mutate({ targetId: selected._id, fromGroupId: importFromId })
                      }
                    >
                      <Copy size={14} /> Copiar para aqui
                    </Button>
                  </Card>
                )}

                <input
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  placeholder="Buscar nome ou telefone…"
                  className={inputCls}
                />

                {loadingMembers ? (
                  <div className="flex justify-center py-8">
                    <Spinner size={24} />
                  </div>
                ) : filteredMembers.length === 0 ? (
                  <Card className="text-center py-8 text-gray-500 text-sm">
                    {members.length === 0
                      ? 'Segmento vazio. Copie de outro segmento ou importe contatos.'
                      : 'Nenhum resultado na busca.'}
                  </Card>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-800 max-h-[420px] overflow-y-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-900/80 text-xs text-gray-500 uppercase sticky top-0">
                        <tr>
                          <th className="px-3 py-2">Nome</th>
                          <th className="px-3 py-2">Telefone</th>
                          <th className="px-3 py-2">Consentimento</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {filteredMembers.map(m => (
                          <tr key={m._id} className="hover:bg-gray-900/40">
                            <td className="px-3 py-2 text-gray-200">{m.name || '—'}</td>
                            <td className="px-3 py-2 text-gray-400 font-mono text-xs">{m.identifier}</td>
                            <td className="px-3 py-2 text-gray-500 text-xs">{m.consentStatus ?? '—'}</td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                className="text-xs text-red-400/80 hover:text-red-400"
                                onClick={() => {
                                  if (window.confirm(`Remover ${m.name || m.identifier} deste segmento?`)) {
                                    removeMember.mutate({ groupId: selected._id, destinationId: m._id })
                                  }
                                }}
                              >
                                Remover
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </PlatformPage>
  )
}
