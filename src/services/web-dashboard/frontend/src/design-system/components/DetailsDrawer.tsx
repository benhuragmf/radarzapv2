import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DetailsDrawerProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
  width?: 'md' | 'lg' | 'xl'
}

const widthClass = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
} as const

export function DetailsDrawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  width = 'lg',
}: DetailsDrawerProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Fechar painel"
        onClick={onClose}
      />
      <aside
        className={cn(
          'relative flex h-full w-full flex-col border-l border-[var(--rz-border)] bg-[var(--rz-surface)] shadow-[var(--rz-shadow-drawer)]',
          widthClass[width],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--rz-border)] px-5 py-4">
          <div className="min-w-0">
            <h2 id="drawer-title" className="text-base font-semibold text-[var(--rz-text-primary)]">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm text-[var(--rz-text-secondary)]">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-[var(--rz-text-muted)] hover:bg-[var(--rz-surface-muted)] hover:text-[var(--rz-text-primary)]"
            aria-label="Fechar"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="border-t border-[var(--rz-border)] px-5 py-4">{footer}</div>
        ) : null}
      </aside>
    </div>
  )
}
