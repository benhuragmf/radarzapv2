import { useCallback, useRef, type ReactNode } from 'react'
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Code2,
  List,
  Type,
} from 'lucide-react'
import {
  applyWhatsAppBulletList,
  applyWhatsAppFormat,
  insertTextAtCursor,
  type WaTextFormat,
  WA_TEXT_FORMAT_HINT,
} from '../../lib/whatsapp-text-format'
import { WA_STATUS_FONTS, type WaStatusFont } from '../../lib/whatsapp-status-fonts'
import { WhatsAppPreviewBubble } from '../platform/WhatsAppPreviewBubble'
import { WhatsAppEmojiPicker } from './WhatsAppEmojiPicker'

const inputBase =
  'w-full bg-gray-800 border-0 px-3 py-2 text-sm text-gray-200 focus:outline-none resize-y min-h-[80px]'

interface Props {
  value: string
  onChange: (value: string) => void
  maxLength?: number
  rows?: number
  minHeight?: string
  placeholder?: string
  label?: ReactNode
  className?: string
  showPreview?: boolean
  showHint?: boolean
  showEmoji?: boolean
  /** Fonte de status WhatsApp — só aplicada ao publicar status (não em mensagens comuns). */
  showFontPicker?: boolean
  font?: WaStatusFont
  onFontChange?: (font: WaStatusFont) => void
  disabled?: boolean
  monospace?: boolean
}

export function WhatsAppTextEditor({
  value,
  onChange,
  maxLength,
  rows = 4,
  minHeight,
  placeholder,
  label,
  className = '',
  showPreview = false,
  showHint = true,
  showEmoji = true,
  showFontPicker = false,
  font = 0,
  onFontChange,
  disabled = false,
  monospace = false,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const applyFormat = useCallback(
    (format: WaTextFormat) => {
      const el = textareaRef.current
      if (!el || disabled) return

      const start = el.selectionStart ?? value.length
      const end = el.selectionEnd ?? value.length
      const result = applyWhatsAppFormat(value, start, end, format)
      const next =
        maxLength != null ? result.value.slice(0, maxLength) : result.value
      onChange(next)

      requestAnimationFrame(() => {
        el.focus()
        const selStart = Math.min(result.selectionStart, next.length)
        const selEnd = Math.min(result.selectionEnd, next.length)
        el.setSelectionRange(selStart, selEnd)
      })
    },
    [disabled, maxLength, onChange, value],
  )

  const applyBullets = useCallback(() => {
    const el = textareaRef.current
    if (!el || disabled) return

    const start = el.selectionStart ?? value.length
    const end = el.selectionEnd ?? value.length
    const result = applyWhatsAppBulletList(value, start, end)
    const next = maxLength != null ? result.value.slice(0, maxLength) : result.value
    onChange(next)

    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(result.selectionStart, result.selectionEnd)
    })
  }, [disabled, maxLength, onChange, value])

  const insertAtCursor = useCallback(
    (insert: string) => {
      const el = textareaRef.current
      if (!el || disabled) return

      const start = el.selectionStart ?? value.length
      const end = el.selectionEnd ?? value.length
      const result = insertTextAtCursor(value, start, end, insert)
      const next = maxLength != null ? result.value.slice(0, maxLength) : result.value
      onChange(next)

      requestAnimationFrame(() => {
        el.focus()
        const pos = Math.min(result.selectionStart, next.length)
        el.setSelectionRange(pos, pos)
      })
    },
    [disabled, maxLength, onChange, value],
  )

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.ctrlKey || e.metaKey)) return
    const key = e.key.toLowerCase()
    if (key === 'b') {
      e.preventDefault()
      applyFormat('bold')
    } else if (key === 'i') {
      e.preventDefault()
      applyFormat('italic')
    } else if (key === 'x' && e.shiftKey) {
      e.preventDefault()
      applyFormat('strikethrough')
    } else if (key === 'm' && e.shiftKey) {
      e.preventDefault()
      applyFormat('monospace')
    }
  }

  const toolbarBtn =
    'p-1.5 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-800 disabled:opacity-40 transition-colors'

  return (
    <div className={className}>
      {label != null && <div className="mb-1">{label}</div>}

      <div
        className={`rounded-lg border border-gray-700 bg-gray-800/50 focus-within:border-brand-500 transition-colors ${
          disabled ? 'opacity-60' : ''
        }`}
      >
        <div className="flex flex-wrap items-center gap-0.5 px-1.5 py-1 bg-gray-900/90 border-b border-gray-800 relative z-10">
          <button
            type="button"
            title="Negrito (*texto*) — Ctrl+B"
            disabled={disabled}
            onClick={() => applyFormat('bold')}
            className={toolbarBtn}
          >
            <Bold size={15} />
          </button>
          <button
            type="button"
            title="Itálico (_texto_) — Ctrl+I"
            disabled={disabled}
            onClick={() => applyFormat('italic')}
            className={toolbarBtn}
          >
            <Italic size={15} />
          </button>
          <button
            type="button"
            title="Tachado (~texto~)"
            disabled={disabled}
            onClick={() => applyFormat('strikethrough')}
            className={toolbarBtn}
          >
            <Strikethrough size={15} />
          </button>
          <button
            type="button"
            title="Monoespaçado inline (`texto`)"
            disabled={disabled}
            onClick={() => applyFormat('monoInline')}
            className={toolbarBtn}
          >
            <Code size={15} />
          </button>
          <button
            type="button"
            title="Bloco monoespaçado (```texto```)"
            disabled={disabled}
            onClick={() => applyFormat('monospace')}
            className={toolbarBtn}
          >
            <Code2 size={15} />
          </button>
          <button
            type="button"
            title="Lista com •"
            disabled={disabled}
            onClick={applyBullets}
            className={toolbarBtn}
          >
            <List size={15} />
          </button>

          {showEmoji && (
            <WhatsAppEmojiPicker disabled={disabled} onPick={insertAtCursor} />
          )}

          {showFontPicker && onFontChange && (
            <div className="flex items-center gap-1 ml-0.5 pl-1 border-l border-gray-800">
              <Type size={13} className="text-gray-600 shrink-0" />
              <select
                value={font}
                disabled={disabled}
                title="Fonte do status WhatsApp"
                onChange={e => onFontChange(Number(e.target.value) as WaStatusFont)}
                className="h-7 max-w-[108px] text-[11px] bg-gray-800 border border-gray-700 rounded-md text-gray-300 px-1.5 focus:outline-none focus:border-brand-500"
              >
                {WA_STATUS_FONTS.map(f => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {showHint && (
            <span className="hidden lg:inline text-[10px] text-gray-600 ml-auto pr-1 truncate max-w-[200px]">
              {showFontPicker ? 'Fonte só no status · ' : ''}
              {WA_TEXT_FORMAT_HINT}
            </span>
          )}
        </div>

        <textarea
          ref={textareaRef}
          value={value}
          disabled={disabled}
          rows={rows}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={e => {
            const next = maxLength != null ? e.target.value.slice(0, maxLength) : e.target.value
            onChange(next)
          }}
          onKeyDown={onKeyDown}
          style={minHeight ? { minHeight } : undefined}
          className={`${inputBase} ${monospace ? 'font-mono text-xs' : ''}`}
        />

        {showPreview && value.trim() && (
          <div className="border-t border-gray-800 p-3 bg-[#0b141a]/60 overflow-hidden rounded-b-lg">
            <p className="text-[10px] text-gray-600 mb-2">Prévia WhatsApp</p>
            <WhatsAppPreviewBubble text={value} statusFont={showFontPicker ? font : undefined} />
          </div>
        )}
      </div>

      {maxLength != null && (
        <p className="text-[11px] mt-1 text-right text-gray-600">
          {value.length} / {maxLength}
        </p>
      )}
    </div>
  )
}
