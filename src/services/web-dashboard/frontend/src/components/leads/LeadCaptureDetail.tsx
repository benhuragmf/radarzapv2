import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import {
  AlertTriangle,
  ChevronDown,
  ExternalLink,
  Link2,
  MessageSquare,
  MoreHorizontal,
  Phone,
  Search,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react'
import { inputCls, textareaCls } from '@/design-system'
import { cn } from '@/lib/utils'
import { notifySuccess } from '../../lib/notify'
import type { LeadCaptureListItem, LeadCaptureStatus, LeadTemperature } from '@radarzap-types/lead-form'
import {
  LEAD_ORIGIN_DISPLAY,
  LEAD_STATUS_DISPLAY,
  formatPhoneDisplay,
  getContactStateLabel,
  getInboxStateLabel,
  getRecommendedAction,
  leadInboxHref,
  priorityLabel,
} from '../../lib/leadUi'
import { LEAD_CAPTURE_STATUS_VARIANT, LEAD_TEMPERATURE_LABEL, LEAD_TEMPERATURE_VARIANT, LEAD_TEMPERATURES } from '@radarzap-types/lead-form'
import { LeadLinkContactModal } from './LeadLinkContactModal'
import { LeadWhatsAppComposer } from './LeadWhatsAppComposer'
import { ContactClassificationCard } from '../contacts/ContactClassificationCard'
import type { ContactClassificationView } from '../../lib/contactClassificationUi'

type DetailTab = 'resumo' | 'conversa' | 'contato' | 'listas' | 'historico'

const HISTORY_LABEL: Record<string, string> = {
  captured: 'Capturado',
  status_changed: 'Status',
  temperature_changed: 'Temperatura',
  linked_contact: 'Vínculo',
  converted: 'Conversão',
  sent_to_inbox: 'Atendimento',
  added_to_list: 'Lista',
  note: 'Observação',
}

function shortDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const DETAIL_TABS: { id: DetailTab; label: string }[] = [
  { id: 'resumo', label: 'Resumo' },
  { id: 'conversa', label: 'Conversa' },
  { id: 'contato', label: 'Contato' },
  { id: 'listas', label: 'Listas' },
  { id: 'historico', label: 'Histórico' },
]

export function LeadCaptureDetail({
  item,
  canManage,
  canReply,
  contactGroups,
  onUpdate,
  onOpenInbox,
  onConvert,
  onLinkContact,
  onInboxConversationReady,
  onAddToGroups,
  onDelete,
  onClose,
  layout = 'sidebar',
  focusConversa = false,
  onConversaFocusDone,
  openingInbox,
  converting,
  linking,
  pending,
}: {
  item: LeadCaptureListItem
  canManage: boolean
  canReply: boolean
  contactGroups: { id: string; name: string }[]
  onUpdate: (patch: { status?: LeadCaptureStatus; temperature?: LeadTemperature | null; internalNotes?: string }) => void
  onOpenInbox: () => void
  onConvert: (opts: { contactGroupIds?: string[] }) => void
  onLinkContact: (contactId: string) => void
  onInboxConversationReady: (conversationId: string) => void
  onAddToGroups: (groupIds: string[]) => void
  onDelete: () => void
  onClose?: () => void
  layout?: 'sidebar' | 'bottom-panel' | 'mobile-sheet' | 'page'
  focusConversa?: boolean
  onConversaFocusDone?: () => void
  openingInbox: boolean
  converting: boolean
  linking: boolean
  pending: boolean
}) {
  const [notes, setNotes] = useState(item.internalNotes ?? '')
  const [selectedGroups, setSelectedGroups] = useState<string[]>(item.contactGroupIds ?? [])
  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [detailTab, setDetailTab] = useState<DetailTab>('resumo')
  const [moreOpen, setMoreOpen] = useState(false)
  const hasPhone = !item.phone.startsWith('email:')

  useEffect(() => {
    setNotes(item.internalNotes ?? '')
    setSelectedGroups(item.contactGroupIds ?? [])
    setDetailTab('resumo')
    setMoreOpen(false)
  }, [item.id])

  useEffect(() => {
    if (focusConversa) {
      setDetailTab('conversa')
      onConversaFocusDone?.()
    }
  }, [focusConversa, onConversaFocusDone])

  const contactLine = item.phone.startsWith('email:') ? (item.email ?? '—') : formatPhoneDisplay(item.phone)
  const recommended = useMemo(() => getRecommendedAction(item), [item])
  const inboxHref = useMemo(() => leadInboxHref(item), [item])
  const isBottom = layout === 'bottom-panel'
  const isPage = layout === 'page'

  const shellCls =
    layout === 'mobile-sheet'
      ? 'flex flex-col h-full min-h-0 bg-[var(--rz-surface)]'
      : isPage
        ? 'flex flex-col xl:flex-row min-h-[min(760px,calc(100dvh-10rem))] rounded-xl border border-[var(--rz-border)] bg-[var(--rz-surface)] overflow-hidden shadow-sm'
        : isBottom
          ? 'flex flex-col h-full min-h-0 bg-[var(--rz-surface)] overflow-hidden'
          : 'flex flex-col h-full min-h-0 bg-[var(--rz-surface)]'

  const primaryAction = (
    <>
      {(recommended.kind === 'view-contact' || recommended.kind === 'link') && item.destinationId && (
        <Link
          to={`/contact?search=${encodeURIComponent(item.phone)}`}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--rz-primary)] text-white text-sm font-medium py-2 px-3 hover:opacity-90"
        >
          <ExternalLink size={15} /> {recommended.primaryLabel}
        </Link>
      )}
      {recommended.kind === 'link' && !item.destinationId && canManage && (
        <Button className="w-full" onClick={() => setLinkModalOpen(true)}>
          <Link2 size={15} /> {recommended.primaryLabel}
        </Button>
      )}
      {recommended.kind === 'inbox' && inboxHref && (
        <Link
          to={inboxHref}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--rz-primary)] text-white text-sm font-medium py-2 px-3 hover:opacity-90"
        >
          <MessageSquare size={15} /> {recommended.primaryLabel}
        </Link>
      )}
      {recommended.kind === 'convert' && canManage && (
        <Button className="w-full" disabled={converting} onClick={() => onConvert({ contactGroupIds: selectedGroups })}>
          <UserCheck size={15} /> {recommended.primaryLabel}
        </Button>
      )}
      {(recommended.kind === 'open-inbox' || recommended.kind === 'follow-up') && canReply && (
        <Button className="w-full" disabled={openingInbox} onClick={onOpenInbox}>
          <MessageSquare size={15} /> {recommended.primaryLabel}
        </Button>
      )}
    </>
  )

  const actionsRail = (
    <>
      <div
        className={cn(
          'shrink-0 border-b border-[var(--rz-border)] px-4 space-y-2',
          isBottom ? 'py-2' : 'py-3',
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className={cn('font-semibold truncate', isBottom || isPage ? 'text-sm' : 'text-base')}>{item.name}</h2>
            <p className="text-xs text-[var(--rz-text-muted)] truncate">{contactLine}</p>
            {!isBottom && !isPage && (
              <>
                <p className="text-[10px] text-[var(--rz-text-muted)] mt-0.5">
                  Origem: {LEAD_ORIGIN_DISPLAY[item.origin]} · {item.formName}
                </p>
                <p className="text-[10px] text-[var(--rz-text-muted)]">
                  Status: {LEAD_STATUS_DISPLAY[item.status]}
                  {item.assignedUserName ? ` · ${item.assignedUserName}` : ' · Sem responsável'}
                </p>
              </>
            )}
            {(isBottom || isPage) && (
              <p className="text-[10px] text-[var(--rz-text-muted)] mt-0.5 truncate">
                {LEAD_ORIGIN_DISPLAY[item.origin]} · {LEAD_STATUS_DISPLAY[item.status]}
                {item.assignedUserName ? ` · ${item.assignedUserName}` : ''}
              </p>
            )}
          </div>
          {onClose && !isPage && (
            <button
              type="button"
              className="shrink-0 p-1.5 rounded-lg hover:bg-[var(--rz-surface-muted)] text-[var(--rz-text-muted)]"
              onClick={onClose}
              aria-label="Fechar painel"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge label={LEAD_STATUS_DISPLAY[item.status]} variant={LEAD_CAPTURE_STATUS_VARIANT[item.status]} />
          {item.temperature && (
            <Badge label={priorityLabel(item.temperature)} variant={LEAD_TEMPERATURE_VARIANT[item.temperature]} />
          )}
          {item.linkedContactName && <Badge label="Vinculado" variant="green" />}
          {item.possibleDuplicate && <Badge label="Duplicado?" variant="yellow" />}
          {item.consentAccepted === true && <Badge label="LGPD OK" variant="green" />}
        </div>
      </div>

      <div className={cn('shrink-0 px-4 border-b border-[var(--rz-border)] bg-[var(--rz-primary)]/5', isBottom || isPage ? 'py-1.5' : 'py-2')}>
        <p className="text-[10px] uppercase tracking-wide text-[var(--rz-text-muted)] mb-0.5">Próxima ação</p>
        <p className="text-xs font-medium">{recommended.title}</p>
        {!isBottom && !isPage && <p className="text-[10px] text-[var(--rz-text-muted)] mt-0.5">{recommended.description}</p>}
      </div>

      {isBottom || isPage ? (
        <div className="shrink-0 px-4 py-2 border-b border-[var(--rz-border)] flex flex-wrap items-center gap-2">
          <div className="min-w-[140px] flex-1">{primaryAction}</div>
          <div className="flex flex-wrap gap-1.5">
            {hasPhone && canReply && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-[var(--rz-border)] hover:bg-[var(--rz-surface-muted)]"
                onClick={() => setDetailTab('conversa')}
              >
                <MessageSquare size={12} /> WhatsApp
              </button>
            )}
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-[var(--rz-border)] hover:bg-[var(--rz-surface-muted)]"
              onClick={() => {
                void navigator.clipboard.writeText(item.phone.startsWith('email:') ? (item.email ?? '') : item.phone)
                notifySuccess('Copiado')
              }}
            >
              <Phone size={12} /> Copiar
            </button>
            <Link
              to={`/platform/inbox?search=${encodeURIComponent(item.phone)}`}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-[var(--rz-border)] hover:bg-[var(--rz-surface-muted)]"
            >
              <Search size={12} /> Procurar
            </Link>
            {canManage && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-[var(--rz-border)] hover:bg-[var(--rz-surface-muted)]"
                onClick={() => setLinkModalOpen(true)}
              >
                <Link2 size={12} /> Vincular
              </button>
            )}
            {canManage && (
              <div className="relative">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-[var(--rz-border)] hover:bg-[var(--rz-surface-muted)]"
                  onClick={() => setMoreOpen(v => !v)}
                >
                  <MoreHorizontal size={12} /> Mais
                  <ChevronDown size={10} className={cn(moreOpen && 'rotate-180')} />
                </button>
                {moreOpen && (
                  <div className="absolute right-0 top-full mt-1 z-10 min-w-[160px] rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface)] shadow-lg py-1">
                    {item.status !== 'lost' && (
                      <button
                        type="button"
                        className="w-full text-left text-xs px-3 py-1.5 hover:bg-[var(--rz-surface-muted)]"
                        onClick={() => {
                          onUpdate({ status: 'lost' })
                          setMoreOpen(false)
                        }}
                      >
                        Marcar como perdido
                      </button>
                    )}
                    {item.status !== 'spam' && (
                      <button
                        type="button"
                        className="w-full text-left text-xs px-3 py-1.5 hover:bg-[var(--rz-surface-muted)]"
                        onClick={() => {
                          onUpdate({ status: 'spam' })
                          setMoreOpen(false)
                        }}
                      >
                        Marcar como spam
                      </button>
                    )}
                    <button
                      type="button"
                      className="w-full text-left text-xs px-3 py-1.5 text-red-600 hover:bg-red-500/10"
                      onClick={() => {
                        setMoreOpen(false)
                        onDelete()
                      }}
                    >
                      <Trash2 size={12} className="inline mr-1" /> Excluir lead
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="shrink-0 px-4 py-2 border-b border-[var(--rz-border)]">{primaryAction}</div>
          <div className="shrink-0 px-3 py-2 border-b border-[var(--rz-border)] flex flex-wrap gap-1.5">
            {hasPhone && canReply && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-[var(--rz-border)] hover:bg-[var(--rz-surface-muted)]"
                onClick={() => setDetailTab('conversa')}
              >
                <MessageSquare size={12} /> WhatsApp
              </button>
            )}
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-[var(--rz-border)] hover:bg-[var(--rz-surface-muted)]"
              onClick={() => {
                void navigator.clipboard.writeText(item.phone.startsWith('email:') ? (item.email ?? '') : item.phone)
                notifySuccess('Copiado')
              }}
            >
              <Phone size={12} /> Copiar
            </button>
            <Link
              to={`/platform/inbox?search=${encodeURIComponent(item.phone)}`}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-[var(--rz-border)] hover:bg-[var(--rz-surface-muted)]"
            >
              <Search size={12} /> Procurar
            </Link>
            {canManage && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-[var(--rz-border)] hover:bg-[var(--rz-surface-muted)]"
                onClick={() => setLinkModalOpen(true)}
              >
                <Link2 size={12} /> Vincular contato
              </button>
            )}
            {canManage && (
              <div className="relative">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-[var(--rz-border)] hover:bg-[var(--rz-surface-muted)]"
                  onClick={() => setMoreOpen(v => !v)}
                >
                  <MoreHorizontal size={12} /> Mais
                  <ChevronDown size={10} className={cn(moreOpen && 'rotate-180')} />
                </button>
                {moreOpen && (
                  <div className="absolute left-0 top-full mt-1 z-10 min-w-[160px] rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface)] shadow-lg py-1">
                    {canManage && item.status !== 'lost' && (
                      <button
                        type="button"
                        className="w-full text-left text-xs px-3 py-1.5 hover:bg-[var(--rz-surface-muted)]"
                        onClick={() => {
                          onUpdate({ status: 'lost' })
                          setMoreOpen(false)
                        }}
                      >
                        Marcar como perdido
                      </button>
                    )}
                    {canManage && item.status !== 'spam' && (
                      <button
                        type="button"
                        className="w-full text-left text-xs px-3 py-1.5 hover:bg-[var(--rz-surface-muted)]"
                        onClick={() => {
                          onUpdate({ status: 'spam' })
                          setMoreOpen(false)
                        }}
                      >
                        Marcar como spam
                      </button>
                    )}
                    {canManage && (
                      <button
                        type="button"
                        className="w-full text-left text-xs px-3 py-1.5 text-red-600 hover:bg-red-500/10"
                        onClick={() => {
                          setMoreOpen(false)
                          onDelete()
                        }}
                      >
                        <Trash2 size={12} className="inline mr-1" /> Excluir lead
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {item.duplicateHints && item.duplicateHints.length > 0 && (
        <div className="shrink-0 mx-3 my-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 px-2.5 py-2 text-[11px]">
          <p className="flex items-center gap-1 font-medium text-yellow-600 dark:text-yellow-400">
            <AlertTriangle size={12} /> Possível duplicado
          </p>
          {item.duplicateHints.slice(0, 2).map(h => (
            <div key={`${h.kind}-${h.id}`} className="flex items-center justify-between gap-2 mt-1">
              <span className="truncate">{h.name ?? h.phone ?? h.email}</span>
              {canManage && h.kind === 'contact' && (
                <button
                  type="button"
                  className="text-[var(--rz-primary)] shrink-0"
                  disabled={linking}
                  onClick={() => onLinkContact(h.id)}
                >
                  Vincular
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )

  const tabsBody = (
    <>
      <div className="shrink-0 flex border-b border-[var(--rz-border)] overflow-x-auto">
        {DETAIL_TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setDetailTab(t.id)}
            className={cn(
              'px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
              detailTab === t.id
                ? 'border-[var(--rz-primary)] text-[var(--rz-primary)]'
                : 'border-transparent text-[var(--rz-text-muted)] hover:text-[var(--rz-text-secondary)]',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 text-sm">
          {detailTab === 'resumo' && (
            <div className="space-y-3">
              {item.message && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-[var(--rz-text-muted)] mb-1">Mensagem</p>
                  <p className="text-sm whitespace-pre-wrap rounded-lg bg-[var(--rz-surface-muted)]/50 p-2.5">{item.message}</p>
                </div>
              )}
              <dl className="space-y-2 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--rz-text-muted)]">Capturado em</dt>
                  <dd>{new Date(item.createdAt).toLocaleString('pt-BR')}</dd>
                </div>
                {item.pageTitle && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-[var(--rz-text-muted)]">Página de origem</dt>
                    <dd className="text-right truncate max-w-[60%]">{item.pageTitle}</dd>
                  </div>
                )}
                {item.linkedContactName && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-[var(--rz-text-muted)]">Contato vinculado</dt>
                    <dd className="font-medium">{item.linkedContactName}</dd>
                  </div>
                )}
              </dl>
              {canManage && (
                <>
                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-[var(--rz-text-muted)]">Prioridade</label>
                    <select
                      className={inputCls + ' mt-1 text-sm h-9'}
                      value={item.temperature ?? ''}
                      disabled={pending}
                      onChange={e => {
                        const v = e.target.value
                        onUpdate({ temperature: v ? (v as LeadTemperature) : null })
                      }}
                    >
                      <option value="">Sem prioridade definida</option>
                      {LEAD_TEMPERATURES.map(t => (
                        <option key={t} value={t}>
                          {LEAD_TEMPERATURE_LABEL[t]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-[var(--rz-text-muted)]">Observações internas</label>
                    <textarea className={textareaCls + ' mt-1 text-sm'} rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
                    {item.internalNotes && notes !== item.internalNotes && (
                      <p className="text-[10px] text-[var(--rz-text-muted)] mt-1">Alterações não salvas</p>
                    )}
                    <Button size="sm" className="mt-1.5" disabled={pending} onClick={() => onUpdate({ internalNotes: notes })}>
                      Salvar
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {detailTab === 'conversa' && (
            <div className="space-y-4 text-xs">
              <div className="rounded-lg border border-[var(--rz-border)] p-2.5 space-y-1.5">
                <p className="text-[10px] text-[var(--rz-text-muted)]">Situação do atendimento</p>
                <p className="font-medium">{getInboxStateLabel(item)}</p>
              </div>
              {hasPhone && canReply && (
                <div className="rounded-xl border border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/20 p-3 space-y-2">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--rz-text-muted)]">Responder pelo WhatsApp</p>
                  <LeadWhatsAppComposer
                    item={item}
                    canReply={canReply}
                    onConversationReady={onInboxConversationReady}
                    compact
                  />
                </div>
              )}
              <div className="space-y-2">
                {canReply &&
                  (inboxHref ? (
                    <Link
                      to={inboxHref}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--rz-primary)] text-[var(--rz-primary)] text-sm py-2"
                    >
                      <MessageSquare size={14} /> Abrir atendimento
                    </Link>
                  ) : (
                    <Button className="w-full" size="sm" disabled={openingInbox} onClick={onOpenInbox}>
                      Abrir atendimento
                    </Button>
                  ))}
                <Link
                  to={`/platform/inbox?search=${encodeURIComponent(item.phone)}`}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--rz-border)] text-sm py-2"
                >
                  <Search size={14} /> Procurar conversa
                </Link>
              </div>
            </div>
          )}

          {detailTab === 'contato' && (
            <div className="space-y-3 text-xs">
              <div className="rounded-lg border border-[var(--rz-border)] p-2.5">
                <p className="text-[10px] text-[var(--rz-text-muted)] mb-1">Situação do contato</p>
                <p className="font-medium">{getContactStateLabel(item)}</p>
              </div>
              {item.classification && (
                <ContactClassificationCard
                  classification={item.classification as ContactClassificationView}
                  compact
                />
              )}
              {item.possibleDuplicate && (
                <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-2 text-[11px]">
                  Contato existente encontrado — vincule para não duplicar a base.
                </div>
              )}
              <div className="space-y-2">
                {item.destinationId && (
                  <Link
                    to={`/contact?search=${encodeURIComponent(item.phone)}`}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--rz-primary)] text-[var(--rz-primary)] text-sm py-2"
                  >
                    <ExternalLink size={14} /> Ver contato
                  </Link>
                )}
                {canManage && (
                  <>
                    <Button className="w-full" size="sm" variant="secondary" onClick={() => setLinkModalOpen(true)}>
                      <Link2 size={14} /> Vincular contato
                    </Button>
                    {item.status !== 'converted' && (
                      <Button className="w-full" size="sm" disabled={converting} onClick={() => onConvert({ contactGroupIds: selectedGroups })}>
                        <UserCheck size={14} /> Salvar como contato
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {detailTab === 'listas' && (
            <div className="space-y-3">
              {item.contactGroupNames && item.contactGroupNames.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-[var(--rz-text-muted)] mb-1.5">Listas atuais</p>
                  <div className="flex flex-wrap gap-1">
                    {item.contactGroupNames.map(n => (
                      <Badge key={n} label={n} variant="purple" />
                    ))}
                  </div>
                </div>
              )}
              {canManage && contactGroups.length > 0 ? (
                <>
                  <p className="text-[10px] uppercase tracking-wide text-[var(--rz-text-muted)]">Adicionar em lista</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {contactGroups.map(g => (
                      <label key={g.id} className="flex items-center gap-2 text-xs border border-[var(--rz-border)] rounded px-2 py-1.5">
                        <input
                          type="checkbox"
                          checked={selectedGroups.includes(g.id)}
                          onChange={e => {
                            setSelectedGroups(prev =>
                              e.target.checked ? [...prev, g.id] : prev.filter(id => id !== g.id),
                            )
                          }}
                        />
                        {g.name}
                      </label>
                    ))}
                  </div>
                  <Button size="sm" variant="secondary" disabled={pending} onClick={() => onAddToGroups(selectedGroups)}>
                    Salvar listas
                  </Button>
                </>
              ) : (
                <p className="text-xs text-[var(--rz-text-muted)]">Nenhuma lista disponível.</p>
              )}
            </div>
          )}

          {detailTab === 'historico' && (
            <div>
              {!item.history?.length ? (
                <p className="text-xs text-[var(--rz-text-muted)]">Nenhum evento registrado.</p>
              ) : (
                <ul className="space-y-3">
                  {[...item.history].reverse().map((h, i) => (
                    <li key={i} className="relative pl-3 border-l-2 border-[var(--rz-border)]">
                      <p className="text-[10px] text-[var(--rz-text-muted)]">
                        {shortDate(h.at)} — <span className="font-medium text-[var(--rz-text-secondary)]">{HISTORY_LABEL[h.kind] ?? h.kind}</span>
                      </p>
                      <p className="text-xs mt-0.5 text-[var(--rz-text-secondary)]">{h.message}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
      </div>
    </>
  )

  return (
    <>
      <div className={shellCls}>
        {isPage ? (
          <>
            <div className="flex flex-col shrink-0 xl:w-[min(340px,34%)] xl:max-w-[400px] xl:border-r border-b xl:border-b-0 border-[var(--rz-border)] min-h-0 xl:overflow-y-auto">
              {actionsRail}
            </div>
            <div className="flex flex-col flex-1 min-w-0 min-h-0">{tabsBody}</div>
          </>
        ) : (
          <>
            {actionsRail}
            {tabsBody}
          </>
        )}
      </div>

      <LeadLinkContactModal
        open={linkModalOpen}
        leadName={item.name}
        leadPhone={item.phone}
        linking={linking}
        onClose={() => setLinkModalOpen(false)}
        onLink={contactId => {
          onLinkContact(contactId)
          setLinkModalOpen(false)
        }}
      />

    </>
  )
}

export function LeadDetailEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[280px] px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--rz-surface-muted)] text-[var(--rz-text-muted)] mb-3">
        <MessageSquare size={22} aria-hidden />
      </div>
      <p className="text-sm font-medium text-[var(--rz-text-secondary)]">Nenhum lead selecionado</p>
      <p className="text-xs text-[var(--rz-text-muted)] mt-1 max-w-[260px] leading-relaxed">
        Clique em um card no Kanban ou em uma linha na lista para abrir a página completa do lead.
      </p>
    </div>
  )
}
