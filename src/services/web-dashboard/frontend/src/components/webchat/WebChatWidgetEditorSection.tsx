import type { ReactNode } from 'react'
import {
  Bot,
  Clock,
  Code2,
  LayoutDashboard,
  MessageSquareText,
  Palette,
  Settings2,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EditorMode, SectionStatus, SectionStatusKind } from '@/lib/webchatWidgetEditorUtils'

export function WebChatWidgetEditorSection({
  id,
  title,
  description,
  children,
  className,
}: {
  id: string
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      id={id}
      className={cn(
        'scroll-mt-28 rounded-xl border border-[var(--rz-border)] bg-[var(--rz-surface)]/40',
        className,
      )}
    >
      <div className="border-b border-[var(--rz-border)]/80 px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--rz-text-primary)]">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--rz-text-muted)]">{description}</p>
        ) : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

export type WebChatWidgetEditorSectionId =
  | 'overview'
  | 'visual'
  | 'prechat'
  | 'automacao'
  | 'horarios'
  | 'instalacao'
  | 'avancado'

export const WEBCHAT_WIDGET_EDITOR_SECTIONS: Array<{
  id: WebChatWidgetEditorSectionId
  label: string
  description: string
  icon: LucideIcon
  advancedOnly?: boolean
}> = [
  {
    id: 'overview',
    label: 'Visão geral',
    description: 'Resumo e configurações essenciais',
    icon: LayoutDashboard,
  },
  {
    id: 'visual',
    label: 'Aparência',
    description: 'Cores, textos e modelo visual',
    icon: Palette,
  },
  {
    id: 'prechat',
    label: 'Formulário inicial',
    description: 'Dados antes de iniciar o chat',
    icon: MessageSquareText,
  },
  {
    id: 'automacao',
    label: 'IA e automações',
    description: 'Respostas, transferência e saudação',
    icon: Bot,
  },
  {
    id: 'horarios',
    label: 'Horário de atendimento',
    description: 'Quando o widget está disponível',
    icon: Clock,
  },
  {
    id: 'instalacao',
    label: 'Instalação',
    description: 'Script para o seu site',
    icon: Code2,
  },
  {
    id: 'avancado',
    label: 'Avançado',
    description: 'Domínios, setor e opções extras',
    icon: Settings2,
    advancedOnly: true,
  },
]

const STATUS_STYLES: Record<SectionStatusKind, string> = {
  complete: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  incomplete: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
  optional: 'bg-[var(--rz-surface-muted)] text-[var(--rz-text-muted)] border-[var(--rz-border)]',
  attention: 'bg-violet-500/10 text-violet-300 border-violet-500/25',
}

function StatusDot({ kind }: { kind: SectionStatusKind }) {
  return (
    <span
      className={cn('h-1.5 w-1.5 shrink-0 rounded-full', {
        'bg-emerald-400': kind === 'complete',
        'bg-amber-400': kind === 'incomplete',
        'bg-[var(--rz-text-muted)]': kind === 'optional',
        'bg-violet-400': kind === 'attention',
      })}
      aria-hidden
    />
  )
}

export function WebChatWidgetSectionNav({
  active,
  onChange,
  statuses,
  editorMode,
  onEditorModeChange,
  className,
}: {
  active: WebChatWidgetEditorSectionId
  onChange: (id: WebChatWidgetEditorSectionId) => void
  statuses: Record<WebChatWidgetEditorSectionId, SectionStatus>
  editorMode: EditorMode
  onEditorModeChange: (mode: EditorMode) => void
  className?: string
}) {
  const visibleSections = WEBCHAT_WIDGET_EDITOR_SECTIONS.filter(
    s => editorMode === 'advanced' || !s.advancedOnly,
  )

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/30 p-0.5">
        <button
          type="button"
          onClick={() => onEditorModeChange('simple')}
          className={cn(
            'flex-1 rounded-md px-2 py-1.5 text-[10px] font-medium transition-colors',
            editorMode === 'simple'
              ? 'bg-[var(--rz-surface)] text-[var(--rz-text-primary)] shadow-sm'
              : 'text-[var(--rz-text-muted)] hover:text-[var(--rz-text-secondary)]',
          )}
        >
          Modo simples
        </button>
        <button
          type="button"
          onClick={() => onEditorModeChange('advanced')}
          className={cn(
            'flex-1 rounded-md px-2 py-1.5 text-[10px] font-medium transition-colors',
            editorMode === 'advanced'
              ? 'bg-[var(--rz-surface)] text-[var(--rz-text-primary)] shadow-sm'
              : 'text-[var(--rz-text-muted)] hover:text-[var(--rz-text-secondary)]',
          )}
        >
          Modo avançado
        </button>
      </div>

      <label className="block xl:hidden">
        <span className="sr-only">Seção do editor</span>
        <select
          className="w-full rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface)] px-3 py-2 text-sm text-[var(--rz-text-primary)]"
          value={active}
          onChange={e => onChange(e.target.value as WebChatWidgetEditorSectionId)}
        >
          {visibleSections.map(s => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <nav className="hidden xl:block space-y-1" aria-label="Seções do widget">
        {visibleSections.map(section => {
          const Icon = section.icon
          const status = statuses[section.id]
          const isActive = active === section.id
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onChange(section.id)}
              className={cn(
                'flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors',
                isActive
                  ? 'border-brand-500/35 bg-brand-500/10'
                  : 'border-transparent hover:border-[var(--rz-border)] hover:bg-[var(--rz-surface-muted)]/50',
              )}
            >
              <Icon
                className={cn(
                  'mt-0.5 h-4 w-4 shrink-0',
                  isActive ? 'text-brand-300' : 'text-[var(--rz-text-muted)]',
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'text-xs font-medium',
                      isActive ? 'text-brand-200' : 'text-[var(--rz-text-secondary)]',
                    )}
                  >
                    {section.label}
                  </span>
                  <StatusDot kind={status.kind} />
                </div>
                <p className="mt-0.5 line-clamp-1 text-[10px] text-[var(--rz-text-muted)]">
                  {section.description}
                </p>
                <span
                  className={cn(
                    'mt-1.5 inline-flex max-w-full truncate rounded-full border px-1.5 py-0.5 text-[9px] font-medium',
                    STATUS_STYLES[status.kind],
                  )}
                >
                  {status.hint}
                </span>
              </div>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

export function WidgetSectionCard({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--rz-border)]/80 bg-[var(--rz-surface-muted)]/15',
        className,
      )}
    >
      <div className="border-b border-[var(--rz-border)]/60 px-4 py-2.5">
        <h4 className="text-xs font-semibold text-[var(--rz-text-primary)]">{title}</h4>
        {description ? (
          <p className="mt-0.5 text-[10px] leading-relaxed text-[var(--rz-text-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      <div className="space-y-3 p-4">{children}</div>
    </div>
  )
}

export function WebChatWidgetSectionNavCompact({
  active,
  onChange,
  editorMode,
}: {
  active: WebChatWidgetEditorSectionId
  onChange: (id: WebChatWidgetEditorSectionId) => void
  editorMode: EditorMode
}) {
  const visibleSections = WEBCHAT_WIDGET_EDITOR_SECTIONS.filter(
    s => editorMode === 'advanced' || !s.advancedOnly,
  )
  return (
    <nav
      className="mb-4 flex gap-0.5 overflow-x-auto border-b border-[var(--rz-border)] pb-px scrollbar-thin lg:hidden"
      aria-label="Seções do widget"
    >
      {visibleSections.map(s => (
        <button
          key={s.id}
          type="button"
          onClick={() => onChange(s.id)}
          className={cn(
            'shrink-0 border-b-2 px-2.5 py-2 text-[11px] font-medium transition-colors',
            active === s.id
              ? 'border-brand-400 text-brand-300'
              : 'border-transparent text-[var(--rz-text-muted)]',
          )}
        >
          {s.label}
        </button>
      ))}
    </nav>
  )
}
