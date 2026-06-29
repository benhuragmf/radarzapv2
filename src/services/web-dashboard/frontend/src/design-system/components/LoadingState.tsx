import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/shadcn/skeleton'

interface LoadingStateProps {
  rows?: number
  className?: string
  label?: string
  rowClassName?: string
}

export function LoadingState({
  rows = 4,
  className,
  label = 'Carregando',
  rowClassName,
}: LoadingStateProps) {
  return (
    <div className={cn('space-y-3', className)} aria-busy="true" aria-label={label} role="status">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={cn('h-10 w-full', rowClassName)} />
      ))}
    </div>
  )
}
