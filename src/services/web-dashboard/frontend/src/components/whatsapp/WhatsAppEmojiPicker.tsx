import { useEffect, useRef, useState } from 'react'
import { Smile } from 'lucide-react'
import {
  loadRecentEmojis,
  pushRecentEmoji,
  WA_EMOJI_CATEGORIES,
} from '../../lib/whatsapp-emojis'

interface Props {
  disabled?: boolean
  onPick: (emoji: string) => void
}

export function WhatsAppEmojiPicker({ disabled, onPick }: Props) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('recent')
  const [recent, setRecent] = useState<string[]>(() => loadRecentEmojis())
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const pick = (emoji: string) => {
    setRecent(pushRecentEmoji(emoji))
    onPick(emoji)
    setOpen(false)
  }

  const tabs = [
    { id: 'recent', label: '🕐' },
    ...WA_EMOJI_CATEGORIES.map(c => ({ id: c.id, label: c.label })),
  ]

  const gridEmojis =
    tab === 'recent'
      ? recent
      : (WA_EMOJI_CATEGORIES.find(c => c.id === tab)?.emojis ?? [])

  const toolbarBtn =
    'p-1.5 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-800 disabled:opacity-40 transition-colors'

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        title="Inserir emoji"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        className={`${toolbarBtn} ${open ? 'text-brand-400 bg-gray-800' : ''}`}
      >
        <Smile size={15} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-[min(320px,calc(100vw-2rem))] rounded-xl border border-gray-700 bg-gray-900 shadow-xl overflow-hidden">
          <div className="flex gap-0.5 px-1 py-1 border-b border-gray-800 overflow-x-auto">
            {tabs.map(t => (
              <button
                key={t.id}
                type="button"
                title={t.id === 'recent' ? 'Recentes' : undefined}
                onClick={() => setTab(t.id)}
                className={`shrink-0 w-8 h-8 rounded-lg text-base leading-none transition-colors ${
                  tab === t.id ? 'bg-brand-600/30 ring-1 ring-brand-500/50' : 'hover:bg-gray-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-8 gap-0.5 p-2 max-h-44 overflow-y-auto">
            {gridEmojis.length === 0 ? (
              <p className="col-span-8 text-center text-[11px] text-gray-600 py-6">
                {tab === 'recent' ? 'Emojis recentes aparecem aqui' : 'Nenhum emoji'}
              </p>
            ) : (
              gridEmojis.map((emoji, i) => (
                <button
                  key={`${tab}-${emoji}-${i}`}
                  type="button"
                  onClick={() => pick(emoji)}
                  className="h-8 w-full rounded-md hover:bg-gray-800 text-lg leading-none transition-colors"
                >
                  {emoji}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
