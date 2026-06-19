import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

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
  | 'geral'
  | 'visual'
  | 'prechat'
  | 'automacao'
  | 'horarios'
  | 'instalacao'

export const WEBCHAT_WIDGET_EDITOR_SECTIONS: Array<{
  id: WebChatWidgetEditorSectionId
  label: string
}> = [
  { id: 'geral', label: 'Geral' },
  { id: 'visual', label: 'Visual' },
  { id: 'prechat', label: 'Pré-chat' },
  { id: 'automacao', label: 'IA e proativa' },
  { id: 'horarios', label: 'Horários' },
  { id: 'instalacao', label: 'Instalação' },
]

export function WebChatWidgetSectionNav({
  active,
  onChange,
}: {
  active: WebChatWidgetEditorSectionId
  onChange: (id: WebChatWidgetEditorSectionId) => void
}) {
  return (
    <nav
      className="sticky top-28 z-10 -mx-1 mb-4 flex gap-0.5 overflow-x-auto border-b border-[var(--rz-border)] bg-[var(--rz-surface)]/95 pb-px backdrop-blur-sm scrollbar-thin"
      aria-label="Seções do widget"
    >
      {WEBCHAT_WIDGET_EDITOR_SECTIONS.map(s => (
        <button
          key={s.id}
          type="button"
          onClick={() => onChange(s.id)}
          className={cn(
            'shrink-0 border-b-2 px-3 py-2 text-xs font-medium transition-colors',
            active === s.id
              ? 'border-brand-400 text-brand-300'
              : 'border-transparent text-[var(--rz-text-muted)] hover:text-[var(--rz-text-secondary)]',
          )}
        >
          {s.label}
        </button>
      ))}
    </nav>
  )
}
