const BASE = '/api'

function parseApiErrorBody(body: string, status: number): string {
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

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',          // always send session cookie
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(parseApiErrorBody(body, res.status))
  }
  return res.json()
}

export const api = {
  get:    <T>(path: string)                  => request<T>(path),
  post:   <T>(path: string, body?: unknown)  => request<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
  patch:  <T>(path: string, body?: unknown)  => request<T>(path, { method: 'PATCH',  body: JSON.stringify(body) }),
  put:    <T>(path: string, body?: unknown)  => request<T>(path, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: <T>(path: string)                  => request<T>(path, { method: 'DELETE' }),
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
