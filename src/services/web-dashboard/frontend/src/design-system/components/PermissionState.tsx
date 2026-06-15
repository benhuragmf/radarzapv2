import { ShieldOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PermissionStateProps {
  title?: string
  description?: string
  className?: string
}

export function PermissionState({
  title = 'Sem permissão',
  description = 'Você não tem acesso a este recurso. Peça ao administrador da organização.',
  className,
}: PermissionStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-[var(--rz-border)] bg-[var(--rz-surface-muted)] px-4 py-10 text-center',
        className,
      )}
    >
      <ShieldOff className="mb-3 size-8 text-[var(--rz-text-muted)]" aria-hidden />
      <h3 className="text-sm font-semibold text-[var(--rz-text-primary)]">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-[var(--rz-text-secondary)]">{description}</p>
    </div>
  )
}
