const BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',          // always send session cookie
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.text()
    let message = body || `HTTP ${res.status}`
    if (res.status === 502) {
      message =
        'Servidor indisponível ou tempo esgotado. Confira se `npm run dev` está rodando e reconecte o WhatsApp em Conexão.'
    } else {
      try {
        const parsed = JSON.parse(body) as { error?: string; message?: string }
        message = parsed.error ?? parsed.message ?? message
      } catch {
        /* corpo não é JSON */
      }
    }
    throw new Error(message)
  }
  return res.json()
}

export const api = {
  get:    <T>(path: string)                  => request<T>(path),
  post:   <T>(path: string, body?: unknown)  => request<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:    <T>(path: string, body?: unknown)  => request<T>(path, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: <T>(path: string)                  => request<T>(path, { method: 'DELETE' }),
}
