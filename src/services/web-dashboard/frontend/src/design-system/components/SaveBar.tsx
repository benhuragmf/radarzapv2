import type { ReactNode } from 'react'
import { ConfigSaveFooter, type ConfigSaveFooterProps } from './ConfigSaveFooter'

interface SaveBarProps extends ConfigSaveFooterProps {
  /** @deprecated Feedback inline removido — use `notifyConfigSaved()` após save. */
  hint?: ReactNode
  /** @deprecated Use botão Cancelar no formulário, não na barra de save. */
  onCancel?: () => void
  cancelLabel?: string
}

/**
 * Alias de `ConfigSaveFooter` — barra inferior alinhada a IA de Atendimento.
 * Props legadas (`hint`, `onCancel`) são ignoradas; preferir `ConfigSaveFooter` + Sonner.
 */
export function SaveBar({ hint: _hint, onCancel: _onCancel, cancelLabel: _cancelLabel, ...props }: SaveBarProps) {
  return <ConfigSaveFooter {...props} />
}
