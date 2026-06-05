import { Link } from 'react-router-dom'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Zap } from 'lucide-react'
import type { Campaign } from '../../lib/campaigns'
import { scheduleCountdown } from '../../lib/schedule-display'

interface Props {
  campaign: Campaign
  ruleLabel?: string
  editRuleId?: string
}

export function NextScheduleCard({ campaign, ruleLabel, editRuleId }: Props) {
  const countdown = scheduleCountdown(campaign.scheduledFor)
  const when = new Date(campaign.scheduledFor).toLocaleString('pt-BR')

  return (
    <Card className="border-brand-700/40 bg-brand-950/20">
      <div className="flex items-start gap-3">
        <Zap size={18} className="text-brand-400 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-brand-400/90 font-medium uppercase tracking-wide">
            Próximo envio · {countdown}
          </p>
          <p className="text-sm font-semibold text-white mt-1 truncate">{campaign.title}</p>
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{campaign.message}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-gray-600">
            <span>{when}</span>
            <span>·</span>
            <span>{campaign.destinations.length} destino(s)</span>
            {ruleLabel && (
              <>
                <span>·</span>
                <span>Regra: {ruleLabel}</span>
              </>
            )}
          </div>
          {campaign.status === 'processing' && (
            <Badge label="Enviando agora" variant="blue" />
          )}
        </div>
        {editRuleId && (
          <Link
            to="/platform/automacoes"
            state={{ editId: editRuleId }}
            className="text-xs text-brand-400 hover:underline shrink-0"
          >
            Ver regra
          </Link>
        )}
      </div>
    </Card>
  )
}
