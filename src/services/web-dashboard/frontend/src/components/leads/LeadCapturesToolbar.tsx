import { Filter, LayoutGrid, List, Search, SlidersHorizontal } from 'lucide-react'
import { Button } from '../ui/Button'
import { DetailsDrawer } from '@/design-system/components/DetailsDrawer'
import { inputCls, searchFieldIconCls } from '@/design-system'
import type { LeadCaptureOrigin, LeadCaptureStatus, LeadFormListItem } from '@radarzap-types/lead-form'
import { LEAD_CAPTURE_ORIGIN_LABEL, LEAD_CAPTURE_ORIGINS, LEAD_CAPTURE_STATUS_LABEL } from '@radarzap-types/lead-form'

export type CaptureView = 'list' | 'kanban'
export type PeriodFilter = '' | 'today' | '7d' | '30d'

type Props = {
  search: string
  onSearchChange: (v: string) => void
  statusFilter: LeadCaptureStatus | ''
  onStatusFilterChange: (v: LeadCaptureStatus | '') => void
  originFilter: LeadCaptureOrigin | ''
  onOriginFilterChange: (v: LeadCaptureOrigin | '') => void
  periodFilter: PeriodFilter
  onPeriodFilterChange: (v: PeriodFilter) => void
  formFilter: string
  onFormFilterChange: (v: string) => void
  groupFilter: string
  onGroupFilterChange: (v: string) => void
  consentFilter: '' | 'yes' | 'no'
  onConsentFilterChange: (v: '' | 'yes' | 'no') => void
  forms: LeadFormListItem[]
  contactGroups: { id: string; name: string }[]
  captureView: CaptureView
  onCaptureViewChange: (v: CaptureView) => void
  total?: number
  advancedOpen: boolean
  onAdvancedOpenChange: (v: boolean) => void
}

export function LeadCapturesToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  originFilter,
  onOriginFilterChange,
  periodFilter,
  onPeriodFilterChange,
  formFilter,
  onFormFilterChange,
  groupFilter,
  onGroupFilterChange,
  consentFilter,
  onConsentFilterChange,
  forms,
  contactGroups,
  captureView,
  onCaptureViewChange,
  total,
  advancedOpen,
  onAdvancedOpenChange,
}: Props) {
  const advancedCount = [formFilter, groupFilter, consentFilter].filter(Boolean).length

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[180px] max-w-md">
          <Search size={15} className={searchFieldIconCls} />
          <input
            className={inputCls + ' pl-9 h-9 text-sm'}
            placeholder="Buscar nome, telefone, e-mail…"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>

        <select
          className={inputCls + ' h-9 text-sm w-auto min-w-[130px]'}
          value={statusFilter}
          onChange={e => onStatusFilterChange(e.target.value as LeadCaptureStatus | '')}
        >
          <option value="">Status</option>
          {(Object.keys(LEAD_CAPTURE_STATUS_LABEL) as LeadCaptureStatus[]).map(s => (
            <option key={s} value={s}>
              {LEAD_CAPTURE_STATUS_LABEL[s]}
            </option>
          ))}
        </select>

        <select
          className={inputCls + ' h-9 text-sm w-auto min-w-[120px]'}
          value={originFilter}
          onChange={e => onOriginFilterChange(e.target.value as LeadCaptureOrigin | '')}
        >
          <option value="">Origem</option>
          {LEAD_CAPTURE_ORIGINS.map(o => (
            <option key={o} value={o}>
              {LEAD_CAPTURE_ORIGIN_LABEL[o]}
            </option>
          ))}
        </select>

        <select
          className={inputCls + ' h-9 text-sm w-auto min-w-[110px]'}
          value={periodFilter}
          onChange={e => onPeriodFilterChange(e.target.value as PeriodFilter)}
        >
          <option value="">Período</option>
          <option value="today">Hoje</option>
          <option value="7d">7 dias</option>
          <option value="30d">30 dias</option>
        </select>

        <Button size="sm" variant="secondary" className="h-9" onClick={() => onAdvancedOpenChange(true)}>
          <SlidersHorizontal size={14} />
          Filtros
          {advancedCount > 0 && (
            <span className="ml-1 rounded-full bg-[var(--rz-primary)] text-white text-[10px] px-1.5 py-0.5">
              {advancedCount}
            </span>
          )}
        </Button>

        <div className="flex rounded-lg border border-[var(--rz-border)] overflow-hidden ml-auto">
          <button
            type="button"
            className={`inline-flex items-center gap-1 px-3 h-9 text-xs font-medium ${
              captureView === 'list'
                ? 'bg-[var(--rz-primary)]/15 text-[var(--rz-primary)]'
                : 'text-[var(--rz-text-secondary)] hover:bg-[var(--rz-surface-muted)]'
            }`}
            onClick={() => onCaptureViewChange('list')}
          >
            <List size={14} /> Lista
          </button>
          <button
            type="button"
            className={`inline-flex items-center gap-1 px-3 h-9 text-xs font-medium border-l border-[var(--rz-border)] ${
              captureView === 'kanban'
                ? 'bg-[var(--rz-primary)]/15 text-[var(--rz-primary)]'
                : 'text-[var(--rz-text-secondary)] hover:bg-[var(--rz-surface-muted)]'
            }`}
            onClick={() => onCaptureViewChange('kanban')}
          >
            <LayoutGrid size={14} /> Kanban
          </button>
        </div>
      </div>

      {total != null && (
        <p className="text-[11px] text-[var(--rz-text-muted)] mb-2 -mt-1">
          {total} lead{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
        </p>
      )}

      <DetailsDrawer
        open={advancedOpen}
        onClose={() => onAdvancedOpenChange(false)}
        title="Filtros avançados"
        description="Refine a lista sem ocupar espaço fixo na tela."
        width="md"
        footer={
          <Button size="sm" onClick={() => onAdvancedOpenChange(false)}>
            Aplicar
          </Button>
        }
      >
        <div className="space-y-4 p-1">
          <div>
            <label className="text-xs text-[var(--rz-text-muted)] mb-1 block">Formulário</label>
            <select className={inputCls + ' text-sm'} value={formFilter} onChange={e => onFormFilterChange(e.target.value)}>
              <option value="">Todos</option>
              {forms.map(f => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-[var(--rz-text-muted)] mb-1 block">Lista / segmento</label>
            <select className={inputCls + ' text-sm'} value={groupFilter} onChange={e => onGroupFilterChange(e.target.value)}>
              <option value="">Todas</option>
              {contactGroups.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-[var(--rz-text-muted)] mb-1 block">Consentimento</label>
            <select
              className={inputCls + ' text-sm'}
              value={consentFilter}
              onChange={e => onConsentFilterChange(e.target.value as '' | 'yes' | 'no')}
            >
              <option value="">Todos</option>
              <option value="yes">Com consentimento</option>
              <option value="no">Sem consentimento</option>
            </select>
          </div>
          {(formFilter || groupFilter || consentFilter) && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                onFormFilterChange('')
                onGroupFilterChange('')
                onConsentFilterChange('')
              }}
            >
              <Filter size={14} /> Limpar filtros avançados
            </Button>
          )}
        </div>
      </DetailsDrawer>
    </>
  )
}
