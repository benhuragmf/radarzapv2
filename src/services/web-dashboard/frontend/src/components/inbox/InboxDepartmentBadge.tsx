import { Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  /** Texto do badge (nome do setor ou "2ª instância"). */
  label: string
  departmentName?: string
  menuKey?: string
  clientVisible?: boolean
  internalRankLabel?: string
  size?: 'sm' | 'md'
  className?: string
}

/** Badge na lista do Inbox — mesma linguagem visual de /platform/inbox/setores. */
export function InboxDepartmentBadge({
  label,
  departmentName,
  menuKey,
  clientVisible = true,
  internalRankLabel,
  size = 'sm',
  className,
}: Props) {
  const cls = size === 'sm' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5'
  const isInternal = clientVisible === false
  const name = departmentName ?? label
  const short =
    label.length > 14 ? label.replace(/\s*[-–].*$/, '').trim() || label.slice(0, 12) : label
  const title = isInternal
    ? `${internalRankLabel ?? label} — ${name}`
    : menuKey
      ? `Menu ${menuKey} — ${name}`
      : name

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 font-medium rounded-md border max-w-[88px] truncate',
        isInternal
          ? 'bg-[var(--rz-warning-bg)] text-[var(--rz-warning-text)] border-[var(--rz-warning-text)]/25'
          : 'bg-[var(--rz-info-bg)] text-[var(--rz-info-text)] border-[var(--rz-info-text)]/25',
        cls,
        className,
      )}
      title={title}
    >
      <Building2 size={size === 'sm' ? 9 : 11} aria-hidden className="shrink-0" />
      <span className="truncate">{short}</span>
    </span>
  )
}
