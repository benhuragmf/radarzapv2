import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/shadcn/skeleton'

interface LoadingStateProps {
  rows?: number
  className?: string
}

export function LoadingState({ rows = 4, className }: LoadingStateProps) {
  return (
    <div className={cn('space-y-3', className)} aria-busy="true" aria-label="Carregando">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}
