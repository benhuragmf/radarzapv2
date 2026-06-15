import { toast as sonnerToast } from 'sonner'

/** Toasts via Sonner — use somente após resposta real da API ou em falha confirmada. */

export function toastSuccess(message: string): void {
  const text = message.trim()
  if (!text) return
  sonnerToast.success(text)
}

export function toastError(message: string): void {
  const text = message.trim()
  if (!text) return
  sonnerToast.error(text)
}

export function toastInfo(message: string): void {
  const text = message.trim()
  if (!text) return
  sonnerToast.info(text)
}

export function toastLoading(message: string): string | number {
  return sonnerToast.loading(message.trim() || 'Processando…')
}

export function toastDismiss(id?: string | number): void {
  sonnerToast.dismiss(id)
}

export { toast as sonnerToast } from 'sonner'
