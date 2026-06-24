import { Link } from 'react-router-dom'
import { MessageSquare, UserPlus } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import type { LeadCaptureListItem } from '@radarzap-types/lead-form'
import {
  LEAD_ORIGIN_DISPLAY,
  LEAD_STATUS_DISPLAY,
  canQuickAssumeLead,
  canQuickConvertLead,
  canQuickWhatsAppLead,
  formatPhoneDisplay,
  formatRelativeEntry,
  leadOriginBadgeVariant,
} from '../../lib/leadUi'
import { LEAD_CAPTURE_STATUS_VARIANT } from '@radarzap-types/lead-form'

type Props = {
  items: LeadCaptureListItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  canReply: boolean
  canManage: boolean
  onAssume: (id: string) => void
  onWhatsApp?: (item: LeadCaptureListItem) => void
  onConvert?: (id: string) => void
  assumingId?: string | null
  convertingId?: string | null
}

export function LeadCaptureListTable({
  items,
  selectedId,
  onSelect,
  canReply,
  canManage,
  onAssume,
  onWhatsApp,
  onConvert,
  assumingId,
  convertingId,
}: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-[var(--rz-border)] text-[var(--rz-text-muted)]">
            <th className="text-left py-2 px-2 font-medium">Nome</th>
            <th className="text-left py-2 px-2 font-medium hidden sm:table-cell">Telefone</th>
            <th className="text-left py-2 px-2 font-medium">Origem</th>
            <th className="text-left py-2 px-2 font-medium hidden md:table-cell">Status</th>
            <th className="text-left py-2 px-2 font-medium hidden lg:table-cell">Responsável</th>
            <th className="text-left py-2 px-2 font-medium">Entrada</th>
            <th className="text-left py-2 px-2 font-medium hidden xl:table-cell">Contato</th>
            <th className="text-right py-2 px-2 font-medium">Ação</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => {
            const selected = selectedId === item.id
            const showAssume = Boolean(canReply && canQuickAssumeLead(item))
            const showWhatsApp = Boolean(canReply && onWhatsApp && canQuickWhatsAppLead(item))
            const showConvert = Boolean(canManage && onConvert && canQuickConvertLead(item))
            const showInbox =
              canReply &&
              item.inboxConversationId &&
              !showAssume &&
              item.status !== 'converted' &&
              item.status !== 'lost' &&
              item.status !== 'spam'
            const assuming = assumingId === item.id
            const converting = convertingId === item.id
            return (
              <tr
                key={item.id}
                className={`border-b border-[var(--rz-border)]/60 cursor-pointer hover:bg-[var(--rz-surface-muted)]/40 ${
                  selected ? 'bg-[var(--rz-primary)]/5' : ''
                }`}
                onClick={() => onSelect(item.id)}
              >
                <td className="py-2 px-2">
                  <p className="font-medium truncate max-w-[140px]">{item.name}</p>
                  <p className="text-[10px] text-[var(--rz-text-muted)] sm:hidden">{formatPhoneDisplay(item.phone)}</p>
                </td>
                <td className="py-2 px-2 hidden sm:table-cell text-[var(--rz-text-secondary)]">
                  {formatPhoneDisplay(item.phone)}
                </td>
                <td className="py-2 px-2">
                  <Badge label={LEAD_ORIGIN_DISPLAY[item.origin]} variant={leadOriginBadgeVariant(item.origin)} />
                </td>
                <td className="py-2 px-2 hidden md:table-cell">
                  <Badge label={LEAD_STATUS_DISPLAY[item.status]} variant={LEAD_CAPTURE_STATUS_VARIANT[item.status]} />
                </td>
                <td className="py-2 px-2 hidden lg:table-cell text-[var(--rz-text-muted)]">
                  {item.assignedUserName ?? '—'}
                </td>
                <td className="py-2 px-2 text-[var(--rz-text-muted)] whitespace-nowrap">
                  {formatRelativeEntry(item.createdAt)}
                </td>
                <td className="py-2 px-2 hidden xl:table-cell">
                  {item.linkedContactName ? (
                    <span className="text-green-600 dark:text-green-400 truncate block max-w-[100px]">
                      {item.linkedContactName}
                    </span>
                  ) : (
                    <span className="text-[var(--rz-text-muted)]">—</span>
                  )}
                </td>
                <td className="py-2 px-2 text-right" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-end gap-1 flex-wrap">
                    {showAssume && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 px-2 text-[10px]"
                        disabled={assuming}
                        onClick={() => onAssume(item.id)}
                      >
                        <UserPlus size={11} /> Assumir
                      </Button>
                    )}
                    {showWhatsApp && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 px-2 text-[10px]"
                        title="WhatsApp"
                        onClick={() => onWhatsApp?.(item)}
                      >
                        <MessageSquare size={11} /> WA
                      </Button>
                    )}
                    {showConvert && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 px-2 text-[10px]"
                        title="Salvar como contato"
                        disabled={converting}
                        onClick={() => onConvert?.(item.id)}
                      >
                        <UserPlus size={11} /> Contato
                      </Button>
                    )}
                    {showInbox && (
                      <Link
                        to={`/platform/inbox?conv=${encodeURIComponent(item.inboxConversationId!)}`}
                        className="inline-flex items-center gap-1 h-7 px-2 text-[10px] rounded-md border border-[var(--rz-border)] hover:bg-[var(--rz-surface-muted)]"
                      >
                        <MessageSquare size={11} /> Inbox
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
