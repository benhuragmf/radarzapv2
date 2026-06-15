import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { api } from '../../lib/api'
import { Zap, Plus, Pencil } from 'lucide-react'
import { LoadingState, EmptyState } from '@/design-system'
import {
  TRIGGER_GROUPS,
  TRIGGER_HINTS,
  TRIGGER_LABELS,
  describeTrigger,
  type TriggerType,
} from '../../lib/automation-triggers'

interface AutomationRule {
  _id: string
  name?: string
  templateName: string
  triggerType: TriggerType
  active: boolean
  sendTime: string
  scheduledAt?: string
  dayOfMonth?: number
  weekdays?: number[]
  weekday?: number
  lastRunDate?: string
}

export default function PlatformTriggers() {
  const navigate = useNavigate()

  const { data: rules = [], isLoading } = useQuery<AutomationRule[]>({
    queryKey: ['platform-automations'],
    queryFn: () => api.get('/platform/automations'),
  })

  return (
    <PlatformPage
      title="Gatilhos"
      description="Cada regra usa um gatilho (quando disparar) e uma mensagem. Edite abaixo ou crie em Mensagens automáticas."
    >
      <div className="flex flex-wrap gap-2 mb-6">
        <Link to="/platform/automacoes">
          <Button size="sm">
            <Plus size={14} /> Nova automação
          </Button>
        </Link>
      </div>

      <h3 className="text-sm font-medium text-[var(--rz-text-secondary)] mb-3">Suas regras ({rules.length})</h3>
      {isLoading ? (
        <LoadingState rows={3} className="pt-4" />
      ) : rules.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="Nenhuma regra ainda"
          description="Crie automações com gatilhos de calendário, aniversário ou recorrentes."
          action={
            <Link to="/platform/automacoes" className="text-sm text-[var(--rz-primary)] hover:underline">
              Criar primeira automação
            </Link>
          }
        />
      ) : (
        <div className="space-y-2 mb-8">
          {rules.map(r => (
            <div
              key={r._id}
              role="button"
              tabIndex={0}
              className="cursor-pointer"
              onClick={() => navigate('/platform/automacoes', { state: { editId: r._id } })}
              onKeyDown={e => {
                if (e.key === 'Enter') navigate('/platform/automacoes', { state: { editId: r._id } })
              }}
            >
            <Card className="flex flex-wrap items-center justify-between gap-3 hover:border-[var(--rz-border)]">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-[var(--rz-text-primary)] truncate">
                    {r.name || r.templateName}
                  </p>
                  <Badge label={r.active ? 'Ativa' : 'Pausada'} variant={r.active ? 'green' : 'gray'} />
                </div>
                <p className="text-xs text-[var(--rz-text-muted)] mt-1">{describeTrigger(r)}</p>
                {r.lastRunDate && (
                  <p className="text-[11px] text-[var(--rz-text-muted)] mt-0.5">
                    Último enfileiramento: {r.lastRunDate.replace(/^rec:|^once:/, '')}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={e => {
                  e.stopPropagation()
                  navigate('/platform/automacoes', { state: { editId: r._id } })
                }}
              >
                <Pencil size={14} /> Editar gatilho
              </Button>
            </Card>
            </div>
          ))}
        </div>
      )}

      <h3 className="text-sm font-medium text-[var(--rz-text-secondary)] mb-3">Tipos de gatilho disponíveis</h3>
      <div className="space-y-4">
        {TRIGGER_GROUPS.map(group => (
          <div key={group.label}>
            <p className="text-xs text-[var(--rz-text-muted)] mb-2">{group.label}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {group.types.map(type => (
                <Card key={type} className="flex gap-3">
                  <Zap size={16} className="text-brand-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-[var(--rz-text-primary)]">{TRIGGER_LABELS[type]}</p>
                    <p className="text-[11px] text-[var(--rz-text-muted)] mt-1 leading-relaxed">
                      {TRIGGER_HINTS[type]}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PlatformPage>
  )
}
