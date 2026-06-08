import { useMemo, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { Button } from '../ui/Button'
import { WhatsAppEmojiPicker } from '../whatsapp/WhatsAppEmojiPicker'

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
    const m = value.match(/^\/(\w*)$/)
    if (!m) return []
    const partial = m[1].toLowerCase()
    return quickReplies.filter(q => q.code.startsWith(partial)).slice(0, 8)
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
        <div className="rounded-lg border border-gray-700/80 bg-gray-900/90 overflow-hidden shadow-lg">
          <p className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-gray-600 border-b border-gray-800">
            Respostas rápidas
          </p>
          {slashMatches.map(q => (
            <button
              key={q.code}
              type="button"
              onClick={() => applySlash(q.code)}
              className="w-full text-left px-3 py-2 hover:bg-gray-800/80 border-b border-gray-800/50 last:border-0"
            >
              <span className="text-brand-400 font-mono text-xs">/{q.code}</span>
              <span className="text-gray-500 text-xs ml-2">{q.label}</span>
              <p className="text-[11px] text-gray-600 truncate mt-0.5">{q.template}</p>
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
            className="w-full bg-gray-900 border border-gray-700/80 rounded-xl pl-10 pr-3 py-2.5 text-sm text-gray-200 resize-none focus:outline-none focus:border-brand-500/50 min-h-[44px] max-h-32 disabled:opacity-50"
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
          {quickReplies.slice(0, 7).map(q => (
            <button
              key={q.code}
              type="button"
              disabled={disabled}
              onClick={() => applySlash(q.code)}
              className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-gray-800/80 text-gray-500 hover:text-brand-400 border border-gray-700/60 disabled:opacity-40"
              title={q.template}
            >
              /{q.code}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
