import { Link } from 'react-router-dom'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { LoadingState, EmptyState } from '@/design-system'
import { ExternalLink, List, Plus } from 'lucide-react'
import type { LeadSegmentSummary } from '@radarzap-types/lead-form'

export function LeadSegmentsTab({
  segments,
  loading,
  canManage,
}: {
  segments: LeadSegmentSummary[]
  loading: boolean
  canManage: boolean
}) {
  if (loading) return <LoadingState rows={4} />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-3 items-center">
        <p className="text-sm text-[var(--rz-text-muted)] max-w-xl">
          Listas e segmentos reaproveitados do módulo Contatos. Use-as para organizar leads por origem,
          campanha ou estágio — sem duplicar a gestão completa de listas aqui.
        </p>
        <div className="flex gap-2">
          <Link to="/platform/segmentos">
            <Button variant="secondary" size="sm">
              <ExternalLink size={14} /> Abrir Listas e segmentos
            </Button>
          </Link>
          {canManage && (
            <Link to="/platform/segmentos">
              <Button size="sm">
                <Plus size={14} /> Nova lista
              </Button>
            </Link>
          )}
        </div>
      </div>

      {!segments.length ? (
        <EmptyState
          icon={List}
          title="Nenhuma lista com leads"
          description="Configure listas padrão nos formulários ou adicione leads manualmente às listas em Contatos → Listas e segmentos."
          action={
            <Link to="/platform/segmentos">
              <Button variant="secondary" size="sm">
                Ir para Listas e segmentos
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {segments.map(s => (
            <Card key={s.id} className="space-y-2">
              <h3 className="font-medium">{s.name}</h3>
              <dl className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-[10px] text-[var(--rz-text-muted)] uppercase">Leads</dt>
                  <dd className="font-semibold">{s.leadCount}</dd>
                </div>
                <div>
                  <dt className="text-[10px] text-[var(--rz-text-muted)] uppercase">Convertidos</dt>
                  <dd className="font-semibold">{s.convertedCount}</dd>
                </div>
                <div>
                  <dt className="text-[10px] text-[var(--rz-text-muted)] uppercase">Taxa</dt>
                  <dd className="font-semibold">{s.conversionRate}%</dd>
                </div>
              </dl>
              <Link to={`/platform/segmentos`} className="text-xs text-[var(--rz-primary)] hover:underline">
                Ver lista completa →
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
