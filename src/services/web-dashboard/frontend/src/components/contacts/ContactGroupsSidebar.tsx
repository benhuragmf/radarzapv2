import { useState } from 'react'
import { FolderOpen, MoreHorizontal, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'

export interface ContactGroupItem {
  _id: string
  name: string
  description?: string
  memberCount: number
}

interface Props {
  groups: ContactGroupItem[]
  totalContacts: number
  selectedGroupId: string | null
  onSelectGroup: (id: string | null) => void
  canManage: boolean
  loading?: boolean
  onCreate: (data: { name: string; description?: string }) => Promise<void>
  onUpdate: (id: string, data: { name: string; description?: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export default function ContactGroupsSidebar({
  groups,
  totalContacts,
  selectedGroupId,
  onSelectGroup,
  canManage,
  loading,
  onCreate,
  onUpdate,
  onDelete,
}: Props) {
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')

  const startEdit = (g: ContactGroupItem) => {
    setEditingId(g._id)
    setEditName(g.name)
    setEditDesc(g.description ?? '')
    setMenuId(null)
  }

  const handleCreate = async () => {
    if (!createName.trim()) return
    setSaving(true)
    try {
      await onCreate({ name: createName.trim(), description: createDesc.trim() || undefined })
      setCreateName('')
      setCreateDesc('')
      setShowCreate(false)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return
    setSaving(true)
    try {
      await onUpdate(id, { name: editName.trim(), description: editDesc.trim() || undefined })
      setEditingId(null)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (g: ContactGroupItem) => {
    setMenuId(null)
    if (
      !window.confirm(
        `Excluir o grupo "${g.name}"? Os contatos permanecem cadastrados, apenas saem deste grupo.`,
      )
    ) {
      return
    }
    setSaving(true)
    try {
      await onDelete(g._id)
      if (selectedGroupId === g._id) onSelectGroup(null)
    } finally {
      setSaving(false)
    }
  }

  const itemCls = (active: boolean) =>
    `w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
      active
        ? 'bg-brand-600/20 border border-brand-600/40 text-white'
        : 'text-gray-400 hover:text-white hover:bg-gray-800/80 border border-transparent'
    }`

  return (
    <aside className="w-full lg:w-56 shrink-0 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Grupos de contato
        </p>
        {canManage && (
          <button
            type="button"
            onClick={() => {
              setShowCreate(v => !v)
              setEditingId(null)
            }}
            className="p-1 rounded text-gray-500 hover:text-brand-400 hover:bg-gray-800"
            title="Novo grupo"
          >
            <Plus size={16} />
          </button>
        )}
      </div>

      {showCreate && canManage && (
        <div className="rounded-lg border border-brand-700/50 bg-gray-900/60 p-3 space-y-2">
          <input
            value={createName}
            onChange={e => setCreateName(e.target.value)}
            placeholder="Nome do grupo"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-brand-500"
          />
          <input
            value={createDesc}
            onChange={e => setCreateDesc(e.target.value)}
            placeholder="Descrição (opcional)"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-brand-500"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={!createName.trim() || saving}>
              {saving ? <Spinner size={12} /> : 'Criar'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <nav className="space-y-1">
        <button
          type="button"
          onClick={() => onSelectGroup(null)}
          className={itemCls(selectedGroupId === null)}
        >
          <Users size={15} className="shrink-0 text-gray-500" />
          <span className="flex-1 truncate">Todos os contatos</span>
          <span className="text-[11px] text-gray-600 tabular-nums">{totalContacts}</span>
        </button>

        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner size={20} />
          </div>
        ) : (
          groups.map(g => {
            const active = selectedGroupId === g._id
            const editing = editingId === g._id

            if (editing) {
              return (
                <div
                  key={g._id}
                  className="rounded-lg border border-yellow-700/40 bg-gray-900/60 p-3 space-y-2"
                >
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-brand-500"
                  />
                  <input
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    placeholder="Descrição (opcional)"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-brand-500"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleUpdate(g._id)} disabled={saving}>
                      Salvar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )
            }

            return (
              <div key={g._id} className="relative group">
                <button
                  type="button"
                  onClick={() => onSelectGroup(g._id)}
                  className={itemCls(active)}
                >
                  <FolderOpen size={15} className={`shrink-0 ${active ? 'text-brand-400' : 'text-gray-500'}`} />
                  <span className="flex-1 truncate">{g.name}</span>
                  <span className="text-[11px] text-gray-600 tabular-nums">{g.memberCount}</span>
                </button>
                {canManage && (
                  <div className="absolute right-1 top-1/2 -translate-y-1/2">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation()
                        setMenuId(menuId === g._id ? null : g._id)
                      }}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 text-gray-500 hover:text-white hover:bg-gray-800"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                    {menuId === g._id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuId(null)} />
                        <div className="absolute right-0 top-full mt-1 z-20 min-w-[120px] rounded-lg border border-gray-700 bg-gray-900 shadow-lg py-1">
                          <button
                            type="button"
                            onClick={() => startEdit(g)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800"
                          >
                            <Pencil size={12} /> Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(g)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-gray-800"
                          >
                            <Trash2 size={12} /> Excluir
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </nav>

      {!loading && groups.length === 0 && canManage && !showCreate && (
        <p className="text-[11px] text-gray-600 leading-snug px-1">
          Organize contatos em listas (VIP, Clientes, etc.) para filtrar e segmentar envios.
        </p>
      )}
    </aside>
  )
}
