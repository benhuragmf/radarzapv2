import { Save } from 'lucide-react'
import { Button } from '../../ui/Button'
import { cn } from '@/lib/utils'

type Props = {
  isDirty: boolean
  saving?: boolean
  onSave: () => void
  className?: string
}

/** Rodapé de save do editor de widget — alinhado a `ConfigSaveFooter` (só visível com alterações). */
export function WebChatWidgetSaveBar({ isDirty, saving, onSave, className }: Props) {
  if (!isDirty && !saving) return null

  return (
    <div className={cn('sticky bottom-2 z-10 flex justify-end pt-1', className)}>
      <Button type="button" onClick={onSave} disabled={saving || !isDirty} className="shadow-lg">
        <Save className="mr-2 h-4 w-4" />
        {saving ? 'Salvando…' : 'Salvar configurações'}
      </Button>
    </div>
  )
}
