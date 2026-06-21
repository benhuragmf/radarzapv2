import { useState } from 'react'
import {
  CheckCircle2,
  RotateCcw,
  Send,
  Share2,
  Trash2,
  UserPlus,
  AtSign,
  ChevronDown,
} from 'lucide-react'
import { Button } from '../ui/Button'
import { inputCls, selectCls, textareaCls } from '@/design-system'
import type { InboxTicketDetail, InboxTicketTeamMember } from '../../lib/inboxTicket'
import { ticketIsOpen } from '../../lib/inboxTicket'

interface Props {
  ticket: InboxTicketDetail
  teamMembers: InboxTicketTeamMember[]
  clientChannel?: 'whatsapp' | 'webchat_site'
  onCloseTicket?: () => void
  closingTicket?: boolean
  onReopenTicket?: () => void
  reopeningTicket?: boolean
  onSendClientUpdate?: () => void
  sendingClientUpdate?: boolean
  onDeleteTicket?: () => void
  deletingTicket?: boolean
  onForward?: (payload: { targetUserId?: string; phone?: string; note?: string }) => Promise<unknown>
  forwarding?: boolean
  onAssign?: (userId: string) => Promise<unknown>
  assigning?: boolean
  onSetStatus?: (status: 'open' | 'in_progress' | 'client_replied') => Promise<unknown>
  settingStatus?: boolean
  mentionSelection: string[]
  onMentionToggle: (userId: string) => void
}

export function InboxTicketActionsBar({
  ticket,
  teamMembers,
  clientChannel = 'whatsapp',
  onCloseTicket,
  closingTicket,
  onReopenTicket,
  reopeningTicket,
  onSendClientUpdate,
  sendingClientUpdate,
  onDeleteTicket,
  deletingTicket,
  onForward,
  forwarding,
  onAssign,
  assigning,
  onSetStatus,
  settingStatus,
  mentionSelection,
  onMentionToggle,
}: Props) {
  const open = ticketIsOpen(ticket.status)
  const isWebChat = clientChannel === 'webchat_site'
  const [menuOpen, setMenuOpen] = useState(false)
  const [forwardOpen, setForwardOpen] = useState(false)
  const [forwardUserId, setForwardUserId] = useState('')
  const [forwardPhone, setForwardPhone] = useState('')
  const [forwardNote, setForwardNote] = useState('')

  const linkedMembers = teamMembers.filter(m => m.userId && m.linked)

  const handleForward = async () => {
    if (!onForward) return
    await onForward({
      targetUserId: forwardUserId || undefined,
      phone: forwardPhone.trim() || undefined,
      note: forwardNote.trim() || undefined,
    })
    setForwardOpen(false)
    setForwardUserId('')
    setForwardPhone('')
    setForwardNote('')
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {open && onSendClientUpdate && (
          <Button
            size="sm"
            variant="secondary"
            onClick={onSendClientUpdate}
            disabled={sendingClientUpdate}
            title={
              isWebChat
                ? 'Envia status + acompanhamento ao visitante no chat do site e na consulta TK+token'
                : 'Envia status do ticket + histórico de acompanhamento até agora'
            }
          >
            <Send size={14} />
            {sendingClientUpdate
              ? 'Enviando…'
              : isWebChat
                ? 'Enviar atualização ao visitante'
                : 'Enviar atualização ao cliente'}
          </Button>
        )}

        {open && onCloseTicket && (
          <Button
            size="sm"
            variant="secondary"
            onClick={onCloseTicket}
            disabled={closingTicket}
            className="border-green-500/30 text-green-400 hover:bg-green-500/10"
          >
            <CheckCircle2 size={14} />
            {closingTicket ? 'Finalizando…' : 'Finalizar ticket'}
          </Button>
        )}

        {!open && onReopenTicket && (
          <Button size="sm" variant="secondary" onClick={onReopenTicket} disabled={reopeningTicket}>
            <RotateCcw size={14} />
            {reopeningTicket ? 'Reabrindo…' : 'Reabrir ticket'}
          </Button>
        )}

        {open && onSetStatus && (
          <>
            <Button
              size="sm"
              variant="secondary"
              disabled={settingStatus || ticket.status === 'in_progress'}
              onClick={() => onSetStatus('in_progress')}
              title="Marcar em andamento"
            >
              Em andamento
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={settingStatus || ticket.status === 'client_replied'}
              onClick={() => onSetStatus('client_replied')}
              title="Marcar aguardando equipe"
            >
              Aguard. equipe
            </Button>
          </>
        )}

        <div className="relative">
          <Button size="sm" variant="secondary" onClick={() => setMenuOpen(v => !v)}>
            Ações <ChevronDown size={14} />
          </Button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 min-w-[200px] rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface)] shadow-xl py-1 text-sm">
                {open && onForward && (
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-[var(--rz-surface-muted)] flex items-center gap-2 text-[var(--rz-text-secondary)]"
                    onClick={() => {
                      setMenuOpen(false)
                      setForwardOpen(true)
                    }}
                  >
                    <Share2 size={14} /> Encaminhar p/ WhatsApp
                  </button>
                )}
                {onDeleteTicket && (
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-red-900/20 flex items-center gap-2 text-red-400"
                    onClick={() => {
                      setMenuOpen(false)
                      if (window.confirm(`Excluir o ticket ${ticket.ticketRef}? Esta ação não pode ser desfeita.`)) {
                        onDeleteTicket()
                      }
                    }}
                  >
                    <Trash2 size={14} /> Excluir ticket
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {open && onAssign && linkedMembers.length > 0 && (
          <div className="flex items-center gap-1.5 ml-auto">
            <UserPlus size={14} className="text-[var(--rz-text-muted)] shrink-0" />
            <select
              value={ticket.assignedUserId ?? ''}
              disabled={assigning}
              onChange={e => {
                const v = e.currentTarget.value
                if (v) void onAssign(v)
              }}
              className={`${selectCls} text-xs max-w-[160px] py-1.5`}
            >
              <option value="">Responsável…</option>
              {linkedMembers.map(m => (
                <option key={m.userId!} value={m.userId!}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {open && linkedMembers.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <span className="text-[10px] uppercase text-[var(--rz-text-muted)] flex items-center gap-1">
            <AtSign size={10} /> Mencionar colega (notificação interna)
          </span>
          {linkedMembers.slice(0, 8).map(m => {
            const uid = m.userId!
            const active = mentionSelection.includes(uid)
            return (
              <button
                key={uid}
                type="button"
                onClick={() => onMentionToggle(uid)}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                  active
                    ? 'bg-brand-500/15 text-brand-400 border-brand-500/40'
                    : 'bg-[var(--rz-surface-muted)] text-[var(--rz-text-muted)] border-[var(--rz-border)] hover:border-[var(--rz-border)]'
                }`}
              >
                @{m.displayName.split(' ')[0]}
              </button>
            )
          })}
        </div>
      )}

      {forwardOpen && onForward && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-md border border-[var(--rz-border)] bg-[var(--rz-surface)] rounded-2xl shadow-xl">
            <div className="p-5 border-b border-[var(--rz-border)]">
              <h3 className="text-base font-semibold text-[var(--rz-text-primary)]">Encaminhar ticket</h3>
              <p className="text-xs text-[var(--rz-text-muted)] mt-1">
                Envia resumo do ticket {ticket.ticketRef} para o WhatsApp de um funcionário.
              </p>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs text-[var(--rz-text-muted)] mb-1 block">Funcionário</label>
                <select
                  value={forwardUserId}
                  onChange={e => {
                    setForwardUserId(e.currentTarget.value)
                    const m = linkedMembers.find(x => x.userId === e.currentTarget.value)
                    if (m?.whatsappPhone) setForwardPhone(m.whatsappPhone)
                  }}
                  className={selectCls}
                >
                  <option value="">Selecionar…</option>
                  {linkedMembers.map(m => (
                    <option key={m.userId!} value={m.userId!}>
                      {m.displayName}
                      {m.whatsappPhone ? '' : ' (sem WhatsApp cadastrado)'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--rz-text-muted)] mb-1 block">WhatsApp (alternativo)</label>
                <input
                  type="tel"
                  value={forwardPhone}
                  onChange={e => setForwardPhone(e.currentTarget.value)}
                  placeholder="5511999999999"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs text-[var(--rz-text-muted)] mb-1 block">Observação (opcional)</label>
                <textarea
                  value={forwardNote}
                  onChange={e => setForwardNote(e.currentTarget.value)}
                  rows={2}
                  className={`${textareaCls} resize-none`}
                />
              </div>
            </div>
            <div className="p-5 border-t border-[var(--rz-border)] flex gap-2 justify-end">
              <Button type="button" variant="secondary" onClick={() => setForwardOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void handleForward()}
                disabled={forwarding || (!forwardUserId && !forwardPhone.trim())}
              >
                {forwarding ? 'Enviando…' : 'Encaminhar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
