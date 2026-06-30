import { useEffect, useCallback } from 'react'

export interface InboxHotkeysOptions {
  enabled?: boolean
  conversationIds: string[]
  selectedId: string | null
  onSelectId: (id: string | null) => void
  onAssume: () => void
  canAssume: boolean
  onFocusComposer: () => void
  onShowHelp: () => void
  onEscape?: () => void
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return el.isContentEditable
}

export function useInboxHotkeys({
  enabled = true,
  conversationIds,
  selectedId,
  onSelectId,
  onAssume,
  canAssume,
  onFocusComposer,
  onShowHelp,
  onEscape,
}: InboxHotkeysOptions): void {
  const moveSelection = useCallback(
    (delta: number) => {
      if (!conversationIds.length) return
      const idx = selectedId ? conversationIds.indexOf(selectedId) : -1
      const nextIdx =
        idx < 0
          ? delta > 0
            ? 0
            : conversationIds.length - 1
          : Math.min(conversationIds.length - 1, Math.max(0, idx + delta))
      onSelectId(conversationIds[nextIdx] ?? null)
    },
    [conversationIds, selectedId, onSelectId],
  )

  useEffect(() => {
    if (!enabled) return

    const onKeyDown = (e: KeyboardEvent) => {
      const typing = isTypingTarget(e.target)
      const alt = e.altKey
      const ctrl = e.ctrlKey || e.metaKey

      if (e.key === 'Escape' && !typing) {
        onEscape?.()
        return
      }

      if ((e.key === '?' || (ctrl && e.key === '/')) && !typing) {
        e.preventDefault()
        onShowHelp()
        return
      }

      if (typing && !(alt && (e.key === 'ArrowDown' || e.key === 'ArrowUp'))) return

      if (alt && e.key === 'ArrowDown') {
        e.preventDefault()
        moveSelection(1)
        return
      }

      if (alt && e.key === 'ArrowUp') {
        e.preventDefault()
        moveSelection(-1)
        return
      }

      if (alt && (e.key === 'a' || e.key === 'A') && canAssume) {
        e.preventDefault()
        onAssume()
        return
      }

      if (alt && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault()
        onFocusComposer()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    enabled,
    moveSelection,
    onAssume,
    canAssume,
    onFocusComposer,
    onShowHelp,
    onEscape,
  ])
}
