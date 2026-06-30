import { MessageSquare, X } from 'lucide-react'
import type { LeadCaptureListItem } from '@radarzap-types/lead-form'
import { LeadWhatsAppComposer } from './LeadWhatsAppComposer'

interface Props {
  item: LeadCaptureListItem
  open: boolean
  onClose: () => void
  onConversationReady: (conversationId: string) => void
  canReply: boolean
}

/** Painel flutuante legado — preferir composer inline no detalhe do lead. */
export function LeadWhatsAppPanel({ item, open, onClose, onConversationReady, canReply }: Props) {
  if (!open) return null

  const phoneLabel = item.phone.startsWith('email:') ? 'Sem telefone' : item.phone

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-[var(--rz-border)] bg-[var(--rz-surface)] shadow-[0_-8px_32px_rgba(0,0,0,0.25)] lg:left-auto lg:right-0 lg:max-w-[min(420px,38vw)]">
      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <MessageSquare size={16} className="text-[var(--rz-primary)] shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">WhatsApp — {item.name}</p>
              <p className="text-xs text-[var(--rz-text-muted)] truncate">{phoneLabel}</p>
            </div>
          </div>
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-[var(--rz-surface-muted)] text-[var(--rz-text-muted)]"
            onClick={onClose}
            aria-label="Fechar painel WhatsApp"
          >
            <X size={18} />
          </button>
        </div>
        <LeadWhatsAppComposer item={item} canReply={canReply} onConversationReady={onConversationReady} />
      </div>
    </div>
  )
}
