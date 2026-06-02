import { Navigate } from 'react-router-dom'
import type { AuthUser } from '../lib/auth'
import { can } from '../lib/auth'
import { ROUTE_PERMISSIONS } from '../lib/navConfig'

interface Props {
  user: AuthUser
  path: string
  children: React.ReactNode
}

export default function ProtectedRoute({ user, path, children }: Props) {
  const permission = ROUTE_PERMISSIONS[path]
  if (permission && !can(user, permission)) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}
