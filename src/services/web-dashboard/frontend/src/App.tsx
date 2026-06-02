import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import Sessions from './pages/Sessions'
import Rules from './pages/Rules'
import Templates from './pages/Templates'
import Queue from './pages/Queue'
import Logs from './pages/Logs'
import TestSend from './pages/TestSend'
import Destinations from './pages/Destinations'
import Channels from './pages/Channels'
import Plans from './pages/Plans'
import Settings from './pages/Settings'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminClients from './pages/admin/AdminClients'
import Login from './pages/Login'
import { getMe, type AuthUser } from './lib/auth'
import { Spinner } from './components/ui/Spinner'

export const AuthContext = { user: null as AuthUser | null }

function Guard({ user, path, children }: { user: AuthUser; path: string; children: React.ReactNode }) {
  return <ProtectedRoute user={user} path={path}>{children}</ProtectedRoute>
}

export default function App() {
  const [user, setUser]       = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const urlError = new URLSearchParams(window.location.search).get('error') ?? undefined

  useEffect(() => {
    getMe().then(u => { setUser(u); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <Spinner size={32} />
      </div>
    )
  }

  if (!user) return <Login error={urlError} />

  AuthContext.user = user
  const home = user.isInternalStaff ? '/admin/dashboard' : '/dashboard'

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout user={user} onLogout={() => setUser(null)} />}>
          <Route index element={<Navigate to={home} replace />} />

          {/* Cliente */}
          <Route path="dashboard" element={<Guard user={user} path="/dashboard"><Dashboard /></Guard>} />
          <Route path="sessions" element={<Guard user={user} path="/sessions"><Sessions /></Guard>} />
          <Route path="channels" element={<Guard user={user} path="/channels"><Channels /></Guard>} />
          <Route path="destinations" element={<Guard user={user} path="/destinations"><Destinations /></Guard>} />
          <Route path="rules" element={<Guard user={user} path="/rules"><Rules /></Guard>} />
          <Route path="templates" element={<Guard user={user} path="/templates"><Templates /></Guard>} />
          <Route path="queue" element={<Guard user={user} path="/queue"><Queue /></Guard>} />
          <Route path="logs" element={<Guard user={user} path="/logs"><Logs /></Guard>} />
          <Route path="test-send" element={<Guard user={user} path="/test-send"><TestSend /></Guard>} />
          <Route path="plans" element={<Guard user={user} path="/plans"><Plans user={user} /></Guard>} />
          <Route path="settings" element={<Guard user={user} path="/settings"><Settings user={user} /></Guard>} />

          {/* Admin interno */}
          <Route path="admin/dashboard" element={<Guard user={user} path="/admin/dashboard"><AdminDashboard /></Guard>} />
          <Route path="admin/clients" element={<Guard user={user} path="/admin/clients"><AdminClients /></Guard>} />
          <Route path="admin/servers" element={<Guard user={user} path="/admin/servers"><AdminDashboard title="Servidores" /></Guard>} />
          <Route path="admin/sessions" element={<Guard user={user} path="/admin/sessions"><Sessions /></Guard>} />
          <Route path="admin/queue" element={<Guard user={user} path="/admin/queue"><Queue /></Guard>} />
          <Route path="admin/logs" element={<Guard user={user} path="/admin/logs"><Logs /></Guard>} />
          <Route path="admin/plans" element={<Guard user={user} path="/admin/plans"><Plans user={user} admin /></Guard>} />
          <Route path="admin/payments" element={<Guard user={user} path="/admin/payments"><AdminDashboard title="Pagamentos" /></Guard>} />
          <Route path="admin/moderation" element={<Guard user={user} path="/admin/moderation"><AdminDashboard title="Moderação" /></Guard>} />
          <Route path="admin/audit" element={<Guard user={user} path="/admin/audit"><AdminDashboard title="Auditoria" /></Guard>} />
          <Route path="admin/api" element={<Guard user={user} path="/admin/api"><AdminDashboard title="API Global" /></Guard>} />
          <Route path="admin/settings" element={<Guard user={user} path="/admin/settings"><AdminDashboard title="Configurações do Sistema" /></Guard>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
