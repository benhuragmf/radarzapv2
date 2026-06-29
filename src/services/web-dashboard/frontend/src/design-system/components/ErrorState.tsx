import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { themeClasses } from '../theme'

interface ErrorStateProps {
  title?: string
  message: string
  code?: string | number
  onRetry?: () => void
  retryLabel?: string
  className?: string
}

function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/(authorization|x-api-key|api[-_ ]?key|token|secret|password)(["'\s:=]+)[^"',\s}]+/gi, '$1$2[redacted]')
    .replace(/\b(rz|sk|rk|pk|whsec|wck|wcv|wcp)_[A-Za-z0-9._-]{8,}\b/g, '[redacted]')
    .split('\n')
    .slice(0, 2)
    .join(' ')
    .trim()
}

/** Exibe falha real sem transformar erro em sucesso e redige segredos comuns. */
export function ErrorState({
  title = 'Não foi possível carregar',
  message,
  code,
  onRetry,
  retryLabel = 'Tentar novamente',
  className,
}: ErrorStateProps) {
  const safeMessage = sanitizeErrorMessage(message)

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
      <p className="mt-1 max-w-md text-sm text-[var(--rz-text-secondary)]">
        {safeMessage || 'Erro inesperado. Tente novamente em instantes.'}
      </p>
      {code != null ? (
        <p className="mt-2 font-mono text-xs text-[var(--rz-text-muted)]">Código: {code}</p>
      ) : null}
      {onRetry ? (
        <button type="button" className={cn(themeClasses.btnSecondary, 'mt-4')} onClick={onRetry}>
          {retryLabel}
        </button>
      ) : null}
    </div>
  )
}
