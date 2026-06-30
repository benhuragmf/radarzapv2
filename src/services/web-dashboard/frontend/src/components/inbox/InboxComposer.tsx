import { useMemo, useRef, useState } from 'react'
import { Paperclip, Send } from 'lucide-react'
import { Button } from '../ui/Button'
import { WhatsAppEmojiPicker } from '../whatsapp/WhatsAppEmojiPicker'
import { textareaCls } from '@/design-system'
import { cn } from '@/lib/utils'

export interface QuickReplyItem {
  code: string
  label: string
  template: string
}

interface Props {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  /** Bloqueia envio (botão/Enter) — textarea permanece editável para rascunho. */
  sendDisabled?: boolean
  sending?: boolean
  quickReplies?: QuickReplyItem[]
  /** Código da resposta rápida de aviso (ex.: aus). */
  inactivityWarningQuickCode?: string
  /** Código da pergunta final (ex.: mais). */
  gracefulCloseQuickCode?: string
  /** Código da resposta rápida de encerramento por inatividade (ex.: enc). */
  inactivityCloseQuickCode?: string
  /** Código do encerramento natural cordial (ex.: enc_ok). */
  inactivityCloseGracefulQuickCode?: string
  /** Libera o chip/menu do atalho /enc (inatividade). */
  inactivityCloseAllowed?: boolean
  /** Libera o chip/menu do atalho /enc_ok (encerramento natural). */
  encOkCloseAllowed?: boolean
  /** Bloqueia /enc até /aus + tempo. */
  inactivityCloseGateEnabled?: boolean
  /** Bloqueia /enc_ok até /mais + tempo ou resposta do cliente. */
  gracefulCloseGateEnabled?: boolean
  onImageAttach?: (file: File) => void
  imageAttachDisabled?: boolean
  imageAttaching?: boolean
  composeMode?: 'reply' | 'internal'
  onComposeModeChange?: (mode: 'reply' | 'internal') => void
  internalChatDisabled?: boolean
}

export function InboxComposer({
  value,
  onChange,
  onSend,
  sendDisabled,
  sending,
  quickReplies = [],
  inactivityWarningQuickCode = 'aus',
  gracefulCloseQuickCode = 'mais',
  inactivityCloseQuickCode = 'enc',
  inactivityCloseGracefulQuickCode = 'enc_ok',
  inactivityCloseAllowed = true,
  encOkCloseAllowed = true,
  inactivityCloseGateEnabled = true,
  gracefulCloseGateEnabled = true,
  onImageAttach,
  imageAttachDisabled,
  imageAttaching,
  composeMode = 'reply',
  onComposeModeChange,
  internalChatDisabled,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const closeCode = inactivityCloseQuickCode.toLowerCase()
  const encOkCode = inactivityCloseGracefulQuickCode.toLowerCase()
  const warnCode = inactivityWarningQuickCode.toLowerCase()
  const maisCode = gracefulCloseQuickCode.toLowerCase()

  const isInactivityCloseQuickReply = (code: string) => code.toLowerCase() === closeCode
  const isEncOkCloseQuickReply = (code: string) => code.toLowerCase() === encOkCode

  const isQuickReplyDisabled = (code: string) => {
    if (sendDisabled) return true
    if (isInactivityCloseQuickReply(code)) {
      return inactivityCloseGateEnabled && !inactivityCloseAllowed
    }
    if (isEncOkCloseQuickReply(code)) {
      return gracefulCloseGateEnabled && !encOkCloseAllowed
    }
    return false
  }

  const closeDisabledTitle = (code: string) => {
    if (isInactivityCloseQuickReply(code) && inactivityCloseGateEnabled && !inactivityCloseAllowed) {
      return `Use /${warnCode} (inatividade) e aguarde o tempo do SLA antes de /${closeCode}`
    }
    if (isEncOkCloseQuickReply(code) && gracefulCloseGateEnabled && !encOkCloseAllowed) {
      return `Use /${maisCode} (pergunta final) e aguarde resposta do cliente ou o tempo do SLA antes de /${encOkCode}`
    }
    return undefined
  }

  const slashMatches = useMemo(() => {
    const m = value.match(/^\/(\w*)$/i)
    if (!m) return []
    const partial = m[1].toLowerCase()
    return quickReplies.filter(q => q.code.toLowerCase().startsWith(partial)).slice(0, 12)
  }, [value, quickReplies])

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current
    if (!el) {
      onChange(value + emoji)
      return
    }
    const start = el.selectionStart ?? value.length
    const end = el.selectionEnd ?? value.length
    const next = value.slice(0, start) + emoji + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + emoji.length
      el.setSelectionRange(pos, pos)
    })
  }

  const applySlash = (code: string) => {
    if (isQuickReplyDisabled(code)) return
    onChange(`/${code} `)
    textareaRef.current?.focus()
  }

  const isInternal = composeMode === 'internal'
  const typedQuickCode = value.trim().match(/^\/(\w+)/)?.[1]?.toLowerCase()
  const closeReplyBlocked =
    !isInternal &&
    inactivityCloseGateEnabled &&
    typedQuickCode === closeCode &&
    !inactivityCloseAllowed
  const encOkReplyBlocked =
    !isInternal &&
    gracefulCloseGateEnabled &&
    typedQuickCode === encOkCode &&
    !encOkCloseAllowed
  const canSubmit =
    Boolean(value.trim()) &&
    !sending &&
    !closeReplyBlocked &&
    !encOkReplyBlocked &&
    (isInternal ? !internalChatDisabled : !sendDisabled)

  return (
    <div className="space-y-2">
      {onComposeModeChange && (
        <div className="flex gap-1 p-0.5 rounded-lg bg-[var(--rz-surface-muted)]/60 border border-[var(--rz-border)]/60 w-fit">
          <button
            type="button"
            onClick={() => onComposeModeChange('reply')}
            className={cn(
              'px-3 py-1 rounded-md text-[11px] font-medium transition-colors',
              composeMode === 'reply'
                ? 'bg-brand-500/15 text-brand-400'
                : 'text-[var(--rz-text-muted)] hover:text-[var(--rz-text-secondary)]',
            )}
          >
            Responder
          </button>
          <button
            type="button"
            onClick={() => onComposeModeChange('internal')}
            className={cn(
              'px-3 py-1 rounded-md text-[11px] font-medium transition-colors',
              composeMode === 'internal'
                ? 'bg-amber-500/15 text-amber-400'
                : 'text-[var(--rz-text-muted)] hover:text-[var(--rz-text-secondary)]',
            )}
          >
            Chat interno
          </button>
        </div>
      )}

      {isInternal && (
        <p className="text-[11px] text-amber-500/90 leading-snug">
          Visível só para atendentes e supervisores — o cliente não recebe esta mensagem.
          Use <span className="font-mono">@supervisor</span> para alertar a supervisão.
        </p>
      )}

      {!isInternal && slashMatches.length > 0 && (
        <div className="rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface)] overflow-hidden shadow-lg">
          <p className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[var(--rz-text-muted)] border-b border-[var(--rz-border)]">
            Respostas rápidas
          </p>
          {slashMatches.map(q => (
            <button
              key={q.code}
              type="button"
              disabled={isQuickReplyDisabled(q.code)}
              title={closeDisabledTitle(q.code) ?? undefined}
              onClick={() => applySlash(q.code)}
              className="w-full text-left px-3 py-2 hover:bg-[var(--rz-surface-muted)] border-b border-[var(--rz-border)]/50 last:border-0 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="text-brand-400 font-mono text-xs">/{q.code}</span>
              <span className="text-[var(--rz-text-muted)] text-xs ml-2">{q.label}</span>
              <p className="text-[11px] text-[var(--rz-text-muted)] truncate mt-0.5">{q.template}</p>
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 items-end">
        <div className="flex-1 relative">
          <div className="absolute left-2 bottom-2 z-10 flex items-center gap-0.5">
            {!isInternal && <WhatsAppEmojiPicker disabled={sendDisabled} onPick={insertEmoji} />}
            {!isInternal && onImageAttach && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) onImageAttach(file)
                    e.target.value = ''
                  }}
                />
                <button
                  type="button"
                  disabled={sendDisabled || imageAttachDisabled || imageAttaching}
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 rounded-lg text-[var(--rz-text-muted)] hover:text-[var(--rz-text-primary)] hover:bg-[var(--rz-surface-muted)] disabled:opacity-40"
                  title="Enviar imagem"
                  aria-label="Enviar imagem"
                >
                  <Paperclip size={16} />
                </button>
              </>
            )}
          </div>
          <textarea
            ref={textareaRef}
            data-inbox-composer
            value={value}
            onChange={e => onChange(e.currentTarget.value)}
            placeholder={
              isInternal
                ? 'Mensagem para a equipe (supervisor ou atendente)…'
                : sendDisabled
                  ? 'Aceite a conversa para enviar · você pode rascunhar aqui'
                  : 'Digite sua resposta… (/bd, /bt…) · Enter envia'
            }
            rows={2}
            className={cn(
              textareaCls,
              isInternal ? 'min-h-[44px]' : 'pl-10',
              'min-h-[44px] max-h-32 resize-none rounded-xl',
            )}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && value.trim() && canSubmit) {
                e.preventDefault()
                onSend()
              }
            }}
          />
        </div>
        <Button
          size="sm"
          className="h-10 w-10 p-0 shrink-0 rounded-xl"
          onClick={onSend}
          disabled={!canSubmit}
          aria-label={isInternal ? 'Enviar no chat interno' : 'Enviar'}
        >
          <Send size={16} />
        </Button>
      </div>

      {quickReplies.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {quickReplies.map(q => (
            <button
              key={q.code}
              type="button"
              disabled={isQuickReplyDisabled(q.code)}
              onClick={() => applySlash(q.code)}
              className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-[var(--rz-surface-muted)] text-[var(--rz-text-muted)] hover:text-brand-400 border border-[var(--rz-border)] disabled:opacity-40 disabled:cursor-not-allowed"
              title={
                closeDisabledTitle(q.code) ??
                (q.label ? `${q.label} — ${q.template}` : q.template)
              }
            >
              /{q.code}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
