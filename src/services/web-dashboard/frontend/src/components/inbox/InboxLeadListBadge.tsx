import { Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  label?: string
  size?: 'sm' | 'md'
  className?: string
}

/** Badge compacto na lista do Inbox — setor Lead / Comercial. */
export function InboxLeadListBadge({ label = 'Comercial', size = 'sm', className }: Props) {
  const cls = size === 'sm' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5'
  const short =
    label.length > 14 ? label.replace(/\s*[-–].*$/, '').trim() || label.slice(0, 12) : label

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 font-medium rounded text-purple-300 bg-purple-500/15',
        cls,
        className,
      )}
      title={label !== short ? label : 'Entrada comercial / Lead'}
    >
      <Building2 size={size === 'sm' ? 9 : 11} aria-hidden />
      {short}
    </span>
  )
}
