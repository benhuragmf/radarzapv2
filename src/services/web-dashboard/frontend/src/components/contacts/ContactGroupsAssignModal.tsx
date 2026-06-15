import { useEffect, useState } from 'react'
import { FolderOpen, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { EmptyState } from '@/design-system'
import type { ContactGroupItem } from './ContactGroupsSidebar'

interface Props {
  contactName?: string
  title?: string
  subtitle?: string
  saveLabel?: string
  groups: ContactGroupItem[]
  selectedGroupIds: string[]
  onSave: (groupIds: string[]) => Promise<void>
  onClose: () => void
}

export default function ContactGroupsAssignModal({
  contactName,
  title,
  subtitle,
  saveLabel = 'Salvar grupos',
  groups,
  selectedGroupIds,
  onSave,
  onClose,
}: Props) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(selectedGroupIds))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setPicked(new Set(selectedGroupIds))
  }, [selectedGroupIds])

  const toggle = (id: string) => {
    setPicked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave([...picked])
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div
        className="w-full max-w-md rounded-xl border border-[var(--rz-border)] bg-[var(--rz-surface)] shadow-xl"
        role="dialog"
        aria-labelledby="assign-groups-title"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--rz-border)]">
          <div>
            <p id="assign-groups-title" className="text-sm font-medium text-[var(--rz-text-primary)]">
              {title ?? 'Grupos do contato'}
            </p>
            <p className="text-xs text-gray-500 truncate max-w-[280px]">
              {subtitle ?? contactName}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-white p-1">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 max-h-72 overflow-y-auto space-y-1">
          {groups.length === 0 ? (
            <EmptyState
              title="Nenhum grupo"
              description="Crie um grupo na barra lateral para organizar contatos."
            />
          ) : (
            groups.map(g => {
              const checked = picked.has(g._id)
              return (
                <label
                  key={g._id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                    checked ? 'bg-brand-600/10 border border-brand-600/30' : 'hover:bg-gray-800/80'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(g._id)}
                    className="rounded border-gray-600"
                  />
                  <FolderOpen size={14} className="text-brand-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{g.name}</p>
                    {g.description && (
                      <p className="text-[11px] text-gray-500 truncate">{g.description}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-600">{g.memberCount}</span>
                </label>
              )
            })
          )}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--rz-border)]">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || groups.length === 0}>
            {saving ? <Spinner size={12} /> : saveLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
