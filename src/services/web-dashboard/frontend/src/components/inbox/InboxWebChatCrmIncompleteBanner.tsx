import { AlertTriangle, UserPen } from 'lucide-react'
import { Button } from '../ui/Button'

export function InboxWebChatCrmIncompleteBanner({
  hint,
  reason,
  onComplete,
}: {
  hint: string
  reason?: string
  onComplete?: () => void
}) {
  if (!hint) return null

  return (
    <div
      className="mx-3 mt-3 rounded-lg border border-amber-800/50 bg-amber-950/35 px-3 py-2.5 flex gap-2.5 items-start"
      role="status"
      data-reason={reason}
    >
      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-xs text-amber-100/95 leading-relaxed">{hint}</p>
        {onComplete && (
          <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={onComplete}>
            <UserPen size={13} />
            Completar cadastro
          </Button>
        )}
      </div>
    </div>
  )
}
