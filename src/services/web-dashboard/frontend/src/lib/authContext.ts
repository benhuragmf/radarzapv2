import type { AuthUser } from './auth'

/** Estado global de auth (fora de App.tsx para compatibilidade com React Fast Refresh). */
export const AuthContext = { user: null as AuthUser | null }
