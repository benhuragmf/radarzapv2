import { Save } from 'lucide-react'
import { Button } from '../../ui/Button'
import { cn } from '@/lib/utils'

type Props = {
  isDirty: boolean
  saving?: boolean
  onSave: () => void
  className?: string
}

export function WebChatWidgetSaveBar({ isDirty, saving, onSave, className }: Props) {
  if (!isDirty && !saving) return null

  return (
    <div
      className={cn(
        'sticky bottom-0 z-20 -mx-4 mt-4 border-t border-[var(--rz-border)] bg-[var(--rz-surface)]/95 px-4 py-3 backdrop-blur-sm',
        'max-xl:fixed max-xl:left-0 max-xl:right-0 max-xl:bottom-0 max-xl:mx-0 max-xl:border-x-0 max-xl:shadow-[0_-8px_24px_rgba(0,0,0,0.25)]',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[var(--rz-text-muted)]">
          {saving ? 'Salvando alterações…' : 'Você tem alterações não salvas neste widget.'}
        </p>
        <Button type="button" onClick={onSave} disabled={saving || !isDirty}>
          <Save className="h-4 w-4" />
          Salvar alterações
        </Button>
      </div>
    </div>
  )
}
