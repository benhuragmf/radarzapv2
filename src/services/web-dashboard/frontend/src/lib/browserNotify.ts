export interface BrowserNotifyOptions {
  title: string
  body?: string
  href?: string
  tag?: string
  /** Não exibir se a aba está visível e o usuário já está nesta conversa. */
  skipWhenViewingConversationId?: string | null
  viewingConversationId?: string | null
}

function shouldSkipVisibleTab(options: BrowserNotifyOptions): boolean {
  if (typeof document === 'undefined') return true
  if (document.visibilityState !== 'visible') return false
  const convId = options.viewingConversationId
  const skipId = options.skipWhenViewingConversationId
  if (convId && skipId && convId === skipId) return true
  return false
}

export function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  const current = getBrowserNotificationPermission()
  if (current === 'unsupported' || current !== 'default') return current
  try {
    return await Notification.requestPermission()
  } catch {
    return current
  }
}

export function showBrowserNotification(options: BrowserNotifyOptions): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (shouldSkipVisibleTab(options)) return

  const body = options.body?.trim().slice(0, 200) || undefined
  const show = () => {
    try {
      const n = new Notification(options.title, {
        body,
        tag: options.tag,
        icon: '/favicon.svg',
      })
      if (options.href) {
        n.onclick = () => {
          window.focus()
          if (options.href!.startsWith('http')) {
            window.location.href = options.href!
          } else {
            window.location.assign(options.href!)
          }
          n.close()
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (Notification.permission === 'granted') {
    show()
    return
  }
  if (Notification.permission !== 'denied') {
    void requestBrowserNotificationPermission().then(p => {
      if (p === 'granted') show()
    })
  }
}
