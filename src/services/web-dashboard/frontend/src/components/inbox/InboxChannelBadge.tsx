import { Globe, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  channel?: 'whatsapp_qr' | 'whatsapp_cloud' | 'webchat_site' | string
  size?: 'sm' | 'md'
  className?: string
}

export function InboxChannelBadge({ channel, size = 'sm', className }: Props) {
  const isWebChat = channel === 'webchat_site'
  const cls = size === 'sm' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5'
  const Icon = isWebChat ? Globe : MessageCircle

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 font-medium rounded',
        isWebChat
          ? 'text-violet-300 bg-violet-500/15'
          : 'text-emerald-300 bg-emerald-500/15',
        cls,
        className,
      )}
    >
      <Icon size={size === 'sm' ? 9 : 11} aria-hidden />
      {isWebChat ? 'Site' : 'WhatsApp'}
    </span>
  )
}
