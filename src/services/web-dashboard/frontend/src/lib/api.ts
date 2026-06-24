const BASE = '/api'

function apiUrl(path: string, useSessionRoot = false): string {
  return useSessionRoot ? path : `${BASE}${path}`
}

function parseApiErrorBody(body: string, status: number): string {
  if (status === 503) {
    try {
      const parsed = JSON.parse(body) as { error?: string; message?: string }
      if (parsed.error === 'backend_offline') {
        return 'backend_offline'
      }
    } catch {
      /* ignore */
    }
  }
  if (status === 413) {
    return 'Arquivo muito grande para enviar. Divida o VCF/CSV ou use menos contatos por vez.'
  }
  if (status === 502) {
    return 'Servidor indisponível ou tempo esgotado. Confira se `npm run dev` está rodando e reconecte o WhatsApp em Conexão.'
  }
  try {
    const parsed = JSON.parse(body) as { error?: string; message?: string }
    return parsed.error ?? parsed.message ?? body
  } catch {
    if (/<html|<!DOCTYPE|<pre/i.test(body)) {
      const pre = /<pre[^>]*>([\s\S]*?)<\/pre>/i.exec(body)
      const raw = (pre?.[1] ?? body).replace(/<br\s*\/?>/gi, '\n').replace(/&nbsp;/g, ' ')
      const firstLine = raw.split('\n').map((l) => l.trim()).find(Boolean)
      return firstLine ?? `Erro HTTP ${status}`
    }
    return body || `HTTP ${status}`
  }
}

async function request<T>(
  path: string,
  options?: RequestInit & { sessionRoot?: boolean; timeoutMs?: number },
): Promise<T> {
  const { sessionRoot, timeoutMs = 30_000, signal: externalSignal, ...fetchOptions } = options ?? {}
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  const onExternalAbort = () => controller.abort()
  externalSignal?.addEventListener('abort', onExternalAbort)

  let res: Response
  try {
    res = await fetch(apiUrl(path, sessionRoot), {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      ...fetchOptions,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(
        'Tempo esgotado aguardando a API. Confira se `npm run dev` está rodando e recarregue a página.',
      )
    }
    throw new Error(
      'Falha de conexão com a API. Confira se `npm run dev` está rodando e recarregue a página.',
    )
  } finally {
    window.clearTimeout(timer)
    externalSignal?.removeEventListener('abort', onExternalAbort)
  }
  if (!res.ok) {
    const body = await res.text()
    throw new Error(parseApiErrorBody(body, res.status))
  }
  return res.json()
}

export const api = {
  get:    <T>(path: string, opts?: { timeoutMs?: number }) =>
    request<T>(path, opts),
  post:   <T>(path: string, body?: unknown, opts?: { timeoutMs?: number }) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body), ...opts }),
  patch:  <T>(path: string, body?: unknown, opts?: { timeoutMs?: number }) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body), ...opts }),
  put:    <T>(path: string, body?: unknown, opts?: { timeoutMs?: number }) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body), ...opts }),
  delete: <T>(path: string, opts?: { timeoutMs?: number }) =>
    request<T>(path, { method: 'DELETE', ...opts }),
}

/** Rotas de sessão montadas em `/auth/*` (não em `/api`). */
export const sessionApi = {
  get:    <T>(path: string)                  => request<T>(path, { sessionRoot: true }),
  post:   <T>(path: string, body?: unknown)  =>
    request<T>(path, { sessionRoot: true, method: 'POST', body: JSON.stringify(body) }),
  patch:  <T>(path: string, body?: unknown)  =>
    request<T>(path, { sessionRoot: true, method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string)                  => request<T>(path, { sessionRoot: true, method: 'DELETE' }),
}

/** Download binário/texto (ex.: export CSV) com cookie de sessão */
export async function downloadFile(path: string, fallbackName = 'download.csv'): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include' })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(parseApiErrorBody(body, res.status))
  }
  const blob = await res.blob()
  const disp = res.headers.get('Content-Disposition') ?? ''
  const match = /filename="?([^";]+)"?/i.exec(disp)
  const name = match?.[1] ?? fallbackName
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
