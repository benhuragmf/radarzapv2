import { useMemo, useState } from 'react'
import { Hash, Search, Users, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { formatPhone } from '../../lib/destinationFormat'
import { inputCls, selectCls } from '@/design-system'

export interface DestinationOption {
  _id: string
  name: string
  identifier: string
  type: string
  isActive?: boolean
}

interface Props {
  destinations: DestinationOption[]
  value: string[]
  onChange: (identifiers: string[]) => void
  emptyHint?: string
  destinationsLink?: string
}

export default function DestinationMultiSelect({
  destinations,
  value,
  onChange,
  emptyHint = 'Nenhum destino cadastrado.',
  destinationsLink = '/discord/contact',
}: Props) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'group' | 'contact'>('all')

  const activeDestinations = useMemo(
    () => destinations.filter(d => d.isActive !== false),
    [destinations],
  )

  const selectedSet = useMemo(() => new Set(value), [value])

  const selectedDestinations = useMemo(
    () => activeDestinations.filter(d => selectedSet.has(d.identifier)),
    [activeDestinations, selectedSet],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return activeDestinations
      .filter(d => {
        if (typeFilter !== 'all' && d.type !== typeFilter) return false
        if (!q) return true
        return (
          d.name.toLowerCase().includes(q) ||
          d.identifier.toLowerCase().includes(q) ||
          (d.type === 'contact' && formatPhone(d.identifier).includes(q))
        )
      })
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'group' ? -1 : 1
        return a.name.localeCompare(b.name, 'pt-BR')
      })
  }, [activeDestinations, search, typeFilter])

  const toggle = (identifier: string) => {
    if (selectedSet.has(identifier)) {
      onChange(value.filter(id => id !== identifier))
    } else {
      onChange([...value, identifier])
    }
  }

  const selectAllFiltered = () => {
    const next = new Set(value)
    for (const d of filtered) next.add(d.identifier)
    onChange([...next])
  }

  const groupCount = activeDestinations.filter(d => d.type === 'group').length
  const contactCount = activeDestinations.filter(d => d.type === 'contact').length

  return (
    <div className="rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface)]/40 overflow-hidden">
      {selectedDestinations.length > 0 ? (
        <div className="px-3 py-2.5 border-b border-gray-800 bg-gray-800/30">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs text-gray-400">
              {selectedDestinations.length} selecionado(s)
            </span>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[11px] text-gray-500 hover:text-white transition-colors"
            >
              Limpar seleção
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
            {selectedDestinations.map(d => (
              <span
                key={d._id}
                className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md text-xs bg-brand-600/15 border border-brand-600/35 text-gray-200"
              >
                {d.type === 'group' ? (
                  <Hash size={11} className="text-brand-400 shrink-0" />
                ) : (
                  <Users size={11} className="text-blue-400 shrink-0" />
                )}
                <span className="truncate max-w-[140px]">{d.name}</span>
                <button
                  type="button"
                  onClick={() => toggle(d.identifier)}
                  className="p-0.5 rounded hover:bg-gray-700/80 text-gray-500 hover:text-white"
                  aria-label={`Remover ${d.name}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="px-3 py-2 border-b border-gray-800 bg-gray-800/20">
          <p className="text-xs text-gray-500">
            Nenhum destino selecionado — envia para <span className="text-gray-400">todos os ativos</span>
          </p>
        </div>
      )}

      <div className="p-3 space-y-2">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[160px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar nome ou número..."
              className={`${inputCls} pl-9`}
            />
          </div>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as typeof typeFilter)}
            className={selectCls}
          >
            <option value="all">Todos ({activeDestinations.length})</option>
            <option value="group">Grupos ({groupCount})</option>
            <option value="contact">Contatos ({contactCount})</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={selectAllFiltered}>
            Marcar visíveis
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
            Desmarcar tudo
          </Button>
        </div>

        <div className="max-h-48 overflow-y-auto space-y-0.5 border border-gray-800 rounded-lg p-1.5">
          {filtered.length === 0 ? (
            <p className="text-xs text-gray-600 text-center py-6 px-2">
              {activeDestinations.length === 0 ? (
                <>
                  {emptyHint}{' '}
                  <Link to={destinationsLink} className="text-brand-400 hover:underline">
                    Cadastrar destinos
                  </Link>
                </>
              ) : (
                'Nenhum resultado para esta busca.'
              )}
            </p>
          ) : (
            filtered.map(d => {
              const checked = selectedSet.has(d.identifier)
              return (
                <label
                  key={d._id}
                  className={`flex items-center gap-3 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                    checked
                      ? 'bg-brand-600/10 border border-brand-600/25'
                      : 'hover:bg-gray-800/80 border border-transparent'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(d.identifier)}
                    className="rounded border-gray-600 shrink-0"
                  />
                  {d.type === 'group' ? (
                    <Hash size={14} className="text-brand-500 shrink-0" />
                  ) : (
                    <Users size={14} className="text-blue-400 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{d.name}</p>
                    <p className="text-[11px] text-gray-500 font-mono truncate">
                      {d.type === 'contact' ? formatPhone(d.identifier) : d.identifier}
                    </p>
                  </div>
                  <Badge
                    label={d.type === 'group' ? 'grupo' : 'contato'}
                    variant={d.type === 'group' ? 'green' : 'blue'}
                  />
                </label>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
