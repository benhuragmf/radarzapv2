/** Feedback global — Sonner (sem alert nativo do navegador). */

import { toastError, toastInfo, toastSuccess } from '@/design-system/toast'

export const API_OFFLINE_MESSAGE =
  'Servidor reiniciando ou offline. Aguarde alguns segundos e tente novamente.'

const OFFLINE_HINTS = [
  'backend_offline',
  'api indisponível',
  'npm run dev',
  'falha de conexão com a api',
  'servidor indisponível',
  'confira se `npm run dev`',
]

const DEDUPE_MS = 5_000
const lastShownAt = new Map<string, number>()

function isOfflineError(message: string): boolean {
  const lower = message.toLowerCase()
  return OFFLINE_HINTS.some(h => lower.includes(h))
}

function errorDedupeKey(message: string): string {
  if (isOfflineError(message)) return 'rz-api-offline'
  return `rz-err:${message.slice(0, 120)}`
}

export function humanizeApiError(message: string): string {
  if (isOfflineError(message)) return API_OFFLINE_MESSAGE
  return message.trim()
}

function shouldShow(key: string): boolean {
  const now = Date.now()
  const prev = lastShownAt.get(key)
  if (prev != null && now - prev < DEDUPE_MS) return false
  lastShownAt.set(key, now)
  return true
}

/** Mensagem padrão após salvar formulários de configuração no painel. */
export const CONFIG_SAVED_MESSAGE = 'Configurações salvas'

export function notifyConfigSaved(message: string = CONFIG_SAVED_MESSAGE): void {
  notifySuccess(message)
}

export function notifySuccess(message: string): void {
  toastSuccess(message)
}

export function notifyError(message: string): void {
  const text = humanizeApiError(message)
  const key = errorDedupeKey(message)
  if (!shouldShow(key)) return
  toastError(text, key)
}

export function notifyInfo(message: string): void {
  toastInfo(message)
}

/** @deprecated Mantido só por compatibilidade; notify usa Sonner diretamente. */
export function registerNotifyHandlers(_next: unknown): void {
  /* noop */
}

/** Helper para onError de mutations TanStack Query. */
export function mutationError(err: unknown): void {
  const raw = err instanceof Error ? err.message : String(err)
  notifyError(raw)
}
