export interface AuthUser {
  userId: string
  discordId: string
  username: string
  avatar: string | null
}

export async function getMe(): Promise<AuthUser | null> {
  try {
    const res = await fetch('/auth/me', { credentials: 'include' })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export function loginWithDiscord() {
  window.location.href = '/auth/discord'
}

export async function logout() {
  await fetch('/auth/logout', { method: 'POST', credentials: 'include' })
  window.location.href = '/'
}
