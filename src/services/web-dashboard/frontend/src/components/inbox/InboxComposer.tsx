import { useMemo, useRef, useState } from 'react'
import { Send } from 'lucide-react'
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
  disabled?: boolean
  sending?: boolean
  quickReplies?: QuickReplyItem[]
}

export function InboxComposer({
  value,
  onChange,
  onSend,
  disabled,
  sending,
  quickReplies = [],
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  return (
    <div className="space-y-2">
      {slashMatches.length > 0 && (
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
            <WhatsAppEmojiPicker disabled={disabled} onPick={insertEmoji} />
          </div>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={e => onChange(e.currentTarget.value)}
            placeholder="Digite sua resposta… (/bd, /bt…) · Enter envia"
            rows={2}
            disabled={disabled}
            className={cn(
              textareaCls,
              'pl-10 min-h-[44px] max-h-32 resize-none rounded-xl disabled:opacity-50',
            )}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && value.trim()) {
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
          disabled={!value.trim() || disabled || sending}
          aria-label="Enviar"
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
              disabled={disabled}
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
