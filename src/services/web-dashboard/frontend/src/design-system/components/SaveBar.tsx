import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { themeClasses } from '../theme'

interface SaveBarProps {
  onSave: () => void
  onCancel?: () => void
  saving?: boolean
  disabled?: boolean
  saveLabel?: string
  cancelLabel?: string
  hint?: ReactNode
  className?: string
}

/** Barra fixa inferior para formulários — salvar só dispara callback; validação fica no caller. */
export function SaveBar({
  onSave,
  onCancel,
  saving,
  disabled,
  saveLabel = 'Salvar',
  cancelLabel = 'Cancelar',
  hint,
  className,
}: SaveBarProps) {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-20 -mx-4 mt-6 border-t border-[var(--rz-border)] bg-[var(--rz-surface)]/95 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6',
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {hint ? <div className="text-xs text-[var(--rz-text-muted)]">{hint}</div> : <span />}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {onCancel ? (
            <button type="button" className={themeClasses.btnSecondary} onClick={onCancel} disabled={saving}>
              {cancelLabel}
            </button>
          ) : null}
          <button
            type="button"
            className={themeClasses.btnPrimary}
            onClick={onSave}
            disabled={disabled || saving}
          >
            {saving ? 'Salvando…' : saveLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
