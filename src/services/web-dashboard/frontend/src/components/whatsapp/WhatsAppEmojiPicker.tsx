import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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

const PANEL_WIDTH = 360
const PANEL_EST_HEIGHT = 340

type PanelPos = { left: number; top?: number; bottom?: number }

export function WhatsAppEmojiPicker({ disabled, onPick }: Props) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('recent')
  const [recent, setRecent] = useState<string[]>(() => loadRecentEmojis())
  const [panelPos, setPanelPos] = useState<PanelPos | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const updatePanelPos = () => {
    const btn = btnRef.current
    if (!btn) return

    const rect = btn.getBoundingClientRect()
    const width = Math.min(PANEL_WIDTH, window.innerWidth - 16)
    let left = rect.left
    if (left + width > window.innerWidth - 8) {
      left = window.innerWidth - width - 8
    }
    left = Math.max(8, left)

    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const openUp = spaceBelow < PANEL_EST_HEIGHT && spaceAbove > spaceBelow

    if (openUp) {
      setPanelPos({ left, bottom: window.innerHeight - rect.top + 6 })
    } else {
      setPanelPos({ left, top: rect.bottom + 6 })
    }
  }

  useLayoutEffect(() => {
    if (!open) {
      setPanelPos(null)
      return
    }
    updatePanelPos()
  }, [open])

  useEffect(() => {
    if (!open) return

    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        rootRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return
      }
      setOpen(false)
    }

    const onReposition = () => updatePanelPos()

    document.addEventListener('mousedown', onDoc)
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)

    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
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

  const panelWidth = Math.min(PANEL_WIDTH, typeof window !== 'undefined' ? window.innerWidth - 16 : PANEL_WIDTH)

  const panel =
    open && panelPos
      ? createPortal(
          <div
            ref={panelRef}
            style={{
              position: 'fixed',
              left: panelPos.left,
              top: panelPos.top,
              bottom: panelPos.bottom,
              width: panelWidth,
              zIndex: 9999,
            }}
            className="rounded-xl border border-gray-700 bg-gray-900 shadow-2xl shadow-black/50 flex flex-col overflow-hidden"
          >
            <div className="flex gap-0.5 px-1.5 py-1.5 border-b border-gray-800 overflow-x-auto shrink-0">
              {tabs.map(t => (
                <button
                  key={t.id}
                  type="button"
                  title={t.id === 'recent' ? 'Recentes' : undefined}
                  onClick={() => setTab(t.id)}
                  className={`shrink-0 w-9 h-9 rounded-lg text-lg leading-none transition-colors ${
                    tab === t.id ? 'bg-brand-600/30 ring-1 ring-brand-500/50' : 'hover:bg-gray-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div
              className="grid grid-cols-9 gap-1 p-2.5 overflow-y-auto overscroll-contain min-h-[220px] max-h-[min(340px,calc(100vh-96px))]"
              style={{ scrollbarWidth: 'thin' }}
            >
              {gridEmojis.length === 0 ? (
                <p className="col-span-9 text-center text-xs text-gray-500 py-10">
                  {tab === 'recent' ? 'Emojis recentes aparecem aqui' : 'Nenhum emoji'}
                </p>
              ) : (
                gridEmojis.map((emoji, i) => (
                  <button
                    key={`${tab}-${emoji}-${i}`}
                    type="button"
                    onClick={() => pick(emoji)}
                    className="h-9 w-full rounded-lg hover:bg-gray-800 text-xl leading-none transition-colors flex items-center justify-center"
                  >
                    {emoji}
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        title="Inserir emoji"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        className={`${toolbarBtn} ${open ? 'text-brand-400 bg-gray-800' : ''}`}
      >
        <Smile size={16} />
      </button>
      {panel}
    </div>
  )
}
