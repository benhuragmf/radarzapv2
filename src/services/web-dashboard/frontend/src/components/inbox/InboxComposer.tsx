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
  onImageAttach?: (file: File) => void
  imageAttachDisabled?: boolean
  imageAttaching?: boolean
  composeMode?: 'reply' | 'internal'
  onComposeModeChange?: (mode: 'reply' | 'internal') => void
  internalNoteDisabled?: boolean
}

export function InboxComposer({
  value,
  onChange,
  onSend,
  sendDisabled,
  sending,
  quickReplies = [],
  onImageAttach,
  imageAttachDisabled,
  imageAttaching,
  composeMode = 'reply',
  onComposeModeChange,
  internalNoteDisabled,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    onChange(`/${code} `)
    textareaRef.current?.focus()
  }

  const isInternal = composeMode === 'internal'
  const canSubmit = Boolean(value.trim()) && !sending && (isInternal ? !internalNoteDisabled : !sendDisabled)

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
            Nota interna
          </button>
        </div>
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
              onClick={() => applySlash(q.code)}
              className="w-full text-left px-3 py-2 hover:bg-[var(--rz-surface-muted)] border-b border-[var(--rz-border)]/50 last:border-0"
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
            value={value}
            onChange={e => onChange(e.currentTarget.value)}
            placeholder={
              isInternal
                ? 'Nota visível só para a equipe…'
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
          aria-label={isInternal ? 'Salvar nota' : 'Enviar'}
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
              disabled={sendDisabled}
              onClick={() => applySlash(q.code)}
              className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-[var(--rz-surface-muted)] text-[var(--rz-text-muted)] hover:text-brand-400 border border-[var(--rz-border)] disabled:opacity-40"
              title={q.label ? `${q.label} — ${q.template}` : q.template}
            >
              /{q.code}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
