import { Card } from '../ui/Card'
import { Search } from 'lucide-react'
import type { Campaign } from '../../lib/campaigns'
import { CampaignRow } from '../../lib/campaigns'

const inputCls =
  'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500'

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
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Buscar na fila…"
          className={`${inputCls} pl-8`}
        />
      </div>

      {campaigns.length === 0 ? (
        <Card className="text-center py-8 text-gray-500 text-sm">
          {search ? 'Nenhum resultado para esta busca.' : emptyMessage}
        </Card>
      ) : (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-300">Na fila ({campaigns.length})</h3>
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
