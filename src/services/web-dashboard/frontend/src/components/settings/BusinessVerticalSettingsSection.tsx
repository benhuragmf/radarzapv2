import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { BusinessVerticalPicker } from '../onboarding/BusinessVerticalPicker'
import { Button } from '../ui/Button'

export function BusinessVerticalSettingsSection() {
  const [showReplace, setShowReplace] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--rz-primary)]/10 text-[var(--rz-primary)]">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-medium text-[var(--rz-text-primary)]">Tipo de negócio</h3>
          <p className="text-sm text-[var(--rz-text-muted)] mt-0.5">
            Pré-configura setores, textos do atendimento, WebChat e base de conhecimento conforme o segmento.
          </p>
        </div>
      </div>

      <BusinessVerticalPicker showCurrent compact={!showReplace} overwrite={showReplace} />

      <Button variant="secondary" size="sm" onClick={() => setShowReplace(v => !v)}>
        {showReplace ? 'Cancelar substituição' : 'Trocar tipo de negócio (substituir)'}
      </Button>
      {showReplace && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Substituir pode recriar setores se ainda não houver conversas. Configurações já personalizadas podem ser
          sobrescritas parcialmente.
        </p>
      )}
    </div>
  )
}
