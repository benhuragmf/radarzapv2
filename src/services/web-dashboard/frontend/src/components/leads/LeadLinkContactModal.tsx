import { useEffect, useState } from 'react'
import { Link2, Search, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { inputCls } from '@/design-system'
import { api } from '../../lib/api'
import type { LeadContactSearchItem } from '@radarchat-types/lead-form'

interface Props {
  open: boolean
  leadName: string
  leadPhone: string
  onClose: () => void
  onLink: (contactId: string) => void
  linking: boolean
}

export function LeadLinkContactModal({ open, leadName, leadPhone, onClose, onLink, linking }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LeadContactSearchItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      setSelectedId(null)
      return
    }
    const seed = leadPhone.startsWith('email:') ? leadName : leadPhone.replace(/\D/g, '').slice(-8)
    if (seed.length >= 2) setQuery(seed)
  }, [open, leadName, leadPhone])

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([])
      return
    }
    const t = window.setTimeout(() => {
      setLoading(true)
      api
        .get<LeadContactSearchItem[]>(`/leads/contacts-search?q=${encodeURIComponent(query.trim())}`)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 300)
    return () => window.clearTimeout(t)
  }, [open, query])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-lg rounded-xl border border-[var(--rz-border)] bg-[var(--rz-surface)] shadow-xl max-h-[85vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--rz-border)] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Link2 size={16} /> Vincular a contato existente
            </h2>
            <p className="text-sm text-[var(--rz-text-muted)] mt-1">
              Lead: {leadName}
            </p>
          </div>
          <button type="button" className="p-1.5 rounded-lg hover:bg-[var(--rz-surface-muted)]" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--rz-text-muted)]" />
            <input
              className={inputCls + ' pl-9'}
              placeholder="Buscar por nome, telefone ou e-mail…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : query.trim().length < 2 ? (
            <p className="text-sm text-[var(--rz-text-muted)] text-center py-6">
              Digite ao menos 2 caracteres para buscar contatos.
            </p>
          ) : results.length === 0 ? (
            <p className="text-sm text-[var(--rz-text-muted)] text-center py-6">
              Nenhum contato encontrado. Tente outro termo ou cadastre em Contatos.
            </p>
          ) : (
            <ul className="space-y-2">
              {results.map(c => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                      selectedId === c.id
                        ? 'border-[var(--rz-primary)] bg-[var(--rz-primary)]/10'
                        : 'border-[var(--rz-border)] hover:border-[var(--rz-primary)]/40'
                    }`}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <p className="font-medium text-sm">{c.name}</p>
                    <p className="text-xs text-[var(--rz-text-muted)] mt-0.5">
                      {c.phone}
                      {c.email ? ` · ${c.email}` : ''}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--rz-border)] px-5 py-4">
          <Button variant="secondary" onClick={onClose} disabled={linking}>
            Cancelar
          </Button>
          <Button disabled={!selectedId || linking} onClick={() => selectedId && onLink(selectedId)}>
            {linking ? 'Vinculando…' : 'Vincular contato'}
          </Button>
        </div>
      </div>
    </div>
  )
}
