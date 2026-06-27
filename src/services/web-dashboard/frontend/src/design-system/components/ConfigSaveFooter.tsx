import { Save } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export interface ConfigSaveFooterProps {
  onSave: () => void
  saving?: boolean
  disabled?: boolean
  saveLabel?: string
  className?: string
  /** Ocultar em abas/seções sem persistência (ex.: logs, testar). */
  hidden?: boolean
}

/** Rodapé padrão de formulários de configuração — referência: `/platform/inbox/ia`. */
export function ConfigSaveFooter({
  onSave,
  saving = false,
  disabled = false,
  saveLabel = 'Salvar configurações',
  className,
  hidden = false,
}: ConfigSaveFooterProps) {
  if (hidden) return null

  return (
    <div className={cn('sticky bottom-2 z-10 flex justify-end pt-1', className)}>
      <Button type="button" onClick={onSave} disabled={disabled || saving} className="shadow-lg">
        <Save className="mr-2 h-4 w-4" />
        {saving ? 'Salvando…' : saveLabel}
      </Button>
    </div>
  )
}
