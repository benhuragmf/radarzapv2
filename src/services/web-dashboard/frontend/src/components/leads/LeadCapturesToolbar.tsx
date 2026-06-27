import { Filter, LayoutGrid, List, Plus, RotateCcw, Search, SlidersHorizontal } from 'lucide-react'
import { Button } from '../ui/Button'
import { DetailsDrawer } from '@/design-system/components/DetailsDrawer'
import { inputCls, searchFieldIconCls } from '@/design-system'
import type { LeadCaptureOrigin, LeadCaptureStatus, LeadFormListItem } from '@radarzap-types/lead-form'
import { LEAD_CAPTURE_ORIGINS, LEAD_CAPTURE_STATUS_LABEL } from '@radarzap-types/lead-form'
import { LEAD_ORIGIN_DISPLAY, LEAD_STATUS_DISPLAY } from '../../lib/leadUi'
import { CONTACT_KIND_LABELS, type ContactKind } from '../../lib/contactClassificationUi'

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
  assigneeFilter: string
  onAssigneeFilterChange: (v: string) => void
  formFilter: string
  onFormFilterChange: (v: string) => void
  groupFilter: string
  onGroupFilterChange: (v: string) => void
  consentFilter: '' | 'yes' | 'no'
  onConsentFilterChange: (v: '' | 'yes' | 'no') => void
  forms: LeadFormListItem[]
  contactGroups: { id: string; name: string }[]
  assignees: { userId: string; displayName: string }[]
  captureView: CaptureView
  onCaptureViewChange: (v: CaptureView) => void
  total?: number
  advancedOpen: boolean
  onAdvancedOpenChange: (v: boolean) => void
  onClearFilters: () => void
  classificationKindFilter: ContactKind | ''
  onClassificationKindFilterChange: (v: ContactKind | '') => void
  classificationOptInOnly: boolean
  onClassificationOptInOnlyChange: (v: boolean) => void
  classificationPendingOnly: boolean
  onClassificationPendingOnlyChange: (v: boolean) => void
  classificationHotOnly: boolean
  onClassificationHotOnlyChange: (v: boolean) => void
  classificationBlockedOnly: boolean
  onClassificationBlockedOnlyChange: (v: boolean) => void
  unlinkedOnly: boolean
  onUnlinkedOnlyChange: (v: boolean) => void
  canManage?: boolean
  onAddManual?: () => void
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
  assigneeFilter,
  onAssigneeFilterChange,
  formFilter,
  onFormFilterChange,
  groupFilter,
  onGroupFilterChange,
  consentFilter,
  onConsentFilterChange,
  forms,
  contactGroups,
  assignees,
  captureView,
  onCaptureViewChange,
  total,
  advancedOpen,
  onAdvancedOpenChange,
  onClearFilters,
  classificationKindFilter,
  onClassificationKindFilterChange,
  classificationOptInOnly,
  onClassificationOptInOnlyChange,
  classificationPendingOnly,
  onClassificationPendingOnlyChange,
  classificationHotOnly,
  onClassificationHotOnlyChange,
  classificationBlockedOnly,
  onClassificationBlockedOnlyChange,
  unlinkedOnly,
  onUnlinkedOnlyChange,
  canManage,
  onAddManual,
}: Props) {
  const classificationCount = [
    classificationKindFilter,
    classificationOptInOnly,
    classificationPendingOnly,
    classificationHotOnly,
    classificationBlockedOnly,
    unlinkedOnly,
  ].filter(Boolean).length
  const advancedCount =
    [formFilter, groupFilter, consentFilter].filter(Boolean).length + (classificationCount > 0 ? 1 : 0)
  const hasActiveFilters = Boolean(
    search || statusFilter || originFilter || periodFilter || assigneeFilter || advancedCount,
  )

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {canManage && onAddManual && (
          <Button size="sm" className="h-8 px-2.5 text-xs shrink-0" onClick={onAddManual}>
            <Plus size={14} /> Capturar lead
          </Button>
        )}

        <div className="relative flex-1 min-w-[160px] max-w-sm">
          <Search size={14} className={searchFieldIconCls} />
          <input
            className={inputCls + ' pl-8 h-8 text-xs'}
            placeholder="Buscar lead, telefone ou mensagem…"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>

        <select
          className={inputCls + ' h-8 text-xs w-auto min-w-[100px] max-w-[120px]'}
          value={originFilter}
          onChange={e => onOriginFilterChange(e.target.value as LeadCaptureOrigin | '')}
        >
          <option value="">Origem</option>
          {LEAD_CAPTURE_ORIGINS.map(o => (
            <option key={o} value={o}>
              {LEAD_ORIGIN_DISPLAY[o]}
            </option>
          ))}
        </select>

        <select
          className={inputCls + ' h-8 text-xs w-auto min-w-[100px] max-w-[120px]'}
          value={statusFilter}
          onChange={e => onStatusFilterChange(e.target.value as LeadCaptureStatus | '')}
        >
          <option value="">Status</option>
          {(Object.keys(LEAD_CAPTURE_STATUS_LABEL) as LeadCaptureStatus[]).map(s => (
            <option key={s} value={s}>
              {LEAD_STATUS_DISPLAY[s]}
            </option>
          ))}
        </select>

        <select
          className={inputCls + ' h-8 text-xs w-auto min-w-[110px] max-w-[130px]'}
          value={assigneeFilter}
          onChange={e => onAssigneeFilterChange(e.target.value)}
        >
          <option value="">Responsável</option>
          <option value="__unassigned__">Sem responsável</option>
          {assignees.map(a => (
            <option key={a.userId} value={a.userId}>
              {a.displayName}
            </option>
          ))}
        </select>

        <select
          className={inputCls + ' h-8 text-xs w-auto min-w-[90px]'}
          value={periodFilter}
          onChange={e => onPeriodFilterChange(e.target.value as PeriodFilter)}
        >
          <option value="">Período</option>
          <option value="today">Hoje</option>
          <option value="7d">7 dias</option>
          <option value="30d">30 dias</option>
        </select>

        <Button size="sm" variant="secondary" className="h-8 px-2 text-xs" onClick={() => onAdvancedOpenChange(true)}>
          <SlidersHorizontal size={13} />
          Mais
          {advancedCount > 0 && (
            <span className="ml-1 rounded-full bg-[var(--rz-primary)] text-white text-[9px] px-1">{advancedCount}</span>
          )}
        </Button>

        {hasActiveFilters && (
          <Button size="sm" variant="secondary" className="h-8 px-2 text-xs" onClick={onClearFilters}>
            <RotateCcw size={13} /> Limpar
          </Button>
        )}

        <div className="flex rounded-md border border-[var(--rz-border)] overflow-hidden ml-auto">
          <button
            type="button"
            className={`inline-flex items-center gap-1 px-2.5 h-8 text-[11px] font-medium ${
              captureView === 'list'
                ? 'bg-[var(--rz-primary)]/15 text-[var(--rz-primary)]'
                : 'text-[var(--rz-text-secondary)] hover:bg-[var(--rz-surface-muted)]'
            }`}
            onClick={() => onCaptureViewChange('list')}
          >
            <List size={13} /> Lista
          </button>
          <button
            type="button"
            className={`inline-flex items-center gap-1 px-2.5 h-8 text-[11px] font-medium border-l border-[var(--rz-border)] ${
              captureView === 'kanban'
                ? 'bg-[var(--rz-primary)]/15 text-[var(--rz-primary)]'
                : 'text-[var(--rz-text-secondary)] hover:bg-[var(--rz-surface-muted)]'
            }`}
            onClick={() => onCaptureViewChange('kanban')}
          >
            <LayoutGrid size={13} /> Kanban
          </button>
        </div>
      </div>

      {total != null && (
        <p className="text-[10px] text-[var(--rz-text-muted)] mb-2 -mt-0.5">
          {total} entrada{total !== 1 ? 's' : ''} comercial{total !== 1 ? 'is' : ''}
        </p>
      )}

      <DetailsDrawer
        open={advancedOpen}
        onClose={() => onAdvancedOpenChange(false)}
        title="Mais filtros"
        description="Formulário, listas, consentimento e classificação CRM."
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
            <label className="text-xs text-[var(--rz-text-muted)] mb-1 block">Lista</label>
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

          <div className="border-t border-[var(--rz-border)] pt-3">
            <p className="text-xs font-medium text-[var(--rz-text-secondary)] mb-2">Classificação CRM</p>
            <p className="text-[10px] text-[var(--rz-text-muted)] mb-3 leading-relaxed">
              Filtros aplicados ao contato vinculado. Leads sem CRM só aparecem em &quot;Sem contato CRM&quot;.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[var(--rz-text-muted)] mb-1 block">Tipo no CRM</label>
                <select
                  className={inputCls + ' text-sm'}
                  value={classificationKindFilter}
                  onChange={e => onClassificationKindFilterChange(e.target.value as ContactKind | '')}
                >
                  <option value="">Qualquer</option>
                  {(Object.keys(CONTACT_KIND_LABELS) as ContactKind[]).map(k => (
                    <option key={k} value={k}>
                      {CONTACT_KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={classificationOptInOnly}
                  onChange={e => onClassificationOptInOnlyChange(e.target.checked)}
                />
                Somente opt-in aceito
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={classificationPendingOnly}
                  onChange={e => onClassificationPendingOnlyChange(e.target.checked)}
                />
                Opt-in pendente
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={classificationHotOnly}
                  onChange={e => onClassificationHotOnlyChange(e.target.checked)}
                />
                Quentes ou mornos
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={classificationBlockedOnly}
                  onChange={e => onClassificationBlockedOnlyChange(e.target.checked)}
                />
                Bloqueados para campanha
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={unlinkedOnly}
                  onChange={e => onUnlinkedOnlyChange(e.target.checked)}
                />
                Sem contato no CRM
              </label>
            </div>
          </div>

          {(formFilter ||
            groupFilter ||
            consentFilter ||
            classificationKindFilter ||
            classificationOptInOnly ||
            classificationPendingOnly ||
            classificationHotOnly ||
            classificationBlockedOnly ||
            unlinkedOnly) && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                onFormFilterChange('')
                onGroupFilterChange('')
                onConsentFilterChange('')
                onClassificationKindFilterChange('')
                onClassificationOptInOnlyChange(false)
                onClassificationPendingOnlyChange(false)
                onClassificationHotOnlyChange(false)
                onClassificationBlockedOnlyChange(false)
                onUnlinkedOnlyChange(false)
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
