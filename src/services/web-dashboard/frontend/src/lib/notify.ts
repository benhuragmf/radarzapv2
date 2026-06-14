/** Feedback global — usa toast quando ToastProvider está montado; fallback alert. */

type Handlers = {
  success: (msg: string) => void
  error: (msg: string) => void
  info: (msg: string) => void
}

let handlers: Handlers | null = null

export function registerNotifyHandlers(next: Handlers | null): void {
  handlers = next
}

function fallback(msg: string): void {
  if (typeof window !== 'undefined') window.alert(msg)
}

export function notifySuccess(message: string): void {
  handlers?.success(message) ?? fallback(message)
}

export function notifyError(message: string): void {
  handlers?.error(message) ?? fallback(message)
}

export function notifyInfo(message: string): void {
  handlers?.info(message) ?? fallback(message)
}

/** Helper para onError de mutations TanStack Query. */
export function mutationError(err: unknown): void {
  notifyError(err instanceof Error ? err.message : String(err))
}
