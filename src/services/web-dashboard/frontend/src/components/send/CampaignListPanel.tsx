import { Search } from 'lucide-react'
import type { Campaign } from '../../lib/campaigns'
import { CampaignRow } from '../../lib/campaigns'
import { inputCls, EmptyState } from '@/design-system'

interface Props {
  campaigns: Campaign[]
  search: string
  onSearchChange: (s: string) => void
  onCancel?: (id: string) => void
  cancelling?: boolean
  emptyMessage?: string
}

export function CampaignListPanel({
  campaigns,
  search,
  onSearchChange,
  onCancel,
  cancelling,
  emptyMessage = 'Nenhum agendamento na fila.',
}: Props) {
  return (
    <div className="space-y-4">
      <div className="relative max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--rz-text-muted)]" />
        <input
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Buscar na fila…"
          className={`${inputCls} pl-8`}
        />
      </div>

      {campaigns.length === 0 ? (
        <EmptyState
          title={search ? 'Nenhum resultado' : 'Fila vazia'}
          description={search ? 'Nenhum resultado para esta busca.' : emptyMessage}
        />
      ) : (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-[var(--rz-text-secondary)]">Na fila ({campaigns.length})</h3>
          {campaigns.map(c => (
            <CampaignRow
              key={c._id}
              c={c}
              onCancel={
                onCancel
                  ? () => {
                      if (window.confirm('Cancelar este agendamento?')) onCancel(c._id)
                    }
                  : undefined
              }
              cancelling={cancelling}
            />
          ))}
        </div>
      )}
    </div>
  )
}
