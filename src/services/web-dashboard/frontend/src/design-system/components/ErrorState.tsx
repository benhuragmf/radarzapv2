import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { themeClasses } from '../theme'

interface ErrorStateProps {
  title?: string
  message: string
  code?: string | number
  onRetry?: () => void
  className?: string
}

/** Exibe falha real — não converte erro em sucesso nem oculta código quando informado. */
export function ErrorState({
  title = 'Não foi possível carregar',
  message,
  code,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-[var(--rz-danger)]/30 bg-[var(--rz-danger-bg)] px-4 py-8 text-center',
        className,
      )}
      role="alert"
    >
      <AlertCircle className="mb-2 size-8 text-[var(--rz-danger-text)]" aria-hidden />
      <h3 className="text-sm font-semibold text-[var(--rz-danger-text)]">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-[var(--rz-text-secondary)]">{message}</p>
      {code != null ? (
        <p className="mt-2 font-mono text-xs text-[var(--rz-text-muted)]">Código: {code}</p>
      ) : null}
      {onRetry ? (
        <button type="button" className={cn(themeClasses.btnSecondary, 'mt-4')} onClick={onRetry}>
          Tentar novamente
        </button>
      ) : null}
    </div>
  )
}
