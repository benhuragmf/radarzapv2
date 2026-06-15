import { WhatsAppFormattedMessage } from '../whatsapp/WhatsAppFormattedMessage'
import { statusFontPreviewClass } from '../../lib/whatsapp-status-fonts'

export function WhatsAppPreviewBubble({
  text,
  timeLabel = 'agora ✓✓',
  statusFont,
}: {
  text: string
  timeLabel?: string
  statusFont?: number
}) {
  return (
    <div className="rz-wa-preview-bubble text-xs leading-relaxed px-3 py-2 shadow-lg max-w-full whitespace-pre-wrap break-words">
      <span className={statusFont != null ? statusFontPreviewClass(statusFont) : undefined}>
        <WhatsAppFormattedMessage text={text || '…'} />
      </span>
      <p className="text-[10px] text-right rz-wa-preview-bubble-time mt-1 opacity-80">{timeLabel}</p>
    </div>
  )
}
